/**
 * @module ArSync Main module for ArSync
 *
 * Current version: v1.3.2
 *
 * ArSync comprises all necessary logic for creating, fetching and tracking Podsphere's transactions
 * on Arweave.
 * At present, these transactions comprise incremental (podcast) metadata. Future updates will
 * expand this with more types of transactions.
 *
 * A modular API is not available yet, but the code is to be maintained with this prospect in mind.
 *
 * Main intrinsic interfaces/types (see {@link ../../interfaces.ts}):
 * @see {ArSyncTx}
 *   Main data structure used to track an Arweave transaction through its various stages.
 * @see {ArSyncTxStatus}
 *   An enum comprising all supported stages of an ArSyncTx object. Used to track and update status.
 */

import { v4 as uuid } from 'uuid';
import Transaction from 'arweave/node/lib/transaction';
import { JWKInterface } from 'arweave/node/lib/wallet';
// eslint-disable-next-line import/no-extraneous-dependencies
import { DispatchResult } from 'arconnect';
import {
  ArSyncTx,
  ArSyncTxStatus,
  ArweaveTag,
  Episode,
  Podcast,
} from '../../interfaces';
import {
  findMetadataById,
  hasMetadata,
  unixTimestamp,
} from '../../../utils';
import { throwDevError } from '../../../errors';
import { formatTags, withMetadataBatchNumber } from '../create-transaction';
import { mergeBatchMetadata, rightDiff } from './diff-merge-logic';
import { WalletDeferredToArConnect } from '../wallet';
import {
  calculateTagsSize,
  compressMetadata,
  isConfirmed,
  isInitialized,
  isPosted,
  usingArConnect,
} from '../utils';
import {
  newTransactionFromCompressedMetadata,
  dispatchTransaction,
  signAndPostTransaction,
} from '..';

/** Max size of compressed metadata per transaction (including tags) */
const MAX_BATCH_SIZE = 96 * 1024; // KiloBytes

export async function initArSyncTxs(
  subscriptions: Podcast[],
  metadataToSync: Partial<Podcast>[],
  wallet: JWKInterface | WalletDeferredToArConnect,
  maxBatchSize: number | null = MAX_BATCH_SIZE,
)
  : Promise<ArSyncTx[]> {
  let result : ArSyncTx[] = [];
  const partitionedBatches : PartitionedBatch[] = [];

  metadataToSync.forEach(podcastMetadataToSync => {
    let cachedMetadata : Partial<Podcast> = {};
    if (hasMetadata(podcastMetadataToSync)) {
      try {
        const { id } = podcastMetadataToSync;
        if (!id) throw new Error('Could not find Podcast id.');
        cachedMetadata = findMetadataById(id, subscriptions);

        // A transaction will be created for each batchesToSync[i]
        const batchesToSync = partitionMetadataBatches(cachedMetadata,
          podcastMetadataToSync,
          maxBatchSize);
        partitionedBatches.push(...batchesToSync);
      }
      catch (ex) {
        const title = cachedMetadata.title || podcastMetadataToSync.title;
        console.error(`Failed to sync ${title || podcastMetadataToSync.feedUrl} due to: ${ex}`);
      }
    }
  });

  result = await Promise.all(partitionedBatches.map(async batch => {
    let newTxResult : Transaction | Error;
    try {
      newTxResult = await newTransactionFromCompressedMetadata(
        wallet, batch.compressedMetadata, batch.tags,
      );
    }
    catch (ex) {
      newTxResult = ex as Error;
    }
    const arSyncTx : ArSyncTx = {
      id: uuid(),
      podcastId: batch.podcastId,
      title: batch.title,
      resultObj: newTxResult,
      metadata: batch.metadata,
      numEpisodes: batch.numEpisodes,
      status: newTxResult instanceof Error ? ArSyncTxStatus.ERRORED : ArSyncTxStatus.INITIALIZED,
      timestamp: unixTimestamp(),
    };
    return arSyncTx;
  }));
  console.debug('initArSyncTxs result:', result);

  return result;
}

export async function startSync(
  allTxs: ArSyncTx[],
  wallet: JWKInterface | WalletDeferredToArConnect,
)
  : Promise<ArSyncTx[]> {
  const result : ArSyncTx[] = [...allTxs];
  await Promise.all(allTxs.map(async (tx, index) => {
    if (isInitialized(tx)) {
      let postedTxResult : Transaction | Error = tx.resultObj as Transaction;
      let dispatchResult : DispatchResult | undefined;
      try {
        if (usingArConnect()) {
          dispatchResult = await dispatchTransaction(tx.resultObj as Transaction);
        }
        else await signAndPostTransaction(tx.resultObj as Transaction, wallet);
      }
      catch (ex) {
        postedTxResult = ex as Error;
      }
      const arSyncTx : ArSyncTx = {
        ...tx,
        dispatchResult,
        resultObj: postedTxResult,
        status: postedTxResult instanceof Error ? ArSyncTxStatus.ERRORED : ArSyncTxStatus.POSTED,
      };
      result[index] = arSyncTx;
    }
    else result[index] = tx;
  }));
  console.debug('startSync result:', result);

  return result;
}

