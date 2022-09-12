import React from 'react';
import { Container } from 'react-bootstrap';
import {
  FaHome,
  FaStar,
  FaPlus,
  FaHistory,
  FaCog,
} from 'react-icons/fa';
import { Box } from '@mui/material';
import style from './index-elements.module.scss';
import NavButton from '../buttons/nav-button';

function LayoutFooter() {
  return (
    <Box component="footer" className={style.footer}>
      <Container as="nav">
        <Box component="ul" className={style['nav-list']}>
          <NavButton end to="/">
            <FaHome />
          </NavButton>
          <NavButton end to="/favourites">
            <FaStar />
          </NavButton>
          <NavButton end to="/add-url">
            <FaPlus />
          </NavButton>
          <NavButton end to="/history">
            <FaHistory />
          </NavButton>
          <NavButton end to="/settings">
            <FaCog />
          </NavButton>
        </Box>
      </Container>
    </Box>
  );
}

export default LayoutFooter;
