import { v4 as uuid } from 'uuid';
import {
  ArSyncTx, ArSyncTxStatus, ArweaveTag,
  DispatchResult, Episode, NonMetadataTxKind,
  Podcast, Transaction, WalletTypes,
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
 * @namespace ArSync
 * @module ArSync
 *
 * @exports {@linkcode ArSync|ArSync as default namespace}
 *   => immutable object mapping an es6-structured reference for each module member to be exported.
 *
 * @summary Main es6-module housing high-level logic to (diff &) sync new Podsphere metadata onto
 *   Arweave. Each new Transaction is wrapped in an {@link ArSyncTx} object, used to track and
 *   update tx status, persistent through IndexedDB until the user clears the tx history entry.
 *
 * @description
 *   - ArSync is Podsphere's main ES6-module for metadata synchronization with Arweave.
 *
 *   - ArSync functions as the highest-level mediator between Podsphere and the Arweave-JS API.
 *
 *   - It integrates all required logic for creating, fetching and tracking any new transactions.
 *     - Currently these comprise incremental podcast metadata or user threads/replies.
 *     - Future tx types may be as easy to add as expanding {@link extractNonMetadataBatchesToSync}.
 *
 *   - NOTE: It is not a true RESTful API, due to its present ties with React, primarily through
 *     [ArweaveProvider](../../../providers/arweave.tsx). If we decide TODO build such an API,
 *     ArSync should be seamlessly refactorable: mostly extracting a lot of logic into the new API
 *     package; similar for `ArweaveProvider`. Many other dependencies like `diff-merge-logic` would
 *     require too much rewiring if these were to also become isolated modules.
 *
 * @integrational_example
 *   Getting metadata from subscribed feeds onto Arweave roughly flows through ArSync as follows:
 *
 *   > - User clicks Sync button => [ArweaveProvider#prepareSync](../../../providers/arweave.tsx):
 *     1. Refreshes all `subscriptions` & updates `metadataToSync` with the new diffs
 *     2. Calls {@linkcode initSync()} which returns initialized txs
 *     3. Updates `ArweaveProvider.arSyncTxs` with the initialized txs
 *
 *   > - User inspects the Transactions tab & clicks Sync again =>
 *       [ArweaveProvider#startSync](../../../providers/arweave.tsx):
 *     1. Calls {@linkcode startSync()} which returns new `arSyncTxs`, where each previously
 *        initialized tx now has a new status of either POSTED or ERRORED
 *     2. Calls {@linkcode formatNewMetadataToSync()} which returns new `metadataToSync`, which is
 *        a diff vs the old one, where each POSTED or CONFIRMED tx has its (podcast/thread)
 *        metadata omitted
 *
 *   > - `ArweaveProvider` periodically updates the status of each tx
 *
 * @implements Notable intrinsic interfaces/types:
 *   - {@linkcode ArSyncTx}
 *     Main data structure used to track an Arweave transaction through its various stages.
 *   - {@linkcode ArSyncTxStatus}
 *     An enum used to track & update status of an ArSyncTx throughout each stage of its lifecycle.
 *
 * @version 1.5
 * @versions
 *   *   `1.5` Sync Threads and ThreadReplies
 *   *   `1.4` Integrate Transaction Cache, which ArSync and others concurrently use to e.g.:
 *         - cache subset {@link CachedArTx['tags']} + {@link GraphQLMetadata} of the GQL response.
 *         - for cached txs, avoid fetching their tags/data each refresh
 *         - filter `*id`s with unwanted metadata (f.i. erronous ones are flagged `txBlocked`)
 *         - map `txId`s to `tags.metadataBatch` number, which aids chronologically sound indexing
 *           of supplemental metadata on top of existing batches.
 *         - avoid fetching `txId`s whose aggregate metadata is already cached in subscriptions
 *   * `1.3.2` Change metadata primary key from subcribeUrl to uuid
 *   * `1.3.1` Add tests for 1.3
 *   *   `1.3`
 *         - Partition metadata batches by gzipped size < 100KB
 *         - Implement IndexedDB tables for metadataToSync and arSyncTxs
 *   *   `1.2` Show transaction status
 *   *   `1.1` Add tests, data validation and sanity checks
 *   *   `1.0` Support segmented sync of podcast metadata
 *   *   `0.7` Remove ArweaveSyncProvider, refactor ArSync logic
 *   *   `0.6` Improve tests, sanity checks, helper functions
 *   *   `0.5` Support seeding, posting and fetching of incremental episode metadata batches
 *
 * @license AGPLv3
 * @author https://github.com/Davdxv 2021-2022
 */
const ArSync = Object.freeze({ initSync, startSync, formatNewMetadataToSync });
export default ArSync;

/** Max size of compressed metadata per transaction (including tags) */
const MAX_BATCH_SIZE = 96 /* KiloBytes */ * 1024;

/**
 * @interface PartitionedBatch
 * @description Transient local precursor to an exported & IDB-cached {@linkcode ArSyncTx}.
 *   Comprises notably the pre-computed `compressedMetadata`, `tags` params required by
 *   {@linkcode newTransactionFromCompressedMetadata}.
 * @prop {string} podcastId uuid of the relevant podcast `= metadata.id`
 * @prop {string} kind
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
 * Subset of the {@link PartitionedBatch} interface.
 * Its `kind` prop is narrowed down to {@link NonMetadataTxKind}.
 */
interface NonMetadataBatch extends Omit<PartitionedBatch, 'kind'> {
  kind: NonMetadataTxKind;
}

/**
 * Initializes Arweave transactions from the current `metadataToSync`.
 * @returns An {@linkcode ArSyncTx} array where each element is an INITIALIZED | ERRORED tx
 * @exported @memberof {@linkcode ArSync}
 */
async function initSync(
  subscriptions: Podcast[],
  metadataToSync: Partial<Podcast>[],
  wallet: WalletTypes,
  maxBatchSize: number | null = MAX_BATCH_SIZE,
) : Promise<ArSyncTx[]> {
  // A transaction will be created for each PartitionedBatch
  const metadataBatches : PartitionedBatch[] = [];
  const otherBatches : NonMetadataBatch[] = [];

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
 * Since generation of metadata batches requires much more logic, this function first prepares
 * the NonMetadataBatches, upon which the remaining `podcastMetadataToSync` serves to compute any
 * metadata batches.
 *
 * @returns to {@linkcode initSync}:
 *   - `podcastToSync` split into `nonMetadataBatches`, `podcastMetadataToSync`
 */
function extractNonMetadataBatchesToSync(
  podcastToSync: Partial<Podcast>,
  cachedMetadata: Partial<Podcast>,
) : { nonMetadataBatches: NonMetadataBatch[], podcastMetadataToSync: Partial<Podcast> } {
  const { threads, ...podcastMetadataToSync } = podcastToSync;
  const nonMetadataBatches : NonMetadataBatch[] = [];

  if (isNotEmpty(threads)) {
    threads.forEach(post => {
      if (isValidPost(post) && !post.isDraft) {
        nonMetadataBatches.push({
          podcastId: podcastToSync.id || '',
          kind: isReply(post) ? 'threadReply' : 'thread' as NonMetadataTxKind,
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
 * @returns to {@linkcode partitionMetadataBatches}:
 *   - A {@linkcode PartitionedBatch} object, notably comprising the pre-computed params that
 *     {@linkcode newTransactionFromCompressedMetadata()} requires: `compressedMetadata`, `tags`.
 *     - ArSync pre-computes these metadata params to ensure they comprise fresh diffs.
 *     - Additionally, iff maxBatchSize is set (e.g. desired for ArConnect dispatch), these diffs
 *       comprise the best-fitting subset of `episodesToSync` out of up to 10 candidates computed by
 *       {@linkcode findNextOptimalBatch}.
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
 * @returns to {@linkcode initSync}:
 *   - An array of partitioned `podcastMetadataToSync`, which when merged should equal
 *   `podcastMetadataToSync`.
 *     - If `!maxBatchSize` or there are no episodes to sync, returns an array with one
 *       all-encompassing {@linkcode PartitionedBatch}.
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
 * @exported @memberof {@linkcode ArSync}
 */
async function startSync(allTxs: ArSyncTx[], wallet: WalletTypes) : Promise<ArSyncTx[]> {
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

/**
 * Called after {@linkcode startSync()} by `ArweaveProvider`.
 * @param allTxs all POSTED | CONFIRMED arSyncTxs currently present the local browser tx history
 * @param prevMetadataToSync The outdated metadataToSync state var
 * @returns `prevMetadataToSync` where fields that overlap (have diff) with the respective metadata
 *   in `allTxs` are omitted.
 *   TODO: Does not preserve order. This is fine if we implement CRUD timestamp & order txs by that.
 * @exported @memberof {@linkcode ArSync}
 */
function formatNewMetadataToSync(allTxs: ArSyncTx[], prevMetadataToSync: Partial<Podcast>[] = [])
  : Partial<Podcast>[] {
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
