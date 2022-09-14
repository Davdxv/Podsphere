import React from 'react';
import { Box } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import Footer from './footer';
import style from './index-elements.module.scss';

interface Props {
  children: React.ReactNode;
}

function Layout({ children }: Props) {
  return (
    <Box className={style.page}>
      <ToastContainer
        position="top-center"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick={false}
        rtl={false}
        draggable
        pauseOnHover
      />
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
