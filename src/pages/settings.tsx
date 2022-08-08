import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import { BackupDropzone } from '../components/settings-page/BackupDropzone';
import { db } from '../providers/subscriptions';
import styles from './settings.module.scss';

const downloadBackup = async () => {
  try {
    const FileName = 'backup.txt';
    const text = await db.exportDB();
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
    element.setAttribute('download', FileName);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  } catch (e) {
    console.error(e);
  }
};

const importBackup = async (file: string) => {
  db.importDB(file);
};

const SettingsPage = () => (
  <Box className={styles.container}>
    <Box className={styles['export-box']}>
      <Typography> Backup your data: </Typography>
      <Button onClick={downloadBackup}> Backup </Button>
    </Box>
    <Box>
      <Typography> Import your data: </Typography>
      <BackupDropzone onDrop={importBackup} />
    </Box>
  </Box>
);

export default SettingsPage;
