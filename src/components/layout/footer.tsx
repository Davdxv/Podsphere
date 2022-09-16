import React from 'react';
import { Box } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import NavButton from '../buttons/nav-button';
import style from './index-elements.module.scss';

function LayoutFooter() {
  return (
    <Box component="footer" className={style.footer}>
      <Box component="ul" className={style['nav-list']}>
        <NavButton end to="/">
          <HomeIcon />
        </NavButton>
        <NavButton end to="/favourites">
          <BookmarksIcon />
        </NavButton>
        <NavButton end to="/history">
          <HistoryIcon />
        </NavButton>
        <NavButton end to="/settings">
          <SettingsIcon />
        </NavButton>
      </Box>
    </Box>
  );
}
export default LayoutFooter;
