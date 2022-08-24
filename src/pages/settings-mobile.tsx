import {
  Box, Button, List, ListItem, Typography,
} from '@mui/material';
import React, { useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import HandymanIcon from '@mui/icons-material/Handyman';
import { BackupDropzone } from '../components/settings-page/backup-dropzone';
import styles from './settings-mobile.module.scss';
import { MenuElement, downloadBackup, importBackup } from './settings';

const GeneralSettings : React.FC = () => (
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

const AdvancedSettings : React.FC = () => (
  <Box className={styles.container}>
    <Typography style={{ margin: 'auto' }}> TBD! :( </Typography>
  </Box>
);

const getActivePane = (activeEl: MenuElement) => {
  switch (activeEl) {
    case MenuElement.General:
      return <GeneralSettings />;
    case MenuElement.Advanced:
      return <AdvancedSettings />;
    default:
      return <GeneralSettings />;
  }
};

export const MobileSettingsPage = () => {
  const [activeElement, setActiveElement] = useState(MenuElement.General);

  const handleChange = (activeEl: MenuElement) => setActiveElement(activeEl);

  return (
    <Box className={styles.main}>
      <Box className={styles.profile}>
        <img
          className={styles['profile-picture']}
          src="https://bit.ly/3JE5I68"
          alt="profile"
        />
        <Typography> Random Dude </Typography>
      </Box>
      <List className={styles.list}>
        <ListItem
          // onClick={onListItemClick(MenuElement.General)}
          className={styles['list-item']}
        >
          <Box>
            <SettingsIcon className={styles.icon} />
            General
          </Box>
          <KeyboardArrowRightIcon className={styles.arrow} />
        </ListItem>
        <ListItem
          // onClick={onListItemClick(MenuElement.Advanced)}
          className={styles['list-item']}
        >
          <Box>
            <HandymanIcon className={styles.icon} />
            Advanced
          </Box>
          <KeyboardArrowRightIcon className={styles.arrow} />
        </ListItem>
      </List>
    </Box>
  );
};
