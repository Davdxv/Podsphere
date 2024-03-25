import { Podcast, Thread } from './interfaces';
import * as Arweave from './arweave';
import * as RSS from './rss';
import {
  addLastMutatedAt, findMetadataByFeedUrl, findMetadataById,
  hasMetadata, isEmpty, isValidUuid,
  partialToPodcast,
} from '../utils';
import {
  hasDiff,
  mergeBatchMetadata,
  mergePosts,
  rightDiff,
  simpleDiff,
} from './arweave/sync/diff-merge-logic';
import { findBestId } from '../podcast-id';
import { getPodcastId } from './arweave/cache/podcast-id';

export const { pingTxIds } = Arweave;

export type GetPodcastResult = {
  errorMessage?: string;
  newPodcastMetadata?: Podcast;
  newPodcastMetadataToSync?: Partial<Podcast>;
};

async function fetchRss2Feeds(feedUrl: Podcast['feedUrl'], title: Podcast['title']) {
  const [arweaveFeed, rssFeed] = await Promise.all([
    Arweave.getPodcastRss2Feed(feedUrl, title),
    RSS.getPodcastRss2Feed(feedUrl),
  ]);
  return {
    arweave: arweaveFeed,
    rss: rssFeed,
  };
}

export async function fetchPodcastById(
  id: Podcast['id'],
  feedType: Podcast['feedType'],
  subscriptions: Podcast[],
  metadataToSync: Partial<Podcast>[] = [],
) : Promise<GetPodcastResult> {
  if (feedType === 'rss2') {
    const { feedUrl, title } = findMetadataById(id, subscriptions);
    if (feedUrl) return fetchPodcastRss2Feed(feedUrl, metadataToSync, id, title);
  }
  return { errorMessage: `Could not find the feed url for Podcast with id ${id}` };
}

export async function fetchPodcastRss2Feed(
  feedUrl: Podcast['feedUrl'],
  metadataToSync: Partial<Podcast>[] = [],
  id: Podcast['id'] = '',
  title: Podcast['title'] = 'Podcast',
) : Promise<GetPodcastResult> {
  const feed = await fetchRss2Feeds(feedUrl, title);
  if ('errorMessage' in feed.arweave) return { errorMessage: feed.arweave.errorMessage };
  if ('errorMessage' in feed.rss && !hasMetadata(feed.arweave)) {
    return { errorMessage: feed.rss.errorMessage };
  }
  // else: we do want to update the subscription if RSS fails but Arweave has metadata

  const rssDiffnewToArweave = simpleDiff(feed.arweave, feed.rss as Partial<Podcast>);
  const currentPodcastMetadataToSync = findMetadataByFeedUrl(feedUrl, 'rss2', metadataToSync);

  // Here we do want currentPodcastMetadataToSync to override each field of the rssDiffnewToArweave,
  // since in the previous refresh, currentPodcastMetadataToSync was assigned
  // the diff from feed.arweave to metadataToSyncWithNewEpisodes.
  const metadataToSyncWithNewEpisodes =
    mergeBatchMetadata([rssDiffnewToArweave, currentPodcastMetadataToSync], false);

  const newPartialPodcastMetadata : Partial<Podcast> =
    mergeBatchMetadata([feed.arweave, metadataToSyncWithNewEpisodes], true);
  const newPodcastMetadata = partialToPodcast({
    ...newPartialPodcastMetadata,
    id: findBestId([newPartialPodcastMetadata.id, id]),
  });
  if ('errorMessage' in newPodcastMetadata) return newPodcastMetadata;

  const newPodcastMetadataToSync = {
    ...rightDiff(feed.arweave, metadataToSyncWithNewEpisodes, ['id', 'feedUrl']),
    id: findBestId([feed.arweave.id, id, metadataToSyncWithNewEpisodes.id]),
  };

  return { newPodcastMetadata: addLastMutatedAt(newPodcastMetadata), newPodcastMetadataToSync };
}

export interface NewIdMapping extends Pick<Podcast, 'feedType' | 'feedUrl'> {
  oldId: Podcast['id'],
  newId: Podcast['id'],
}

