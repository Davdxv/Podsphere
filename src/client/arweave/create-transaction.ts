import { JWKInterface } from 'arweave/node/lib/wallet';
import Transaction from 'arweave/node/lib/transaction';
// eslint-disable-next-line import/no-extraneous-dependencies
import { DispatchResult } from 'arconnect';
import {
  ArweaveTag,
  Episode,
  MandatoryTags,
  METADATA_TX_KINDS,
  OPTIONAL_ARWEAVE_STRING_TAGS,
  Podcast,
  TransactionKind,
  TRANSACTION_KINDS,
} from '../interfaces';
import { WalletDeferredToArConnect } from './wallet';
import client from './client';
import { compressMetadata, toTag, usingArConnect } from './utils';
import {
  unixTimestamp,
  toISOString,
  isNotEmpty,
  isValidDate,
  isValidInteger,
  getFirstEpisodeDate,
  getLastEpisodeDate,
} from '../../utils';
import { isValidUuid, removePrefixFromPodcastId } from '../../podcast-id';
import { getCachedBatchNumberForDate } from './cache/transactions';

/**
 * {@linkcode https://github.com/joshbenaron/arweave-standards/blob/ans104/ans/ANS-104.md ANS-104}
 *   Arweave standard limits max tags to 128, but mind leaving some space for extra meta tags
 */
const MAX_TAGS = 120;
/** ANS-104 limits each tag name size to 1024 bytes */
const MAX_TAG_NAME_SIZE = 1024 - toTag('').length;
/** ANS-104 limits each tag value size to 3072 bytes */
const MAX_TAG_VALUE_SIZE = 3072;

/**
 * @param tag Tuple of two strings representing the tag name and value
 * @returns The given `tag` as string tuple, trimmed to fit Arweave's size limitations.
 *   Returns `null` if the tag name or value is empty or if the name is not a string.
 */
const validateAndTrimTag = (tag: ArweaveTag) : ArweaveTag | null => {
  const [name, val] = tag;
  if (!name || !val || typeof name !== 'string') return null;

  const validName = name.length <= MAX_TAG_NAME_SIZE ? name : name.substring(0, MAX_TAG_NAME_SIZE);
  let validVal = `${val}`;
  if (validVal.length > MAX_TAG_VALUE_SIZE) validVal = validVal.substring(0, MAX_TAG_VALUE_SIZE);
  return [validName, validVal] as ArweaveTag;
};

export function formatTags(
  newMetadata: Partial<Podcast>,
  cachedMetadata: Partial<Podcast> = {},
  kind: TransactionKind = 'metadataBatch',
) : ArweaveTag[] {
  // An updated id is assumed to have been fetched through SubscriptionsProvider.refresh()
  let id = removePrefixFromPodcastId(newMetadata.id || cachedMetadata.id || '');
  if (!isValidUuid(id)) id = '';
  const title = newMetadata.title || cachedMetadata.title || '';

  const mandatoryPodcastTags : [MandatoryTags | 'title', string | undefined][] = [
    ['id', removePrefixFromPodcastId(id)],
    ['feedType', newMetadata.feedType || cachedMetadata.feedType],
    ['feedUrl', newMetadata.feedUrl || cachedMetadata.feedUrl],
    ['kind', TRANSACTION_KINDS.includes(kind) ? kind : ''],
  ];
  if (METADATA_TX_KINDS.includes(kind)) {
    mandatoryPodcastTags.push(['title', title]);
  }

  const getMandatoryTagsValues = (key: MandatoryTags) => mandatoryPodcastTags
    .find(element => element[0] === key)![1];

  mandatoryPodcastTags.forEach(([name, value]) => {
    if (!value) {
      throw new Error('Could not upload metadata for '
        + `${title || getMandatoryTagsValues('feedUrl')}: ${name} is missing`);
    }
  });

  const podcastTags : ArweaveTag[] = [...mandatoryPodcastTags];
  OPTIONAL_ARWEAVE_STRING_TAGS.forEach(tagName => {
    const val = newMetadata[tagName as keyof Podcast] as string;
    if (val) podcastTags.push([tagName, `${val}`]);
  });
  const episodeBatchTags : ArweaveTag[] = isNotEmpty(newMetadata.episodes) ? episodeTags(
    id,
    newMetadata.episodes,
    cachedMetadata,
    newMetadata.metadataBatch,
  ) : [];
  const pluralTags : ArweaveTag[] = [];
  // Add new categories and keywords in string => string format
  (newMetadata.categories || []).forEach(cat => pluralTags.push(['category', cat]));
  (newMetadata.keywords || []).forEach(key => pluralTags.push(['keyword', key]));
  (newMetadata.episodesKeywords || []).forEach(key => pluralTags.push(['episodesKeyword', key]));
  const validTags : ArweaveTag[] = [
    ...podcastTags,
    ...episodeBatchTags,
    ...pluralTags,
  ].map(validateAndTrimTag).filter(x => x) as ArweaveTag[];

  // pluralTags are cut off if tags exceed MAX_TAGS
  return validTags.length <= MAX_TAGS ? validTags : validTags.slice(0, MAX_TAGS);
}

