import { Box } from '@mui/material';
import React from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './dropzone.module.scss';

export const BackupDropzone : React.FC = props => {
  const { acceptedFiles, getRootProps, getInputProps } = useDropzone();

  const files = acceptedFiles.map(file => (
    // @ts-ignore
    <li key={file.path}>
      {/* @ts-ignore */}
      {file.path} - {file.size} bytes
    </li>
  ));

  return (
    <Box className={styles.container}>
      <Box {...getRootProps({ className: styles.dropzone })}>
        <input {...getInputProps()} />
        <p>Drag and drop your backup file here!</p>
      </Box>
    </Box>
  );
};
