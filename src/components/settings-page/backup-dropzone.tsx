import { Box, Typography } from '@mui/material';
import React from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './dropzone.module.scss';

interface Props {
  onDrop: (file: File) => void;
  dropzoneText: string;
}

export const BackupDropzone : React.FC<Props> = ({ onDrop, dropzoneText }) => {
  const { getRootProps, getInputProps } = useDropzone({
    maxFiles: 1,
    onDrop: async files => {
      const file = files[0];
      onDrop(file);
    },
    onDropRejected: () => {
      console.error('Error');
    },
  });

  return (
    <Box className={styles.container}>
      <Box {...getRootProps({ className: styles.dropzone })}>
        <input {...getInputProps()} />
        <Typography>{dropzoneText}</Typography>
      </Box>
    </Box>
  );
};
