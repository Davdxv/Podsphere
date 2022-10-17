import {
  compressSync,
  decompressSync,
  strFromU8,
  strToU8,
} from 'fflate';
import {
  findThreadInMetadata, isNotEmpty, isReply,
  podcastFromDTO, podcastToDTO,
} from '../../utils';
import {
  ArSyncTx,
  ArSyncTxDTO,
  ArSyncTxStatus,
  ArweaveTag,
  CachedArTx,
  DispatchResultDTO,
  MetadataTxKind,
  METADATA_TX_KINDS,
  Podcast,
  PodcastDTO,
  Post,
  ThreadTxKind,
  THREAD_TX_KINDS,
  TransactionDTO,
  TxKind,
} from '../interfaces';

const PLURAL_TAG_MAP = {
  category: 'categories',
  keyword: 'keywords',
  episodesKeyword: 'episodesKeywords',
};
const TAG_EXCLUDE_PREFIX = ['App-Name', 'App-Version', 'Content-Type', 'Unix-Time'];

/**
 * @returns The given tag name prefixed with the app name and a dash.
 *   Prefix is excluded for `'App-Name', 'App-Version', 'Content-Type', 'Unix-Time'`.
 */
export function toTag(name: string) {
  return TAG_EXCLUDE_PREFIX.includes(name) ? name : `${process.env.REACT_APP_TAG_PREFIX}-${name}`;
}

/** @returns The given tag name with stripped prefix */
export function fromTag(tagName: string) {
  const a = tagName.replace(new RegExp(`^${process.env.REACT_APP_TAG_PREFIX}-`), '');
  return PLURAL_TAG_MAP[a as keyof typeof PLURAL_TAG_MAP] || a;
}

/**
 * @param tags
 * @returns The size of the given Arweave tags in bytes
 */
export function calculateTagsSize(tags: ArweaveTag[]) : number {
  const tagPrefixesSize = tags.length * toTag('').length;
  const tagsSize =
    tags.flat().reduce((acc: number, str: string | undefined) => (acc + (str ? str.length : 0)), 0);
  return tagPrefixesSize + tagsSize;
}

export function compressMetadata(metadata: Partial<Podcast>) : Uint8Array {
  const u8data = strToU8(JSON.stringify(metadata));
  const gzippedData = compressSync(u8data, { level: 6, mem: 4 });
  return gzippedData;
}

export function decompressMetadata(getDataResult: Uint8Array) {
  const unzipped : string = strFromU8(decompressSync(getDataResult));
  return JSON.parse(unzipped);
}

/** Helper function in order to retain numeric ArSyncTxStatus enums */
export const statusToString = (status: ArSyncTxStatus) => {
  switch (status) {
    case ArSyncTxStatus.ERRORED:
      return 'Error';
    case ArSyncTxStatus.INITIALIZED:
      return 'Initialized';
    case ArSyncTxStatus.POSTED:
      return 'Posted';
    case ArSyncTxStatus.CONFIRMED:
      return 'Confirmed';
    case ArSyncTxStatus.REJECTED:
      return 'Rejected';
    default:
      return 'Unknown';
  }
};

export const arSyncTxToString = (tx: ArSyncTx, subscriptions: Podcast[] = [],
  metadataToSync: Partial<Podcast>[] = []) : string => {
  if (hasThreadTxKind(tx)) {
    const post = tx.metadata;
    if (isReply(post)) {
      const parent = findThreadInMetadata(post.parentThreadId, subscriptions, metadataToSync);
      return parent ? `RE: ${parent.subject}` : 'Reply';
    }
    return `${post.subject}`;
  }
  return `${tx.numEpisodes} new episodes`;
};

/** @returns Whether the given `kind` is a `MetadataTxKind` */
export const isMetadataTx = (kind: TxKind | undefined) : kind is MetadataTxKind => !!kind
  && METADATA_TX_KINDS.includes(kind as MetadataTxKind);

/** @returns Whether the given `kind` is a `ThreadTxKind` */
export const isThreadTx = (kind: TxKind | undefined) : kind is ThreadTxKind => !!kind
  && THREAD_TX_KINDS.includes(kind as ThreadTxKind);

export const hasMetadataTxKind = <T extends Pick<CachedArTx, 'kind'>>(tx: T)
  : tx is T & { metadata: Partial<Podcast> } => isMetadataTx(tx.kind);

export const hasThreadTxKind = <T extends Pick<CachedArTx, 'kind'>>(tx: T)
  : tx is T & { metadata: Post } => isThreadTx(tx.kind);

