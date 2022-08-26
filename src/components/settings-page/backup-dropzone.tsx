import { Box, Typography } from '@mui/material';
import React from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './dropzone.module.scss';

interface Props {
  onDrop: (file: string) => void;
  dropzoneText: string;
}

export const BackupDropzone : React.FC<Props> = ({ onDrop, dropzoneText }) => {
  const { getRootProps, getInputProps } = useDropzone({
    maxFiles: 1,
    accept: { 'text/*': ['.txt'] },
    onDrop: async files => {
      const fileContent = await files[0].text();
      onDrop(fileContent);
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
