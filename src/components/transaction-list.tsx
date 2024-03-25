import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Box, Link } from '@mui/material';
import CachedImage from './cached-image';
import RemoveBtn from './buttons/remove-button';
import {
  arSyncTxToString,
  getTxId,
  hasThreadTxKind,
  isNotInitialized,
  isNotPosted,
  statusToString,
} from '../client/arweave/utils';
import style from './shared-elements.module.scss';
import { findMetadataById } from '../utils';
import {
  ArSyncTx, ArSyncTxStatus, Podcast,
} from '../client/interfaces';

dayjs.extend(relativeTime);

interface Props {
  subscriptions: Podcast[];
  metadataToSync: Partial<Podcast>[];
  txs: ArSyncTx[];
  removeArSyncTxs: (ids: string[] | null) => void;
}

const TransactionList : React.FC<Props> = ({
  subscriptions, metadataToSync, txs, removeArSyncTxs,
}) => {
  const findImageUrl = (id: Podcast['id']) => {
    const cachedPodcast = findMetadataById(id, subscriptions);
    return cachedPodcast.imageUrl || '';
  };

  const completedTxIds = txs.filter(tx => isNotInitialized(tx) && isNotPosted(tx)).map(tx => tx.id);

  const txDetailsTooltip = (tx: ArSyncTx) => (
    hasThreadTxKind(tx) ? `${tx.metadata.content || undefined}` : undefined
  );

  const viewBlockUrl = (txId: string) => `https://v2.viewblock.io/arweave/tx/${txId}`;

  return (
    <Box className={style['list-container']}>
      { txs.length ? (
        <div>
          <Box className={style['list-item']} key="total-txs">
            <Box className={style['title-detail']} />
            <Box className={style['call-to-action']}>
              <Box className={`${style['action-info']} ${style['status-color--all-txs']}`}>
                total: <b>{txs.length}</b>
              </Box>
              <Box className={style['action-btn']}>
                <RemoveBtn onClick={() => removeArSyncTxs(null) /* TODO: user confirmation */} />
              </Box>
            </Box>
          </Box>

          <Box className={style['list-item']} key="completed-txs">
            <Box className={style['title-detail']} />
            <Box className={style['call-to-action']}>
              <Box className={`${style['action-info']} ${style['status-color--all-txs']}`}>
                completed: <b>{completedTxIds.length}</b>
              </Box>
              <Box className={style['action-btn']}>
                <RemoveBtn onClick={() => removeArSyncTxs(completedTxIds)} />
              </Box>
            </Box>
          </Box>
          {
            [...txs].reverse().map(tx => {
              const podcastImageUrl = findImageUrl(tx.podcastId);
              const status = statusToString(tx.status);
              const txId = getTxId(tx);
              // TODO: Show tx.timestamp

              return (
                <Box className={style['list-item']} key={tx.id}>
                  <Box className={style['title-detail']}>
                    <CachedImage
                      loading="lazy"
                      classes={style['podcast-image']}
                      src={podcastImageUrl}
                      alt={tx.title || ''}
                    />
                    <Box title={txDetailsTooltip(tx)} className={style['item-title']}>
                      <Box component="h5" className={style['title-header']}>
                        {tx.title}
                      </Box>
                      <Box className={style['meta-detail']}>
                        {arSyncTxToString(tx, subscriptions, metadataToSync)}
                      </Box>
                    </Box>
                  </Box>

                  <Box className={style['call-to-action']}>
                    <Box className={`${style['action-info']} ${style[`status-color--${status}`]}`}>
                      {txId && tx.status >= ArSyncTxStatus.POSTED ? (
                        <Link
                          href={viewBlockUrl(txId)}
                          title={`View the transaction on ${viewBlockUrl(txId)}`}
                          target="_blank"
                        >
                          {status}
                        </Link>
                      ) : status}
                    </Box>
                    <Box className={style['action-btn']}>
                      <RemoveBtn onClick={() => removeArSyncTxs([tx.id])} />
                    </Box>
                  </Box>
                </Box>
              );
            })
          }
        </div>
      ) : <Box className={style['list-item']}>No active transactions.</Box>}
    </Box>
  );
};

export default TransactionList;
