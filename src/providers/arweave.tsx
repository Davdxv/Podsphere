import React, {
  createContext, useState, useContext,
  useRef, useEffect, useCallback,
} from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { AppInfo, GatewayConfig, PermissionType } from 'arconnect';
import { toast } from 'react-toastify';
import {
  AnyFunction,
  ApiConfig,
  ArSyncTx,
  ArSyncTxDTO,
  ArSyncTxStatus,
  TransactionStatusResponse,
  WalletTypes,
} from '../client/interfaces';
import useRerenderEffect from '../hooks/use-rerender-effect';
import { IndexedDb } from '../indexed-db';
import { DBStatus, SubscriptionsContext } from './subscriptions';
import {
  concatMessages,
  isEmpty,
  isNotEmpty,
  pluralize,
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
import * as Arweave from '../client/arweave';
import ArSync from '../client/arweave/sync';
import { getApiConfig } from '../client/arweave/client';

interface ArweaveContextType {
  isSyncing: boolean,
  wallet: WalletTypes,
  walletAddress: string,
  loadNewWallet: (loadedWallet: WalletTypes, newWalletAddress?: string) => Promise<void>,
  arSyncTxs: ArSyncTx[],
  prepareSync: () => Promise<void>,
  startSync: () => Promise<void>,
  removeArSyncTxs: (ids: string[] | null) => void,
  hasPendingTxs: boolean,
}

type ArConnectConfig = {
  PERMISSIONS: PermissionType[],
  APPINFO: AppInfo,
  GATEWAY?: GatewayConfig,
};

const clientApiCfg : ApiConfig = getApiConfig();

/** ArConnect config params @see https://github.com/th8ta/ArConnect#permissions */
const ARCONNECT : ArConnectConfig = Object.freeze({
  PERMISSIONS: [
    'ACCESS_ADDRESS', // Required
    'ACCESS_ALL_ADDRESSES', // Required for wallet switching
    // 'ACCESS_ARWEAVE_CONFIG', // TODO: prefer this over clientApiCfg under GATEWAY
    'ACCESS_PUBLIC_KEY', // Required
    // 'DECRYPT',
    'DISPATCH', // Required
    // 'ENCRYPT',
    // 'SIGNATURE',
    'SIGN_TRANSACTION', // Required // TODO minor: request this permission when needed
  ],
  APPINFO: {
    name: `Podsphere ${process.env.REACT_APP_VERSION}`,
    // logo: '', // TODO
  },
  // Optional gateway config. NOTE: This cfg is not observed when using ArConnect's dispatch().
  GATEWAY: (!clientApiCfg.host || !clientApiCfg.port || !clientApiCfg.protocol ? undefined : {
    host: clientApiCfg.host,
    port: +clientApiCfg.port,
    protocol: clientApiCfg.protocol === 'http' ? 'http' : 'https',
  }),
});

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

const TX_CONFIRMATION_INTERVAL = 60 /* seconds */ * 1000;
const TX_EXPIRY_TIME = 1 /* minutes */ * 60; // TODO MVP: 60 mins

// TODO: ArSync v1.6+, test me
const ArweaveProvider : React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    dbReadCachedArSyncTxs, dbStatus, dbWriteCachedArSyncTxs,
    isRefreshing, metadataToSync, redraftPost,
    refresh, setDbStatus, setMetadataToSync,
  } = useContext(SubscriptionsContext);

  const [wallet, setWallet] = useState<WalletTypes>({});
  const [walletAddress, setWalletAddress] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [arSyncTxs, setArSyncTxs] = useState<ArSyncTx[]>([]);

  /** Used to prevent duplicate setTimeout calls */
  const timedFnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingWallet = useRef(false);
  const eventListenersLoaded = useRef(false);

  const hasPendingTxs = useCallback(() => arSyncTxs.some(isInitialized), [arSyncTxs]);

  async function prepareSync() {
    if (isEmpty(wallet) && !usingArConnect()) return cancelSync('Wallet is undefined');
    if (isSyncing || isRefreshing || hasPendingTxs()) return;

    setIsSyncing(true);

    const [newSubscriptions, newMetadataToSync] = await refresh(null, true, 600); // TODO MVP: => 30

    if (!isNotEmpty(newSubscriptions)) return cancelSync('Failed to refresh subscriptions.');
    if (!isNotEmpty(newMetadataToSync)) {
      return cancelSync('Subscribed podcasts are already up-to-date.', toast.info);
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
        return cancelSync('Subscribed podcasts are already up-to-date.', toast.info);
      }
      // All transactions failed to create; probably due to invalid wallet or disconnectivity
      return cancelSync(`Failed to sync with Arweave: ${failedTxs[0].resultObj}`);
    }
    const successfulTxs = newTxs.filter(isNotErrored);
    toast.success(`${pluralize('Transaction', successfulTxs)} initialized.\n`
      + 'Click the Sync button again to post pending transactions.');

    setArSyncTxs(prev => prev.concat(newTxs));
    setIsSyncing(false);
  }

  async function cancelSync(toastMessage = '', toastFn = toast.error) {
    setTimeout(() => setIsSyncing(false), 400);

    if (toastMessage) {
      if (toastFn === toast.error) {
        toast.error(`${toastMessage}\nPlease try to sync again.`, { autoClose: 15000 });
      }
      else if (typeof toastFn === 'function') toastFn(toastMessage);
    }
    if (hasPendingTxs()) {
      toast.warn('Pending transactions have been cleared, but their data is still cached.');
      setArSyncTxs(arSyncTxs.filter(isNotInitialized));
    }
  }

  async function startSync() {
    if (isEmpty(wallet) && !usingArConnect()) return cancelSync('Wallet is undefined');
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
        const msg = concatMessages(postedTxs.map(tx => `\n${tx.title}:\n${arSyncTxToString(tx)}`));
        toast.success(`${pluralize('Transaction', postedTxs)} successfully posted to Arweave:\n\n`
          + `${msg}`, { autoClose: 8000 });
      }
      if (isNotEmpty(erroredTxs)) {
        const msg = concatMessages(erroredTxs.map(tx => (
          `\n${tx.title} (${arSyncTxToString(tx)}), reason:\n${tx.resultObj}\n`
        )));
        toast.error(`${pluralize('Transaction', erroredTxs)} failed to post to Arweave:\n\n`
          + `${msg}`, { autoClose: false });
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

  /** Removes elements matching `ids` from `arSyncTxs`. Clears all `arSyncTxs` if `ids` is null. */
  function removeArSyncTxs(ids: string[] | null) : void {
    if (ids === null) setArSyncTxs([]);
    else {
      const newValue : ArSyncTx[] = arSyncTxs.filter(tx => !ids.includes(tx.id));
      setArSyncTxs(newValue);
    }
  }

  /** Wrapper for a setTimeout() call that first clears the previous timer spawned here */
  const timedFnCall = (fn: AnyFunction, delay = 500) : void => {
    if (timedFnRef.current) clearInterval(timedFnRef.current);
    timedFnRef.current = setInterval(fn, delay);
  };

  /** Determines the transaction status of the posted `arSyncTxs` and updates the confirmed ones. */
  const confirmArSyncTxs = useCallback(async () => {
    if (isSyncing || isRefreshing || hasPendingTxs()) {
      // Retry once, at halftime before the next timed call
      return timedFnCall(confirmArSyncTxs, Math.floor(TX_CONFIRMATION_INTERVAL / 2));
    }
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

        if (hasThreadTxKind(postedTx)) redraftPost(postedTx.metadata);
      }
    }));

    if (confirmedArSyncTxs.length || idUpdatedArSyncTxs.length) {
      setArSyncTxs(updateArSyncTxs(newArSyncTxs, confirmedArSyncTxs));
    }
    if (confirmedArSyncTxs.length) {
      console.debug('At least one posted transaction has been confirmed or has expired.');
      const confirmedMetadataTxs = confirmedArSyncTxs.filter(hasMetadataTxKind);
      const confirmedPodcastIds = new Set<string>(confirmedMetadataTxs.map(tx => tx.podcastId));
      if (confirmedPodcastIds.size) await refresh([...confirmedPodcastIds], true, 0);
    }
  }, [arSyncTxs, hasPendingTxs, isRefreshing, isSyncing, redraftPost, refresh]);

  /**
   * Loads the state variables `wallet` and `walletAddress` for the given `loadedWallet`.
   * If `loadedWallet` is empty, a new developer wallet is created and ample AR tokens are minted.
   */
  const loadNewWallet = useCallback(async (loadedWallet: WalletTypes, newWalletAddress = '') => {
    if (!loadingWallet.current) {
      loadingWallet.current = true;

      if (usingArConnect()) {
        const address = newWalletAddress || await Arweave.getWalletAddress(loadedWallet);
        setWalletAddress(address);
        setWallet(loadedWallet);
      }
      else {
        const newWallet : WalletTypes =
          isNotEmpty(loadedWallet) ? loadedWallet : await Arweave.createNewDevWallet();

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
        const { PERMISSIONS, APPINFO, GATEWAY } = ARCONNECT;
        await window.arweaveWallet.connect(PERMISSIONS, APPINFO, GATEWAY);

        const allowedPermissions : PermissionType[] = await window.arweaveWallet.getPermissions();
        if (!PERMISSIONS.every(perm => allowedPermissions.includes(perm))) {
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
