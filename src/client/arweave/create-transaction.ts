import {
  AllowedTags, ArweaveTag, DispatchResult, Episode,
  JWKInterface, MandatoryMetadataTxTags, MandatoryThreadReplyTxTags, MandatoryTags,
  MandatoryThreadTxTags, OPTIONAL_ARWEAVE_STRING_TAGS, Podcast,
  Post, Transaction, TxKind, TX_KINDS, WalletTypes,
} from '../interfaces';
import client from './client';
import {
  compressMetadata, toTag, usingArConnect,
} from './utils';
import {
  getFirstEpisodeDate, getLastEpisodeDate, isEmpty,
  isNotEmpty, isReply, isValidDate,
  isValidInteger, isValidThreadType, isValidUuid,
  toISOString, unixTimestamp,
} from '../../utils';
import { removePrefixFromPodcastId } from '../../podcast-id';
import { getCachedBatchNumberForDate } from './cache/transactions';

// TODO: sanitize

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

/**
 * @param tags
 * @returns The `tags` trimmed to fit Arweave's limitations
 *   - NOTE: tags exceeding {@linkcode MAX_TAGS} are omitted.
 *     Therefore, least important tags, like `episodesKeywords`, should be last in the array.
 */
const validateAndTrimTags = (tags: ArweaveTag[]) : ArweaveTag[] => {
  const validTags = tags.map(validateAndTrimTag).filter(x => x) as ArweaveTag[];
  return validTags.length <= MAX_TAGS ? validTags : validTags.slice(0, MAX_TAGS);
};

export function formatMetadataTxTags(
  newMetadata: Partial<Podcast>,
  cachedMetadata: Partial<Podcast> = {},
  kind: TxKind = 'metadataBatch',
) : ArweaveTag[] {
  // An updated id is assumed to have been fetched through SubscriptionsProvider.refresh()
  let id = removePrefixFromPodcastId(newMetadata.id || cachedMetadata.id || '');
  if (!isValidUuid(id)) id = '';

  const mandatoryTags : { [K in MandatoryTags | MandatoryMetadataTxTags]: string | undefined } = {
    id: removePrefixFromPodcastId(id),
    kind: TX_KINDS.includes(kind) ? kind : '',
    feedType: newMetadata.feedType || cachedMetadata.feedType || '',
    feedUrl: newMetadata.feedUrl || cachedMetadata.feedUrl || '',
    title: newMetadata.title || cachedMetadata.title || '',
  };

  Object.entries(mandatoryTags).forEach(([key, value]) => {
    if (!value) {
      const name = mandatoryTags.title || mandatoryTags.feedUrl;
      throw new Error(`Could not upload metadata for ${name}: ${key} is missing`);
    }
  });

  const podcastTags : ArweaveTag[] = Object.entries(mandatoryTags) as ArweaveTag[];
  OPTIONAL_ARWEAVE_STRING_TAGS.forEach(tagName => {
    const val = newMetadata[tagName as keyof Podcast];
    if (val) podcastTags.push([tagName, val instanceof Date ? toISOString(val) : `${val}`]);
  });
  const episodeBatchTags : ArweaveTag[] =
    episodeTags(id, newMetadata.episodes, cachedMetadata, newMetadata.metadataBatch);
  const pluralTags : ArweaveTag[] = [];
  // Add each element of categories[], keywords[] and episodesKeywords[] as [string, string]
  (newMetadata.categories || []).forEach(cat => pluralTags.push(['category', cat]));
  (newMetadata.keywords || []).forEach(key => pluralTags.push(['keyword', key]));
  (newMetadata.episodesKeywords || []).forEach(key => pluralTags.push(['episodesKeyword', key]));

  return validateAndTrimTags([...podcastTags, ...episodeBatchTags, ...pluralTags]);
}

export function formatThreadTxTags(
  post: Post,
  cachedMetadata: Partial<Podcast> = {},
) : ArweaveTag[] {
  const { id, podcastId, episodeId, content, type } = post;
  const parentPostId = isReply(post) ? post.parentPostId : '';

  const primaryMandatoryTags
  : { [K in MandatoryTags | (MandatoryThreadReplyTxTags & MandatoryThreadTxTags)]: string } = {
    id: isValidUuid(podcastId) ? podcastId : '',
    kind: isReply(post) ? 'threadReply' : 'thread',
    threadId: isValidUuid(id) ? id : '',
    type: isValidThreadType(type) ? type : '',
    content,
  };
  let secondaryMandatoryTags;
  if (isReply(post)) {
    secondaryMandatoryTags = {
      parentThreadId: isValidUuid(post.parentThreadId) ? post.parentThreadId : '',
    } as { [K in MandatoryThreadReplyTxTags]: string };
  }
  else {
    secondaryMandatoryTags = {
      subject: post.subject || '',
    } as { [K in MandatoryThreadTxTags]: string };
  }
  const mandatoryTags = { ...primaryMandatoryTags, ...secondaryMandatoryTags };
  Object.entries(mandatoryTags).forEach(([key, value]) => {
    if (!value) {
      const prefix = isReply(post) ? 'reply' : `thread "${post.subject}"`;
      const name = `${prefix} in ${cachedMetadata.title || 'podcast'}`;
      throw new Error(`Could not post ${name}: ${key} is missing`);
    }
  });

  const optionalTags : Partial<{ [K in AllowedTags]: string }> = {};
  if (isValidDate(episodeId)) optionalTags.episodeId = toISOString(episodeId);
  if (parentPostId) optionalTags.parentPostId = parentPostId;

  return validateAndTrimTags(Object.entries({ ...mandatoryTags, ...optionalTags }) as ArweaveTag[]);
}

async function newTransaction(
  wallet: WalletTypes,
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
export async function signAndPostTransaction(trx: Transaction, wallet: WalletTypes)
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
  wallet: WalletTypes,
  newMetadata: Partial<Podcast>,
  cachedMetadata: Partial<Podcast> = {},
) : Promise<Transaction> {
  const id = removePrefixFromPodcastId(newMetadata.id || cachedMetadata.id || '');
  const newMetadataWithId = { ...newMetadata, id };
  const cachedMetadataWithId = { ...cachedMetadata, id };

  const newCompressedMetadata : Uint8Array = compressMetadata(newMetadataWithId);
  const tags : ArweaveTag[] = formatMetadataTxTags(newMetadataWithId, cachedMetadataWithId);
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
  wallet: WalletTypes,
  compressedMetadata: Uint8Array,
  tags: ArweaveTag[],
) : Promise<Transaction> {
  // TODO: Add some simple type checks
  return newTransaction(wallet, compressedMetadata, tags);
}

/**
 * @param wallet
 * @param post
 * @param cachedMetadata
 * @returns a new Arweave Transaction object
 * @throws if `newMetadata` is incomplete or if newTransaction() throws
 */
export async function newThreadTransaction(
  wallet: WalletTypes,
  post: Post,
  cachedMetadata: Partial<Podcast> = {},
) : Promise<Transaction> {
  const id = post.podcastId;
  const newCompressedMetadata : Uint8Array = compressMetadata(post);
  const tags : ArweaveTag[] = formatThreadTxTags(post, { ...cachedMetadata, id });
  return newTransactionFromCompressedMetadata(wallet, newCompressedMetadata, tags);
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
  if (isEmpty(newEpisodes)) return [];

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
  const metadataBatch =
    getMetadataBatchNumber(podcastId, priorBatchMetadata, firstEpisodeDate, lastEpisodeDate);

  return { ...metadata, firstEpisodeDate, lastEpisodeDate, metadataBatch };
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

  if (isEmpty(cachedMetadata)) return 0;

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
