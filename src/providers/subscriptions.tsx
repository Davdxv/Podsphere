import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import dedent from 'dedent';
import { ToastContext } from './toast';
import useRerenderEffect from '../hooks/use-rerender-effect';
import {
  fetchPodcastRss2Feed,
  getNewPodcastIds,
  NewIdMapping,
  pingTxIds,
  refreshSubscriptions,
  updatePodcastIds,
} from '../client';
import {
  unixTimestamp,
  hasMetadata,
  concatMessages,
  podcastsFromDTO,
} from '../utils';
import {
  ArSyncTxDTO,
  CachedArTx,
  EpisodesDBTable,
  Podcast,
  PodcastDTO,
} from '../client/interfaces';
import { sanitizeUri } from '../client/metadata-filtering';
import { usingArLocal } from '../client/arweave/utils';
import { IndexedDb } from '../indexed-db';
import {
  initializeIdCache,
  metadataToIdMappings,
} from '../client/arweave/cache/podcast-id';
import {
  initializeTxCache,
  isNotBlocked,
  removeTxIds as removeTxIdsFromTxCache,
  removeUnsubscribedIds as removeUnsubscribedIdsFromTxCache,
  txCache,
} from '../client/arweave/cache/transactions';

if (usingArLocal()) {
  console.debug('Seeded arlocal podcast feeds:\n', dedent`
    https://feeds.simplecast.com/dHoohVNH
     https://thejimmydoreshow.libsyn.com/rss
     https://feeds.megaphone.fm/ADV2256857693
     https://lexfridman.com/feed/podcast
  `);
}

interface SubscriptionContextType {
  subscriptions: Podcast[],
  isRefreshing: boolean,
  lastRefreshTime: number,
  subscribe: (id: string) => Promise<boolean>,
  unsubscribe: (id: string) => Promise<void>,
  refresh: (idsToRefresh?: Podcast['id'][] | null, silent?: boolean,
    maxLastRefreshAge?: number) => Promise<[null, null] | [Podcast[], Partial<Podcast>[]]>,
  metadataToSync: Partial<Podcast>[],
  setMetadataToSync: (value: Partial<Podcast>[]) => void,
  dbReadCachedArSyncTxs: () => Promise<ArSyncTxDTO[]>,
  dbWriteCachedArSyncTxs: (newValue: ArSyncTxDTO[]) => Promise<void>,
  dbStatus: DBStatus,
  setDbStatus: (value: DBStatus) => void,
}

export enum DBStatus {
  UNINITIALIZED,
  INITIALIZING1, // initializing db schema, subscriptions, transactionCache, metadataToSync
  INITIALIZING2, // transactionCache + (subscriptions or metadataToSync) initialized
  INITIALIZING3, // transactionCache + subscriptions + metadataToSync initialized
  INITIALIZED, // transactionCache + subscriptions + metadataToSync + transactionHistory initialized
}

export const SubscriptionsContext = createContext<SubscriptionContextType>({
  subscriptions: [],
  isRefreshing: false,
  lastRefreshTime: 0,
  subscribe: async () => false,
  unsubscribe: async () => {},
  refresh: async () => [null, null],
  metadataToSync: [],
  setMetadataToSync: () => {},
  dbReadCachedArSyncTxs: async () => [],
  dbWriteCachedArSyncTxs: async () => {},
  dbStatus: 0,
  setDbStatus: () => {},
});

const DB_SUBSCRIPTIONS = IndexedDb.SUBSCRIPTIONS;
const DB_EPISODES = IndexedDb.EPISODES;
const DB_METADATATOSYNC = IndexedDb.METADATATOSYNC;
/** @see ArweaveProvider */
const DB_ARSYNCTXS = IndexedDb.TX_HISTORY;
const DB_TX_CACHE = IndexedDb.TX_CACHE;

export interface SchemaType {
  metadataToSync: Partial<PodcastDTO>[];
  transactionHistory: ArSyncTxDTO[];
  episodes: EpisodesDBTable[];
  subscriptions: PodcastDTO[]
}

export const db = new IndexedDb();

// declare global {
//   interface Window {
//     idb : IndexedDb;
//   }
// }
// if (typeof window !== 'undefined') window.idb = db;