async function newTransaction(
  wallet: JWKInterface | WalletDeferredToArConnect,
  compressedMetadata: Uint8Array,
  tags: ArweaveTag[] = [],
) : Promise<Transaction> {
  try {
    const trx = usingArConnect() ? await client.createTransaction({ data: compressedMetadata })
      : await client.createTransaction({ data: compressedMetadata }, wallet as JWKInterface);

    /** Add all General Purpose Tag Names suggested in:
     * @see https://github.com/joshbenaron/arweave-standards/blob/master/best-practices/BP-105.md */
    trx.addTag('App-Name', process.env.REACT_APP_TAG_PREFIX || '');
    trx.addTag('App-Version', process.env.REACT_APP_VERSION || '');
    trx.addTag('Content-Type', 'application/gzip');
    trx.addTag('Unix-Time', `${unixTimestamp()}`);
    tags.forEach(([name, value]) => {
      trx.addTag(toTag(name), `${value}`);
    });
    return trx;
  }
  catch (ex) {
    console.error('Creating transaction failed:', ex);
    throw new Error('Creating transaction failed; please try reloading your wallet.');
  }
}

/**
 * @param trx The Arweave Transaction to be signed and posted
 * @param wallet
 * @returns `trx` if signed and posted successfully
 * @throws if signing or posting fails
 */
export async function signAndPostTransaction(
  trx: Transaction,
  wallet: JWKInterface | WalletDeferredToArConnect,
)
  : Promise<Transaction> {
  let postResponse;

  try {
    if (usingArConnect()) {
      // Unused as of yet, as dispatch() is preferred, but included for future compatibility.
      await client.transactions.sign(trx);
    }
    else await client.transactions.sign(trx, wallet as JWKInterface);
    postResponse = await client.transactions.post(trx);
  }
  catch (ex) {
    console.error('Signing/posting transaction failed:', ex);
    if (!postResponse) {
      throw new Error('Signing transaction failed; please try reloading your wallet.');
    }
    throw new Error('Posting transaction failed; please try reloading your wallet.');
  }

  if (isNotEmpty(postResponse.data.error)) {
    throw new Error(`${postResponse.data.error.code}. Posting transaction failed: `
      + `${postResponse.data.error.msg}`);
  }
  return trx;
}

/**
 * Dispatches (signs and sends) the Transaction to the network, preferably by bundling it.
 * Intended to dispatch a Transaction < 100KB at reduced costs using ArConnect.
 * @see https://github.com/th8ta/ArConnect#dispatchtransaction-promisedispatchresult
 * @param trx The Arweave Transaction to be dispatched
 * @returns The DispatchResult iff dispatch() does not throw
 * @throws if dispatch() throws
 */
export async function dispatchTransaction(trx: Transaction) : Promise<DispatchResult> {
  let response : DispatchResult;
  try {
    response = await window.arweaveWallet.dispatch(trx);
  }
  catch (ex) {
    console.error(`Dispatching transaction using ArConnect failed: ${ex}. Transaction:`, trx);
    throw new Error(`Dispatching transaction using ArConnect failed: ${ex}`);
  }

  return response;
}

/**
 * @param wallet
 * @param newMetadata Assumed to already be a diff vs `cachedMetadata`
 * @param cachedMetadata
 * @returns a new Arweave Transaction object
 * @throws if `newMetadata` is incomplete or if newTransaction() throws
 */
export async function newTransactionFromMetadata(
  wallet: JWKInterface | WalletDeferredToArConnect,
  newMetadata: Partial<Podcast>,
  cachedMetadata: Partial<Podcast> = {},
) : Promise<Transaction> {
  const id = removePrefixFromPodcastId(newMetadata.id || cachedMetadata.id || '');
  const newMetadataWithId = { ...newMetadata, id };
  const cachedMetadataWithId = { ...cachedMetadata, id };

  const newCompressedMetadata : Uint8Array = compressMetadata(newMetadataWithId);
  const tags : ArweaveTag[] = formatTags(newMetadataWithId, cachedMetadataWithId);
  return newTransactionFromCompressedMetadata(wallet, newCompressedMetadata, tags);
}

