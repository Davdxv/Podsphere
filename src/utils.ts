import {
  EmptyTypes,
  Episode,
  EpisodeDTO,
  FeedType,
  FEED_TYPES,
  Podcast,
  PodcastDTO,
  PodcastFeedError,
  TransactionKind,
  TRANSACTION_KINDS,
} from './client/interfaces';
import { initializeKeywords } from './client/metadata-filtering/generation';
import {
  addPrefixToPodcastId,
  isCandidatePodcastId,
  removePrefixFromPodcastId,
} from './podcast-id';

export function unixTimestamp(date : Date | null = null) {
  return Math.floor(date ? date.getTime() : Date.now() / 1000);
}

export function addLastMutatedAt(subscription: Podcast) : Podcast {
  return { ...subscription, lastMutatedAt: unixTimestamp() };
}

export function metadatumToString<K extends keyof Podcast>(field: Podcast[K]) {
  if (Array.isArray(field)) return field.join(', ');
  if ((field as unknown) instanceof Date) return toLocaleString(field as unknown as Date);

  return `${field}`;
}

export function toISOString(date: Date) {
  try {
    return date.toISOString();
  }
  catch (_ex) {
    return '';
  }
}

export function toLocaleString(date: Date) {
  try {
    return date.toLocaleString();
  }
  catch (_ex) {
    return 'unknown';
  }
}

export function isValidString(str: unknown) : str is string {
  return typeof str === 'string' && !!str.trim().length;
}

export function isValidInteger(number: unknown) : number is number {
  return typeof number === 'number' && Number.isInteger(number);
}

export function isValidDate(date: unknown) : date is Date {
  return date instanceof Date && !!date.getTime();
}

export function isValidKind(kind: unknown) : kind is TransactionKind {
  return typeof kind === 'string' && TRANSACTION_KINDS.some(txKind => txKind === kind);
}

export function isValidFeedType(feedType: unknown) : feedType is FeedType {
  return typeof feedType === 'string' && FEED_TYPES.some(t => t === feedType);
}

export function datesEqual(a: Date, b: Date) {
  return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
}

export function episodesCount(metadata: Partial<Podcast> | Podcast | {}) : number {
  return isNotEmpty(metadata) && isNotEmpty(metadata.episodes) ? metadata.episodes.length : 0;
}

export function getFirstEpisodeDate(metadata: Partial<Podcast>) : Date {
  if (!episodesCount(metadata)) return new Date(0);

  const result = metadata.episodes![metadata.episodes!.length - 1].publishedAt;
  return isValidDate(result) ? result : new Date(0);
}

export function getLastEpisodeDate(metadata: Partial<Podcast>) : Date {
  if (!episodesCount(metadata)) return new Date(0);

  const result = metadata.episodes![0].publishedAt;
  return isValidDate(result) ? result : new Date(0);
}

/**
 * @param messages
 * @param filterDuplicates
 * @returns The `messages` concatenated by '\n'
 */
export function concatMessages(messages : string[] = [], filterDuplicates = false) {
  return (filterDuplicates ? [...new Set(messages.flat())] : messages.flat())
    .filter(x => x) // Filter out any null elements
    .join('\n').trim();
}

/**
 * @param date
 * @returns One of the following:
 *   - A new Date object, if `date` is a valid date string.
 *   - A `0` Date object, if `date` is not a valid date string.
 *   - `date`, if `date` is already a Date object.
 */
export function toDate(date: string | Date | undefined) : Date {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;

  const dateObj = new Date(date);
  return dateObj.getTime() ? dateObj : new Date(0);
}

/**
 * @param metadata
 * @returns true iff `metadata` has specific metadata other than:
 *   - `Podcast['id' | 'feedType' | 'feedUrl' | 'kind' | 'lastMutatedAt']`
 *   - an empty episodes list
 *   - `Episode['publishedAt']`
 */
