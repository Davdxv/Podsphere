import React, { useState } from 'react';
import {
  Box, Modal, Table,
  TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel,
  TablePagination, Toolbar, Typography,
} from '@mui/material';
import Highlighter from 'react-highlight-words';
import CloseButton from './buttons/close-button';
import { SearchPodcastResult } from '../client/interfaces';
import { metadatumToString } from '../utils';
import { truncateString } from '../client/metadata-filtering/formatting';
import style from './search-podcast-results.module.scss';

type Order = 'asc' | 'desc';

interface OnCloseProp {
  onClose: (_event: React.MouseEvent<unknown>, reason: string) => void,
}

interface Props extends OnCloseProp {
  clickFeedHandler: (_event: React.MouseEvent<unknown>, feedUrl: string) => Promise<void>,
  // eslint-disable-next-line react/no-unused-prop-types
  isOpen?: boolean,
  searchQuery: string,
  results: SearchPodcastResult[],
}

interface SearchResult extends Pick<SearchPodcastResult, 'title' | 'author' | 'lastEpisodeDate' |
'numEpisodes' | 'feedUrl'> {
  index: number,
  genres: string,
}

const rows = (results: SearchPodcastResult[]) : SearchResult[] => results.map((res, index) => ({
  ...res,
  index,
  genres: (res.genres || []).join(', '),
}));

const SearchPodcastResults : React.FC<Props> = ({
  onClose,
  clickFeedHandler,
  isOpen = false,
  searchQuery = '',
  results = [],
}: Props) => (
  <Modal open={isOpen} onClose={onClose} className={style['search-results-modal']}>
    <EnhancedTable
      clickFeedHandler={clickFeedHandler}
      onClose={onClose}
      searchQuery={searchQuery}
      results={results}
    />
  </Modal>
);
export default SearchPodcastResults;

/** An 'index' is added in rows() to retain original sort order */
const DEFAULT_ORDER_BY = 'index';
const DEFAULT_ROWS_PER_PAGE = 10;

