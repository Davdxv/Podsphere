import React, { useContext, useEffect, useState } from 'react';
import {
  Box, Tabs, Tab,
} from '@mui/material';
import { toast } from 'react-toastify';
import {
  Episode, Podcast, Thread,
} from '../client/interfaces';
import { findMetadataByFeedUrl, hasMetadata } from '../utils';
import { SubscriptionsContext } from '../providers/subscriptions';
import { ArweaveContext } from '../providers/arweave';
import PodGraph from '../components/pod-graph';
import HeaderComponent from '../components/layout/header-component';
import PodcastList from '../components/podcast-list';
import TransactionList from '../components/transaction-list';
// import ThreadList from '../components/thread-list';
import DraftList from '../components/draft-list';
import SearchPodcastResults from '../components/search-podcast-results';
import PodcastDetails from '../components/podcast-details';
import NewThreadDialog from '../components/new-thread';
import AlertDialog from '../components/alert-dialog';
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
    handleCreateThread,
    handleDiscardThread,
    handleSearch,
    handleFetchPodcastRss2Feed,
    metadataToSync,
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
  const [showPodcastDetails, setShowPodcastDetails] = useState(false);

  const [showPodcastMetadata, setShowPodcastMetadata] = useState(false);
  const [showEpisodeImages, setShowEpisodeImages] = useState(true);

  const [showCreateThreadDialog, setShowCreateThreadDialog] = useState(false);
  const [createThreadPodcastId, setCreateThreadPodcastId] = useState('');
  const [createThreadEpisodeId, setCreateThreadEpisodeId] = useState<Date | null>(null);

  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [threadDraft, setThreadDraft] = useState<Thread | null>(null);

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

  const handleShowCreateThreadDialog = (_event: React.MouseEvent<unknown>, podcastId: Podcast['id'],
    episodeId: Episode['publishedAt'] | null) => {
    setCreateThreadPodcastId(podcastId);
    setCreateThreadEpisodeId(episodeId);
    setShowCreateThreadDialog(true);
  };

  const handleShowEditThreadDialog = (_event: React.MouseEvent<unknown>, draft: Thread) => {
    setThreadDraft(draft);
    setCreateThreadPodcastId(draft.podcastId);
    setCreateThreadEpisodeId(draft.episodeId);
    setShowCreateThreadDialog(true);
  };

  const handleCloseCreateThreadDialog = () => {
    setShowCreateThreadDialog(false);
    setThreadDraft(null);
    setCreateThreadPodcastId('');
    setCreateThreadEpisodeId(null);
  };

  const handleOpenSavePrompt = (draft: Thread) => {
    setThreadDraft(draft);
    setShowSavePrompt(true);
  };

  const handleCloseSavePrompt = () => {
    setShowSavePrompt(false);
  };

  const handleSubmitThread = (thread: Thread) => {
    if (thread) {
      toast.success('Thread saved in browser storage.\n\nTo upload it to Arweave, tap the Sync '
        + 'button twice.\n\nYou may still edit or discard it from the Drafts tab.');
      handleCreateThread(thread);
      handleCloseCreateThreadDialog();
    }
  };

  const handleSaveDraft = () => {
    if (threadDraft) {
      toast.success('Draft saved in browser storage.\n\nYou can edit, submit or discard it from '
        + 'the Drafts tab.');
      handleCreateThread(threadDraft);
    }
    setShowSavePrompt(false);
    handleCloseCreateThreadDialog();
  };

  const handleDiscardDraft = () => {
    if (threadDraft) {
      toast.info('Draft deleted.');
      handleDiscardThread(threadDraft);
    }
    setShowSavePrompt(false);
    handleCloseCreateThreadDialog();
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

  async function search(_event: React.MouseEvent<any> | React.FormEvent<any>, query: string)
    : Promise<boolean> {
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
        <Box>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs onChange={handleChange} value={tab} aria-label="Info tabs">
              <Tab className={style.tabHeader} label="Subscriptions" />
              <Tab className={style.tabHeader} label="Transactions" />
              <Tab className={style.tabHeader} label="Threads" />
              <Tab className={style.tabHeader} label="Drafts" />
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

          <TabPanel className={style['tab-panel']} value={tab} index={2}>
            <div />
          </TabPanel>

          <TabPanel className={style['tab-panel']} value={tab} index={3}>
            <DraftList
              subscriptions={subscriptions}
              metadataToSync={metadataToSync}
              handleShowEditThreadDialog={handleShowEditThreadDialog}
              handleOpenSavePrompt={handleOpenSavePrompt}
              handleCreateThread={handleCreateThread}
            />
          </TabPanel>
        </Box>
      </Box>

      <SearchPodcastResults
        onClose={handleCloseSearchResults}
        clickFeedHandler={handleFetchFeed}
        isOpen={showSearchResults}
        searchQuery={searchQuery}
        results={searchResults}
      />

      {showPodcastDetails && hasMetadata(selectedPodcastMetadata) && (
      <PodcastDetails
        onClose={handleClosePodcastDetails}
        podcast={selectedPodcastMetadata as Podcast}
        isSubscribed={isSubscribed()}
        isOpen={showPodcastDetails}
        handleSubscribe={handleSubscribe}
        handleUnsubscribe={handleUnsubscribe}
        showPodcastMetadata={showPodcastMetadata}
        setShowPodcastMetadata={setShowPodcastMetadata}
        showEpisodeImages={showEpisodeImages}
        setShowEpisodeImages={setShowEpisodeImages}
        handleShowCreateThreadDialog={handleShowCreateThreadDialog}
      />
      )}

      {showCreateThreadDialog && (
      <NewThreadDialog
        onClose={handleCloseCreateThreadDialog}
        isOpen={showCreateThreadDialog}
        handleOpenSavePrompt={handleOpenSavePrompt}
        handleSubmitThread={handleSubmitThread}
        subscriptions={subscriptions}
        prevDraft={threadDraft}
        podcastId={createThreadPodcastId}
        episodeId={createThreadEpisodeId}
      />
      )}

      {showSavePrompt && (
      <AlertDialog
        onClose={handleCloseSavePrompt}
        isOpen={showSavePrompt}
        title="Would you like to keep your draft?"
        description=""
        buttons={[
          ['Save', handleSaveDraft, { autoFocus: true }],
          ['Discard', handleDiscardDraft],
          ['Close', () => { handleCloseSavePrompt(); handleCloseCreateThreadDialog(); }],
        ]}
      />
      )}
    </div>
  );
}

export default HomePage;
