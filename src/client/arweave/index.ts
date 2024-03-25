import {
  ArSyncTx, DispatchResultDTO, StringToStringMapping,
  TransactionStatusResponse,
} from '../interfaces';
import { isNotEmpty } from '../../utils';
import client from './client';
import { getArBundledParentIds } from './graphql-ops';
import {
  getLayer1TxId,
  getLayer2TxId,
  getTxId,
  isBundled,
} from './utils';

export { getAllThreads, getPodcastRss2Feed, pingTxIds } from './graphql-ops';
export { createNewDevWallet, getWalletAddress } from './wallet';
export {
  newThreadTransaction,
  newTransactionFromCompressedMetadata,
  newTransactionFromMetadata,
  signAndPostTransaction,
  dispatchTransaction,
} from './create-transaction';
export { arSyncTxsFromDTO, arSyncTxsToDTO } from './utils';

export async function getTxConfirmationStatus(arSyncTx: ArSyncTx)
  : Promise<TransactionStatusResponse> {
  let result : TransactionStatusResponse;
  try {
    result = await client.transactions.getStatus(getTxId(arSyncTx));
  }
  catch (_ex) {
    result = { status: 500, confirmed: null };
  }

  return result;
}

/**
 * Generates a list of transaction id's that were Arbundled into parent transactions and missing
 * their parent transaction id's. Then fetches the parent id's using a single GraphQL call.
 * Returns only the arSyncTxs that were updated in this process.
 * @param arSyncTxs All/unfilter()ed arSyncTxs
 * @returns The arSyncTxs that were updated by population of the dispatchResult.bundledIn field
 */
export async function updateArBundledParentIds(arSyncTxs: ArSyncTx[]) : Promise<ArSyncTx[]> {
  const updatedTxs : ArSyncTx[] = [];
  const bundledTxs : ArSyncTx[] = arSyncTxs.filter(isBundled);
  const idsToLookUp : string[] = bundledTxs.filter(arSyncTx => !getLayer2TxId(arSyncTx))
    .map(getLayer1TxId).filter(x => x);
  if (!idsToLookUp.length) return [] as ArSyncTx[];

  const mapping : StringToStringMapping = await getArBundledParentIds(idsToLookUp);
  Object.entries(mapping).forEach(([id, parentId]) => {
    const oldTx = bundledTxs.find(arSyncTx => arSyncTx.dispatchResult!.id === id);
    const prevResult = oldTx?.dispatchResult;
    if (isNotEmpty(oldTx) && isNotEmpty(prevResult)) {
      const dispatchResult : DispatchResultDTO = { ...prevResult, bundledIn: parentId };
      updatedTxs.push({ ...oldTx, dispatchResult });
    }
  });

  return updatedTxs;
}