/**
 * NOTE: `newTransactionFromMetadata()` always calls this function. ArSync calls it directly.
 * @param wallet
 * @param compressedMetadata
 * @param tags
 * @returns a new Arweave Transaction object
 * @throws if typecheck of parameters fails or if newTransaction() throws
 */
export async function newTransactionFromCompressedMetadata(
  wallet: JWKInterface | WalletDeferredToArConnect,
  compressedMetadata: Uint8Array,
  tags: ArweaveTag[],
) : Promise<Transaction> {
  // TODO: Add some simple type checks
  return newTransaction(wallet, compressedMetadata, tags);
}

/**
 * @param newEpisodes
 * @param cachedMetadata
 * @param metadataBatchNumber
 *   Iff null then metadataBatch is computed by {@linkcode getMetadataBatchNumber()}.
 * @returns The metadata transaction tags for the given list of newEpisodes
 */
function episodeTags(
  podcastId: Podcast['id'],
  newEpisodes: Episode[] = [],
  cachedMetadata: Partial<Podcast> = {},
  metadataBatchNumber: number | null = null,
) : ArweaveTag[] {
  if (!newEpisodes.length) { return []; }

  const firstEpisodeDate = newEpisodes[newEpisodes.length - 1].publishedAt;
  const lastEpisodeDate = newEpisodes[0].publishedAt;
  const metadataBatch = (isValidInteger(metadataBatchNumber) ? metadataBatchNumber
    : getMetadataBatchNumber(podcastId, cachedMetadata, firstEpisodeDate, lastEpisodeDate));

  return [
    ['firstEpisodeDate', toISOString(firstEpisodeDate)],
    ['lastEpisodeDate', toISOString(lastEpisodeDate)],
    ['metadataBatch', `${metadataBatch}`],
  ];
}

export function withMetadataBatchNumber(
  metadata: Partial<Podcast>,
  priorBatchMetadata: Partial<Podcast> = {},
) : Partial<Podcast> {
  const firstEpisodeDate = getFirstEpisodeDate(metadata);
  const lastEpisodeDate = getLastEpisodeDate(metadata);
  const podcastId = removePrefixFromPodcastId(metadata.id || priorBatchMetadata.id || '');

  const metadataBatch = getMetadataBatchNumber(
    podcastId, priorBatchMetadata, firstEpisodeDate, lastEpisodeDate,
  );
  return {
    ...metadata,
    firstEpisodeDate,
    lastEpisodeDate,
    metadataBatch,
  };
}

/**
 * @param cachedMetadata
 * @param firstNewEpisodeDate
 * @param lastNewEpisodeDate
 * @returns An integer denoting the batch number for the `[firstNewEpisodeDate, lastNewEpisodeDate]`
 *   interval. If the interval overlaps with `cachedMetadata`, the lowest matching metadataBatch
 *   number from the transaction cache is returned by {@linkcode getCachedBatchNumberForDate()}.
 * @throws if the batch number could not be computed
 */
export function getMetadataBatchNumber(
  podcastId: Podcast['id'],
  cachedMetadata: Partial<Podcast>,
  firstNewEpisodeDate: Date,
  lastNewEpisodeDate: Date,
) : number {
  const throwError = (msg: string) : never => {
    throw new Error(`Could not upload metadata for ${cachedMetadata.title || podcastId}: ${msg}`);
  };

  if (!isValidUuid(podcastId)) throwError('could not find Podcast id.');

  if (!isValidDate(firstNewEpisodeDate) || !isValidDate(lastNewEpisodeDate)) {
    throwError('invalid date found for one of its episodes.');
  }

  if (!isNotEmpty(cachedMetadata)) return 0;

  const cachedLastBatchNr = cachedMetadata.metadataBatch;
  const cachedFirstDate = cachedMetadata.firstEpisodeDate;
  const cachedLastDate = cachedMetadata.lastEpisodeDate;

  if (!isValidDate(cachedFirstDate) || !isValidDate(cachedLastDate)
      || !isValidInteger(cachedLastBatchNr)) { /* First metadata batch for this podcast */
    return 0;
  }

  if (firstNewEpisodeDate < cachedFirstDate) { /* Retroactive insertion of metadata */
    // TODO: This should return a negative batch number
    throwError('retroactive insertion of metadata is not yet implemented.');
  }

  if (lastNewEpisodeDate <= cachedLastDate) {
    // Return the cached metadataBatch number that encompasses `firstNewEpisodeDate`
    try {
      return getCachedBatchNumberForDate(podcastId, firstNewEpisodeDate);
    }
    catch (ex) {
      console.warn(`Could not find batch number for ${cachedMetadata.title || podcastId}.`, ex);
    }
  }

  /* Next consecutive metadata batch */
  return cachedLastBatchNr + 1;
}
