import Transaction from 'arweave/node/lib/transaction';
import { z } from 'zod';
import { ArSyncTxStatus } from '../../client/interfaces';

const txKindsSchema = z.union([z.literal('metadataBatch'), z.literal('customMetadata')]);

const podcastTagsSchema = z.object({
  id: z.string(),
  feedType: z.literal('rss2'),
  feedUrl: z.string(),
  title: z.string(),
  kind: txKindsSchema.optional(),
  description: z.string().optional(),
  author: z.string().optional(),
  summary: z.string().optional(),
  explicit: z.string().optional(),
  subtitle: z.string().optional(),
  language: z.string().optional(),
  creator: z.string().optional(),
  ownerName: z.string().optional(),
  ownerEmail: z.string().optional(),
  managingEditor: z.string().optional(),
  categories: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  episodesKeywords: z.array(z.string()).optional(),
  firstEpisodeDate: z.string().optional(),
  lastEpisodeDate: z.string().optional(),
  metadataBatch: z.number().optional(),
  lastBuildDate: z.string().optional(),
});

const episodeDtoSchema = z.object({
  title: z.string(),
  publishedAt: z.string(),
  categories: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  subtitle: z.string().optional(),
  contentHtml: z.string().optional(),
  summary: z.string().optional(),
  guid: z.string().optional(),
  infoUrl: z.string().optional(),
  mediaUrl: z.string().optional(),
  mediaType: z.string().optional(),
  mediaLength: z.string().optional(),
  duration: z.string().optional(),
  imageUrl: z.string().optional(),
  imageTitle: z.string().optional(),
  explicit: z.string().optional(),
});

const podcastDtoSchema = podcastTagsSchema.extend({
  lastMutatedAt: z.number().optional(),
  episodes: episodeDtoSchema.array().optional(),
  infoUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  imageTitle: z.string().optional(),
  copyright: z.string().optional(),
});

const arSyncTxStatusSchema = z.nativeEnum(ArSyncTxStatus);

const dispatchResultSchema = z.object({
  id: z.string(),
  type: z.union([z.literal('BASE'), z.literal('BUNDLED')]).optional(),
});

const dispatchResultDTOSchema = dispatchResultSchema.extend({
  bundledIn: z.string().optional(),
});

const transactionDtoSchema = z.object({
  id: z.string(),
});

const arSyncTxSchema = z.object({
  id: z.string(),
  podcastId: z.string(),
  kind: txKindsSchema,
  title: z.string().optional(),
  numEpisodes: z.number(),
  dispatchResult: z.union([dispatchResultSchema, dispatchResultDTOSchema]).optional(),
  resultObj: z.union([z.instanceof(Transaction), z.instanceof(Error), transactionDtoSchema]),
  metadata: podcastDtoSchema.partial(),
  status: arSyncTxStatusSchema,
  timestamp: z.number(),
});

export const dbSchema = z.object({
  metadataToSync: podcastDtoSchema.partial().array(),
  transactionHistory: arSyncTxSchema.array(),
  episodes: z.object({
    episodes: episodeDtoSchema.array(),
    id: z.string(),
  }).array(),
  subscriptions: podcastDtoSchema.array(),
});
