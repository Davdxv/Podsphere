import React, { useState } from 'react';
import {
  Box, Modal, DialogContent,
  FormControl, InputLabel, OutlinedInput,
  TextareaAutosize, FormControlLabel,
  Radio, RadioGroup, Button,
} from '@mui/material';
import { toast } from 'react-toastify';
import { v4 as uuid } from 'uuid';
import {
  Episode, Podcast, Thread,
  ThreadType,
} from '../client/interfaces';
import {
  findEpisodeMetadata, findMetadataById,
  isEmpty, isValidString, unixTimestamp,
} from '../utils';
import CloseButton from './buttons/close-button';
import CachedImage from './cached-image';
import style from './new-thread.module.scss';

interface Props {
  onClose: () => void;
  isOpen: boolean;
  handleOpenSavePrompt: (draft: Thread) => void;
  handleSubmitThread: (thread: Thread) => void;
  subscriptions: Podcast[];
  prevDraft: Thread | null;
  podcastId: Podcast['id'];
  episodeId: Episode['publishedAt'] | null; // If null, the thread pertains to the podcast itself
}

const NewThreadDialog : React.FC<Props> = ({
  onClose, isOpen, handleOpenSavePrompt,
  handleSubmitThread, subscriptions, prevDraft,
  podcastId, episodeId,
}) => {
  const [initialized, setInitialized] = useState(false);
  const [modified, setModified] = useState(false);
  const [subject, setSubject] = useState(prevDraft ? prevDraft.subject : '');
  const [content, setContent] = useState(prevDraft ? prevDraft.content : '');
  const [type, setType] = useState<ThreadType>(prevDraft ? prevDraft.type : 'public');
  const id = prevDraft ? prevDraft.id : uuid();

  const podcast : Partial<Podcast> = findMetadataById(podcastId, subscriptions);
  const episode : Episode | null = findEpisodeMetadata(episodeId, podcast);

  if (!initialized) {
    setInitialized(true);
    const propsAreInvalid = isEmpty(podcast) || !!(episodeId && isEmpty(episode));
    if (propsAreInvalid) {
      setTimeout(onClose, 250);
      toast.error('Unable to create thread: Could not find the corresponding '
        + `${episodeId ? 'episode' : 'podcast'}.\n\nPlease ensure that you are subscribed to the `
        + 'podcast and that it\'s indexed.', { autoClose: 8000, toastId: 'thr-bad-props' });
      return <Box />;
    }
  }

  const title = [podcast.title, episode?.title].filter(x => x).join(': ');
  const imageUrl = episode?.imageUrl || podcast.imageUrl || '';

  const newThread = (props: Partial<Thread> = {}) : Thread => {
    const thr = { isDraft: false, id, podcastId, episodeId, subject, content, type };
    return { ...thr, ...props, timestamp: unixTimestamp() };
  };

  const handleSubjectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setModified(true);
    setSubject(event.target?.value || '');
  };

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setModified(true);
    setContent(event.target?.value || '');
  };

  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setModified(true);
    if (event.target?.value) setType(event.target?.value as ThreadType);
  };

  const handleClose = (_event: React.MouseEvent<unknown>, reason = '') => {
    if (reason !== 'backdropClick') {
      if (modified && (isValidString(subject) || isValidString(content))) {
        handleOpenSavePrompt(newThread({ isDraft: true }));
      }
      else onClose();
    }
  };

  const handleSubmit = (_event: React.MouseEvent<unknown>) => {
    if (!isValidString(subject) || !isValidString(content)) {
      toast.warn(`Please fill in ${!subject ? 'a subject' : 'some content'} for the thread`,
        { autoClose: 2000, toastId: 'thr-submit-warning' });
    }
    else handleSubmitThread(newThread());
  };

  return (
    <Modal
      disableEnforceFocus
      className={style['new-thread-modal']}
      open={isOpen && initialized}
      onClose={handleClose}
    >
      <DialogContent className={style['new-thread-inner-container']}>
        <CloseButton classes={style['new-thread-close-button']} onClick={handleClose} />

        <Box className={style['new-thread-header']}>
          {imageUrl && (
          <CachedImage
            classes={style['new-thread-image']}
            src={imageUrl}
            alt={`${title} image`}
          />
          )}
          <Box component="h4" className={style['new-thread-title-container']}>
            <span>New Thread in:</span>
            <span className={style['new-thread-title']}>{title}</span>
          </Box>
        </Box>

        <Box className={style['new-thread-fields']}>
          <FormControl className={style['new-thread-subject']} variant="outlined">
            <InputLabel htmlFor="subject-outlined-adornment">Subject</InputLabel>
            <OutlinedInput
              value={subject}
              onChange={handleSubjectChange}
              id="subject-outlined-adornment"
              type="text"
              label="Subject"
            />
          </FormControl>

          <FormControl className={style['new-thread-content']}>
            <TextareaAutosize
              minRows={20}
              maxRows={25}
              placeholder="Content"
              value={content}
              onChange={handleContentChange}
            />
          </FormControl>

          <FormControl className={style['new-thread-type']}>
            <RadioGroup row value={type} defaultValue="public" onChange={handleTypeChange}>
              <FormControlLabel value="public" control={<Radio />} label="public" />
              <FormControlLabel value="private" control={<Radio />} label="private" />
              <FormControlLabel value="passworded" control={<Radio />} label="passworded" />
            </RadioGroup>
          </FormControl>
        </Box>

        <Box>
          <Button className={style['submit-button']} onClick={handleSubmit}>Submit</Button>
        </Box>
      </DialogContent>
    </Modal>
  );
};

export default NewThreadDialog;
