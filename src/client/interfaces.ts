// eslint-disable-next-line import/no-extraneous-dependencies
import { DispatchResult } from 'arconnect';
import Transaction from 'arweave/node/lib/transaction';

export type Primitive = string | boolean | number;

export type EmptyTypes = null | undefined | {};

export const MANDATORY_ARWEAVE_TAGS = [
  'id',
  'feedType',
  'feedUrl',
  'kind',
] as const;

const MANDATORY_ARWEAVE_METADATA_TAGS = [
  'title',
] as const;

export const OPTIONAL_ARWEAVE_STRING_TAGS = [
  'description',
  'author',
  'summary',
  'explicit',
  'subtitle',
  'language',
  'creator',
  'ownerName',
  'ownerEmail',
  'managingEditor',
  'lastBuildDate',
] as const;

export const OPTIONAL_ARWEAVE_BATCH_TAGS = [
  'firstEpisodeDate',
  'lastEpisodeDate',
  'metadataBatch',
] as const;

/**
 * These tags exist as e.g. multiple `Podsphere-category` tags on an Arweave Transaction, but
 * internally we refer to them as `categories: string[]` (mapped to plural through `fromTag()`).
 */
const OPTIONAL_ARWEAVE_PLURAL_TAGS = [
  'categories',
  'keywords',
  'episodesKeywords',
] as const;

const OPTIONAL_ARWEAVE_SINGULAR_TAGS = [
  'category',
  'keyword',
  'episodesKeyword',
] as const;

export const ALLOWED_ARWEAVE_TAGS = [
  ...MANDATORY_ARWEAVE_TAGS,
  ...MANDATORY_ARWEAVE_METADATA_TAGS,
  ...OPTIONAL_ARWEAVE_STRING_TAGS,
  ...OPTIONAL_ARWEAVE_BATCH_TAGS,
  ...OPTIONAL_ARWEAVE_SINGULAR_TAGS,
] as const;

export const ALLOWED_ARWEAVE_TAGS_PLURALIZED = [
  ...MANDATORY_ARWEAVE_TAGS,
  ...MANDATORY_ARWEAVE_METADATA_TAGS,
  ...OPTIONAL_ARWEAVE_STRING_TAGS,
  ...OPTIONAL_ARWEAVE_BATCH_TAGS,
  ...OPTIONAL_ARWEAVE_PLURAL_TAGS,
] as const;

export type MandatoryTags = typeof MANDATORY_ARWEAVE_TAGS[number];
export type AllowedTags = typeof ALLOWED_ARWEAVE_TAGS[number];
export type AllowedTagsPluralized = typeof ALLOWED_ARWEAVE_TAGS_PLURALIZED[number];
export type ArweaveTag = [AllowedTags, string | undefined];

export const FEED_TYPES = [
  'rss2',
] as const;
export type FeedType = typeof FEED_TYPES[number];

export const METADATA_TX_KINDS = [
  'metadataBatch',
  'customMetadata',
] as const;
export const TRANSACTION_KINDS = [
  ...METADATA_TX_KINDS,
];
// export type MetadataTransactionKind = typeof METADATA_TX_KINDS[number];
export type TransactionKind = typeof TRANSACTION_KINDS[number];

export interface Podcast extends PodcastTags {
  lastMutatedAt?: number; /** @see unixTimestamp() */
  episodes?: Episode[];
  infoUrl?: string;
  imageUrl?: string;
  imageTitle?: string;
  copyright?: string;
}

export interface PodcastTags {
  id: string;
  feedType: FeedType;
  feedUrl: string;
  title: string;
  kind?: TransactionKind;
  description?: string;
  author?: string;
  summary?: string;
  explicit?: string;
  subtitle?: string;
  language?: string;
  creator?: string;
  ownerName?: string;
  ownerEmail?: string;
  managingEditor?: string;
  categories?: string[];
  keywords?: string[];
  episodesKeywords?: string[];
  firstEpisodeDate?: Date;
  lastEpisodeDate?: Date;
  metadataBatch?: number;
  lastBuildDate?: Date;
}

export interface PodcastDTO extends Omit<Podcast, 'feedType' | 'kind' | 'firstEpisodeDate'
| 'lastEpisodeDate' | 'episodes' | 'lastBuildDate'> {
  feedType: FeedType | string;
  kind?: TransactionKind | string;
  firstEpisodeDate?: string;
  lastEpisodeDate?: string;
  episodes?: EpisodeDTO[];
  lastBuildDate?: string;
}

export interface EpisodeDTO extends Omit<Episode, 'publishedAt'> {
  publishedAt: string;
}

export interface EpisodesDBTable extends Pick<Podcast, 'id'> {
  episodes: EpisodeDTO[];
}

export type ErrorStruct = {
  errorMessage: string;
};

export interface PodcastFeedError extends ErrorStruct {}

export type Episode = {
  title: string;
  publishedAt: Date;
  categories?: string[];
  keywords?: string[];
  subtitle?: string;
  contentHtml?: string;
  summary?: string;
  guid?: string;
  infoUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaLength?: string;
  duration?: string;
  imageUrl?: string;
  imageTitle?: string;
  explicit?: string;
};

