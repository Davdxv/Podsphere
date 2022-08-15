import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { ToastContext } from './toast';
import useRerenderEffect from '../hooks/use-rerender-effect';
import {
  fetchPodcastRss2Feed,
  getNewPodcastIds,
  NewIdMapping,
  refreshSubscriptions,
  updatePodcastIds,
} from '../client';
import {
  unixTimestamp,
  hasMetadata,
  concatMessages,
} from '../utils';
import {
  ArSyncTx,
  Episode,
  EpisodesDBTable,
  Podcast,
} from '../client/interfaces';
import { IndexedDb } from '../indexed-db';
import {
  initializeIdCache,
  metadataToIdMappings,
} from '../client/arweave/cache/podcast-id';
import { sanitizeUri } from '../client/metadata-filtering';

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
  readCachedArSyncTxs: () => Promise<ArSyncTx[]>,
  writeCachedArSyncTxs: (newValue: ArSyncTx[]) => Promise<void>,
  dbStatus: DBStatus,
  setDbStatus: (value: DBStatus) => void,
}

export enum DBStatus {
  UNINITIALIZED,
  INITIALIZING1,
  INITIALIZING2,
  INITIALIZING3, // 'subscriptions' and 'metadataToSync' initialized
  INITIALIZED, // 'subscriptions', 'metadataToSync' and 'transactionHistory' (arSyncTxs) initialized
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
  readCachedArSyncTxs: async () => [],
  writeCachedArSyncTxs: async () => {},
  dbStatus: 0,
  setDbStatus: () => {},
});

const DB_SUBSCRIPTIONS = IndexedDb.SUBSCRIPTIONS;
const DB_EPISODES = IndexedDb.EPISODES;
const DB_METADATATOSYNC = IndexedDb.METADATATOSYNC;
const DB_ARSYNCTXS = IndexedDb.TX_HISTORY;

const db = new IndexedDb();

// declare global {
//   interface Window {
//     idb : IndexedDb;
//   }
// }
// window.idb = db;

async function readCachedPodcasts() : Promise<Podcast[]> {
  const readPodcasts : Podcast[] = [];

  let cachedSubscriptions : Podcast[] = [];
  let cachedEpisodes : EpisodesDBTable[] = [];
  [cachedSubscriptions, cachedEpisodes] = await Promise.all([db.getAllValues(DB_SUBSCRIPTIONS),
    db.getAllValues(DB_EPISODES)]);

  cachedSubscriptions.forEach(sub => {
    const episodesTable : EpisodesDBTable | undefined = cachedEpisodes
      .find(table => table.id === sub.id);
    const episodes = episodesTable ? episodesTable.episodes : [];
    const podcast : Podcast = { ...sub, episodes };
    readPodcasts.push(podcast);
  });

  return readPodcasts;
}

async function writeCachedPodcasts(subscriptions: Podcast[]) : Promise<string[]> {
  const errorMessages : string[] = [];

  await Promise.all(subscriptions.map(async sub => {
    try {
      const { episodes, ...podcast } = sub;
      const cachedSub : Podcast = await db.getByPodcastId(DB_SUBSCRIPTIONS, podcast.id);

      if (!cachedSub || cachedSub.lastMutatedAt !== podcast.lastMutatedAt) {
        await removeCachedSubscription(podcast.feedUrl);
        const episodesTable : EpisodesDBTable = {
          id: podcast.id,
          episodes: episodes as Episode[],
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

async function readCachedMetadataToSync() : Promise<Partial<Podcast>[]> {
  const fetchedData : Partial<Podcast>[] = await db.getAllValues(DB_METADATATOSYNC);
  return fetchedData;
}

/**
 * `metadataToSync` is updated on each subscriptions refresh, but we still cache it, because f.i. it
 * contains any pending user posts.
 * @param newValue
 * @throws
 */
async function writeCachedMetadataToSync(newValue: Partial<Podcast>[]) {
  await db.clearAllValues(DB_METADATATOSYNC);
  await db.putValues(DB_METADATATOSYNC, newValue);
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
      let newIdsToRefresh = null;
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

  const readCachedArSyncTxs = async () : Promise<ArSyncTx[]> => {
    const fetchedData : ArSyncTx[] = await db.getAllValues(DB_ARSYNCTXS);
    return fetchedData;
  };

  const writeCachedArSyncTxs = async (newValue: ArSyncTx[]) => {
    await db.clearAllValues(DB_ARSYNCTXS);
    await db.putValues(DB_ARSYNCTXS, newValue);
  };

  useEffect(() => {
    const initializeSubscriptions = async () => {
      const initializePodcastIdCache = (metadata: Podcast[]) => {
        const cachedMappings = metadataToIdMappings(metadata);
        initializeIdCache(cachedMappings);
      };

      const fetchedData = await readCachedPodcasts();
      initializePodcastIdCache(fetchedData);
      setSubscriptions(fetchedData);
    };

    const initializeMetadataToSync = async () => {
      const fetchedData = await readCachedMetadataToSync();
      setMetadataToSync(fetchedData);
    };

    const initializeDatabase = async () => {
      setDbStatus(DBStatus.INITIALIZING1);

      try {
        await db.initializeDBSchema();
        await initializeSubscriptions();
        await initializeMetadataToSync();
      }
      catch (ex) {
        const errorMessage = 'An error occurred while fetching the cached subscriptions from '
          + `IndexedDB:\n${(ex as Error).message}\n${IndexedDb.DB_ERROR_GENERIC_HELP_MESSAGE}`;
        console.error(errorMessage);
        toast(errorMessage, { autohideDelay: 0, variant: 'danger' });
      }
    };

    if (dbStatus === DBStatus.UNINITIALIZED) initializeDatabase();
  }, [dbStatus, toast]);

  useRerenderEffect(() => {
    const updateCachedPodcasts = async () => {
      const errorMessages = await writeCachedPodcasts(subscriptions);
      if (errorMessages.length) {
        const errorMessage = 'Some subscriptions failed to be cached into IndexedDB:\n'
          + `${IndexedDb.DB_ERROR_GENERIC_HELP_MESSAGE}\n${concatMessages(errorMessages)}`;
        console.error(errorMessage);
        toast(errorMessage, { autohideDelay: 0, variant: 'danger' });
      }
    };

    console.debug('subscriptions have been updated to:', subscriptions);
    if (dbStatus >= DBStatus.INITIALIZED) updateCachedPodcasts();
    else setDbStatus(prev => Math.min(prev + 1, DBStatus.INITIALIZING3));
  }, [subscriptions]);

  useRerenderEffect(() => {
    const updateCachedMetadataToSync = async () => {
      await writeCachedMetadataToSync(metadataToSync);
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
        readCachedArSyncTxs,
        writeCachedArSyncTxs,
        dbStatus,
        setDbStatus,
      }}
    >
      {children}
    </SubscriptionsContext.Provider>
  );
};

export default SubscriptionsProvider;
