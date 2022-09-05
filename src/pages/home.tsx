import React, { useContext, useEffect, useState } from 'react';
import {
  Box, Tabs, Tab,
} from '@mui/material';
import { Podcast } from '../client/interfaces';
import { findMetadataByFeedUrl, hasMetadata } from '../utils';
import { SubscriptionsContext } from '../providers/subscriptions';
import { ArweaveContext } from '../providers/arweave';
import PodGraph from '../components/pod-graph';
import SearchPodcastResults from '../components/search-podcast-results';
import PodcastDetails from '../components/podcast-details';
import HeaderComponent from '../components/layout/header-component';
import CategoriesList from '../components/categories-list';
import PodcastList from '../components/podcast-list';
import TransactionList from '../components/transaction-list';
import style from './home.module.scss';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
  className?: string;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, className, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      className={className}
      {...other}
    >
      <Box>{children}</Box>
    </div>
  );
}

function HomePage() {
  const {
    handleSearch,
    handleFetchPodcastRss2Feed,
    searchResults,
    setShowSearchResults,
    showSearchResults,
    subscriptions,
    subscribe,
    unsubscribe,
  } = useContext(SubscriptionsContext);
  const { arSyncTxs, isSyncing, removeArSyncTxs } = useContext(ArweaveContext);

  const [tab, setTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedPodcastId, setSelectedPodcastId] = useState<string | null>(null);
  const [selectedPodcastMetadata, setSelectedPodcastMetadata] = useState<Podcast | null>(null);
  const [showPodcastDetails, setShowPodcastDetails] = useState<boolean>(false);

  const [showPodcastMetadata, setShowPodcastMetadata] = useState(false);
  const [showImages, setShowImages] = useState(true);

  const isSubscribed = (feedUrl: string = selectedPodcastId || '') => hasMetadata(
    findMetadataByFeedUrl(feedUrl, 'rss2', subscriptions),
  );

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
  };

  const handleSubscribe = async (_event: React.MouseEvent<unknown>, feedUrl: string) => {
    const subscribeResult = await subscribe(feedUrl);
    if (subscribeResult) setTimeout(() => setShowPodcastDetails(false), 250);
  };

  const handleUnsubscribe = async (_event: React.MouseEvent<unknown>, feedUrl: string) => {
    await unsubscribe(feedUrl);
    setShowPodcastDetails(false);
  };

  const handleCloseSearchResults = (_event: React.MouseEvent<unknown>, reason = '') => {
    if (reason !== 'backdropClick') setShowSearchResults(false);
  };

  const handleFetchFeed = async (_event: React.MouseEvent<unknown>, feedUrl: string) => {
    let metadata;
    metadata = findMetadataByFeedUrl(feedUrl, 'rss2', subscriptions);

    if (!hasMetadata(metadata)) {
      const { newPodcastMetadata } = await handleFetchPodcastRss2Feed(feedUrl);
      metadata = newPodcastMetadata;
    }
    if (hasMetadata(metadata)) {
      setSelectedPodcastId(feedUrl);
      setSelectedPodcastMetadata(metadata);
      setShowPodcastDetails(true);
    }
  };

  const handleClosePodcastDetails = (_event: React.MouseEvent<unknown>, reason = '') => {
    if (reason !== 'backdropClick') {
      setSelectedPodcastId(null);
      setSelectedPodcastMetadata(null);
      setShowPodcastDetails(false);
    }
  };

  useEffect(() => {
    if (isSyncing) setTab(1);
  }, [isSyncing]);

  useEffect(() => {
    if (selectedPodcastId) {
      const metadata = findMetadataByFeedUrl(selectedPodcastId, 'rss2', subscriptions);
      if (hasMetadata(metadata)) {
        setSelectedPodcastMetadata(metadata);
        setShowPodcastDetails(true);
      }
    }
  }, [selectedPodcastId, subscriptions]);

  async function search({ query } : { query: string }) {
    setShowPodcastDetails(false);
    setSearchQuery(query);
    return handleSearch(query);
  }

  return (
    <div className={style.container}>
      <HeaderComponent onSubmit={search} />

      {subscriptions && (
        <div>
          <PodGraph subscriptions={subscriptions} setSelectedPodcastId={setSelectedPodcastId} />
        </div>
      )}

      <Box className={style.wrapper}>
        <Box className={style.leftPane}>
          <CategoriesList categories={[]} />
        </Box>
        <Box className={style.rightPane}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs onChange={handleChange} value={tab} aria-label="Info tabs">
              <Tab className={style.tabHeader} label="Subscriptions" />
              <Tab className={style.tabHeader} label="Transactions" />
            </Tabs>
          </Box>

          <TabPanel className={style['tab-panel']} value={tab} index={0}>
            <PodcastList
              subscriptions={subscriptions}
              unsubscribe={unsubscribe}
              clickFeedHandler={handleFetchFeed}
            />
          </TabPanel>

          <TabPanel className={style['tab-panel']} value={tab} index={1}>
            <TransactionList
              subscriptions={subscriptions}
              txs={arSyncTxs}
              removeArSyncTxs={removeArSyncTxs}
            />
          </TabPanel>
        </Box>
      </Box>

      <Box>
        <SearchPodcastResults
          onClose={handleCloseSearchResults}
          clickFeedHandler={handleFetchFeed}
          isOpen={showSearchResults}
          searchQuery={searchQuery}
          results={searchResults}
        />
      </Box>

      {showPodcastDetails && hasMetadata(selectedPodcastMetadata) && (
        <Box>
          <PodcastDetails
            onClose={handleClosePodcastDetails}
            podcast={selectedPodcastMetadata as Podcast}
            isSubscribed={isSubscribed()}
            isOpen={showPodcastDetails}
            handleSubscribe={handleSubscribe}
            handleUnsubscribe={handleUnsubscribe}
            showPodcastMetadata={showPodcastMetadata}
            setShowPodcastMetadata={setShowPodcastMetadata}
            showImages={showImages}
            setShowImages={setShowImages}
          />
        </Box>
      )}
    </div>
  );
}

export default HomePage;
