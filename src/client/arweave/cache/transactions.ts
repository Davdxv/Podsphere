import {
  CachedArTx,
  GraphQLMetadata,
  Podcast,
  PodcastTags,
  Primitive,
} from '../../interfaces';
import {
  episodesCount,
  hasMetadata,
  isNotEmpty,
  isValidDate,
  isValidInteger,
  isValidKind,
  isValidString,
  isValidUuid,
} from '../../../utils';
import { hasMetadataTxKind } from '../utils';

/**
 * The cached transactions, exclusively populated from GraphQL results.
 * So these should never contain a candidate `podcastId`.
 * It's initialized by SubscriptionsProvider, which also maintains an IndexedDb table for it.
 * @see {@linkcode CachedArTx}
 */
export const txCache : CachedArTx[] = [];

const passesSimpleValidation = (tx: CachedArTx) => isNotEmpty(tx) && isValidString(tx.txId)
  && isValidUuid(tx.podcastId);

/**
 * Initializes the txCache with the given object (fetched from IndexedDb).
 */
export function initializeTxCache(newTxCache: CachedArTx[] = []) {
  // Empty the cache first
  txCache.splice(0, txCache.length, ...newTxCache.filter(passesSimpleValidation));
}

/**
 * @param gqlMetadata
 * @param tags
 * @param metadata
 * @returns The `CachedArTx` corresponding to the given parameters.
 *   If it doesn't exist yet in the cache, it's first created and added to the cache.
 *   Returns `null` if params are lacking data for creating a new `CachedArTx` (shouldn't happen).
 *
 *   NOTE: The returned CachedArTx has `txBlocked = true` if it's not a {@linkcode isValidTx()}.
 */
export function getCachedTxForFeed(gqlMetadata: GraphQLMetadata, tags: PodcastTags,
  metadata: Podcast | {} = {}) : CachedArTx | null {
  if (!hasMetadata(tags) || !gqlMetadata?.txId || !gqlMetadata?.ownerAddress) {
    console.error('getCachedTxForFeed() shouldn\'t be called without gqlMetadata or tags',
      { gqlMetadata, tags });
    return null;
  }

  try {
    const { id, kind, ...otherTags } = tags;
    const { txId, ownerAddress, txBundledIn } = gqlMetadata;
    const cachedTx : CachedArTx | null = findCachedTx(txId);
    if (cachedTx) return cachedTx;

    const newTx : CachedArTx = {
      podcastId: tags.id || '',
      txId,
      kind: tags.kind,
      txBlocked: false,
      tags: otherTags,
      ownerAddress,
      numEpisodes: 0,
    };
    if (txBundledIn) newTx.txBundledIn = txBundledIn;
    if (hasMetadata(metadata)) newTx.numEpisodes = episodesCount(metadata as Podcast);
    newTx.txBlocked = !isValidTx(newTx);

    addNewTx(newTx);

    console.debug('new txCache:', txCache);

    return newTx;
  }
  catch (ex) {
    console.warn('getCachedTxForFeed() encountered an unexpected error:', ex);
  }
  return null;
}

export function removeTxIds(txIdsToRemove: CachedArTx['txId'][]) {
  const newTxs = [...txCache.filter(tx => !txIdsToRemove.includes(tx.txId))];
  txCache.splice(0, txCache.length, ...newTxs);
}

export function removeUnsubscribedIds(idsToKeep: Podcast['id'][]) {
  const newTxs = [...txCache.filter(tx => idsToKeep.includes(tx.podcastId))];
  txCache.splice(0, txCache.length, ...newTxs);
}

/**
 * @param tx
 * @param metadata Validate metadata iff this param is given
 * @returns false if the tx should be blocked
 */
function isValidTx(tx: CachedArTx, metadata: Podcast | {} | undefined = undefined) : boolean {
  // TODO: add more validations for deeming txBlocked := true.

  if (!isValidKind(tx.kind)) return false;

  if (metadata) { /* Validate metadata */
    if (hasMetadataTxKind(tx) && !hasMetadata(metadata)) return false;
  }

  if (!isValidUuid(tx.podcastId)) return false;
  if (!hasMetadata(tx.tags)) return false;
  if (!isValidString(tx.ownerAddress)) return false;

  return true;
}

function addNewTx(newTx: CachedArTx) : void {
  const index = findCachedTxIndex(newTx.txId);
  if (index >= 0) txCache[index] = newTx;
  else txCache.push(newTx);
}

const findCachedTxIndex = (txId: CachedArTx['txId']) => txCache.findIndex(tx => tx.txId === txId);

export const findCachedTx = (txId: CachedArTx['txId']) : CachedArTx | null => {
  const index = findCachedTxIndex(txId);
  return index >= 0 ? txCache[index] : null;
};

const onlyUnique = <T extends Primitive | null>(value: T, index: number, self: T[]) => value
  !== null && self.indexOf(value) === index;

// TODO: filter `ownerAddress` too, once we have the data structure for it
export const isBlocked = (tx: CachedArTx) => tx.txBlocked;
export const isNotBlocked = (tx: CachedArTx) => !tx.txBlocked;

const encompassesDate = (
  tx: CachedArTx, epDate: Date,
) => isValidDate(tx.tags.firstEpisodeDate) && isValidDate(tx.tags.lastEpisodeDate)
  && epDate >= tx.tags.firstEpisodeDate && epDate <= tx.tags.lastEpisodeDate;

/**
 * @param podcastId
 * @param epDate
 * @returns The lowest cached metadataBatch number matching the given params
 * @throws if no match was found
 */
export function getCachedBatchNumberForDate(podcastId: PodcastTags['id'], epDate: Date) : number {
  const matchingTxs = txCache.filter(tx => !isBlocked(tx) && tx.podcastId === podcastId);
  const batchNumbers = matchingTxs.map(tx => (isNotEmpty(tx.tags)
    && isValidInteger(tx.tags.metadataBatch) ? tx.tags.metadataBatch : null))
    .filter(onlyUnique).sort() as number[];

  for (let i = 0; i < batchNumbers.length; i++) {
    const matchingTx = matchingTxs
      .find(tx => tx.tags.metadataBatch === batchNumbers[i] && encompassesDate(tx, epDate));
    if (matchingTx) return batchNumbers[i];
  }

  throw new Error('Could not find batch number');
}
