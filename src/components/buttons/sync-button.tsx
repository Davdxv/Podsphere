import React, { useContext } from 'react';
// @ts-ignore
import { ReactComponent as ArSyncIcon } from '../../assets/arsync-logo.svg';
import SpinButton from './spin-button';
import { SubscriptionsContext } from '../../providers/subscriptions';
import { ArweaveContext } from '../../providers/arweave';

const SyncButton : React.FC = () => {
  const { isRefreshing } = useContext(SubscriptionsContext);
  const { isSyncing, prepareSync } = useContext(ArweaveContext);

  return (
    <SpinButton
      disabled={isRefreshing || isSyncing}
      className={isSyncing ? 'spinning' : ''}
      onClick={prepareSync}
      title={'Upload pending metadata to Arweave'}
      alt={'Upload pending metadata to Arweave'}
    >
      <ArSyncIcon
        width={'1.5rem'}
        height={'1.5rem'}
      />
    </SpinButton>
  );
};

export default SyncButton;