async function dbReadCachedPodcasts() : Promise<PodcastDTO[]> {
  const readPodcasts : PodcastDTO[] = [];

  let cachedSubscriptions : SchemaType[typeof DB_SUBSCRIPTIONS] = [];
  let cachedEpisodes : SchemaType[typeof DB_EPISODES] = [];
  [cachedSubscriptions, cachedEpisodes] = await Promise.all([db.getAllValues(DB_SUBSCRIPTIONS),
    db.getAllValues(DB_EPISODES)]);

  cachedSubscriptions.forEach(sub => {
    const episodesTable : EpisodesDBTable | undefined = cachedEpisodes
      .find(table => table.id === sub.id);
    const episodes = episodesTable ? episodesTable.episodes : [];
    const podcast = { ...sub, episodes };
    readPodcasts.push(podcast);
  });

  return readPodcasts;
}

async function dbWriteCachedPodcasts(subscriptions: Podcast[]) : Promise<string[]> {
  const errorMessages : string[] = [];

  await Promise.all(subscriptions.map(async sub => {
    try {
      const { episodes, ...podcast } = sub;
      const cachedSub : Podcast = await db.getByPodcastId(DB_SUBSCRIPTIONS, podcast.id);

      if (!cachedSub || cachedSub.lastMutatedAt !== podcast.lastMutatedAt) {
        await removeCachedSubscription(podcast.feedUrl);
        const episodesTable = {
          id: podcast.id,
          episodes,
        };
        await db.putValue(DB_SUBSCRIPTIONS, podcast);
        await db.putValue(DB_EPISODES, episodesTable);
      }
    }
    catch (ex) {
      errorMessages.push(`${ex}`);
    }
  }));

  return errorMessages;
}

async function dbReadCachedMetadataToSync() : Promise<Partial<PodcastDTO>[]> {
  const fetchedData : SchemaType[typeof DB_METADATATOSYNC] = await db
    .getAllValues(DB_METADATATOSYNC);
  return fetchedData;
}

/**
 * `metadataToSync` is updated on each subscriptions refresh, but we still cache it, because f.i. it
 * contains any pending user posts.
 * @param newValue
 * @throws
 */
async function dbWriteCachedMetadataToSync(newValue: Partial<Podcast>[]) {
  if (Array.isArray(newValue)) {
    await db.clearAllValues(DB_METADATATOSYNC);
    await db.putValues(DB_METADATATOSYNC, newValue);
  }
}

async function dbReadCachedTransactions() : Promise<CachedArTx[]> {
  const fetchedData : CachedArTx[] = await db.getAllValues(DB_TX_CACHE);
  return fetchedData;
}

async function dbWriteCachedTransactions(newValue: CachedArTx[]) {
  if (Array.isArray(newValue)) {
    await db.clearAllValues(DB_TX_CACHE);
    await db.putValues(DB_TX_CACHE, newValue);
  }
}

async function removeCachedSubscription(feedUrl: Podcast['feedUrl']) {
  try {
    const id = await db.getIdFromFeedUrl(feedUrl);
    if (id && typeof id === 'string') {
      await db.deleteSubscription(DB_SUBSCRIPTIONS, id);
      await db.deleteSubscription(DB_EPISODES, id);
    }
  }
  catch (ex) {
    console.error(ex);
  }
}

