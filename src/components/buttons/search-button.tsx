import React from 'react';
import { Button } from 'react-bootstrap';
import { FaSearch } from 'react-icons/fa';
import style from './style.module.scss';

interface Props {
  onClick: () => void;
}

const SearchButton : React.FC<Props> = ({
  onClick,
  ...props
}) => (
  <Button
    className={style['custom-btn']}
    style={{ marginBottom: '0.2rem' }}
    onClick={onClick}
    disabled
    {...props}
  >
    <FaSearch />
  </Button>
);
export default SearchButton;
