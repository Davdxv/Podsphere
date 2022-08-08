import {
  Box, Button, List, ListItem, Typography,
} from '@mui/material';
import React from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import HandymanIcon from '@mui/icons-material/Handyman';
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
  <Box className={styles.main}>
    <Box className={styles.menu}>
      <Box className={styles.profile}>
        <img
          className={styles['profile-picture']}
          src="https://bit.ly/3JE5I68"
          alt="profile"
        />
        <Typography> Random Dude </Typography>
      </Box>
      <List>
        <ListItem className={styles['selected-item']}>
          <SettingsIcon className={styles['general-icon']} />
          General
        </ListItem>
        <ListItem>
          <HandymanIcon className={styles['advanced-icon']} />
          Advanced
        </ListItem>
      </List>
    </Box>
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
  </Box>
);

export default SettingsPage;
