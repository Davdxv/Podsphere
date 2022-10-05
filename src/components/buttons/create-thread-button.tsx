import React from 'react';
import { toast } from 'react-toastify';
import { IconButton, ButtonProps } from '@mui/material';
import CreateThreadIcon from '@mui/icons-material/AddComment';
import EditThreadIcon from '@mui/icons-material/Edit';
import { Podcast, Episode } from '../../client/interfaces';
import style from './style.module.scss';

const CREATE_THREAD_INFO = 'To create a thread, please first index this podcast using the '
  + 'Arweave Sync button (next to the Refresh button).';

interface Props extends ButtonProps {
  isIndexed: boolean;
  podcastId: Podcast['id'];
  episodeId: Episode['publishedAt'] | null;
  handleShowCreateThreadDialog: (_event: React.MouseEvent<unknown>, podcastId: Podcast['id'],
    episodeId: Episode['publishedAt'] | null) => void;
  iconType?: 'create' | 'edit';
  classes?: string;
}

const CreateThreadButton : React.FC<Props> = ({
  isIndexed, podcastId, episodeId,
  handleShowCreateThreadDialog, iconType = 'create', classes = '', ...props
}) => (
  <IconButton
    className={`${style['create-thread-btn']} ${classes}`}
    type="button"
    title={isIndexed ? 'Create Thread' : CREATE_THREAD_INFO}
    onClick={isIndexed ? e => handleShowCreateThreadDialog(e, podcastId, episodeId)
      : () => toast.info(CREATE_THREAD_INFO)}
    {...props}
  >
    {iconType === 'edit' ? <EditThreadIcon /> : <CreateThreadIcon />}
  </IconButton>
);

export default CreateThreadButton;
