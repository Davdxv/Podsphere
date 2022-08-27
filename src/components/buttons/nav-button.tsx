import React from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import style from './style.module.scss';

interface Props {
  children: React.ReactNode;
  to: string;
}

const NavButton : React.FC<Props> = ({ children, ...props }) => (
  <NavLink {...props}>
    <li>
      <Button className={style['nav-btn']}>
        {children}
      </Button>
    </li>
  </NavLink>
);

export default NavButton;