/** Adapted from: https://mui.com/material-ui/react-table/#sorting-amp-selecting */
function EnhancedTable(props: Props) {
  const { onClose, clickFeedHandler, searchQuery, results } = props;

  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<keyof SearchResult>(DEFAULT_ORDER_BY);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  const handleRequestSort = (_event: React.MouseEvent<unknown>, prop: keyof SearchResult) => {
    setPage(0);
    if (orderBy === prop) {
      if (order === 'desc') {
        // 3rd click: Revert to default sort
        setOrder('asc');
        setOrderBy(DEFAULT_ORDER_BY);
      }
      else {
        // 2nd click
        setOrder('desc');
      }
    }
    else {
      // 1st click
      setOrder('asc');
      setOrderBy(prop);
    }
  };

  const handleClickRow = (event: React.MouseEvent<unknown>, feedUrl: string) => {
    clickFeedHandler(event, feedUrl);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPage(0);
    setRowsPerPage(parseInt(event.target.value, 10));
  };

  const getSearchWords = () => searchQuery.split(' ').filter(str => str.length > 1);

  return (
    <Box ref={ref} className={style['search-results-table-container']}>
      <EnhancedTableToolbar onClose={onClose} />
      <TablePagination
        rowsPerPageOptions={[10, 25, 100]}
        component="div"
        labelRowsPerPage="Show:"
        count={results.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
      <TableContainer>
        <Table
          sx={{ minWidth: 750 }}
          aria-labelledby="search-results-table-title"
          size="medium"
        >
          <EnhancedTableHead
            order={order}
            orderBy={orderBy}
            onRequestSort={handleRequestSort}
          />
          <TableBody>
            {rows(results).sort(getComparator(order, orderBy))
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((row, index) => {
                const labelId = `search-results-table-feed-${index}`;

                const { lastEpisodeDate, numEpisodes } = row;
                const title = truncateString(row.title, 120);
                const author = truncateString(row.author, 80);
                const feedUrl = truncateString(row.feedUrl, 120);
                const genres = truncateString(row.genres, 80);

                return (
                  <TableRow
                    hover
                    onClick={event => handleClickRow(event, row.feedUrl)}
                    tabIndex={-1}
                    key={labelId}
                  >
                    <TableCell
                      title={title.length !== row.title.length ? row.title : undefined}
                      className={style['search-results-table-col-title']}
                      align="left"
                      component="th"
                      scope="row"
                      padding="none"
                    >
                      <Highlighter
                        autoEscape
                        highlightClassName={style['text-highlight']}
                        searchWords={getSearchWords()}
                        textToHighlight={metadatumToString(title)}
                      />
                    </TableCell>
                    <TableCell
                      title={author.length !== row.author.length ? row.author : undefined}
                      className={style['search-results-table-col-author']}
                      align="right"
                    >
                      <Highlighter
                        autoEscape
                        highlightClassName={style['text-highlight']}
                        searchWords={getSearchWords()}
                        textToHighlight={metadatumToString(author)}
                      />
                    </TableCell>
                    <TableCell
                      className={style['search-results-table-col-date']}
                      align="right"
                    >
                      {metadatumToString(lastEpisodeDate)}
                    </TableCell>
                    <TableCell
                      className={style['search-results-table-col-eps']}
                      align="right"
                    >
                      {metadatumToString(numEpisodes)}
                    </TableCell>
                    <TableCell
                      title={feedUrl.length !== row.feedUrl.length ? row.feedUrl : undefined}
                      className={style['search-results-table-col-feed-url']}
                      id={labelId}
                      align="right"
                    >
                      {metadatumToString(feedUrl)}
                    </TableCell>
                    <TableCell
                      title={genres.length !== row.genres.length ? row.genres : undefined}
                      className={style['search-results-table-col-genres']}
                      align="right"
                    >
                      {metadatumToString(genres)}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
});

function descendingComparator<T>(a: T, b: T, orderBy: keyof T) {
  if (b[orderBy] < a[orderBy]) return -1;
  if (b[orderBy] > a[orderBy]) return 1;

  return 0;
}

function getComparator<Key extends keyof SearchResult>(order: Order, orderBy: Key) : (
  a: { [key in Key]: number | string | Date },
  b: { [key in Key]: number | string | Date },
) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

interface HeadCell {
  disablePadding: boolean;
  id: keyof SearchResult;
  label: string;
  align: 'left' | 'right';
}

const headCells : readonly HeadCell[] = [
  {
    id: 'title',
    align: 'left',
    disablePadding: true,
    label: 'title',
  },
  {
    id: 'author',
    align: 'right',
    disablePadding: false,
    label: 'author/owner',
  },
  {
    id: 'lastEpisodeDate',
    align: 'right',
    disablePadding: false,
    label: 'last episode',
  },
  {
    id: 'numEpisodes',
    align: 'right',
    disablePadding: false,
    label: 'episodes',
  },
  {
    id: 'feedUrl',
    align: 'right',
    disablePadding: false,
    label: 'feed',
  },
  {
    id: 'genres',
    align: 'right',
    disablePadding: false,
    label: 'genres',
  },
];

interface EnhancedTableHeadProps {
  onRequestSort: (event: React.MouseEvent<unknown>, property: keyof SearchResult) => void;
  order: Order;
  orderBy: string;
}

function EnhancedTableHead(props: EnhancedTableHeadProps) {
  const { onRequestSort, order, orderBy } = props;
  const createSortHandler = (property: keyof SearchResult) => (
    (event: React.MouseEvent<unknown>) => onRequestSort(event, property)
  );

  return (
    <TableHead>
      <TableRow>
        {headCells.map(headCell => (
          <TableCell
            className={style['search-results-table-head-cell']}
            key={headCell.id}
            align={headCell.align}
            padding={headCell.disablePadding ? 'none' : 'normal'}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : 'asc'}
              onClick={createSortHandler(headCell.id)}
            >
              {headCell.label}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

const EnhancedTableToolbar : React.FC<OnCloseProp> = ({ onClose }) => (
  <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 } }}>
    <Typography
      sx={{ flex: '1 1 100%' }}
      variant="h6"
      id="search-results-table-title"
      component="div"
    >
      Podcast search results from iTunes
    </Typography>
    <CloseButton classes={style['search-results-close-button']} onClick={onClose} />
  </Toolbar>
);
