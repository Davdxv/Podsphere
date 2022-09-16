import React from 'react';
import {
  Box, useMediaQuery, useTheme,
} from '@mui/material';
import { ToastContainer, ToastContainerProps } from 'react-toastify';
import Footer from './footer';
import style from './index-elements.module.scss';

interface Props {
  children: React.ReactNode;
}

/** @see {@link https://fkhadra.github.io/react-toastify/api/toast-container} */
const TOAST_PROPS_DESKTOP : ToastContainerProps = {
  position: 'top-center',
  autoClose: 3500,
  hideProgressBar: false,
  newestOnTop: true,
  closeOnClick: false,
  rtl: false,
  draggable: false,
  pauseOnHover: true,
};

const TOAST_PROPS_MOBILE : ToastContainerProps = {
  ...TOAST_PROPS_DESKTOP,
  draggable: true,
  pauseOnHover: false,
};

function Layout({ children }: Props) {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box className={style.page}>
      <ToastContainer {...(isSm ? TOAST_PROPS_MOBILE : TOAST_PROPS_DESKTOP)} />

      <Box className={style['center-components']}>
        <Box className={style['main-content']}>
          {children}
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}
export default Layout;
