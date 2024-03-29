import React from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Box } from '@mui/material';
import DurationIcon from '@mui/icons-material/MoreTime';
import { Podcast } from '../client/interfaces';
import RemoveBtn from './buttons/remove-button';
import CachedImage from './cached-image';
import style from './shared-elements.module.scss';

dayjs.extend(relativeTime);

interface Props {
  subscriptions: Podcast[];
  unsubscribe: (id: string) => void;
  clickFeedHandler: (_event: React.MouseEvent<unknown>, feedUrl: string) => Promise<void>;
}

const PodcastList : React.FC<Props> = ({ subscriptions, unsubscribe, clickFeedHandler }) => (
  <Box className={style['list-container']}>
    { subscriptions.length ? (
      <div>
        {subscriptions.map(subscription => (
          <Box className={style['list-item']} key={subscription.feedUrl}>
            <Box
              className={style['title-detail']}
              onClick={e => clickFeedHandler(e, subscription.feedUrl)}
            >
              <CachedImage
                loading="lazy"
                classes={style['podcast-image']}
                src={subscription.imageUrl || ''}
                alt={subscription.title}
              />
              <Box className={style['item-title']}>
                <Box title={subscription.title} component="h5" className={style['title-header']}>
                  {subscription.title}
                </Box>
                <Box className={style['meta-detail']}>
                  <Box className={style['latest-release']}>
                    <Box component="small" className={style['time-release']}>
                      <DurationIcon />
                      {dayjs(subscription.firstEpisodeDate).fromNow()}
                    </Box>

                  </Box>
                </Box>
              </Box>
            </Box>

            <Box className={style['call-to-action']}>
              <Box className={style['action-btn']}>
                <RemoveBtn onClick={() => unsubscribe(subscription.feedUrl)} />
              </Box>
            </Box>
          </Box>
        ))}
      </div>
    ) : (
      <Box className={style['list-item']}>There are no podcasts to display&hellip;</Box>
    )}
  </Box>
);

export default PodcastList;
