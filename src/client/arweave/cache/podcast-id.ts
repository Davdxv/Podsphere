import { Podcast } from '../../interfaces';
import {
  isCandidatePodcastId,
  isNotEmpty,
  isValidUuid,
  newCandidatePodcastId,
} from '../../../utils';
import { fetchPodcastId } from '../graphql-ops';

export interface IdMapping extends Pick<Podcast, 'id' | 'feedType' | 'feedUrl'> {}

export const idCache : IdMapping[] = [];

const isValidMapping = (mapping : IdMapping) => {
  const { id, feedType, feedUrl, ...otherProps } = mapping;
  return isValidUuid(id) && feedType && feedUrl && !isNotEmpty(otherProps);
};

export function metadataToIdMappings(metadata: Podcast[] = []) : IdMapping[] {
  const result : IdMapping[] = [];
  metadata.forEach(pod => {
    const mapping : IdMapping = { id: pod.id, feedType: pod.feedType, feedUrl: pod.feedUrl };
    if (isValidMapping(mapping)) result.push(mapping);
  });
  return result;
}

/**
 * Initializes the idCache with the given id mappings (from subscriptions).
 */
export function initializeIdCache(newIdMappings: IdMapping[]) {
  // Empty the cache first
  idCache.splice(0, idCache.length);
  idCache.push(...newIdMappings);
  console.debug('idCache initialized to:', idCache);
}

const findCachedIdIndex = (feedUrl: Podcast['feedUrl'], feedType: Podcast['feedType'] = 'rss2')
: number => idCache.findIndex(x => x.feedUrl === feedUrl && x.feedType === feedType);

const findCachedId = (feedUrl: Podcast['feedUrl'], feedType: Podcast['feedType'] = 'rss2')
: string => {
  const index = findCachedIdIndex(feedUrl, feedType);
  return index >= 0 ? idCache[index].id : '';
};

/** Removes any duplicate mappings, in case they were created in error */
const removeDuplicateMappings = (feedUrl: Podcast['feedUrl'],
  feedType: Podcast['feedType'] = 'rss2') => {
  const matches = idCache.filter(x => x.feedUrl === feedUrl && x.feedType === feedType);
  matches.slice(1).forEach(match => {
    const index = idCache.findIndex(x => x === match);
    if (index >= 0) idCache.splice(index, 1);
  });
};

const updateIdMapping = (
  newId: Podcast['id'],
  feedUrl: Podcast['feedUrl'],
  feedType: Podcast['feedType'] = 'rss2',
) : void => {
  console.debug('old IdMapping:', idCache);
  removeDuplicateMappings(feedUrl, feedType);

  const newMapping : IdMapping = {
    id: newId,
    feedType,
    feedUrl,
  };
  if (isValidMapping(newMapping)) {
    const index = findCachedIdIndex(feedUrl, feedType);
    if (index >= 0) idCache[index] = newMapping;
    else idCache.push(newMapping);
    console.debug('Updated idCache to:', idCache);
  }
  else console.warn('Encountered an invalid IdMapping:', newMapping);
};

/**
 * @returns
 *   - An empty string if any param is ill-defined;
 *   - Else returns the cached id, if it exists not just locally: `!isCandidatePodcastId(cachedId)`;
 *   - Else returns the id fetched from Arweave & updates the cache;
 *   - Else returns the `oldId` param if given & updates the cache;
 *   - Else returns a newly generated candidate id & updates the cache.
 */
export async function getPodcastId(
  feedUrl: Podcast['feedUrl'],
  feedType: Podcast['feedType'] = 'rss2',
  oldId: Podcast['id'] = '',
) : Promise<string> {
  if (!feedUrl || !feedType) return '';

  const cachedId = findCachedId(feedUrl, feedType);
  console.debug('cachedId', cachedId);
  if (cachedId && !isCandidatePodcastId(cachedId)) return cachedId;

  const fetchedId = await fetchPodcastId(feedUrl, feedType);
  console.debug('fetchedId', fetchedId);
  if (fetchedId) {
    updateIdMapping(fetchedId, feedUrl, feedType);
    return fetchedId;
  }

  if (cachedId) return cachedId;
  if (oldId) {
    updateIdMapping(oldId, feedUrl, feedType);
    return oldId;
  }

  const newId = newCandidatePodcastId();
  updateIdMapping(newId, feedUrl, feedType);
  return newId;
}
