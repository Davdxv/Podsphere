import React from 'react';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import style from './style.module.scss';

interface Props {
  onClick: (_event: React.MouseEvent<unknown>, reason: string) => void;
  className?: string,
}

const ClearButton : React.FC<Props> = ({ onClick, className, ...props }) => (
  <IconButton
    className={`${style['clear-btn']} ${style[className || '']}`}
    onClick={event => onClick(event, 'closeButton')}
    {...props}
  >
    <CloseIcon />
  </IconButton>
);

export default ClearButton;
