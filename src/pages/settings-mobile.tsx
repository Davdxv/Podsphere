import {
  Box, Button, FormControl, InputLabel, List, ListItem,
  MenuItem, Select, SelectChangeEvent, TextField, Typography,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import HandymanIcon from '@mui/icons-material/Handyman';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { toast } from 'react-toastify';
import { BackupDropzone } from '../components/settings-page/backup-dropzone';
import styles from './settings-mobile.module.scss';
// eslint-disable-next-line import/no-cycle
import {
  getCurrentProxy, CustomCorsProxyName,
  standardOptions,
} from './settings';

export enum MobileMenuElement {
  Main,
  General,
  Advanced,
}

export interface SettingsPageProps {
  handleImportBackup: (file: File) => Promise<void>;
  handleDownloadBackup: () => Promise<void>;
}

const GeneralSettings : React.FC<{ handleChange: (activeEl:
MobileMenuElement) => void } & SettingsPageProps> = ({ handleChange,
  handleDownloadBackup, handleImportBackup }) => {
  const onListItemClick = (element: MobileMenuElement) => () => handleChange(element);

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
  const currentProxy = getCurrentProxy();
  const [proxy, setProxy] = useState(currentProxy);
  const [customUrl, setCustomUrl] = useState(currentProxy.name === CustomCorsProxyName
    ? currentProxy.value : '');

  const inputRef = useRef<HTMLInputElement>();

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomUrl(event.target.value);
  };

  const onListItemClick = (element: MobileMenuElement) => () => handleChange(element);

  const handleSelectChange = (event: SelectChangeEvent) => {
    const val = event.target.value;
    const newProxy = standardOptions.find(item => item.value === val);
    setProxy(newProxy || { name: CustomCorsProxyName, value: customUrl });
  };

  const handleConfirm = () => {
    const prx = proxy;
    if (proxy.name === CustomCorsProxyName) prx.value = customUrl;
    localStorage.setItem('cors-proxy', prx.value);
    toast.success('CORS proxy is successfully set!');
  };

  useEffect(() => {
    if (proxy.name === CustomCorsProxyName) inputRef!.current!.focus();
  }, [proxy]);

  return (
    <Box className={styles.page}>
      <ArrowBackIcon
        onClick={onListItemClick(MobileMenuElement.Main)}
        className={styles['close-button']}
      />
      <Box>
        <Box sx={{ minWidth: 120 }}>
          <FormControl fullWidth>
            <InputLabel className={styles['select-label']}>Choose your CORS proxy</InputLabel>
            <Select
              sx={{
                input: { color: 'white !important' },
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: 'white',
                  backgroundColor: 'gray',
                },
                marginTop: 5,
                '& .MuiInput-underline:before': { borderBottomColor: 'white' },
                '& .MuiInput-underline:after': { borderBottomColor: 'white' },
              }}
              value={proxy.value}
              label="Choose your CORS proxy"
              className={styles['mobile-select']}
              onChange={handleSelectChange}
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
  handleChange: (activeEl: MobileMenuElement) => void } & SettingsPageProps> = ({ activeEl,
  handleChange, handleDownloadBackup, handleImportBackup }) => {
  switch (activeEl) {
    case MobileMenuElement.Main:
      return <Menu handleChange={handleChange} />;
    case MobileMenuElement.General:
      return (
        <GeneralSettings
          handleImportBackup={handleImportBackup}
          handleDownloadBackup={handleDownloadBackup}
          handleChange={handleChange}
        />
      );
    case MobileMenuElement.Advanced:
      return (
        <AdvancedSettings
          handleChange={handleChange}
        />
      );
    default:
      return <Menu handleChange={handleChange} />;
  }
};

export const MobileSettingsPage: React.FC<SettingsPageProps> = ({ handleDownloadBackup,
  handleImportBackup }) => {
  const [activeElement, setActiveElement] = useState(MobileMenuElement.Main);

  const handleChange = (activeEl: MobileMenuElement) => setActiveElement(activeEl);

  return (
    <ActivePane
      handleImportBackup={handleImportBackup}
      handleDownloadBackup={handleDownloadBackup}
      activeEl={activeElement}
      handleChange={handleChange}
    />
  );
};
