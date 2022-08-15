import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Box } from '@mui/material';
import { Image } from 'react-bootstrap';
import RemoveBtn from './buttons/remove-button';
import {
  isNotInitialized,
  isNotPosted,
  statusToString,
} from '../client/arweave/utils';
import style from './shared-elements.module.scss';
import { findMetadataById } from '../utils';
import { ArSyncTx, Podcast } from '../client/interfaces';
import { ReactComponent as AppIcon } from '../assets/arsync-logo.svg';

dayjs.extend(relativeTime);

interface Props {
  subscriptions: Podcast[];
  txs: ArSyncTx[];
  removeArSyncTxs: (ids: string[] | null) => void;
}

function TxSubheader({ numEpisodes } : { numEpisodes: ArSyncTx['numEpisodes'] }) {
  return numEpisodes ? (
    <Box className={style['meta-detail']}>
      {`${numEpisodes} episodes`}
    </Box>
  ) : null;
}

function PodcastImage({ podcastImageUrl } : { podcastImageUrl: Podcast['imageUrl'] }) {
  return podcastImageUrl ? <Image className={style['podcast-image']} src={podcastImageUrl} /> : (
    <Box className={style['podcast-image-whalephant']}>
      <AppIcon />
    </Box>
  );
}

const TransactionList : React.FC<Props> = ({ subscriptions, txs, removeArSyncTxs }) => {
  const findImageUrl = (id: Podcast['id']) => {
    const cachedPodcast = findMetadataById(id, subscriptions);
    return cachedPodcast.imageUrl || '';
  };

  const completedTxIds = txs.filter(tx => isNotInitialized(tx) && isNotPosted(tx)).map(tx => tx.id);

  return (
    <Box className={style['list-container']}>
      { txs.length ? (
        <div>
          <Box className={style['list-item']} key="total-txs">
            <Box className={style['title-detail']} />
            <Box className={style['call-to-action']}>
              <Box className={style['action-info']}>
                {`total: ${txs.length}`}
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
                {`completed: ${completedTxIds.length}`}
              </Box>
              <Box className={style['action-btn']}>
                <RemoveBtn onClick={() => removeArSyncTxs(completedTxIds)} />
              </Box>
            </Box>
          </Box>
          {
            [...txs].reverse().map(tx => {
              const podcastImageUrl = findImageUrl(tx.podcastId);
              const { numEpisodes } = tx;

              // TODO: add viewblock.io tx url
              return (
                <Box className={style['list-item']} key={tx.id}>
                  <Box className={style['title-detail']}>
                    <PodcastImage podcastImageUrl={podcastImageUrl} />

                    <div>
                      <Box className={style['title-header']}>
                        {tx.title}
                      </Box>
                      <TxSubheader numEpisodes={numEpisodes} />
                    </div>
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
