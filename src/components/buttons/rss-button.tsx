import React from 'react';
import { IconButton } from '@mui/material';
import RssIcon from '@mui/icons-material/RssFeed';
import PlusIcon from '@mui/icons-material/Add';
import MinusIcon from '@mui/icons-material/Remove';
import style from './style.module.scss';

interface Props {
  handleSubscribe: (_event: React.MouseEvent<unknown>, feedUrl: string) => Promise<void>,
  handleUnsubscribe: (_event: React.MouseEvent<unknown>, feedUrl: string) => Promise<void>,
  feedUrl: string,
  className?: string,
  isSubscribed?: boolean,
}

const RssButton : React.FC<Props> = ({
  handleSubscribe,
  handleUnsubscribe,
  feedUrl = '',
  className = 'float-right',
  isSubscribed = false,
  ...props
}) => (
  <IconButton
    className={`${style['rss-btn']} ${style[className]}`}
    title={isSubscribed ? 'Unsubscribe' : 'Subscribe'}
    type="button"
    onClick={isSubscribed ? e => handleUnsubscribe(e, feedUrl) : e => handleSubscribe(e, feedUrl)}
    {...props}
  >
    <RssIcon />
    {isSubscribed ? (
      <MinusIcon className={style['minus-icon']} />
    ) : (
      <PlusIcon className={style['plus-icon']} />
    )}
  </IconButton>
);

export default RssButton;