// TODO: ArSync v1.5+, test me
const SubscriptionsProvider : React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useContext(ToastContext);
  const [dbStatus, setDbStatus] = useState(DBStatus.UNINITIALIZED);
  const [subscriptions, setSubscriptions] = useState<Podcast[]>([]);
  const [metadataToSync, setMetadataToSync] = useState<Partial<Podcast>[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  async function subscribe(feedUrl: Podcast['feedUrl']) {
    let validUrl = '';
    try {
      validUrl = sanitizeUri(feedUrl, true);
    }
    catch (ex) {
      toast(`Unable to subscribe: ${(ex as Error).message}`, { variant: 'danger' });
      return false;
    }

    if (subscriptions.some(subscription => subscription.feedUrl === validUrl)) {
      toast(`You are already subscribed to ${validUrl}.`, { variant: 'danger' });
      return true;
    }

    const { errorMessage,
      newPodcastMetadata,
      newPodcastMetadataToSync } = await fetchPodcastRss2Feed(validUrl, metadataToSync);

    if (hasMetadata(newPodcastMetadata)) {
      toast(`Successfully subscribed to ${newPodcastMetadata.title}.`, { variant: 'success' });

      setMetadataToSync(prev => prev.filter(podcast => podcast.feedUrl !== validUrl)
        .concat(hasMetadata(newPodcastMetadataToSync) ? newPodcastMetadataToSync : []));
      setSubscriptions(prev => prev.concat(newPodcastMetadata));

      return true;
    }
    if (errorMessage) toast(`${errorMessage}`, { variant: 'danger' });

    return false; // TODO: don't clear text field if returns false
  }

  async function unsubscribe(feedUrl: Podcast['feedUrl']) {
    // TODO: warn if feedUrl has pending metadataToSync
    //       currently, any pending metadataToSync is left but does not survive a refresh
    if (subscriptions.every(subscription => subscription.feedUrl !== feedUrl)) {
      toast(`You are not subscribed to ${feedUrl}.`, { variant: 'danger' });
    }
    else {
      await removeCachedSubscription(feedUrl);
      setSubscriptions(prev => prev.filter(podcast => podcast.feedUrl !== feedUrl));
    }
  }

  /**
   * TODO: Upon implementation of user-selection from multiple metadata sets per subscription:
   *   - The user-disabled transactions should be reflected in the txCache as
   *     CachedArTx.blockedTx = true.
   *   - The podcast idCache can simply be reinitialized from subscriptions.
   * @param idsToRefresh If `null`, all subscriptions are refreshed
   * @param silent If true, toasts are skipped
   * @param maxLastRefreshAge Only refresh if the last refresh occurred over `maxLastRefreshAge`
   *   seconds ago. If 0, refresh regardless.
   * @returns An array with the resulting subscriptions and metadataToSync
   */
  const refresh = async (
    idsToRefresh: Podcast['id'][] | null = null,
    silent = false,
    maxLastRefreshAge = 1,
  ) : Promise<[null, null] | [Podcast[], Partial<Podcast>[]]> => {
    if (isRefreshing) return [null, null];
    if (getLastRefreshAge() <= maxLastRefreshAge) return [subscriptions, metadataToSync];

    setIsRefreshing(true);
    try {
      const newIdMappings : NewIdMapping[] = await getNewPodcastIds(subscriptions);
      const subscriptionsWithNewIds = updatePodcastIds(subscriptions, newIdMappings);
      const metadataToSyncWithNewIds = updatePodcastIds(metadataToSync, newIdMappings);
      let newIdsToRefresh = idsToRefresh;
      if (idsToRefresh !== null) {
        newIdsToRefresh = idsToRefresh.map(oldId => {
          const mapping = newIdMappings.find(newMapping => newMapping.oldId === oldId);
          return mapping && mapping.newId ? mapping.newId : oldId;
        });
      }

      const { errorMessages, newSubscriptions, newMetadataToSync } = await refreshSubscriptions(
        subscriptionsWithNewIds,
        metadataToSyncWithNewIds,
        newIdsToRefresh,
      );

      setLastRefreshTime(unixTimestamp());
      setSubscriptions(newSubscriptions);
      setMetadataToSync(newMetadataToSync);
      setIsRefreshing(false);

      if (!silent) {
        if (errorMessages.length) {
          toast(
            `Refresh completed with some errors:\n${concatMessages(errorMessages)}`,
            { autohideDelay: 10000, variant: 'warning' },
          );
        }
        else toast('Refresh successful.', { variant: 'success' });
      }

      return [newSubscriptions, newMetadataToSync];
    }
    catch (ex) {
      console.error(ex);
      if (!silent) {
        toast(
          `Failed to refresh subscriptions, please try again; ${ex}`,
          { autohideDelay: 10000, variant: 'danger' },
        );
      }
    }
    finally {
      setIsRefreshing(false);
    }
    return [null, null];
  };

  /**
   * @returns The number of seconds since the last refresh
   */
  function getLastRefreshAge() : number {
    if (!lastRefreshTime) return Infinity;

    return Math.max(0, unixTimestamp() - lastRefreshTime);
  }

  const dbReadCachedArSyncTxs = async () : Promise<ArSyncTxDTO[]> => {
    const fetchedData : SchemaType[typeof DB_ARSYNCTXS] = await db.getAllValues(DB_ARSYNCTXS);
    return fetchedData;
  };

  const dbWriteCachedArSyncTxs = async (newValue: ArSyncTxDTO[]) => {
    await db.clearAllValues(DB_ARSYNCTXS);
    await db.putValues(DB_ARSYNCTXS, newValue);
  };

  useEffect(() => {
    const initializeSubscriptions = async () => {
      const initializePodcastIdCache = (metadata: Podcast[]) => {
        const cachedMappings = metadataToIdMappings(metadata);
        initializeIdCache(cachedMappings);
      };

      const fetchedData = await dbReadCachedPodcasts();
      initializePodcastIdCache(podcastsFromDTO(fetchedData));
      setSubscriptions(podcastsFromDTO(fetchedData));
    };

    const initializeMetadataToSync = async () => {
      const fetchedData = await dbReadCachedMetadataToSync();
      setMetadataToSync(podcastsFromDTO(fetchedData));
    };

    const initializeCachedTransactions = async () => {
      const fetchedData = await dbReadCachedTransactions();
      initializeTxCache(fetchedData);
      console.debug('txCache initialized to:', txCache);
      if (usingArLocal()) {
        const downIds = await pingTxIds(txCache.filter(isNotBlocked).map(tx => tx.txId));
        removeTxIdsFromTxCache(downIds);
      }
    };

    const initializeDatabase = async () => {
      setDbStatus(DBStatus.INITIALIZING1);

      let errorMessageTable = DB_SUBSCRIPTIONS;
      try {
        await db.initializeDBSchema();
        await initializeSubscriptions();
        errorMessageTable = DB_METADATATOSYNC;
        await initializeMetadataToSync();
        errorMessageTable = DB_TX_CACHE;
        await initializeCachedTransactions();
      }
      catch (ex) {
        const errorMessage = `An error occurred while fetching the ${errorMessageTable} table from `
          + `IndexedDB:\n${(ex as Error).message}\n${IndexedDb.DB_ERROR_GENERIC_HELP_MESSAGE}`;
        console.error(errorMessage);
        toast(errorMessage, { autohideDelay: 0, variant: 'danger' });
      }
    };

    if (dbStatus === DBStatus.UNINITIALIZED) initializeDatabase();
  }, [dbStatus, toast]);

  useRerenderEffect(() => {
    const updateCachedPodcasts = async () => {
      const errorMessages = await dbWriteCachedPodcasts(subscriptions);
      if (errorMessages.length) {
        const errorMessage = 'Some subscriptions failed to be cached into IndexedDB:\n'
          + `${IndexedDb.DB_ERROR_GENERIC_HELP_MESSAGE}\n${concatMessages(errorMessages)}`;
        console.error(errorMessage);
        toast(errorMessage, { autohideDelay: 0, variant: 'danger' });
      }
    };

    const updateCachedTransactions = async (txCacheList : CachedArTx[]) => {
      await dbWriteCachedTransactions(txCacheList);
      console.debug('txCache written to IndexedDb:', txCacheList);
    };

    console.debug('subscriptions have been updated to:', subscriptions);
    if (dbStatus >= DBStatus.INITIALIZED) {
      updateCachedPodcasts();
      removeUnsubscribedIdsFromTxCache(subscriptions.map(sub => sub.id));
      updateCachedTransactions(txCache);
    }
    else setDbStatus(prev => Math.min(prev + 1, DBStatus.INITIALIZING3));
  }, [subscriptions]);

  useRerenderEffect(() => {
    const updateCachedMetadataToSync = async () => {
      await dbWriteCachedMetadataToSync(metadataToSync);
    };

    console.debug('metadataToSync has been updated to:', metadataToSync);
    if (dbStatus >= DBStatus.INITIALIZED) updateCachedMetadataToSync();
    else setDbStatus(prev => Math.min(prev + 1, DBStatus.INITIALIZING3));
  }, [metadataToSync]);

  return (
    <SubscriptionsContext.Provider
      value={{
        subscriptions,
        isRefreshing,
        lastRefreshTime,
        subscribe,
        unsubscribe,
        refresh,
        metadataToSync,
        setMetadataToSync,
        dbReadCachedArSyncTxs,
        dbWriteCachedArSyncTxs,
        dbStatus,
        setDbStatus,
      }}
    >
      {children}
    </SubscriptionsContext.Provider>
  );
};

export default SubscriptionsProvider;
