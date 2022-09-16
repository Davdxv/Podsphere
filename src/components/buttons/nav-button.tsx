import React from 'react';
import { NavLink, NavLinkProps } from 'react-router-dom';
import { IconButton } from '@mui/material';
import style from './style.module.scss';

interface Props extends NavLinkProps {
  children: React.ReactNode;
  to: string;
}

const NavButton : React.FC<Props> = ({ children, ...props }) => (
  <NavLink {...props}>
    <li>
      <IconButton className={style['nav-btn']}>
        {children}
      </IconButton>
    </li>
  </NavLink>
);

export default NavButton;