export function hasMetadata<T extends Partial<Podcast>[] | Partial<Episode>[],
K extends Partial<Podcast> | Partial<Episode>>(
  metadata: K | T | EmptyTypes,
) : metadata is T | K {
  if (!isNotEmpty(metadata)) return false;
  if (Array.isArray(metadata)) return !!metadata.length;
  if (metadata.title) return true;

  // @ts-ignore
  const { id, feedType, feedUrl, kind, lastMutatedAt, publishedAt, episodes,
    ...specificMetadata } = metadata;
  if (episodes?.length) return true;

  return !!Object.values(specificMetadata).flat().filter(x => x).length;
}

export function findMetadataByFeedUrl<T extends Podcast | Partial<Podcast>>(
  feedUrl: Podcast['feedUrl'],
  feedType: Podcast['feedType'] = 'rss2',
  metadataList: T[] = [],
) : T {
  return metadataList.find(x => isNotEmpty(x) && x.feedUrl === feedUrl && x.feedType === feedType)
    || {} as T;
}

export function findMetadataById<T extends Podcast | Partial<Podcast>>(
  id: Podcast['id'],
  metadataList: T[] = [],
) : T {
  let result = metadataList.find(obj => isNotEmpty(obj) && obj.id === id);
  if (!result) {
    if (isCandidatePodcastId(id)) {
      result = metadataList.find(obj => obj?.id && addPrefixToPodcastId(obj.id) === id);
    }
    else {
      result = metadataList.find(obj => obj?.id && removePrefixFromPodcastId(obj.id) === id);
    }
  }

  return result || {} as T;
}

export function partialToPodcast(partialMetadata: Partial<Podcast>) : Podcast | PodcastFeedError {
  const result : Podcast = {
    ...partialMetadata,
    id: partialMetadata.id || '',
    feedType: partialMetadata.feedType || 'rss2',
    feedUrl: partialMetadata.feedUrl || '',
    title: partialMetadata.title || '',
  };

  if (!result.feedUrl) return { errorMessage: 'Feed URL is missing.' };
  if (!result.id) return { errorMessage: `Feed ${result.feedUrl} is missing an id.` };
  if (!result.title) return { errorMessage: `Feed ${result.feedUrl} is missing a title.` };

  return result;
}

/** TODO: expand episode validation */
export const isValidEpisode = (ep?: Episode) => isNotEmpty(ep) && isValidDate(ep.publishedAt);

/** NOTE: should not throw if resulting Podcast is incomplete */
export function podcastFromDTO(podcast: Partial<PodcastDTO>, sortEpisodes = true) : Podcast {
  const conditionalSort = (episodes: Podcast['episodes'] = []) => (sortEpisodes
    ? episodes.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    : episodes);

  const episodes : Podcast['episodes'] = conditionalSort(
    (podcast.episodes || [])
      .map(episode => ({ ...episode, publishedAt: toDate(episode.publishedAt) }))
      .filter(isValidEpisode),
  );

  let { feedType, metadataBatch,
    // eslint-disable-next-line prefer-const
    firstEpisodeDate, lastEpisodeDate, lastBuildDate, kind, ...mainMetadata } : any = podcast;

  feedType = isValidFeedType(feedType) ? feedType : 'rss2';
  metadataBatch = Number(metadataBatch);
  firstEpisodeDate = toDate(firstEpisodeDate);
  lastEpisodeDate = toDate(lastEpisodeDate);
  lastBuildDate = toDate(lastBuildDate);
  kind ||= 'metadataBatch';

  const result : Podcast = {
    ...mainMetadata as Podcast,
    feedType: feedType as FeedType,
    keywords: initializeKeywords(podcast, podcast.keywords),
    episodes,
  };

  if (isValidInteger(metadataBatch)) result.metadataBatch = metadataBatch;
  if (isValidDate(firstEpisodeDate)) result.firstEpisodeDate = firstEpisodeDate;
  if (isValidDate(lastEpisodeDate)) result.lastEpisodeDate = lastEpisodeDate;
  if (isValidDate(lastBuildDate)) result.lastBuildDate = lastBuildDate;
  if (isValidKind(kind)) result.kind = kind;

  return result;
}

