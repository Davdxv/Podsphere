import React, { useState, useRef } from 'react';
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
  const SEARCH_TEXT = 'Search for podcasts, episodes or enter an RSS feed URL to subscribe to';
  const searchFormRef = useRef<HTMLInputElement>(null);

  const clearSearchForm = () => {
    if (searchFormRef.current?.value) searchFormRef.current.value = '';
    setShowClearButton(false);
  };

  const getSearchFormInput = () : string => searchFormRef.current?.value || '';

  function handleChange() {
    setShowClearButton(!!getSearchFormInput());
  }

  async function handleSubmit(
    event: React.MouseEvent<HTMLFormElement> | React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const query = getSearchFormInput();
    if (query && !isSubmitting) {
      setIsSubmitting(true);
      try {
        const handleSearchResult = await onSubmit(event, query);
        if (handleSearchResult) clearSearchForm(); // On successful subscription to RSS feed
      } catch (ex) {
        console.error(ex);
        toast.error('Could not find podcast.');
      } finally {
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
          <SearchButton disabled={isSubmitting} form="search-form" onClick={handleSubmit} />
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
              inputRef={searchFormRef}
              className={style['search-field']}
              placeholder={SEARCH_TEXT}
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
