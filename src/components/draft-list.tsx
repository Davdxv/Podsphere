import React from 'react';
import { toast } from 'react-toastify';
import { Box } from '@mui/material';
import {
  Episode, Podcast, Post,
  Thread,
  // ThreadReply,
} from '../client/interfaces';
import {
  findEpisodeMetadata, findMetadataById, isEmpty,
  isNotEmpty,
} from '../utils';
import { truncateString } from '../client/metadata-filtering/formatting';
import ClearButton from './buttons/clear-button';
import ToggleButton from './buttons/toggle-button';
import CachedImage from './cached-image';
import style from './shared-elements.module.scss';

interface Props {
  subscriptions: Podcast[];
  metadataToSync: Partial<Podcast>[];
  hasPendingTxs: boolean;
  handleShowEditThreadDialog: (_event: React.MouseEvent<unknown>, draft: Thread) => void;
  handleOpenSavePrompt: (draft: Thread) => void;
  handleCreatePost: (post: Post) => void;
}

const DraftList : React.FC<Props> = ({
  subscriptions, metadataToSync, hasPendingTxs,
  handleShowEditThreadDialog, handleOpenSavePrompt, handleCreatePost,
}) => {
  const drafts =
    metadataToSync.map(podcast => podcast.threads).flat().filter(isNotEmpty) as Thread[];
  const itemClasses = `${style['list-item']} ${hasPendingTxs ? style['list-item--disabled'] : ''}`;
  const SYNC_PENDING = 'Synchronization pending. Please inspect the initialized transactions '
    + 'in the Transactions tab and press the Sync button again to sync them.';

  const toggleIsDraft = (thr: Thread) : Thread => ({ ...thr, isDraft: !thr.isDraft });

  const handleToggleSyncThread = (thr: Thread) => {
    handleCreatePost(toggleIsDraft(thr));
  };

  return (
    <Box className={style['list-container']}>
      { drafts.length ? [...drafts].reverse().map(draft => {
        const podcast : Partial<Podcast> = findMetadataById(draft.podcastId, subscriptions);
        const episode : Episode | null = findEpisodeMetadata(draft.episodeId, podcast);
        const propsAreInvalid = isEmpty(podcast) || !!(draft.episodeId && isEmpty(episode));

        const title = [podcast.title, episode?.title].filter(x => x).join(': ');
        const imageUrl = episode?.imageUrl || podcast.imageUrl || '';

        const TOGGLE_TOOLTIP = (draft.isDraft ? 'This Thread is saved locally only'
          : 'This thread is marked ready for upload to Arweave');

        return propsAreInvalid ? <span key={draft.id} /> : (
          <Box
            className={itemClasses}
            title={hasPendingTxs ? SYNC_PENDING : undefined}
            onClick={hasPendingTxs ? () => toast(SYNC_PENDING, { toastId: 'sync' }) : undefined}
            key={draft.id}
          >
            <Box
              className={style['title-detail']}
              title={hasPendingTxs ? undefined : truncateString(draft.content, 2000)}
              onClick={hasPendingTxs ? undefined : e => handleShowEditThreadDialog(e, draft)}
            >
              <CachedImage
                loading="lazy"
                classes={style['podcast-image']}
                src={imageUrl || ''}
                alt={title}
              />
              <Box className={style['item-title']}>
                <Box component="h5" className={style['title-header']}>
                  {title}
                </Box>
                <Box className={style['meta-detail']}>
                  {draft.subject}
                </Box>
              </Box>
            </Box>

            <Box className={style['call-to-action']}>
              <Box className={style['action-btn']}>
                <ToggleButton
                  title={hasPendingTxs ? undefined : TOGGLE_TOOLTIP}
                  enabled={!draft.isDraft}
                  onToggle={(_newValue: boolean) => handleToggleSyncThread(draft)}
                  disabled={hasPendingTxs}
                >
                  sync
                </ToggleButton>
                <ClearButton
                  classes={style['no-bg']}
                  onClick={hasPendingTxs ? undefined : () => handleOpenSavePrompt(draft)}
                />
              </Box>
            </Box>
          </Box>
        );
      }) : (
        <Box className={style['list-item']}>There are no thread drafts to display&hellip;</Box>
      )}
    </Box>
  );
};

export default DraftList;
