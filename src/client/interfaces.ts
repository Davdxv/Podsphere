import Transaction from 'arweave/node/lib/transaction';
// eslint-disable-next-line import/no-extraneous-dependencies
import { DispatchResult } from 'arconnect';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { TransactionStatusResponse } from 'arweave/node/transactions';
import { ApiConfig } from 'arweave/node/lib/api.d';

export type { ApiConfig, DispatchResult, JWKInterface, TransactionStatusResponse, WalletTypes };
export { Transaction };

/** If using ArConnect, the wallet param is omitted. */
export interface WalletDeferredToArConnect {}
type WalletTypes = JWKInterface | WalletDeferredToArConnect;

/* Convenience types */
export type Primitive = string | boolean | number;
export type EmptyTypes = null | undefined | {} | [] | '';
export type AnyVoidFunction = (...args: any) => void | Promise<void>;
export type AnyNonVoidFunction = (...args: any) => any | Promise<any>;
export type AnyFunction = AnyVoidFunction | AnyNonVoidFunction;

const MANDATORY_ARWEAVE_TAGS = [
  'id',
  'kind',
] as const;

const MANDATORY_ARWEAVE_METADATA_TAGS = [
  'feedType',
  'feedUrl',
  'title',
] as const;

const MANDATORY_ARWEAVE_THREAD_TAGS = [
  'threadId',
  'type',
  'content',
  'subject',
] as const;

const MANDATORY_ARWEAVE_THREADREPLY_TAGS = [
  'threadId',
  'type',
  'content',
  'parentThreadId',
] as const;

const OPTIONAL_ARWEAVE_THREAD_TAGS = [
  'episodeId',
] as const;

const OPTIONAL_ARWEAVE_THREADREPLY_TAGS = [
  'episodeId',
  'parentPostId',
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
  ...MANDATORY_ARWEAVE_THREAD_TAGS,
  ...MANDATORY_ARWEAVE_THREADREPLY_TAGS,
  ...OPTIONAL_ARWEAVE_THREAD_TAGS,
  ...OPTIONAL_ARWEAVE_THREADREPLY_TAGS,
  ...OPTIONAL_ARWEAVE_STRING_TAGS,
  ...OPTIONAL_ARWEAVE_BATCH_TAGS,
  ...OPTIONAL_ARWEAVE_SINGULAR_TAGS,
] as const;

export const ALLOWED_ARWEAVE_TAGS_PLURALIZED = [
  ...MANDATORY_ARWEAVE_TAGS,
  ...MANDATORY_ARWEAVE_METADATA_TAGS,
  ...MANDATORY_ARWEAVE_THREAD_TAGS,
  ...MANDATORY_ARWEAVE_THREADREPLY_TAGS,
  ...OPTIONAL_ARWEAVE_THREAD_TAGS,
  ...OPTIONAL_ARWEAVE_THREADREPLY_TAGS,
  ...OPTIONAL_ARWEAVE_STRING_TAGS,
  ...OPTIONAL_ARWEAVE_BATCH_TAGS,
  ...OPTIONAL_ARWEAVE_PLURAL_TAGS,
] as const;

export type MandatoryTags = typeof MANDATORY_ARWEAVE_TAGS[number];
export type MandatoryMetadataTxTags = typeof MANDATORY_ARWEAVE_METADATA_TAGS[number];
export type MandatoryThreadTxTags = typeof MANDATORY_ARWEAVE_THREAD_TAGS[number];
export type MandatoryThreadReplyTxTags = typeof MANDATORY_ARWEAVE_THREADREPLY_TAGS[number];
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
export const THREAD_TX_KINDS = [
  'thread',
  'threadReply',
] as const;
export const TX_KINDS = [
  ...METADATA_TX_KINDS,
  ...THREAD_TX_KINDS,
];
export type MetadataTxKind = typeof METADATA_TX_KINDS[number];
export type ThreadTxKind = typeof THREAD_TX_KINDS[number];
export type TxKind = typeof TX_KINDS[number];
export type NonMetadataTxKind = Exclude<TxKind, MetadataTxKind>;

export interface Podcast extends PodcastTags {
  threads?: Post[];
  lastMutatedAt?: number; /** @see unixTimestamp() */
  episodes?: Episode[];
  infoUrl?: string;
  imageUrl?: string;
  imageTitle?: string;
  copyright?: string;
}

export interface PodcastTags {
  id: string;
  kind?: TxKind;

  feedType: FeedType;
  feedUrl: string;

  title: string;
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

  threadId?: Thread['id'];
  episodeId?: Thread['episodeId'];
  content?: Thread['content'];
  type?: Thread['type'];
  subject?: Thread['subject'];
  parentThreadId?: ThreadReply['parentThreadId'];
  parentPostId?: ThreadReply['parentPostId'];
}

