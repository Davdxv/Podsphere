import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import { BackupDropzone } from '../components/settings-page/BackupDropzone';
import styles from './settings.module.scss';

function SettingsPage() {
  return (
    <Box className={styles.container}>
      <Box className={styles['export-box']}>
        <Typography> Backup your data: </Typography>
        <Button> Backup </Button>
      </Box>
      <Box>
        <Typography> Import your data: </Typography>
        <BackupDropzone />
      </Box>
    </Box>
  );
}

export default SettingsPage;
