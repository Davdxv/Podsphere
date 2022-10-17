import React, {
  createContext, useState, useContext,
  useRef, useEffect, useCallback,
} from 'react';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { TransactionStatusResponse } from 'arweave/node/transactions';
import { ApiConfig } from 'arweave/node/lib/api';
// eslint-disable-next-line import/no-extraneous-dependencies
import { AppInfo, GatewayConfig, PermissionType } from 'arconnect';
import { toast } from 'react-toastify';
import useRerenderEffect from '../hooks/use-rerender-effect';
import { IndexedDb } from '../indexed-db';
import { DBStatus, SubscriptionsContext } from './subscriptions';
import {
  concatMessages,
  isEmpty,
  isNotEmpty,
  unixTimestamp,
  valuesEqual,
} from '../utils';
import {
  arSyncTxToString,
  hasMetadataTxKind,
  hasThreadTxKind,
  isErrored,
  isInitialized,
  isNotErrored,
  isNotInitialized,
  isPosted,
  updateArSyncTxs,
  usingArConnect,
  usingArLocal,
} from '../client/arweave/utils';
import { WalletDeferredToArConnect } from '../client/arweave/wallet';
import client from '../client/arweave/client';
import {
  ArSyncTx,
  ArSyncTxDTO,
  ArSyncTxStatus,
  Post,
} from '../client/interfaces';
import * as Arweave from '../client/arweave';
import ArSync from '../client/arweave/sync';

interface ArweaveContextType {
  isSyncing: boolean,
  wallet: JWKInterface | WalletDeferredToArConnect,
  walletAddress: string,
  loadNewWallet: (loadedWallet: JWKInterface | WalletDeferredToArConnect,
    newWalletAddress: string | undefined) => Promise<void>,
  arSyncTxs: ArSyncTx[],
  prepareSync: () => Promise<void>,
  startSync: () => Promise<void>,
  removeArSyncTxs: (ids: string[] | null) => void,
  hasPendingTxs: boolean,
}

export const ArweaveContext = createContext<ArweaveContextType>({
  isSyncing: false,
  wallet: {},
  walletAddress: '',
  loadNewWallet: async () => {},
  arSyncTxs: [],
  prepareSync: async () => {},
  startSync: async () => {},
  removeArSyncTxs: () => {},
  hasPendingTxs: false,
});

/**
 * Start of ArConnect config params @see https://github.com/th8ta/ArConnect#permissions
 */
const ARCONNECT_PERMISSIONS : PermissionType[] = [
  'ACCESS_ADDRESS',
  'ACCESS_ALL_ADDRESSES', // Required for wallet switching
  // 'ACCESS_ARWEAVE_CONFIG', // TODO: prefer this over clientApiConfig under ARCONNECT_GATEWAY
  'ACCESS_PUBLIC_KEY',
  // 'DECRYPT',
  'DISPATCH',
  // 'ENCRYPT',
  // 'SIGNATURE',
  'SIGN_TRANSACTION', // TODO: request this permission when needed
];
const ARCONNECT_APPINFO : AppInfo = {
  name: `Podsphere ${process.env.REACT_APP_VERSION}`,
  // logo: '', TODO
};
const clientApiConfig : ApiConfig = client.getConfig().api;
// Optional gateway config. NOTE: these aren't observed when using ArConnect's dispatch().
const ARCONNECT_GATEWAY : GatewayConfig | undefined = clientApiConfig.host && clientApiConfig.port
  && clientApiConfig.protocol ? {
    host: clientApiConfig.host,
    port: +clientApiConfig.port,
    protocol: clientApiConfig.protocol === 'http' ? 'http' : 'https',
  } : undefined;
/** End */

const TX_CONFIRMATION_INTERVAL = 60 /* seconds */ * 1000;
const TX_EXPIRY_TIME = 1 /* minutes */ * 60;

