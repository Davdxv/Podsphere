import { v4 as uuid } from 'uuid';
import Transaction from 'arweave/node/lib/transaction';
import { JWKInterface } from 'arweave/node/lib/wallet';
// eslint-disable-next-line import/no-extraneous-dependencies
import { DispatchResult } from 'arconnect';
import {
  ArSyncTx, ArSyncTxStatus, ArweaveTag,
  Episode, Podcast,
} from '../../interfaces';
import {
  findMetadataById,
  hasMetadata,
  isNotEmpty,
  isReply,
  isValidPost,
  removePostFromPodcast,
  unixTimestamp,
} from '../../../utils';
import { throwDevError } from '../../../errors';
import { formatMetadataTxTags, withMetadataBatchNumber } from '../create-transaction';
import { mergeBatchMetadata, rightDiff } from './diff-merge-logic';
import { WalletDeferredToArConnect } from '../wallet';
import {
  calculateTagsSize, compressMetadata, hasThreadTxKind,
  isConfirmed, isInitialized, isPosted,
  usingArConnect,
} from '../utils';
import { removePrefixFromPodcastId } from '../../../podcast-id';
import {
  newThreadTransaction,
  newTransactionFromCompressedMetadata,
  dispatchTransaction,
  signAndPostTransaction,
} from '..';

/**
 * @module ArSync Main module for ArSync
 *
 * Current version: v1.5
 *
 * ArSync comprises all necessary logic for creating, fetching and tracking Podsphere's transactions
 * on Arweave.
 * At present, these transactions comprise incremental (podcast) metadata or user threads/replies.
 * Future updates will expand this with more types of transactions.
 *
 * A modular API is not available yet, but the code is to be maintained with this prospect in mind.
 *
 * The flow for getting metadata from subscribed feeds onto Arweave roughly goes as follows:
 *   1) User clicks the Sync button => `ArweaveProvider.prepareSync()`:
 *     > - Refreshes all `subscriptions` & updates `metadataToSync` with the new diffs
 *     > - Calls {@linkcode initSync()} which returns initialized txs
 *     > - Updates `ArweaveProvider.arSyncTxs` with the initialized txs
 *   2) User inspects the Transactions tab & clicks Sync again => `ArweaveProvider.startSync()`:
 *     > - Calls {@linkcode startSync()} which returns new `arSyncTxs`, where each previously
 *         initialized tx now has a new status of either POSTED or ERRORED
 *     > - Calls {@linkcode formatNewMetadataToSync()} which returns new `metadataToSync`, which is
 *         a diff vs the old one, where each POSTED or CONFIRMED tx has its (podcast/thread)
 *         metadata omitted
 *   3) `ArweaveProvider` periodically updates the status of each tx
 *
 * Main intrinsic interfaces/types (see {@link ../../interfaces.ts}):
 * @see {ArSyncTx}
 *   Main data structure used to track an Arweave transaction through its various stages.
 * @see {ArSyncTxStatus}
 *   An enum comprising all supported stages of an ArSyncTx object. Used to track and update status.
 */
const ArSync = Object.freeze({ initSync, startSync, formatNewMetadataToSync });
export default ArSync;

/** Max size of compressed metadata per transaction (including tags) */
const MAX_BATCH_SIZE = 96 /* KiloBytes */ * 1024;

/**
 * @interface PartitionedBatch
 * @description
 *   An transient object that includes the `compressedMetadata` and `tags` params required by
 *   {@linkcode newTransactionFromCompressedMetadata}. Local precursor to an (exported) `ArSyncTx`.
 * @prop {string} podcastId uuid of the relevant podcast `= metadata.id`
 * @prop {string} title?
 * @prop {Partial<Podcast> | Post} metadata
 * @prop {number} numEpisodes
 * @prop {Uint8Array} compressedMetadata?
 * @prop {ArweaveTag[]} tags?
 */
interface PartitionedBatch extends
  Pick<ArSyncTx, 'podcastId' | 'kind' | 'title' | 'metadata' | 'numEpisodes'> {
  cachedMetadata?: Partial<Podcast>;
  compressedMetadata?: Uint8Array;
  tags?: ArweaveTag[];
}

/**
 * Initializes Arweave transactions from the current `metadataToSync`.
 * @returns `ArSyncTx[]` where each element is an initialized transaction
 * @see {@linkcode ArSync}
 */