export const isErrored = (tx: ArSyncTx) => tx.status === ArSyncTxStatus.ERRORED;
export const isNotErrored = (tx: ArSyncTx) => tx.status !== ArSyncTxStatus.ERRORED;
export const isInitialized = (tx: ArSyncTx) => tx.status === ArSyncTxStatus.INITIALIZED;
export const isNotInitialized = (tx: ArSyncTx) => tx.status !== ArSyncTxStatus.INITIALIZED;
export const isPosted = (tx: ArSyncTx) => tx.status === ArSyncTxStatus.POSTED;
export const isNotPosted = (tx: ArSyncTx) => tx.status !== ArSyncTxStatus.POSTED;
export const isConfirmed = (tx: ArSyncTx) => tx.status === ArSyncTxStatus.CONFIRMED;
export const isNotConfirmed = (tx: ArSyncTx) => tx.status !== ArSyncTxStatus.CONFIRMED;
export const isBundled = (tx: ArSyncTx) => isNotEmpty(tx.dispatchResult)
  && tx.dispatchResult.type === 'BUNDLED';

/**
 * TODO: Some ArSyncTx-related functions can be refactored to return only the modified ArSyncTxs
 *       and call this function in the caller of those.
 * @param oldArSyncTxs
 * @param updatedArSyncTxs NOTE: Assumed to be a subset of `oldArSyncTxs`
 * @returns The `oldArSyncTxs` where each of the `updatedArSyncTxs` is updated in-place.
 */
export const updateArSyncTxs = (oldArSyncTxs: ArSyncTx[], updatedArSyncTxs: ArSyncTx[])
: ArSyncTx[] => oldArSyncTxs.map(oldElem => updatedArSyncTxs
  .find(newElem => newElem.id === oldElem.id) || oldElem);

/**
 * @returns - The id of the Arweave Transaction associated with the given ArSyncTx object;
 *   - an empty string if not found.
 */
export const getLayer1TxId = (tx: ArSyncTx) : string => (isBundled(tx) ? tx.dispatchResult!.id
  : (tx.resultObj as TransactionDTO).id) || '';

/**
 * @returns - The id of the parent ArBundle Arweave Transaction enclosing the ArBundled Transaction;
 *   - an empty string if not found.
 */
export const getLayer2TxId = (tx: ArSyncTx) : string => (isNotEmpty(tx.dispatchResult)
  ? (tx.dispatchResult as DispatchResultDTO).bundledIn : '') || '';

/**
 * @returns - The ArBundled tx id if there is one, else returns the main tx id;
 *   - an empty string if neither are present.
 */
export const getTxId = (tx: ArSyncTx) : string => getLayer2TxId(tx) || getLayer1TxId(tx);

/**
 * @param arSyncTxs
 * @param throwOnError
 * @returns The given `arSyncTxs`, made DTO-ready by omitting the most-sizeable transient values.
 *   Optimized `ArSyncTx` props may mutate in value as well as type, though.
 */
export function arSyncTxsToDTO(arSyncTxs: ArSyncTx[], throwOnError = false) : ArSyncTxDTO[] {
  const result : ArSyncTxDTO[] = [];
  arSyncTxs.forEach(tx => {
    try {
      let { dispatchResult, resultObj } = tx;
      if (dispatchResult) dispatchResult = dispatchResult as DispatchResultDTO;
      if (!(resultObj instanceof Error) && resultObj.id) {
        resultObj = {
          id: resultObj.id,
        } as TransactionDTO;
      }
      const { episodes, ...metadata } = tx.metadata as Partial<Podcast>;

      result.push({
        ...tx,
        dispatchResult,
        resultObj,
        metadata: podcastToDTO(metadata),
      });
    }
    catch (ex) {
      const errorMessage = `Could not read transaction history object: ${(ex as Error).message}`;
      console.warn(errorMessage);
      if (throwOnError) throw new Error(errorMessage);
    }
  });

  return result;
}

export function arSyncTxsFromDTO(arSyncTxs: ArSyncTxDTO[], throwOnError = false) : ArSyncTx[] {
  const result : ArSyncTx[] = [];
  arSyncTxs.forEach(tx => {
    try {
      let { dispatchResult, resultObj } = tx;
      if (dispatchResult) dispatchResult = dispatchResult as DispatchResultDTO;
      if (!(resultObj instanceof Error) && resultObj.id) {
        resultObj = {
          id: resultObj.id,
        } as TransactionDTO;
      }
      const { episodes, ...metadata } = tx.metadata as Partial<PodcastDTO>;

      result.push({
        ...tx,
        dispatchResult,
        resultObj,
        metadata: podcastFromDTO(metadata, false, false),
      });
    }
    catch (ex) {
      const errorMessage = `Could not read transaction history object: ${(ex as Error).message}`;
      console.warn(errorMessage);
      if (throwOnError) throw new Error(errorMessage);
    }
  });

  return result;
}

/** Defaults to true, if `process.env.REACT_APP_USE_ARCONNECT != false` */
export function usingArConnect() : boolean {
  return (process.env.REACT_APP_USE_ARCONNECT as string) !== 'false';
}

/** Defaults to false, if `process.env.REACT_APP_USE_ARLOCAL != true` */
export function usingArLocal() : boolean {
  return (process.env.REACT_APP_USE_ARLOCAL as string) === 'true';
}
