import React, { useRef, useState } from 'react';
import {
  Box, Button, Modal,
  InputLabel, FormControl, OutlinedInput,
  TablePagination, Link,
} from '@mui/material';
import { ArrowDropDown, ArrowDropUp } from '@mui/icons-material';
import { Episode, Podcast } from '../client/interfaces';
import { isValidInteger, metadatumToString } from '../utils';
import { valueToLowerCase } from '../client/metadata-filtering/formatting';
import { isCandidatePodcastId } from '../podcast-id';
import CreateThreadButton from './buttons/create-thread-button';
import RssButton from './buttons/rss-button';
import CloseButton from './buttons/close-button';
import ClearButton from './buttons/clear-button';
import CachedImage from './cached-image';
import { Linkified } from './utils';
import EpisodeDetails from './episode-details';
import style from './podcast-details.module.scss';

interface Props {
  onClose: (_event: React.MouseEvent<unknown>, reason?: string) => void,
  podcast: Podcast,
  isSubscribed: boolean,
  isOpen: boolean,
  handleSubscribe: (_event: React.MouseEvent<unknown>, feedUrl: string) => Promise<void>,
  handleUnsubscribe: (_event: React.MouseEvent<unknown>, feedUrl: string) => Promise<void>,
  showPodcastMetadata: boolean,
  setShowPodcastMetadata: React.Dispatch<React.SetStateAction<boolean>>,
  showEpisodeImages: boolean,
  setShowEpisodeImages: React.Dispatch<React.SetStateAction<boolean>>,
  handleShowCreateThreadDialog: (_event: React.MouseEvent<unknown>, podcastId: Podcast['id'],
    episodeId: Episode['publishedAt'] | null) => void;
}

const FILTER_DELAY = 500; // ms

