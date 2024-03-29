import React, { useContext } from 'react';
import { ButtonProps, IconButton } from '@mui/material';
import SyncIcon from '@mui/icons-material/SyncRounded';
import style from './style.module.scss';
import { SubscriptionsContext } from '../../providers/subscriptions';
import { ArweaveContext } from '../../providers/arweave';

const RefreshButton : React.FC<ButtonProps> = ({ ...props }) => {
  const { isRefreshing, refresh } = useContext(SubscriptionsContext);
  const { isSyncing, hasPendingTxs } = useContext(ArweaveContext);

  return (
    <IconButton
      disabled={isRefreshing || isSyncing || hasPendingTxs}
      className={`${style['spin-button']} ${isRefreshing ? style.spinning : ''}`}
      onClick={() => refresh(null, false)}
      title="Refresh subscriptions from RSS & Arweave"
      {...props}
    >
      <SyncIcon />
    </IconButton>
  );
};

export default RefreshButton;
