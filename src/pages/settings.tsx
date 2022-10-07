import {
  Box, Button, FormControl, InputLabel, List, ListItem,
  MenuItem, Select, SelectChangeEvent, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import React, {
  useEffect, useRef, useState,
} from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import HandymanIcon from '@mui/icons-material/Handyman';
import { toast } from 'react-toastify';
import { BackupDropzone } from '../components/settings-page/backup-dropzone';
import styles from './settings.module.scss';

import { downloadBackup, importBackup } from '../components/settings-page/utils';
import { MobileSettingsPage } from './settings-mobile';
import {
  SettingsPageProps, getCurrentProxy,
  CustomCorsProxyName, standardOptions, CorsProxyStorageKey,
} from './settings-utils';

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

const AdvancedSettings : React.FC = () => {
  const currentProxy = getCurrentProxy();
  const [proxy, setProxy] = useState(currentProxy);
  const [customUrl, setCustomUrl] = useState(currentProxy.name === CustomCorsProxyName
    ? currentProxy.value : '');

  const inputRef = useRef<HTMLInputElement>();

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomUrl(event.target.value);
  };

  const handleChange = (event: SelectChangeEvent) => {
    const val = event.target.value;
    const newProxy = standardOptions.find(item => item.value === val);
    setProxy(newProxy || { name: CustomCorsProxyName, value: customUrl });
  };

  const handleConfirm = () => {
    const prx = proxy;
    if (proxy.name === CustomCorsProxyName) prx.value = customUrl;
    localStorage.setItem(CorsProxyStorageKey, prx.value);
    toast.success('CORS proxy is successfully set!');
  };

  useEffect(() => {
    if (proxy.name === CustomCorsProxyName) inputRef!.current!.focus();
  }, [proxy]);

  return (
    <Box className={styles.container}>
      <Box>
        <Box sx={{ minWidth: 120 }}>
          <FormControl fullWidth>
            <InputLabel>Choose your CORS proxy</InputLabel>
            <Select
              value={proxy.value}
              label="Choose your CORS proxy"
              onChange={handleChange}
            >
              {standardOptions.map(item => (
                <MenuItem value={item.value}>
                  {item.name}
                </MenuItem>
              ))}
              <MenuItem value={customUrl}>
                Custom
              </MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end' }}>

          <TextField
            sx={{
              visibility: proxy.name === CustomCorsProxyName ? 'visible' : 'hidden',
              input: { color: 'white !important' },
              '& .MuiInputBase-input.Mui-disabled': {
                WebkitTextFillColor: 'white',
                backgroundColor: 'gray',
              },
              marginTop: 5,
              '& .MuiInput-underline:before': { borderBottomColor: 'white' },
              '& .MuiInput-underline:after': { borderBottomColor: 'white' },
            }}
            required={proxy.name === CustomCorsProxyName}
            disabled={proxy.name !== CustomCorsProxyName}
            color="primary"
            inputRef={inputRef}
            value={customUrl}
            onChange={handleUrlChange}
            variant="standard"
          />
          <Button
            onClick={handleConfirm}
            sx={{ width: 75, backgroundColor: '#31664c', marginLeft: 15 }}
          >
            Confirm
          </Button>
        </Box>
      </Box>
      <Typography style={{ margin: 'auto' }}> TBD! :( </Typography>
    </Box>
  ); };

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

  const handleImportBackup = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      await importBackup(new Uint8Array(buffer));
      toast.success('Backup successfully imported!');
      setTimeout(() => { window.location.href = '/'; }, 500);
    } catch (e: any) {
      toast.error((e as Error).message);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      toast.success('Your download has started!');
      await downloadBackup();
    } catch (e: any) {
      toast.error((e as Error).message);
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