const PodcastDetails : React.FC<Props> = ({
  onClose, podcast,
  isSubscribed, isOpen,
  handleSubscribe, handleUnsubscribe,
  showPodcastMetadata, setShowPodcastMetadata,
  showEpisodeImages, setShowEpisodeImages,
  handleShowCreateThreadDialog,
}) => {
  const METADATA_TAGS = [
    'id', 'feedUrl', 'feedType', 'title', 'description', 'author', 'summary', 'explicit',
    'subtitle', 'language', 'creator', 'ownerName', 'ownerEmail', 'managingEditor', 'categories',
    'keywords', 'episodesKeywords', 'imageUrl', 'imageTitle', 'lastBuildDate', 'copyright',
  ];
  const { id, title, description, episodes, imageUrl, imageTitle } = podcast;

  const isIndexed = !isCandidatePodcastId(id);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [filterText, setFilterText] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [showClearButton, setShowClearButton] = useState(false);
  const filterRef = useRef<HTMLInputElement>(null);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPage(0);
    setRowsPerPage(parseInt(event.target.value, 10));
  };

  const toggle = (fn: React.Dispatch<React.SetStateAction<boolean>>) => fn(prev => !prev);

  const metadataRows = () => {
    const rows = [];
    for (const tag of METADATA_TAGS) {
      const val = podcast[tag as keyof Podcast];
      const key = `metadata-${tag}`;
      if (val) {
        rows.push((
          <tr key={key}>
            <td key={`${key}-tag`}>{tag}</td>
            <td key={`${key}-value`}>
              <Linkified>{metadatumToString(val)}</Linkified>
            </td>
          </tr>
        ));
      }
    }
    return rows;
  };

  const clearFilter = () => {
    setIsFiltering(false);
    setFilterText('');
    setShowClearButton(false);
    if (filterRef.current?.value) filterRef.current.value = '';
  };

  const handleFilterInputDelayed = (target: EventTarget & HTMLInputElement) => {
    setPage(0);
    setFilterText(target?.value || '');
    setIsFiltering(false);
  };

  const handleFilterInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target?.value;
    if (!input) return clearFilter();

    setShowClearButton(true);
    if (!isFiltering) {
      setIsFiltering(true);
      setTimeout(() => handleFilterInputDelayed(event.target), FILTER_DELAY);
    }
  };

  const filteredEpisodes = () : Episode[] => {
    const eps : Episode[] = (episodes || []);
    if (!filterText || !eps.length) return eps;

    const matchTerms = valueToLowerCase(filterText).split(' ');
    return eps.filter(ep => {
      const year = ep.publishedAt.getFullYear();
      const yearString = isValidInteger(year) ? `${year}` : '';
      const presentMetadata = [ep.title, ep.summary, ep.contentHtml, yearString,
        (ep.categories || []).join(' '), (ep.keywords || []).join(' ')]
        .filter(x => x).map(valueToLowerCase).join(' ');
      return matchTerms.every(term => !!presentMetadata.match(term));
    });
  };

  return (
    <Modal
      disableEnforceFocus
      className={style['podcast-details-modal']}
      open={isOpen}
      onClose={onClose}
    >
      <Box className={style['podcast-details-inner-container']}>
        <Box className={style.toolbar}>
          <CreateThreadButton
            isIndexed={isIndexed}
            classes={style[`ep-metadatum-icon-large${isIndexed ? '--clickable' : ''}`]}
            podcastId={id}
            episodeId={null}
            handleShowCreateThreadDialog={handleShowCreateThreadDialog}
          />
          <RssButton
            isSubscribed={isSubscribed}
            feedUrl={podcast.feedUrl}
            handleSubscribe={handleSubscribe}
            handleUnsubscribe={handleUnsubscribe}
          />
        </Box>

        <CloseButton classes={style['podcast-details-close-button']} onClick={onClose} />

        <Box component="h4" className={style['podcast-details-title']}>{title}</Box>

        <Box className={style['podcast-details-description']}>
          {imageUrl && (
          <Link href={imageUrl} title="View full-size image" target="_blank">
            <CachedImage
              classes={style['podcast-details-image']}
              src={imageUrl}
              alt={imageTitle || `${title} image`}
            />
          </Link>
          )}
          {description && (
          <Linkified>{description}</Linkified>
          )}
        </Box>

        <Button onClick={() => toggle(setShowPodcastMetadata)}>
          Metadata
          {showPodcastMetadata ? <ArrowDropUp /> : <ArrowDropDown />}
        </Button>
        <Box className={style['podcast-details-metadata-table-container']}>
          {showPodcastMetadata && (
          <table id={style['podcast-details-metadata-table']}>
            <tbody>{metadataRows()}</tbody>
          </table>
          )}
        </Box>

        <Box className={style['episodes-toolbar']}>
          <Button sx={{ width: '8em' }} onClick={() => toggle(setShowEpisodeImages)}>
            {`${showEpisodeImages ? 'Hide' : 'Load'} episode images`}
          </Button>

          <FormControl sx={{ m: 1, width: 'auto', flexGrow: '99' }} variant="outlined">
            <InputLabel htmlFor="ep-filter-outlined-adornment">Filter</InputLabel>
            <OutlinedInput
              inputRef={filterRef}
              onChange={handleFilterInput}
              id="ep-filter-outlined-adornment"
              type="text"
              label="Filter"
            />
            {showClearButton && (
            <ClearButton classes={style['filter-clear-button']} onClick={clearFilter} />
            )}
          </FormControl>

          <TablePagination
            rowsPerPageOptions={[10, 50, 100, 250, 1000]}
            component="div"
            labelRowsPerPage="Show:"
            count={(episodes || []).length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Box>
        <Box>
          {((episodes || []).length ? (
            <Box component="ol" className={style['episode-list']}>
              {filteredEpisodes()
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
                .map(ep => (
                  <EpisodeDetails
                    key={`${ep.publishedAt}`}
                    podcastId={podcast.id}
                    episode={ep}
                    showImage={showEpisodeImages}
                    podcastImageUrl={imageUrl}
                    handleShowCreateThreadDialog={handleShowCreateThreadDialog}
                  />
                ))}
            </Box>
          ) : <Box component="p">No episodes found.</Box>)}
        </Box>
      </Box>
    </Modal>
  );
};

export default PodcastDetails;
