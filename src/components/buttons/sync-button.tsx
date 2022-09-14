import React, { useContext } from 'react';
import { IconButton } from '@mui/material';
import { ReactComponent as ArSyncIcon } from '../../assets/arsync-logo.svg';
import { SubscriptionsContext } from '../../providers/subscriptions';
import { ArweaveContext } from '../../providers/arweave';
import style from './style.module.scss';

const SyncButton : React.FC = () => {
  const { isRefreshing } = useContext(SubscriptionsContext);
  const { isSyncing, prepareSync, startSync, hasPendingTxs } = useContext(ArweaveContext);

  let disabled = isRefreshing || isSyncing;
  let onClick = prepareSync;
  let title = 'Prepare pending metadata for upload to Arweave';

  if (hasPendingTxs) {
    disabled = isRefreshing;
    onClick = startSync;
    title = 'Post the pending transactions to Arweave';
  }

  return (
    <IconButton
      disabled={disabled}
      className={`${style['spin-button']} ${hasPendingTxs ? style['sync-initialized'] : ''} ${
        isSyncing ? style.spinning : ''}`}
      onClick={onClick}
      title={title}
    >
      <ArSyncIcon
        width="1.5rem"
        height="1.5rem"
      />
    </IconButton>
  );
};

export default SyncButton;
