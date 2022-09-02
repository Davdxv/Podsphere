import React, { useState, useContext, useRef } from 'react';
import { InputGroup, Form, Container } from 'react-bootstrap';
import { Box } from '@mui/material';
import { ToastContext } from '../../providers/toast';
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
  const toast = useContext(ToastContext);
  const [isSearching, setIsSearching] = useState(false);
  const [showClearButton, setShowClearButton] = useState(false);
  const SEARCH_TEXT = 'Search for podcasts, episodes or enter an RSS feed URL to subscribe to';
  const searchFormRef = useRef();

  const clearSearchForm = () => {
    if (searchFormRef.current) searchFormRef.current.reset();
    setShowClearButton(false);
  };

  const getSearchFormInput = () => {
    if (searchFormRef.current) {
      const fd = new FormData(searchFormRef.current);
      return fd.get('query') || '';
    }
    return '';
  };

  function handleChange() {
    setShowClearButton(!!getSearchFormInput());
  }

  async function handleSubmit(
    event: React.MouseEvent<HTMLFormElement> | React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const query = getSearchFormInput();
    if (query) {
      setIsSearching(true);
      try {
        const handleSearchResult = await onSubmit({ query });
        if (handleSearchResult) clearSearchForm(); // On successful subscription to RSS feed
      } catch (ex) {
        console.error(ex);
        toast('Could not find podcast.', { variant: 'danger' });
      } finally {
        setIsSearching(false);
      }
    }
  }

  return (
    <Container className={style['header-container']}>
      <Box className={style['whalephant-wrapper']}>
        <AppIcon />
      </Box>
      <Box className={style['form-layer']}>
        <Box>
          <SearchButton disabled={isSearching} form="search-form" onClick={handleSubmit} />
        </Box>
        <Box className={style['form-wrapper']}>
          <Form ref={searchFormRef} id="search-form" onSubmit={handleSubmit}>
            <Form.Group controlId="query">
              <InputGroup>
                <Form.Control
                  name="query"
                  style={{ paddingLeft: '0.2rem' }}
                  placeholder={SEARCH_TEXT}
                  onChange={handleChange}
                />
                {showClearButton && <ClearButton onClick={clearSearchForm} />}
              </InputGroup>
            </Form.Group>
          </Form>
        </Box>
      </Box>
      <Box className={style['call-to-actions']}>
        <SyncButton />
        <RefreshButton />
      </Box>
    </Container>

  );
}

export default HeaderComponent;
