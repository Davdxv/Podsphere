import {
  Box, Button, List, ListItem, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import React, { useContext, useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import HandymanIcon from '@mui/icons-material/Handyman';
import { BackupDropzone } from '../components/settings-page/backup-dropzone';
import styles from './settings.module.scss';
import { MobileSettingsPage, SettingsPageProps } from './settings-mobile';
import { downloadBackup, importBackup } from '../components/settings-page/utils';
import { ToastContext } from '../providers/toast';

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

const GeneralSettings : React.FC<SettingsPageProps> = ({ handleDownloadBackup,
  handleImportBackup }) => (
    <Box className={styles.container}>
      <Box className={styles['export-box']}>
        <Typography> Backup your data: </Typography>
        <Button onClick={handleDownloadBackup}> Backup </Button>
      </Box>
      <Box>
        <Typography> Import your data: </Typography>
        <BackupDropzone
          dropzoneText="Drag and drop your backup file here!"
          onDrop={handleImportBackup}
        />
      </Box>
    </Box>
);

const AdvancedSettings : React.FC = () => (
  <Box className={styles.container}>
    <Typography style={{ margin: 'auto' }}> TBD! :( </Typography>
  </Box>
);

const getActivePane = (activeEl: MenuElement,
  handleImportBackup: SettingsPageProps['handleImportBackup'],
  handleDownloadBackup: SettingsPageProps['handleDownloadBackup']) => {
  switch (activeEl) {
    case MenuElement.General:
      return (
        <GeneralSettings
          handleImportBackup={handleImportBackup}
          handleDownloadBackup={handleDownloadBackup}
        />
      );
    case MenuElement.Advanced:
      return <AdvancedSettings />;
    default:
      return (
        <GeneralSettings
          handleImportBackup={handleImportBackup}
          handleDownloadBackup={handleDownloadBackup}
        />
      );
  }
};

const SettingsPage = () => {
  const [activeElement, setActiveElement] = useState(MenuElement.General);

  const handleChange = (activeEl: MenuElement) => setActiveElement(activeEl);

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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    isMobile ? (
      <MobileSettingsPage
        handleImportBackup={handleImportBackup}
        handleDownloadBackup={handleDownloadBackup}
      />
    )
      : (
        <Box className={styles.main}>
          <SidebarMenu handleChange={handleChange} activeElement={activeElement} />
          {getActivePane(activeElement, handleImportBackup, handleDownloadBackup)}
        </Box>
      )
  );
};

export default SettingsPage;