/**
 * @interface PartitionedBatch
 * @description
 *   An object that includes the `compressedMetadata` and `tags` params required by
 *   {@linkcode newTransactionFromCompressedMetadata}. Local precursor to an (exported) `ArSyncTx`.
 * @prop {string} podcastId uuid of the relevant podcast `= metadata.id`
 * @prop {string} title
 * @prop {Partial<Podcast>} metadata
 * @prop {number} numEpisodes
 * @prop {Uint8Array} compressedMetadata
 * @prop {ArweaveTag[]} tags
 */
interface PartitionedBatch extends
  Pick<ArSyncTx, 'podcastId' | 'title' | 'metadata' | 'numEpisodes'> {
  compressedMetadata: Uint8Array;
  tags: ArweaveTag[];
}

/**
 * @param cachedMetadata
 * @param priorBatchMetadata
 *   To save space, the returned metadata objects comprise a right diff vs `priorBatchMetadata`
 * @param podcastMetadataToSync
 * @param episodesToSync
 * @param maxBatchSize
 * @returns A {@linkcode PartitionedBatch} object that includes the `compressedMetadata` and `tags`
 *   params required by {@linkcode newTransactionFromCompressedMetadata()}.
 *   If `episodesToSync` does not fit within `maxBatchSize`, the resulting `metadata` and
 *   `compressedMetadata` objects comprise a subset of oldest `episodesToSync` that upon gzip
 *   compression best fits within `maxBatchSize`.
 */
const findNextBatch = (
  cachedMetadata: Partial<Podcast>,
  priorBatchMetadata: Partial<Podcast>,
  podcastMetadataToSync: Partial<Podcast>,
  episodesToSync: Episode[],
  maxBatchSize: number | null,
) : PartitionedBatch => {
  /**
   * @function findNextOptimalBatch runs several passes of gzip compression of a subset of
   * `episodesToSync` (consecutive, starting with the oldest episode at `episodesToSync[-1]`),
   * in an attempt to find the best possible single metadata batch that fits within `maxBatchSize`.
   * @param resultTemplate `PartitionedBatch`
   * @returns The given `PartitionedBatch` with `.compressedMetadata, .metadata, .tags` populated,
   *   even if the max number of passes yields a slightly undersized(rare)/oversized(rarer) result
   * @throws `ImplementationError` iff mistakenly called by parent with bad params
   */
  const findNextOptimalBatch = (resultTemplate: PartitionedBatch) : PartitionedBatch => {
    if (!maxBatchSize) {
      throwDevError(`findNextOptimalBatch shouldn't be called with maxBatchSize=${maxBatchSize}`);
    }
    if (!hasMetadata(episodesToSync)) {
      throwDevError('findNextOptimalBatch shouldn\'t be called with empty episodesToSync.');
    }

    const OPTIMAL_RELATIVE_BATCH_SIZE = 0.8;
    const MAX_NUM_PASSES = 10;
    const PASS_ERR_MARGIN = 0.05;

    const result : PartitionedBatch = { ...resultTemplate };
    let numEps = Math.min(episodesToSync.length, 100);
    let minEps = 1;
    let maxEps = Infinity;
    let bestResultMargin = Infinity;

    for (let pass = 1; pass <= MAX_NUM_PASSES; pass++) {
      const currentBatch = withMetadataBatchNumber({
        ...podcastMetadataToSync,
        episodes: (episodesToSync || []).slice(-numEps),
      }, priorBatchMetadata);
      const tags = formatTags(currentBatch, cachedMetadata);
      const tagsSize = calculateTagsSize(tags);
      const gzip : Uint8Array = compressMetadata(currentBatch);

      const relativeBatchSize = (tagsSize + gzip.byteLength) / maxBatchSize;
      const resultMargin = Math.abs(OPTIMAL_RELATIVE_BATCH_SIZE - relativeBatchSize);
      if (resultMargin < bestResultMargin) {
        // Best intermediate result has a relativeBatchSize closest to OPTIMAL_RELATIVE_BATCH_SIZE.
        // Pass 1 always hits this branch, to ensure a usable result is populated.
        bestResultMargin = resultMargin;
        result.numEpisodes = numEps;
        result.compressedMetadata = gzip;
        result.metadata = currentBatch;
        result.tags = tags;
      }

      if (relativeBatchSize > 1) { /* Too large */
        maxEps = Math.min(maxEps, numEps);
        // For the next pass, set numEps to the average of: (a predictive numEps based on
        // relativeBatchSize) + (the smallest oversized numEps), adding a lower bias with each pass.
        numEps = Math.min(episodesToSync.length,
          Math.floor((1 - PASS_ERR_MARGIN * pass) * (((numEps / relativeBatchSize) + maxEps) / 2)));
      }
      else if (relativeBatchSize < OPTIMAL_RELATIVE_BATCH_SIZE) { /* Too small, but acceptable */
        if (numEps >= episodesToSync.length) break;

        minEps = Math.max(minEps, numEps);
        numEps = Math.min(episodesToSync.length,
          Math.floor((1 + PASS_ERR_MARGIN * pass) * (((numEps / relativeBatchSize) + minEps) / 2)));
      }
      else { /* Good result */
        break;
      }
      if (numEps < minEps || numEps > maxEps || numEps < 1) { /* Optimal result was found already */
        break;
      }
    }
    return result;
  }; /** End of #findNextOptimalBatch() */

  const allMetadata = { ...podcastMetadataToSync };
  if (episodesToSync.length) allMetadata.episodes = episodesToSync;
  const allMetadataDiff = rightDiff(priorBatchMetadata, allMetadata, ['id', 'feedType', 'feedUrl']);

  let result : PartitionedBatch = {
    podcastId: podcastMetadataToSync.id || cachedMetadata.id || '',
    title: podcastMetadataToSync.title || cachedMetadata.title || '',
    numEpisodes: episodesToSync.length,
    metadata: allMetadataDiff,
    compressedMetadata: new Uint8Array([]),
    tags: [],
  };

  if (!hasMetadata(episodesToSync) || !maxBatchSize) {
    if (hasMetadata(episodesToSync)) {
      result.metadata = withMetadataBatchNumber(result.metadata, priorBatchMetadata);
    }
    result.compressedMetadata = compressMetadata(result.metadata);
    result.tags = formatTags(result.metadata, cachedMetadata);
  }
  else {
    result = findNextOptimalBatch(result);
  }
  return result;
};

