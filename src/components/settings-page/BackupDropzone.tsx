import { Box } from '@mui/material';
import React from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './dropzone.module.scss';

interface Props {
  onDrop: (file: string) => void;
}

export const BackupDropzone : React.FC<Props> = props => {
  const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
    maxFiles: 1,
    accept: { 'text/*': ['.txt'] },
    onError: err => {
      console.error(err);
    },
    onDrop: async files => {
      const fileContent = await files[0].text();
      // eslint-disable-next-line react/destructuring-assignment
      props.onDrop(fileContent);
    },
    onDropRejected: () => {
      console.error('Error');
    },
  });

  return (
    <Box className={styles.container}>
      <Box {...getRootProps({ className: styles.dropzone })}>
        <input {...getInputProps()} />
        <p>Drag and drop your backup file here!</p>
        {/* {files} */}
      </Box>
    </Box>
  );
};
