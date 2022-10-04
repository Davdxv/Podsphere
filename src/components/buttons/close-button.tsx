import React from 'react';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import style from './style.module.scss';

interface Props {
  onClick: (_event: React.MouseEvent<unknown>, reason?: string) => void;
  classes?: string,
}

const CloseButton : React.FC<Props> = ({ onClick, classes, ...props }) => (
  <IconButton
    className={`${style['close-btn']} ${style['float-right-fixed']} ${classes || ''}`}
    onClick={event => onClick(event, 'closeButton')}
    {...props}
  >
    <CloseIcon />
  </IconButton>
);

export default CloseButton;
