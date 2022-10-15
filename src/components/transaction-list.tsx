import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Box } from '@mui/material';
import CachedImage from './cached-image';
import RemoveBtn from './buttons/remove-button';
import {
  hasThreadTxKind, isNotInitialized, isNotPosted,
  statusToString,
} from '../client/arweave/utils';
import style from './shared-elements.module.scss';
import { findMetadataById, findThreadInMetadata, isReply } from '../utils';
import {
  ArSyncTx, Podcast, Post,
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

  const txDetails = (tx: ArSyncTx) : string => {
    if (hasThreadTxKind(tx)) {
      const post = tx.metadata as Post;
      if (isReply(post)) {
        const parent = findThreadInMetadata(post.parentThreadId, subscriptions, metadataToSync);
        return parent ? `RE: ${parent.subject}` : `Reply in ${tx.title}`;
      }
      return `${post.subject}`;
    }
    return `${tx.numEpisodes} episodes`;
  };

  const txDetailsTooltip = (tx: ArSyncTx) => (
    hasThreadTxKind(tx) ? `${(tx.metadata as Post).content}` : undefined
  );

  return (
    <Box className={style['list-container']}>
      { txs.length ? (
        <div>
          <Box className={style['list-item']} key="total-txs">
            <Box className={style['title-detail']} />
            <Box className={style['call-to-action']}>
              <Box className={style['action-info']}>
                total: <b>{txs.length}</b>
              </Box>
              <Box className={style['action-btn']}>
                <RemoveBtn onClick={() => removeArSyncTxs(null)} />
              </Box>
            </Box>
          </Box>

          <Box className={style['list-item']} key="completed-txs">
            <Box className={style['title-detail']} />
            <Box className={style['call-to-action']}>
              <Box className={style['action-info']}>
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

              // TODO: add viewblock.io tx url
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
                        {txDetails(tx)}
                      </Box>
                    </Box>
                  </Box>

                  <Box className={style['call-to-action']}>
                    <Box className={style['action-info']}>
                      {statusToString(tx.status)}
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