export function podcastsFromDTO(podcasts: Partial<PodcastDTO>[], sortEpisodes = true) {
  return podcasts.filter(podcast => isNotEmpty(podcast))
    .map(podcast => podcastFromDTO(podcast, sortEpisodes));
}

export function podcastToDTO(podcast: Partial<Podcast>) : Partial<PodcastDTO> {
  const { feedType, kind, firstEpisodeDate, lastEpisodeDate, lastBuildDate, episodes,
    ...dtoCompatibleMetadata } = podcast;
  const result : Partial<PodcastDTO> = { ...dtoCompatibleMetadata };

  if (feedType) result.feedType = `${feedType}`;
  if (kind) result.kind = `${kind}`;
  if (firstEpisodeDate) result.firstEpisodeDate = `${firstEpisodeDate}`;
  if (lastEpisodeDate) result.lastEpisodeDate = `${lastEpisodeDate}`;
  if (lastBuildDate) result.lastBuildDate = `${lastBuildDate}`;
  if (isNotEmpty(episodes)) result.episodes = episodesToDTO(episodes);

  return result;
}

export function episodesToDTO(episodes: Episode[]) : EpisodeDTO[] {
  return episodes.map(episode => ({ ...episode, publishedAt: `${episode.publishedAt}` }));
}

/**
 * @param metadata
 * @returns The `metadata` exluding props where !valuePresent(value), @see valuePresent
 */
export function omitEmptyMetadata(metadata: Partial<Podcast> | Partial<Episode>) {
  if (!isNotEmpty(metadata)) return {};

  let result : Partial<Podcast> | Partial<Episode> = {};
  Object.entries(metadata).forEach(([prop, value]) => {
    let newValue = value;
    // @ts-ignore
    if (Array.isArray(newValue)) newValue = newValue.filter(elem => valuePresent(elem));
    if (valuePresent(newValue)) result = { ...result, [prop]: newValue };
  });

  return result;
}

/**
 * @param value
 * @returns false iff `value` comprises one of these values:
 *   - null
 *   - undefined
 *   - NaN
 *   - an empty string
 *   - an empty array
 *   - an empty object (non-recursively)
 *   - an array comprised of only any of the above elements
 */
export function valuePresent(value: number | string | object) : boolean {
  switch (typeof value) {
    case 'number':
      return !Number.isNaN(value);
    case 'string':
      return !!value.trim();
    case 'object':
      if (Array.isArray(value)) return isNotEmpty(value.filter(elem => valuePresent(elem)));
      if (value instanceof Date) return isValidDate(value);

      return isNotEmpty(value);
    default:
      return !!value;
  }
}

/**
 * @param obj is an object that might be empty/undefined
 * @returns true if the given array or object is not empty
 */
export function isNotEmpty<T extends object>(obj: T | EmptyTypes) : obj is T {
  const isEmpty = !obj || typeof obj !== 'object' || Object.keys(obj).length === 0;
  return !isEmpty;
}

/* Returns true if the given objects' values are (deep)equal */
export function valuesEqual(a: object = {}, b: object = {}) : boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  // See https://stackoverflow.com/a/32922084/8691102
  const ok = Object.keys;
  const tx = typeof a;
  const ty = typeof b;
  return tx === 'object' && tx === ty ? (
    ok(a).length === ok(b).length
    && ok(a).every(key => valuesEqual(a[key as keyof typeof a], b[key as keyof typeof b]))
  ) : (a === b);
}

export function corsApiHeaders() {
  switch (corsProxyURL()) {
    default:
      return {};
  }
}

export function corsProxyURL() {
  // return 'https://corsanywhere.herokuapp.com/';
  return 'https://cors-anywhere.herokuapp.com/';
}

export function withCorsProxy(url: string) {
  return corsProxyURL() + url;
}
