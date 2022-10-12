import React from 'react';
import { Box } from '@mui/material';
import { Episode, Podcast, Thread } from '../client/interfaces';
import { findEpisodeMetadata, findMetadataById, isNotEmpty } from '../utils';
import { truncateString } from '../client/metadata-filtering/formatting';
import ClearButton from './buttons/clear-button';
import ToggleButton from './buttons/toggle-button';
import CachedImage from './cached-image';
import style from './shared-elements.module.scss';

interface Props {
  subscriptions: Podcast[];
  metadataToSync: Partial<Podcast>[];
  handleShowEditThreadDialog: (_event: React.MouseEvent<unknown>, draft: Thread) => void;
  handleOpenSavePrompt: (draft: Thread) => void;
  handleCreateThread: (thread: Thread) => void;
}

const DraftList : React.FC<Props> = ({
  subscriptions, metadataToSync,
  handleShowEditThreadDialog, handleOpenSavePrompt, handleCreateThread,
}) => {
  const drafts = metadataToSync.map(podcast => podcast.threads).filter(isNotEmpty).flat();

  return (
    <Box className={style['list-container']}>
      { drafts.length ? [...drafts].reverse().map(draft => {
        const podcast : Partial<Podcast> = findMetadataById(draft.podcastId, subscriptions);
        const episode : Episode | null = findEpisodeMetadata(draft.episodeId, podcast);
        const propsAreInvalid = !isNotEmpty(podcast)
          || !!(draft.episodeId && !isNotEmpty(episode));
        const title = [podcast.title, episode?.title].filter(x => x).join(': ');
        const imageUrl = episode?.imageUrl || podcast.imageUrl || '';

        const toggleIsDraft = (thr: Thread) : Thread => ({ ...thr, isDraft: !thr.isDraft });

        const handleToggleSyncThread = (thread: Thread) => {
          handleCreateThread(toggleIsDraft(thread));
        };

        return propsAreInvalid ? <span /> : (
          <Box className={style['list-item']} key={draft.id}>
            <Box
              className={style['title-detail']}
              title={truncateString(draft.content, 2000)}
              onClick={e => handleShowEditThreadDialog(e, draft)}
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
                  title={draft.isDraft ? 'This Thread is saved locally only'
                    : 'This thread is marked ready for upload to Arweave'}
                  enabled={!draft.isDraft}
                  onToggle={(_newValue: boolean) => handleToggleSyncThread(draft)}
                >
                  sync
                </ToggleButton>
                <ClearButton classes={style['no-bg']} onClick={() => handleOpenSavePrompt(draft)} />
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