export async function getNewPodcastIds(metadataList: (Podcast | Partial<Podcast>)[])
  : Promise<NewIdMapping[]> {
  const oldIdMappings = metadataList.map(metadata => ({
    oldId: metadata.id!,
    feedType: metadata.feedType || 'rss2',
    feedUrl: metadata.feedUrl || '',
  }));
  const newIds = await Promise.all(
    oldIdMappings.map(mapping => getPodcastId(mapping.feedUrl, mapping.feedType, mapping.oldId)),
  );
  return oldIdMappings.map((mapping, index) => ({
    ...mapping,
    newId: isValidUuid(newIds[index]) ? newIds[index] : mapping.oldId,
  }));
}

export function updatePodcastIds<T extends Podcast | Partial<Podcast>>(
  metadataToUpdate: T[],
  newIdMappings: NewIdMapping[],
) : T[] {
  return metadataToUpdate.map(metadata => {
    const mapping = newIdMappings.find(newMapping => newMapping.oldId === metadata.id);
    if (!mapping) return metadata;

    const { newId } = mapping;
    if (!newId) return metadata;

    const result = { ...metadata, id: newId };
    return metadata.lastMutatedAt ? addLastMutatedAt(result) : result;
  });
}

/**
 * @param subscriptions
 * @param metadataToSync
 * @param idsToRefresh if `null`, all subscriptions are refreshed
 */
export async function refreshSubscriptions(
  subscriptions: Podcast[],
  metadataToSync: Partial<Podcast>[] = [],
  idsToRefresh: Podcast['id'][] | null = null,
) {
  const updateSubscriptionInPlace = (newSubscription: Podcast) : void => {
    const index = newSubscriptions.findIndex(sub => sub.id === newSubscription.id);
    if (index >= 0) newSubscriptions[index] = newSubscription;
  };

  const updateMetadataToSyncInPlace = (newPodcastToSync: Partial<Podcast>, id: string) : void => {
    if (id) {
      const index = newMetadataToSync.findIndex(sub => sub.id === id);
      if (index >= 0) {
        const { threads } = newMetadataToSync[index];
        const prevToSync = isEmpty(threads) ? {} : { id, threads };
        newMetadataToSync[index] = mergeBatchMetadata([prevToSync, newPodcastToSync], true);
      }
      else newMetadataToSync.push(newPodcastToSync);
    }
  };

  const withMergedPosts = (subscription: Podcast, newPodcastMetadata: Podcast, allThreads: Thread[])
  : Podcast => {
    const fetchedThreads = allThreads.filter(thr => thr.podcastId === newPodcastMetadata.id);
    const mergedPosts = mergePosts(subscription.threads, fetchedThreads);
    return { ...newPodcastMetadata, threads: mergedPosts };
  };

  const errorMessages : string[] = [];
  const newSubscriptions : Podcast[] = [...subscriptions];
  const newMetadataToSync : Partial<Podcast>[] = [...metadataToSync];

  const podcastsToRefresh = idsToRefresh || subscriptions.map(sub => sub.id);
  const results = await Promise.all(
    podcastsToRefresh.map(id => fetchPodcastById(id, 'rss2', subscriptions, metadataToSync)),
  );
  const allThreads = await Arweave.getAllThreads(podcastsToRefresh);

  results.forEach(({ errorMessage, newPodcastMetadata, newPodcastMetadataToSync }) => {
    if (hasMetadata(newPodcastMetadata)) {
      const subscription = subscriptions.find(sub => sub.id === newPodcastMetadata.id);
      const id = findBestId([subscription?.id, newPodcastMetadata.id]);
      if (subscription && id) {
        const newPodcastMerged = withMergedPosts(subscription, newPodcastMetadata, allThreads);
        if (hasDiff(subscription, newPodcastMerged)) updateSubscriptionInPlace(newPodcastMerged);

        const newToSync = hasMetadata(newPodcastMetadataToSync) ? newPodcastMetadataToSync : { id };
        updateMetadataToSyncInPlace(newToSync, id);
      }
    }
    else if (errorMessage) errorMessages.push(errorMessage);
  });

  return {
    errorMessages,
    newSubscriptions,
    newMetadataToSync: newMetadataToSync.filter(hasMetadata),
  };
}
