import {
  Box, Button, List, ListItem, Typography,
} from '@mui/material';
import React, { useContext, useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import HandymanIcon from '@mui/icons-material/Handyman';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { BackupDropzone } from '../components/settings-page/backup-dropzone';
import styles from './settings-mobile.module.scss';
import { downloadBackup, importBackup } from '../components/settings-page/utils';
import { ToastContext } from '../providers/toast';

export enum MobileMenuElement {
  Main,
  General,
  Advanced,
}

const GeneralSettings : React.FC<{ handleChange: (activeEl:
MobileMenuElement) => void }> = ({ handleChange }) => {
  const onListItemClick = (element: MobileMenuElement) => () => handleChange(element);
  const toast = useContext(ToastContext);

  const handleImportBackup = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      await importBackup(new Uint8Array(buffer));
      toast('Backup successfully imported!', { variant: 'success' });
      setTimeout(() => { window.location.href = '/'; }, 300);
    } catch (e: any) {
      toast(e.message, { variant: 'danger', autohideDelay: 3000 });
    }
  };

  const handleDownloadBackup = async () => {
    try {
      await downloadBackup();
      toast('Your download has started!', { variant: 'success' });
    } catch (e: any) {
      toast(e.message, { variant: 'danger', autohideDelay: 3000 });
    }
  };

  return (
    <Box className={styles.page}>
      <ArrowBackIcon
        onClick={onListItemClick(MobileMenuElement.Main)}
        className={styles['close-button']}
      />
      <Box className={styles['export-box']}>
        <Typography> Backup your data: </Typography>
        <Button onClick={handleDownloadBackup}> Backup </Button>
      </Box>
      <Box>
        <Typography> Import your data: </Typography>
        <BackupDropzone dropzoneText="Choose your backup file!" onDrop={handleImportBackup} />
      </Box>
    </Box>
  );
};

const AdvancedSettings : React.FC<{ handleChange: (activeEl:
MobileMenuElement) => void }> = ({ handleChange }) => {
  const onListItemClick = (element: MobileMenuElement) => () => handleChange(element);

  return (
    <Box className={styles.page}>
      <ArrowBackIcon
        onClick={onListItemClick(MobileMenuElement.Main)}
        className={styles['close-button']}
      />
      <Typography style={{ margin: 'auto' }}> TBD! :( </Typography>
    </Box>
  );
};

const Menu : React.FC<{ handleChange: (activeEl:
MobileMenuElement) => void }> = ({ handleChange }) => {
  const onListItemClick = (element: MobileMenuElement) => () => handleChange(element);

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
          onClick={onListItemClick(MobileMenuElement.General)}
          className={styles['list-item']}
        >
          <Box>
            <SettingsIcon className={styles.icon} />
            General
          </Box>
          <KeyboardArrowRightIcon className={styles.arrow} />
        </ListItem>
        <ListItem
          onClick={onListItemClick(MobileMenuElement.Advanced)}
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

const ActivePane : React.FC<{ activeEl: MobileMenuElement,
  handleChange: (activeEl: MobileMenuElement) => void }> = ({ activeEl, handleChange }) => {
  switch (activeEl) {
    case MobileMenuElement.Main:
      return <Menu handleChange={handleChange} />;
    case MobileMenuElement.General:
      return <GeneralSettings handleChange={handleChange} />;
    case MobileMenuElement.Advanced:
      return <AdvancedSettings handleChange={handleChange} />;
    default:
      return <Menu handleChange={handleChange} />;
  }
};

export const MobileSettingsPage = () => {
  const [activeElement, setActiveElement] = useState(MobileMenuElement.Main);

  const handleChange = (activeEl: MobileMenuElement) => setActiveElement(activeEl);

  return <ActivePane activeEl={activeElement} handleChange={handleChange} />;
};
