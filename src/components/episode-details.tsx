import React, { useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Box,
  Link,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AttachmentIcon from '@mui/icons-material/AttachFile';
import DurationIcon from '@mui/icons-material/MoreTime';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Episode, Podcast, Thread } from '../client/interfaces';
import {
  bytesToString,
  getTextSelection,
  isFakeDate,
  isValidDate,
} from '../utils';
import { truncateString } from '../client/metadata-filtering/formatting';
import { isCandidatePodcastId } from '../podcast-id';
import { parseHtml } from './utils';
import CreateThreadButton from './buttons/create-thread-button';
import CachedImage from './cached-image';
import style from './episode-details.module.scss';

dayjs.extend(relativeTime);

interface Props {
  podcastId: Thread['podcastId'];
  episode: Episode;
  showImage: boolean;
  podcastImageUrl?: string;
  handleShowCreateThreadDialog: (_event: React.MouseEvent<unknown>, podcastId: Podcast['id'],
    episodeId: Thread['episodeId']) => void;
}

type ParsedDescriptions = {
  fullDescription: string,
  truncatedDescription: string,
  isTruncated: Readonly<boolean>,
};

const TRUNCATION_LEN = 300;

/**
 * Most RSS feeds define at least 2 variants of the full description per episode.
 * Internally we reference these with:
 *   1. `contentHtml`: intended to be the unabridged, HTML-formatted ep description;
 *   2. `summary`: usually an unabridged plaintext version of `contentHtml`;
 *   3. `subtitle` (yet unused): intended to be a short ep description.
 *
 * This function selects the optimal field to format the episode description.
 * @returns The resulting `{ fullDescription, truncatedDescription, isTruncated }`
 */
const parseDescriptionMetadata = (contentHtml = '', summary = '') : ParsedDescriptions => {
  const fullDescription = (contentHtml.length > summary.length ? contentHtml : summary) || '';
  let truncatedDescription = truncateString(fullDescription, TRUNCATION_LEN);

  const isTruncated : Readonly<boolean> = (fullDescription.length > TRUNCATION_LEN);
  if (isTruncated && summary) truncatedDescription = truncateString(summary, TRUNCATION_LEN);

  return { fullDescription, truncatedDescription, isTruncated };
};

const EpisodeDetails : React.FC<Props> = ({
  podcastId, episode, showImage, podcastImageUrl, handleShowCreateThreadDialog,
}) => {
  const [expandDescription, setExpandDescription] = useState(false);

  const { title, publishedAt, contentHtml, summary, mediaUrl, mediaLength, duration } = episode;
  const imgUrl = episode.imageUrl || podcastImageUrl || '';

  const { fullDescription, truncatedDescription, isTruncated } =
    parseDescriptionMetadata(contentHtml, summary);

  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('sm'));
  const isIndexed = !isCandidatePodcastId(podcastId);

  const handleClick = (event: React.MouseEvent<unknown>) => {
    // Don't toggle episode expand/collapse if user clicks a metadata link
    if (event?.target instanceof HTMLAnchorElement) return;
    if (isTruncated && !getTextSelection()) setExpandDescription(prev => !prev);
  };

  const epDescriptionClasses = () => {
    const classes = style[`ep-description${(isTruncated ? '--clickable' : '')}`];
    return `${classes} ${expandDescription ? style['ep-description--expanded'] : ''}`;
  };

  return (
    <Box className={style['ep-card-wrapper']}>
      <Box className={style['ep-card-body']}>
        <Box className={style['ep-image-box']}>
          {(!isSm || showImage) && (
          <Link href={imgUrl} title="View full-size image" target="_blank">
            <CachedImage
              className={style['ep-image']}
              src={showImage ? imgUrl : podcastImageUrl || ''}
              alt={title}
            />
          </Link>
          )}
        </Box>
        <Box className={epDescriptionClasses()} onClick={handleClick}>
          {expandDescription ? parseHtml(fullDescription) : parseHtml(truncatedDescription)}
        </Box>
        <Box className={style['ep-metadata']}>
          <Link className={style['ep-link']} href={mediaUrl} title={mediaUrl} target="_blank">
            <b>{title}</b>
          </Link>
          <Box className={style['ep-small-metadata']}>
            {mediaLength && mediaLength !== '0' && (
              <Box component="small" className={style['ep-metadatum']}>
                <AttachmentIcon className={style['ep-metadatum-icon']} />
                {bytesToString(mediaLength)}
              </Box>
            )}
            <Box component="small" className={style['ep-metadatum']}>
              <DurationIcon className={style['ep-metadatum-icon']} />
              {duration}
            </Box>
            <Box component="small" className={style['ep-metadatum']}>
              <CloudUploadIcon className={style['ep-metadatum-icon']} />
              {isFakeDate(publishedAt) ? 'unknown' : dayjs(publishedAt).fromNow()}
            </Box>
            {isValidDate(publishedAt) && (
              <Box component="small" className={style['ep-metadatum']}>
                <CreateThreadButton
                  isIndexed={isIndexed}
                  classes={style[`ep-metadatum-icon-large${isIndexed ? '--clickable' : ''}`]}
                  podcastId={podcastId}
                  episodeId={publishedAt}
                  handleShowCreateThreadDialog={handleShowCreateThreadDialog}
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default EpisodeDetails;
