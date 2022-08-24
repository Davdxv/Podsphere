import {
  Box, Button, List, ListItem, Typography,
} from '@mui/material';
import React, { useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import HandymanIcon from '@mui/icons-material/Handyman';
import { BackupDropzone } from '../components/settings-page/backup-dropzone';
import { db } from '../providers/subscriptions';
import styles from './settings.module.scss';

export const downloadBackup = async () => {
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

export const importBackup = async (file: string) => {
  await db.importDB(file);
  window.location.href = '/';
};

export enum MenuElement {
  General,
  Advanced,
}

const SidebarMenu : React.FC<{ activeElement: MenuElement,
  handleChange: (activeEl: MenuElement) => void }> = ({ activeElement, handleChange }) => {
  const onListItemClick = (element: MenuElement) => () => handleChange(element);
  return (
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
        <ListItem
          onClick={onListItemClick(MenuElement.General)}
          className={`${activeElement === MenuElement.General && styles['selected-item']}`}
        >
          <SettingsIcon className={styles['general-icon']} />
          General
        </ListItem>
        <ListItem
          onClick={onListItemClick(MenuElement.Advanced)}
          className={`${activeElement === MenuElement.Advanced && styles['selected-item']}`}
        >
          <HandymanIcon className={styles['advanced-icon']} />
          Advanced
        </ListItem>
      </List>
    </Box>
  );
};

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

const SettingsPage = () => {
  const [activeElement, setActiveElement] = useState(MenuElement.General);

  const handleChange = (activeEl: MenuElement) => setActiveElement(activeEl);

  return (
    <Box className={styles.main}>
      <SidebarMenu handleChange={handleChange} activeElement={activeElement} />
      {getActivePane(activeElement)}
    </Box>
  );
};

export default SettingsPage;