async function initSync(
  subscriptions: Podcast[],
  metadataToSync: Partial<Podcast>[],
  wallet: JWKInterface | WalletDeferredToArConnect,
  maxBatchSize: number | null = MAX_BATCH_SIZE,
) : Promise<ArSyncTx[]> {
  // A transaction will be created for each PartitionedBatch
  const metadataBatches : PartitionedBatch[] = [];
  const otherBatches : PartitionedBatch[] = [];

  metadataToSync.forEach(podcastToSync => {
    const { id } = podcastToSync;
    let { title } = podcastToSync;
    if (hasMetadata(podcastToSync)) {
      try {
        if (!id) throwDevError('Could not find Podcast id.', podcastToSync);
        const cachedMetadata = findMetadataById(id, subscriptions);
        title ||= cachedMetadata.title;

        const { nonMetadataBatches, podcastMetadataToSync } =
          extractNonMetadataBatchesToSync(podcastToSync, cachedMetadata);
        otherBatches.push(...nonMetadataBatches);
        metadataBatches
          .push(...partitionMetadataBatches(cachedMetadata, podcastMetadataToSync, maxBatchSize));
      }
      catch (ex) {
        console.error(`Failed to sync ${title || podcastToSync.feedUrl} due to: ${ex}\n\n`
          + 'This might be caused by having unsubscribed from a feed with pending Sync data.');
        // TODO: confirm error message reason & solve cause
      }
    }
  });

  const result : ArSyncTx[] =
    await Promise.all([...metadataBatches, ...otherBatches].map(async b => {
      let newTx : Transaction | Error;
      try {
        if (hasThreadTxKind(b)) {
          newTx = await newThreadTransaction(wallet, b.metadata, b.cachedMetadata);
        }
        else {
          newTx = (isNotEmpty(b.compressedMetadata) && isNotEmpty(b.tags)
            ? await newTransactionFromCompressedMetadata(wallet, b.compressedMetadata, b.tags)
            : new Error('Transaction invalid due to missing metadata'));
        }
      }
      catch (ex) {
        newTx = ex as Error;
      }
      return {
        id: uuid(),
        podcastId: b.podcastId,
        kind: b.kind,
        title: b.title,
        resultObj: newTx,
        metadata: b.metadata,
        numEpisodes: b.numEpisodes,
        status: newTx instanceof Error ? ArSyncTxStatus.ERRORED : ArSyncTxStatus.INITIALIZED,
        timestamp: unixTimestamp(),
      } as ArSyncTx;
    }));

  console.debug('initSync result:', result);
  return result;
}

/**
 * @param podcastToSync
 * @returns `podcastToSync` split into 2 data structures:
 *   - A list of PartitionedBatches, each corresponding to a Thread or ThreadReply
 *   - The remainder `podcastMetadataToSync`
 */