export interface PodcastDTO extends Omit<Podcast, 'feedType' | 'kind' | 'firstEpisodeDate'
| 'lastEpisodeDate' | 'episodes' | 'lastBuildDate'> {
  feedType: FeedType | string;
  kind?: TxKind | string;
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

export type StringToStringMapping = {
  [key: string]: string;
};

/**
 * @enum {ArSyncTxStatus} number
 * @memberof {@linkcode ArSyncTx}
 * @description
 *   An enum used to track & update status of an ArSyncTx throughout each stage of its lifecycle.
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
 * @see [ArSync](./arweave/sync/index.ts)
 * @see [ArweaveProvider](../providers/arweave.tsx)
 * @description
 *   Main data structure used to track an Arweave transaction through its various stages.
 *   All ArSyncTx objects with a status other than `INITIALIZED` are cached in IndexedDB, until the
 *   user chooses to clear any of them.
 * @prop {string} id uuid of the ArSyncTx object
 * @prop {string} podcastId uuid of the relevant podcast
 * @prop {TxKind} kind
 * @prop {string} title?
 * @prop {DispatchResult | DispatchResultDTO} dispatchResult?
 * @prop {Transaction | TransactionDTO | Error} resultObj
 * @prop {Partial<Podcast> | Post} metadata
 * @prop {number} numEpisodes
 * @prop {ArSyncTxStatus} status
 * @prop {number} timestamp
 */
export interface ArSyncTx {
  id: string,
  podcastId: Podcast['id'],
  kind: TxKind,
  title?: Podcast['title'],
  dispatchResult?: DispatchResult | DispatchResultDTO,
  resultObj: Transaction | TransactionDTO | Error,
  metadata: Partial<Podcast> | Post,
  numEpisodes: number,
  status: ArSyncTxStatus,
  timestamp: Podcast['lastMutatedAt'],
}

export interface ArSyncTxDTO extends Omit<ArSyncTx, 'metadata'> {
  metadata: Partial<PodcastDTO>,
}

/**
 * @interface CachedArTx
 * @see [TxCache#txCache](./arweave/cache/transactions.ts)
 * @see [ArGraphQLOps#getPodcastRss2Feed##filterCandidateTxs](./arweave/graphql-ops.ts)
 * @see [ArSync](./arweave/sync/index.ts)
 * @description
 *   Data structure used to cache the tags of one Arweave transaction (parsed into `PodcastTags`),
 *   also including all necessary props to compute whether to filter this transaction by means of:
 *   1) Filtering GraphQL responses
 *   2) TODO: smarter `./metadata-filtering`
 *   3) TODO: user-level block lists
 *   4) TODO: global-level block lists (first maintained by our mods, later sharable among users)
 * @prop {string} podcastId
 * @prop {string} txId
 * @prop {TxKind} kind?
 * @prop {boolean} txBlocked defaults to false, but is set to true for erroneous transactions
 * @prop {Omit<PodcastTags, 'id' | 'kind'>} tags
 * @prop {string} ownerAddress
 * @prop {string} txBundledIn?
 * @prop {number} numEpisodes
 */
export interface CachedArTx {
  podcastId: PodcastTags['id'];
  txId: string;
  kind?: TxKind;
  txBlocked: boolean;
  tags: Omit<PodcastTags, 'id' | 'kind'>;
  ownerAddress: string;
  txBundledIn?: string;
  numEpisodes: number;
}

/**
 * @interface GraphQLMetadata
 * @see [ArGraphQLOps#parseGqlTags,#QueryField](./arweave/graphql-ops.ts)
 * @see [ArSync](./arweave/sync/index.ts)
 * @see [TxCache](./arweave/cache/transactions.ts)
 * @description Comprises only the GraphQL metadata essential for UX/core functionality, provided
 *   that these metadata are sourced from any subset of the GraphQL response \ excluding the tags.
 * @prop {string} txId
 * @prop {string} ownerAddress
 * @prop {string} txBundledIn?
 */
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

export const THREAD_TYPES = [
  'public',
  'private',
  'passworded',
] as const;
export type ThreadType = typeof THREAD_TYPES[number];

export interface Thread {
  isDraft: boolean,
  id: string,
  podcastId: Podcast['id'],
  episodeId: Episode['publishedAt'] | null,
  content: string,
  type: ThreadType,
  subject: string,
}

export interface ThreadReply extends Omit<Thread, 'subject'> {
  parentThreadId: Thread['id'],
  parentPostId?: Thread['id'], // Only used when replying to a reply
}

/** @type a `Thread` or `ThreadReply` */
export type Post = Thread | ThreadReply;
