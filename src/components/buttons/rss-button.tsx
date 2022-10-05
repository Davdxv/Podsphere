import React from 'react';
import { ButtonProps, IconButton } from '@mui/material';
import RssIcon from '@mui/icons-material/RssFeed';
import PlusIcon from '@mui/icons-material/Add';
import MinusIcon from '@mui/icons-material/Remove';
import style from './style.module.scss';

interface Props extends ButtonProps {
  handleSubscribe: (_event: React.MouseEvent<unknown>, feedUrl: string) => Promise<void>;
  handleUnsubscribe: (_event: React.MouseEvent<unknown>, feedUrl: string) => Promise<void>;
  feedUrl: string;
  classes?: string;
  isSubscribed?: boolean;
}

const RssButton : React.FC<Props> = ({
  handleSubscribe,
  handleUnsubscribe,
  feedUrl = '',
  classes = '',
  isSubscribed = false,
  ...props
}) => (
  <IconButton
    className={`${style['rss-btn']} ${style[classes]}`}
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
