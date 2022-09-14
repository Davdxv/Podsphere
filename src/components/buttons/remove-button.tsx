import React from 'react';
import { IconButton } from '@mui/material';
import TrashIcon from '@mui/icons-material/DeleteRounded';
import style from './style.module.scss';

interface Props {
  onClick: () => void;
}

const RemoveBtn : React.FC<Props> = ({
  onClick,
  ...props
}) => (
  <IconButton
    className={style['delete-btn']}
    onClick={onClick}
    {...props}
  >
    <TrashIcon />
  </IconButton>
);

export default RemoveBtn;
