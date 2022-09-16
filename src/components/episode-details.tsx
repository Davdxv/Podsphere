import React, { useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Box, Link } from '@mui/material';
import AttachmentIcon from '@mui/icons-material/AttachFile';
import DurationIcon from '@mui/icons-material/MoreTime';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Episode } from '../client/interfaces';
import { getTextSelection, bytesToString } from '../utils';
import { truncateString } from '../client/metadata-filtering/formatting';
import { parseHtml } from './utils';
import CachedImage from './cached-image';
import style from './episode-details-elements.module.scss';

dayjs.extend(relativeTime);

interface Props {
  episode: Episode;
  showImage: boolean;
  podcastImageUrl?: string;
}

const EpisodeDetails : React.FC<Props> = ({ episode, showImage, podcastImageUrl }) => {
  const { title, publishedAt, contentHtml, summary, mediaUrl, mediaLength, duration,
    imageUrl } = episode;
  const imgUrl = imageUrl || podcastImageUrl || '';

  const fullDescription = ((contentHtml || '').length > (summary || '').length ? contentHtml
    : summary) || '';
  let truncatedDescription = truncateString(summary || '', 300);
  const isTruncated = !!truncatedDescription.match(/\.\.\.$/);
  if (!isTruncated && contentHtml) truncatedDescription = truncateString(contentHtml, 300);

  const [expandDescription, setExpandDescription] = useState(false);

  const handleClick = (event: React.MouseEvent<unknown>) => {
    // Don't toggle episode expand/collapse if user clicks a metadata link
    if (event?.target instanceof HTMLAnchorElement) return;
    if (isTruncated && !getTextSelection()) setExpandDescription(prev => !prev);
  };

  return (
    <Box className={style['ep-card-wrapper']}>
      <Box className={style['ep-card-body']}>
        <Box className={style['ep-image-box']}>
          <Link href={imgUrl} title="View full-size image" target="_blank">
            <CachedImage
              className={style['ep-image']}
              src={showImage ? imgUrl : podcastImageUrl || ''}
              alt={title}
            />
          </Link>
        </Box>
        <Box
          className={style[`ep-description${(isTruncated ? '--clickable' : '')}`]}
          sx={{ whiteSpace: expandDescription ? 'pre-line' : 'normal' }}
          onClick={handleClick}
        >
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
              {publishedAt ? dayjs(publishedAt).fromNow() : 'unknown'}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default EpisodeDetails;