/**
 * Calls {@linkcode findNextBatch()} with each `episodesRemainder` resulting from the last call to
 * `findNextBatch()`. `findNextBatch()` may call {@linkcode findNextBatch()#findNextOptimalBatch()}
 * which ensures that each compressed batch size in bytes <= `maxBatchSize`.
 * @param cachedMetadata
 * @param podcastMetadataToSync
 * @param maxBatchSize
 * @returns An array of partitioned `podcastMetadataToSync`, which when merged should equal
 *   `podcastMetadataToSync`. If `!maxBatchSize` or there are no episodes to sync, returns an array
 *   with one all-encompassing `PartitionedBatch`.
 */
function partitionMetadataBatches(
  cachedMetadata: Partial<Podcast>,
  podcastMetadataToSync: Partial<Podcast>,
  maxBatchSize: number | null = MAX_BATCH_SIZE,
) : PartitionedBatch[] {
  const batches : PartitionedBatch[] = [];
  const { episodes, ...mainMetadata } = { ...podcastMetadataToSync };

  let priorBatchMetadata = {};
  let previousBatchMetadata = {};
  let episodesRemainder = episodes || [];
  do {
    priorBatchMetadata = mergeBatchMetadata([priorBatchMetadata, previousBatchMetadata], true);
    const currentBatch = findNextBatch(cachedMetadata,
      priorBatchMetadata,
      mainMetadata,
      episodesRemainder,
      maxBatchSize);
    batches.push(currentBatch);
    previousBatchMetadata = currentBatch.metadata;

    const newEpisodesRemainder = episodesRemainder.slice(0, -currentBatch.numEpisodes);
    if (newEpisodesRemainder.length >= episodesRemainder.length) break; // fail-safe
    episodesRemainder = newEpisodesRemainder;
  }
  while (episodesRemainder.length);

  return batches.filter(batch => hasMetadata(batch.metadata));
}

export function formatNewMetadataToSync(
  allTxs: ArSyncTx[],
  prevMetadataToSync: Partial<Podcast>[] = [],
) : Partial<Podcast>[] {
  let diffs = prevMetadataToSync;
  allTxs.forEach(tx => {
    if (isPosted(tx) || isConfirmed(tx)) {
      const { podcastId, metadata } = tx;
      const prevPodcastToSyncDiff = findMetadataById(podcastId, diffs);
      let newDiff : Partial<Podcast> = {};
      if (hasMetadata(prevPodcastToSyncDiff)) {
        newDiff = rightDiff(metadata, prevPodcastToSyncDiff, ['id', 'feedType', 'feedUrl']);
      }

      diffs = diffs.filter(oldDiff => oldDiff.id !== podcastId);
      if (hasMetadata(newDiff)) diffs.push(newDiff);
    }
  });

  return diffs;
}
