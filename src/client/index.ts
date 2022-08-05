import { Podcast } from './interfaces';
import * as arweave from './arweave';
import * as rss from './rss';
import {
  addLastMutatedAt,
  findMetadataByFeedUrl,
  findMetadataById,
  hasMetadata,
  isValidUuid,
  partialToPodcast,
  unixTimestamp,
} from '../utils';
import {
  hasDiff,
  mergeBatchMetadata,
  rightDiff,
  simpleDiff,
} from './arweave/sync/diff-merge-logic';
import { Podcast } from './interfaces';
import { getPodcastId } from './arweave/cache/podcast-id';

type GetPodcastResult = {
  errorMessage?: string;
  newPodcastMetadata?: Podcast;
  newPodcastMetadataToSync?: Partial<Podcast>;
};

async function fetchRss2Feeds(feedUrl: Podcast['feedUrl']) {
  const [arweaveFeed, rssFeed] = await Promise.all([
    arweave.getPodcastRss2Feed(feedUrl),
    rss.getPodcastRss2Feed(feedUrl),
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
)
  : Promise<GetPodcastResult> {
  if (feedType === 'rss2') {
    const { feedUrl } = findMetadataById(id, subscriptions);
    if (feedUrl) return fetchPodcastRss2Feed(feedUrl, metadataToSync);
  }
  return { errorMessage: `Could not find the feed url for Podcast with id ${id}` };
}

export async function fetchPodcastRss2Feed(
  feedUrl: Podcast['feedUrl'],
  metadataToSync: Partial<Podcast>[] = [],
) : Promise<GetPodcastResult> {
  const feed = await fetchRss2Feeds(feedUrl);
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
  const metadataToSyncWithNewEpisodes = mergeBatchMetadata([rssDiffnewToArweave,
    currentPodcastMetadataToSync], false);

  const newPartialPodcastMetadata : Partial<Podcast> = mergeBatchMetadata([feed.arweave,
    metadataToSyncWithNewEpisodes], true);
  const newPodcastMetadata = partialToPodcast(newPartialPodcastMetadata);
  if ('errorMessage' in newPodcastMetadata) return newPodcastMetadata;

  const newPodcastMetadataToSync = rightDiff(
    feed.arweave,
    metadataToSyncWithNewEpisodes,
    ['id', 'feedUrl', 'title'],
  );

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

    return (metadata.lastMutatedAt ? { ...metadata, lastMutatedAt: unixTimestamp(), id: newId }
      : { ...metadata, id: newId });
  });
}

export async function refreshSubscriptions(
  subscriptions: Podcast[],
  metadataToSync: Partial<Podcast>[] = [],
  idsToRefresh: Podcast['id'][] | null = null,
) {
  const errorMessages : string[] = [];
  const newSubscriptions : Podcast[] = [];
  const newMetadataToSync : Partial<Podcast>[] = [];

  const podcastsToRefresh = idsToRefresh || subscriptions.map(sub => sub.id);
  const fetchPodcastResults = await Promise.all(
    podcastsToRefresh.map(id => fetchPodcastById(id, 'rss2', subscriptions, metadataToSync)),
  );

  const replaceOldSubscription = (subscription: Podcast, errorMessage: string = '') => {
    const oldPodcastMetadataToSync = findMetadataById(subscription.id, metadataToSync);
    if (errorMessage) {
      errorMessages.push(`${subscription.title} failed to refresh due to:\n${errorMessage}`);
    }
    newSubscriptions.push(subscription);
    if (hasMetadata(oldPodcastMetadataToSync)) newMetadataToSync.push(oldPodcastMetadataToSync);
  };

  subscriptions.forEach(subscription => {
    const index = podcastsToRefresh.findIndex(id => id === subscription.id);
    if (index >= 0) {
      const { errorMessage,
        newPodcastMetadata, newPodcastMetadataToSync } = fetchPodcastResults[index];

      if (hasMetadata(newPodcastMetadata)) {
        if (hasDiff(subscription, newPodcastMetadata)) {
          newSubscriptions.push(newPodcastMetadata);
          if (hasMetadata(newPodcastMetadataToSync)) {
            newMetadataToSync.push(newPodcastMetadataToSync);
          }
        }
        else replaceOldSubscription(subscription, errorMessage);
      }
      else replaceOldSubscription(subscription, errorMessage);
    }
    else replaceOldSubscription(subscription);
  });

  return {
    errorMessages,
    newSubscriptions,
    newMetadataToSync,
  };
}
