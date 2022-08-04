// eslint-disable-next-line import/no-extraneous-dependencies
import { DispatchResult } from 'arconnect';
import Transaction from 'arweave/node/lib/transaction';

export type Primitive = string | boolean | number;

export type EmptyTypes = null | undefined | {};

export const MANDATORY_ARWEAVE_TAGS = [
  'subscribeUrl',
  'title',
  'description',
] as const;

export const OPTIONAL_ARWEAVE_STRING_TAGS = [
  'id',
  'author',
  'summary',
  'explicit',
  'subtitle',
  'language',
  'creator',
  'ownerName',
  'ownerEmail',
  'managingEditor',
  'firstEpisodeDate',
  'lastEpisodeDate',
  'metadataBatch',
  'lastBuildDate',
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
  ...OPTIONAL_ARWEAVE_STRING_TAGS,
  ...OPTIONAL_ARWEAVE_SINGULAR_TAGS,
] as const;

export const ALLOWED_ARWEAVE_TAGS_PLURALIZED = [
  ...MANDATORY_ARWEAVE_TAGS,
  ...OPTIONAL_ARWEAVE_STRING_TAGS,
  ...OPTIONAL_ARWEAVE_PLURAL_TAGS,
] as const;

export type MandatoryTags = typeof MANDATORY_ARWEAVE_TAGS[number];
export type AllowedTags = typeof ALLOWED_ARWEAVE_TAGS[number];
export type AllowedTagsPluralized = typeof ALLOWED_ARWEAVE_TAGS_PLURALIZED[number];
export type ArweaveTag = [AllowedTags, string | undefined];

export interface Podcast extends PodcastTags {
  lastMutatedAt?: number; /** @see unixTimestamp() */
  episodes?: Episode[];
  infoUrl?: string;
  imageUrl?: string;
  imageTitle?: string;
  copyright?: string;
}

export interface PodcastTags {
  subscribeUrl: string;
  title: string;
  id?: string;
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

export interface PodcastDTO extends Omit<Podcast, 'firstEpisodeDate' | 'lastEpisodeDate'
| 'metadataBatch' | 'episodes' | 'lastBuildDate'> {
  firstEpisodeDate: string;
  lastEpisodeDate: string;
  metadataBatch: string;
  episodes: EpisodeDTO[];
  lastBuildDate?: string;
}

export interface EpisodeDTO extends Omit<Episode, 'publishedAt'> {
  publishedAt: string;
}

export interface EpisodesDBTable extends Pick<Podcast, 'subscribeUrl'> {
  episodes: Episode[];
}

export type ErrorStruct = {
  errorMessage: string;
  // errorObj?: Error | null;
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
 * @typedef {ArSyncTxStatus} ArSyncTxStatus
 *   An enum comprising all supported stages of an ArSyncTx object, used to track and update status.
 */
export enum ArSyncTxStatus {
  ERRORED,
  INITIALIZED,
  POSTED,
  CONFIRMED,
  REJECTED, // If tx confirmation fails
}

/**
 * @typedef {ArSyncTx} ArSyncTx
 *   Main data structure used to track an Arweave transaction through its various stages.
 *   All ArSyncTx objects with a status other than `INITIALIZED` are cached in IndexedDB, until the
 *   user chooses to clear any of them.
 */
export interface ArSyncTx {
  id: string, // uuid, not to be confused with `(resultObj as Transaction).id`
  subscribeUrl: string, // TODO: pending T244, change to 'podcastId'
  title?: string,
  dispatchResult?: DispatchResult | DispatchResultDTO,
  resultObj: Transaction | TransactionDTO | Error,
  metadata: Partial<Podcast>,
  numEpisodes: number,
  status: ArSyncTxStatus,
  // TODO: add `timestamp`
}

export interface DisjointGraphFunctionNode extends Pick<Podcast, 'subscribeUrl'> {
  keywordsAndCategories: string[];
  visited: boolean;
}
