import React, { useState } from 'react';
import {
  Box, FormControl, TextField,
} from '@mui/material';
import { toast } from 'react-toastify';
import ClearButton from '../buttons/clear-button';
import SyncButton from '../buttons/sync-button';
import RefreshButton from '../buttons/refresh-button';
import SearchButton from '../buttons/search-button';
import style from './index-elements.module.scss';
import { ReactComponent as AppIcon } from '../../assets/arsync-logo.svg';

interface Props {
  onSubmit: (_event: React.MouseEvent<any> | React.FormEvent<any>,
    query: string) => Promise<boolean>;
}

function HeaderComponent({ onSubmit } : Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClearButton, setShowClearButton] = useState(false);
  const [searchText, setSearchText] = useState('');

  const clearSearchForm = () => {
    setSearchText('');
    setShowClearButton(false);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target?.value || '');
    setShowClearButton(!!event.target?.value);
  };

  async function handleSubmit(
    event: React.MouseEvent<HTMLFormElement> | React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!isSubmitting && searchText) {
      setIsSubmitting(true);
      try {
        const handleSearchResult = await onSubmit(event, searchText);
        if (handleSearchResult) clearSearchForm(); // On successful subscription to RSS feed
      }
      catch (ex) {
        console.error(ex);
        toast.error(`Error while searching: ${(ex as Error).message}.\nPlease try again.`);
      }
      finally {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <Box className={style['header-container']}>
      <Box className={style['whalephant-wrapper']}>
        <AppIcon />
      </Box>
      <Box className={style['form-layer']}>
        <Box>
          <SearchButton isSearching={isSubmitting} form="search-form" onClick={handleSubmit} />
        </Box>
        <Box className={style['form-wrapper']}>
          <FormControl
            className={style['search-form']}
            component="form"
            onSubmit={handleSubmit}
            sx={{ m: 0 }}
            variant="filled"
          >
            <TextField
              value={searchText}
              className={style['search-field']}
              placeholder="Search for podcasts, episodes or enter an RSS feed URL to subscribe to"
              onChange={handleChange}
              variant="filled"
            />
            {showClearButton && (
            <ClearButton classes={style['clear-button']} onClick={clearSearchForm} />
            )}
          </FormControl>
        </Box>
      </Box>
      <Box className={style['call-to-actions']}>
        <SyncButton />
        <RefreshButton />
      </Box>
    </Box>
  );
}

export default HeaderComponent;