export interface TransactionDTO extends Pick<Transaction, 'id'> {}

export interface DispatchResultDTO extends DispatchResult {
  bundledIn?: string;
}

export type BundledTxIdMapping = {
  [key: string]: string;
};

/**
 * @enum {ArSyncTxStatus} number
 * @description
 *   An enum comprising all supported stages of an ArSyncTx object, used to track and update status.
 * @member {0} ERRORED
 * @member {1} INITIALIZED
 * @member {2} POSTED
 * @member {3} CONFIRMED
 * @member {4} REJECTED
 */
export enum ArSyncTxStatus {
  ERRORED,
  INITIALIZED,
  POSTED,
  CONFIRMED,
  REJECTED, // If tx confirmation fails
}

/**
 * @interface ArSyncTx
 * @description
 *   Main data structure used to track an Arweave transaction through its various stages.
 *   All ArSyncTx objects with a status other than `INITIALIZED` are cached in IndexedDB, until the
 *   user chooses to clear any of them.
 * @prop {string} id uuid of the ArSyncTx object
 * @prop {string} podcastId uuid of the relevant podcast
 * @prop {TransactionKind} kind
 * @prop {string} title?
 * @prop {DispatchResult | DispatchResultDTO} dispatchResult?
 * @prop {Transaction | TransactionDTO | Error} resultObj
 * @prop {Partial<Podcast>} metadata
 * @prop {number} numEpisodes
 * @prop {ArSyncTxStatus} status
 * @prop {number} timestamp
 */
export interface ArSyncTx {
  id: string,
  podcastId: Podcast['id'],
  kind: TransactionKind,
  title?: Podcast['title'],
  dispatchResult?: DispatchResult | DispatchResultDTO,
  resultObj: Transaction | TransactionDTO | Error,
  metadata: Partial<Podcast>,
  numEpisodes: number,
  status: ArSyncTxStatus,
  timestamp: Podcast['lastMutatedAt'],
}

export interface ArSyncTxDTO extends Omit<ArSyncTx, 'metadata'> {
  metadata: Partial<PodcastDTO>,
}

/**
 * @interface CachedArTx
 * @description
 *   Data structure used to cache the tags of one Arweave transaction (parsed into `PodcastTags`),
 *   also including all necessary props to compute whether to filter this transaction by means of:
 *   1) Filtering GraphQL responses; see `./arweave/graphql-ops#filterCandidateTxs`
 *   2) TODO: smarter `./metadata-filtering`
 *   3) TODO: user-level block lists
 *   4) TODO: global-level block lists (first maintained by our mods, later sharable among users)
 * @prop {string} podcastId
 * @prop {string} txId
 * @prop {TransactionKind} kind?
 * @prop {boolean} txBlocked defaults to false, but is set to true for erroneous transactions
 * @prop {Omit<PodcastTags, 'id' | 'kind'>} tags
 * @prop {string} ownerAddress
 * @prop {string} txBundledIn?
 * @prop {number} numEpisodes
 */
export interface CachedArTx {
  podcastId: PodcastTags['id'];
  txId: string;
  kind?: TransactionKind;
  txBlocked: boolean;
  tags: Omit<PodcastTags, 'id' | 'kind'>;
  ownerAddress: string;
  txBundledIn?: string;
  numEpisodes: number;
}

export interface GraphQLMetadata extends
  Pick<CachedArTx, 'txId' | 'ownerAddress' | 'txBundledIn'> {}

/**
 * @interface SearchPodcastResult
 * @description Data structure to wrap a single podcast search result, from e.g. iTunes.
 * @prop {number} id `iTunes.collectionId`
 * @prop {string} feedUrl `iTunes.feedUrl`
 * @prop {string} title `iTunes.collectionName|trackName`
 * @prop {string} author `iTunes.artistName`
 * @prop {number} numEpisodes `iTunes.trackCount` The number of episodes in the feed
 * @prop {Date} lastEpisodeDate `new Date(iTunes.releaseDate)`
 * @prop {string[]} genres `iTunes.genres`
 * @prop {string} country `iTunes.country`
 */
export interface SearchPodcastResult {
  id: number;
  feedUrl: string;
  title: string;
  author: string;
  numEpisodes: number;
  lastEpisodeDate: Date;
  genres: string[];
  country: string;
}

/**
 * @interface SearchPodcastResult
 * @description Data structure to wrap a single podcast search result, from e.g. iTunes.
 * @prop {number} id `iTunes.collectionId`
 * @prop {string} feedUrl `iTunes.feedUrl`
 * @prop {string} title `iTunes.collectionName|trackName`
 * @prop {string} author `iTunes.artistName`
 * @prop {number} numEpisodes `iTunes.trackCount` The number of episodes in the feed
 * @prop {Date} lastEpisodeDate `new Date(iTunes.releaseDate)`
 * @prop {string[]} genres `iTunes.genres`
 * @prop {string} country `iTunes.country`
 */
export interface SearchPodcastResult {
  id: number;
  feedUrl: string;
  title: string;
  author: string;
  numEpisodes: number;
  lastEpisodeDate: Date;
  genres: string[];
  country: string;
}
