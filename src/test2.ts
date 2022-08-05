// eslint-disable-next-line import/no-extraneous-dependencies
import Transaction from 'arweave/node/lib/transaction';

export interface DispatchResult {
  id: string;
  type?: 'BASE' | 'BUNDLED';
}

export interface DispatchResultDTO extends DispatchResult {
  bundledIn?: string;
}

export interface TransactionDTO extends Transaction {}

export enum ArSyncTxStatus {
  ERRORED,
  INITIALIZED,
  POSTED,
  CONFIRMED,
  REJECTED, // If tx confirmation fails
}

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

export interface Podcast extends PodcastTags {
  lastMutatedAt?: number; /** @see unixTimestamp() */
  episodes?: Episode[];
  infoUrl?: string;
  imageUrl?: string;
  imageTitle?: string;
  copyright?: string;
}

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

interface SchemaType {
  metadataToSync: Partial<Podcast>[];
  arSyncTxs: ArSyncTx[];
  episodes: {
    episodes: Episode[];
    subscribeUrl: string;
  }[];
  subscriptions: Podcast[]
}