// TODO: ArSync v1.5+, test me
const ArweaveProvider : React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    dbReadCachedArSyncTxs, dbStatus, dbWriteCachedArSyncTxs,
    isRefreshing, metadataToSync, redraftPost,
    refresh, setDbStatus, setMetadataToSync,
  } = useContext(SubscriptionsContext);
  const [wallet, setWallet] = useState<JWKInterface | WalletDeferredToArConnect>({});
  const [walletAddress, setWalletAddress] = useState('');
  const loadingWallet = useRef(false);
  const eventListenersLoaded = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [arSyncTxs, setArSyncTxs] = useState<ArSyncTx[]>([]);

  function hasPendingTxs() {
    return arSyncTxs.some(isInitialized);
  }

  const pluralize = (array: any[]) => (array.length > 1 ? 's' : '');

  async function prepareSync() {
    if (isEmpty(wallet) && !usingArConnect()) return cancelSync('Wallet is undefined');
    if (isSyncing || isRefreshing || hasPendingTxs()) return;

    setIsSyncing(true);

    const [newSubscriptions, newMetadataToSync] = await refresh(null, true, 600); // TODO MVP: => 30

    if (!newSubscriptions || isEmpty(newSubscriptions)) {
      return cancelSync('Failed to refresh subscriptions.');
    }
    if (!newMetadataToSync || isEmpty(newMetadataToSync)) {
      return cancelSync('Subscribed podcasts are already up-to-date.', 'info');
    }

    let newTxs : ArSyncTx[];
    try {
      if (usingArConnect()) {
        newTxs = await ArSync.initSync(newSubscriptions, newMetadataToSync, wallet);
      }
      // else if (usingArLocal()) { /** Uncomment temporarily to generate batched arlocal seeds */
      //   const batchSize = 96 * 1024;
      //   newTxs = await ArSync.initSync(newSubscriptions, newMetadataToSync, wallet, batchSize);
      // }
      else newTxs = await ArSync.initSync(newSubscriptions, newMetadataToSync, wallet, null);
    }
    catch (ex) {
      console.error(ex);
      return cancelSync(`Failed to sync with Arweave: ${ex}`);
    }

    const failedTxs = newTxs.filter(isErrored);
    if (!newTxs.some(isInitialized)) {
      if (!failedTxs.length) {
        return cancelSync('Subscribed podcasts are already up-to-date.', 'info');
      }
      // All transactions failed to create; probably due to invalid wallet or disconnectivity
      return cancelSync(`Failed to sync with Arweave: ${failedTxs[0].resultObj}`);
    }
    const successfulTxs = newTxs.filter(isNotErrored);
    toast.success(`${successfulTxs.length} transaction${pluralize(successfulTxs)} initialized.\n`
      + 'Click the Sync button again to post pending transactions.');

    setArSyncTxs(prev => prev.concat(newTxs));
    setIsSyncing(false);
  }

  async function cancelSync(toastMessage = '', toastVariant = 'danger') {
    setIsSyncing(false);

    if (toastMessage) {
      if (toastVariant === 'danger') {
        toast.error(`${toastMessage}\nPlease try to sync again.`, { autoClose: 15000 });
      }
      else toast.info(toastMessage);
    }
    if (hasPendingTxs()) {
      toast.warn('Pending transactions have been cleared, but their data is still cached.');
      setArSyncTxs(arSyncTxs.filter(isNotInitialized));
    }
  }

  async function startSync() {
    if (isEmpty(wallet) && !usingArConnect()) throw new Error('wallet is undefined');
    if (!hasPendingTxs()) return cancelSync();

    setIsSyncing(true);

    const txsToSync = arSyncTxs.filter(isInitialized);
    const txsToSyncIds = txsToSync.map(tx => tx.id);
    let allTxs : ArSyncTx[];
    try {
      allTxs = await ArSync.startSync(arSyncTxs, wallet);
    }
    catch (ex) {
      console.error(ex);
      return cancelSync(`Failed to sync with Arweave: ${ex}`);
    }

    const syncResultTxs = allTxs.filter(tx => txsToSyncIds.includes(tx.id));
    const postedTxs = syncResultTxs.filter(isPosted);
    const erroredTxs = syncResultTxs.filter(isErrored);

    try {
      if (isNotEmpty(postedTxs)) {
        const message =
          concatMessages(postedTxs.map(tx => `\n${tx.title}:\n${arSyncTxToString(tx)}`));
        toast.success(`${postedTxs.length} Transaction${pluralize(postedTxs)} successfully posted `
          + `to Arweave:\n\n${message}`, { autoClose: 8000 });
      }
      if (isNotEmpty(erroredTxs)) {
        const message = concatMessages(erroredTxs.map(tx => (
          `\n${tx.title} (${arSyncTxToString(tx)}), reason:\n${tx.resultObj}\n`
        )));
        toast.error(`${erroredTxs.length} Transaction${pluralize(erroredTxs)} failed to post to `
          + `Arweave:\n\n${message}`, { autoClose: false });
      }
      setMetadataToSync(ArSync.formatNewMetadataToSync(allTxs, metadataToSync));
    }
    catch (ex) {
      console.error(`An unexpected error occurred during synchronization with Arweave: ${ex}`);
    }
    finally {
      setArSyncTxs(allTxs);
      setIsSyncing(false);
    }
  }

  /**
   * Removes elements matching `ids` from the `arSyncTxs` state.
   * Clears all `arSyncTxs` if `ids` is null.
   * @param ids
   */
  function removeArSyncTxs(ids: string[] | null) {
    if (ids === null) setArSyncTxs([]);
    else {
      const newValue : ArSyncTx[] = arSyncTxs.filter(tx => !ids.includes(tx.id));
      setArSyncTxs(newValue);
    }
  }

  /**
   * Determines the transaction status of the posted `arSyncTxs` and updates the confirmed ones.
   */
  const confirmArSyncTxs = useCallback(async () => {
    if (isSyncing || isRefreshing) return;
    // console.debug('Checking for transaction confirmations...');

    const confirmedArSyncTxs : ArSyncTx[] = [];
    const idUpdatedArSyncTxs : ArSyncTx[] = await Arweave.updateArBundledParentIds(arSyncTxs);
    const newArSyncTxs : ArSyncTx[] = updateArSyncTxs(arSyncTxs, idUpdatedArSyncTxs);

    await Promise.all(newArSyncTxs.filter(isPosted).map(async postedTx => {
      const status : TransactionStatusResponse = await Arweave.getTxConfirmationStatus(postedTx);
      const age = postedTx.timestamp ? (unixTimestamp() - postedTx.timestamp) : 0;

      if (status.status === 200 && status.confirmed) {
        // TODO: make number_of_confirmations configurable
        if (usingArLocal() || status.confirmed.number_of_confirmations >= 3) {
          confirmedArSyncTxs.push({ ...postedTx, status: ArSyncTxStatus.CONFIRMED });
        }
      }
      else if (status.status === 404 && age >= TX_EXPIRY_TIME) {
        confirmedArSyncTxs.push({ ...postedTx, status: ArSyncTxStatus.REJECTED });

        if (hasThreadTxKind(postedTx)) redraftPost(postedTx.metadata as Post);
      }
    }));

    if (confirmedArSyncTxs.length || idUpdatedArSyncTxs.length) {
      setArSyncTxs(updateArSyncTxs(newArSyncTxs, confirmedArSyncTxs));
    }
    if (confirmedArSyncTxs.length) {
      console.debug('At least one posted transaction has been confirmed or expired.');
      const confirmedMetadataTxs = confirmedArSyncTxs.filter(hasMetadataTxKind);
      const confirmedPodcastIds = new Set<string>(confirmedMetadataTxs.map(tx => tx.podcastId));
      if (confirmedPodcastIds.size) await refresh([...confirmedPodcastIds], true, 0);
    }
  }, [isSyncing, isRefreshing, arSyncTxs, redraftPost, refresh]);

  /**
   * Loads the state variables `wallet` and `walletAddress` for the given `loadedWallet`.
   * If `loadedWallet` is empty, a new developer wallet is created and some AR tokens are minted.
   */
  const loadNewWallet = useCallback(async (
    loadedWallet: JWKInterface | WalletDeferredToArConnect,
    newWalletAddress: string = '',
  ) => {
    if (!loadingWallet.current) {
      loadingWallet.current = true;

      if (usingArConnect()) {
        const address = newWalletAddress || await Arweave.getWalletAddress(loadedWallet);
        setWalletAddress(address);
        setWallet(loadedWallet);
      }
      else {
        const newWallet : JWKInterface | WalletDeferredToArConnect = (isNotEmpty(loadedWallet)
          ? loadedWallet : await Arweave.createNewDevWallet());
        if (!valuesEqual(wallet, newWallet)) {
          const address = await Arweave.getWalletAddress(newWallet);
          setWalletAddress(address);
          setWallet(newWallet);
        }
      }

      loadingWallet.current = false;
    }
  }, [wallet]);

  const connectArConnect = useCallback(async () => {
    if (!loadingWallet.current) {
      loadingWallet.current = true;

      try {
        await window.arweaveWallet.connect(ARCONNECT_PERMISSIONS, ARCONNECT_APPINFO,
          ARCONNECT_GATEWAY);
        const allowedPermissions : PermissionType[] = await window.arweaveWallet.getPermissions();
        if (!ARCONNECT_PERMISSIONS.every(perm => allowedPermissions.includes(perm))) {
          // TODO minor: explain to the user why we need these permissions
          toast.error('Insufficient permissions! Please try reconnecting your ArConnect wallet.');
          await window.arweaveWallet.disconnect();
          setTimeout(connectArConnect, 5000); // User can click 'cancel' to break this loop
        }
        else {
          loadingWallet.current = false;
          await loadNewWallet({});
        }
      }
      catch (ex) {
        toast.error(`Unable to connect to the ArConnect wallet browser extension: ${ex}`);
        console.warn(`Unable to connect to the ArConnect wallet browser extension: ${ex}`);
      }
      finally {
        loadingWallet.current = false;
      }
    }
  }, [loadNewWallet]);

  useEffect(() => {
    if (usingArLocal()) loadNewWallet(wallet);

    if (!eventListenersLoaded.current) { /* Setup event listeners */
      eventListenersLoaded.current = true;
      window.addEventListener('walletSwitch', event => {
        const newAddress = event.detail.address;
        loadNewWallet(wallet, newAddress);
      });

      window.addEventListener('arweaveWalletLoaded', () => {
        console.debug('ArConnect loaded => initializing config and permissions');
        connectArConnect();
      });
    }
  }, [wallet, loadNewWallet, connectArConnect]);

  useEffect(() => {
    const id = setInterval(confirmArSyncTxs, TX_CONFIRMATION_INTERVAL);
    return () => clearInterval(id);
  }, [confirmArSyncTxs]);

  useEffect(() => {
    const initializeArSyncTxs = async () => {
      try {
        const fetchedData : ArSyncTxDTO[] = await dbReadCachedArSyncTxs() || [];
        const arSyncTxsObject : ArSyncTx[] = Arweave.arSyncTxsFromDTO(fetchedData);
        setArSyncTxs(arSyncTxsObject);
      }
      catch (ex) {
        const errorMessage = `Unable to read the cached transaction history:\n${ex}\n\n`
          + `${IndexedDb.DB_ERROR_GENERIC_HELP_MESSAGE}`;
        console.error(errorMessage);
        toast.error(errorMessage, { autoClose: false });
      }
      finally {
        setDbStatus(DBStatus.INITIALIZED);
      }
    };

    if (dbStatus === DBStatus.INITIALIZING3) initializeArSyncTxs();
  }, [dbStatus, dbReadCachedArSyncTxs, setDbStatus]);

  useRerenderEffect(() => {
    const updateCachedArSyncTxs = async () => {
      try {
        const txsToCache = arSyncTxs.filter(isNotInitialized);
        const arSyncTxsDto : ArSyncTxDTO[] = Arweave.arSyncTxsToDTO(txsToCache, true);
        await dbWriteCachedArSyncTxs(arSyncTxsDto);
      }
      catch (ex) {
        const errorMessage = `Unable to save the transaction history to IndexedDB:\n${ex}\n\n`
          + `${IndexedDb.DB_ERROR_GENERIC_HELP_MESSAGE}`;
        console.error(errorMessage);
        toast.error(errorMessage, { autoClose: false });
      }
    };

    // TODO: warn upon leaving page if there are pending Initialized arSyncTxs, as these aren't
    //   cached (and should not be cached since recreating them costs nothing and avoids timeouts).

    console.debug('arSyncTxs has been updated to:', arSyncTxs);
    if (dbStatus >= DBStatus.INITIALIZED) updateCachedArSyncTxs();
  }, [arSyncTxs]);

  return (
    <ArweaveContext.Provider
      value={{
        isSyncing,
        wallet,
        walletAddress,
        loadNewWallet,
        arSyncTxs,
        prepareSync,
        startSync,
        removeArSyncTxs,
        hasPendingTxs: hasPendingTxs(),
      }}
    >
      {children}
    </ArweaveContext.Provider>
  );
};

export default ArweaveProvider;
