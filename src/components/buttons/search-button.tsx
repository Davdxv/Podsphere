import React from 'react';
import { ButtonProps, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import style from './style.module.scss';

interface Props extends ButtonProps {
  onClick: (event: React.MouseEvent<any> | React.FormEvent<any>) => Promise<void>;
  isSearching: boolean;
}
const SearchButton : React.FC<Props> = ({ onClick, isSearching, ...props }) => (
  <IconButton
    className={`${style['spin-button']} ${isSearching ? style.spinning : ''}`}
    onClick={onClick}
    type="submit"
    disabled={isSearching}
    {...props}
  >
    <SearchIcon />
  </IconButton>
);
export default SearchButton;
