import React from 'react';
import { IconButton, ButtonProps } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import style from './style.module.scss';

interface Props extends ButtonProps {
  onClick: (event: React.MouseEvent<any> | React.FormEvent<any>) => Promise<void>;
}
const SearchButton : React.FC<Props> = ({
  onClick,
  ...props
}) => (
  <IconButton
    className={style['custom-btn']}
    style={{ marginBottom: '0.2rem' }}
    onClick={onClick}
    type="submit"
    {...props}
  >
    <SearchIcon />
  </IconButton>
);
export default SearchButton;