function extractNonMetadataBatchesToSync(
  podcastToSync: Partial<Podcast>,
  cachedMetadata: Partial<Podcast>,
) : { nonMetadataBatches: PartitionedBatch[], podcastMetadataToSync: Partial<Podcast> } {
  const { threads, ...podcastMetadataToSync } = podcastToSync;
  const nonMetadataBatches : PartitionedBatch[] = [];

  if (isNotEmpty(threads)) {
    threads.forEach(post => {
      if (isValidPost(post) && !post.isDraft) {
        nonMetadataBatches.push({
          podcastId: podcastToSync.id || '',
          kind: isReply(post) ? 'threadReply' : 'thread',
          title: podcastToSync.title || cachedMetadata.title || '',
          numEpisodes: 0,
          metadata: post,
          cachedMetadata,
        });
      }
    });
  }
  return { nonMetadataBatches, podcastMetadataToSync };
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
 *   `compressedMetadata` objects comprise a subset of oldest `episodesToSync` that, upon gzip
 *   compression, best fits within `maxBatchSize`.
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
      const currentBatch = {
        ...podcastMetadataToSync,
        id: removePrefixFromPodcastId(result.podcastId),
        episodes: (episodesToSync || []).slice(-numEps),
      };
      const diff = withMetadataBatchNumber(
        rightDiff(priorBatchMetadata, currentBatch, ['id', 'feedType', 'feedUrl']),
        priorBatchMetadata,
      );

      const tags = formatMetadataTxTags(diff, cachedMetadata);
      const tagsSize = calculateTagsSize(tags);
      const gzip : Uint8Array = compressMetadata(diff);

      const relativeBatchSize = (tagsSize + gzip.byteLength) / maxBatchSize;
      const resultMargin = Math.abs(OPTIMAL_RELATIVE_BATCH_SIZE - relativeBatchSize);
      if (resultMargin < bestResultMargin) {
        // Best intermediate result has a relativeBatchSize closest to OPTIMAL_RELATIVE_BATCH_SIZE.
        // Pass 1 always hits this branch, to ensure a usable result is populated.
        bestResultMargin = resultMargin;
        result.numEpisodes = numEps;
        result.compressedMetadata = gzip;
        result.metadata = diff;
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

  const podcastId = podcastMetadataToSync.id || cachedMetadata.id || '';
  let result : PartitionedBatch = {
    podcastId,
    kind: 'metadataBatch',
    title: podcastMetadataToSync.title || cachedMetadata.title || '',
    numEpisodes: episodesToSync.length,
    metadata: { ...allMetadataDiff, id: removePrefixFromPodcastId(podcastId) },
    compressedMetadata: new Uint8Array([]),
    tags: [],
  };

  if (!hasMetadata(episodesToSync) || !maxBatchSize) {
    if (hasMetadata(episodesToSync)) {
      result.metadata = withMetadataBatchNumber(result.metadata, cachedMetadata);
    }
    result.compressedMetadata = compressMetadata(result.metadata);
    result.tags = formatMetadataTxTags(result.metadata, cachedMetadata);
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
    const currentBatch = findNextBatch(cachedMetadata, priorBatchMetadata, mainMetadata,
      episodesRemainder, maxBatchSize);
    batches.push(currentBatch);
    previousBatchMetadata = currentBatch.metadata;

    const newEpisodesRemainder = episodesRemainder.slice(0, -currentBatch.numEpisodes);
    if (newEpisodesRemainder.length >= episodesRemainder.length) break; // fail-safe
    episodesRemainder = newEpisodesRemainder;
  }
  while (episodesRemainder.length);

  return batches.filter(batch => hasMetadata(batch.metadata));
}

/**
 * Dispatches or signs and posts the `allTxs` that were initialized through {@linkcode initSync()}.
 * @returns `allTxs` where each initialized tx now has a new status: POSTED or ERRORED
 * @see {@linkcode ArSync}
 */
async function startSync(
  allTxs: ArSyncTx[],
  wallet: JWKInterface | WalletDeferredToArConnect,
) : Promise<ArSyncTx[]> {
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
      result[index] = {
        ...tx,
        dispatchResult,
        resultObj: postedTxResult,
        status: postedTxResult instanceof Error ? ArSyncTxStatus.ERRORED : ArSyncTxStatus.POSTED,
      };
    }
    else result[index] = tx;
  }));
  console.debug('startSync result:', result);

  return result;
}

/** Called after {@linkcode startSync()} by `ArweaveProvider` */
function formatNewMetadataToSync(
  allTxs: ArSyncTx[],
  prevMetadataToSync: Partial<Podcast>[] = [],
) : Partial<Podcast>[] {
  console.debug('formatNewMetadataToSync prevMetadataToSync:', prevMetadataToSync);
  let diffs = [...prevMetadataToSync];
  allTxs.forEach(tx => {
    if (isPosted(tx) || isConfirmed(tx)) {
      const { podcastId, metadata } = tx;
      const prevPodcastToSyncDiff = findMetadataById(podcastId, diffs);
      let newDiff : Partial<Podcast> = {};
      if (hasMetadata(prevPodcastToSyncDiff)) {
        newDiff = rightDiff(metadata, prevPodcastToSyncDiff, ['id', 'feedType', 'feedUrl']);
      }

      if (hasThreadTxKind(tx)) newDiff = removePostFromPodcast(tx.metadata, newDiff);

      diffs = diffs.filter(oldDiff => oldDiff.id !== podcastId);
      if (hasMetadata(newDiff)) diffs.push(newDiff);
    }
  });

  console.debug('formatNewMetadataToSync returned:', diffs);
  return diffs;
}
