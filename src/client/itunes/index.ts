import {
  Entities,
  Media,
  Options,
  ResultPodcast,
  search,
} from 'itunes-store-api';
import { isNotEmpty, toDate } from '../../utils';
import { SearchPodcastResult } from '../interfaces';

// declare global {
//   interface Window {
//     searchPodcast: any;
//   }
// }
// if (typeof window !== 'undefined') { window.searchPodcast = searchPodcast; }

const MAX_RESULTS = 100;

const toGenericResult = (itunes: ResultPodcast) : SearchPodcastResult => ({
  id: +itunes.collectionId || -1,
  feedUrl: itunes.feedUrl || '',
  title: itunes.collectionName || itunes.trackName || '',
  author: itunes.artistName || '',
  numEpisodes: +itunes.trackCount || 0,
  lastEpisodeDate: toDate(itunes.releaseDate || ''),
  genres: itunes.genres || [],
  country: itunes.country || '',
});

const isValidResult = (res: SearchPodcastResult) => res.feedUrl && res.title;

export async function searchPodcast<M extends Media, E extends Entities[M]>(
  terms: string,
  options: Partial<Options<M, E>> = {},
) : Promise<SearchPodcastResult[]> {
  const searchOptions : Partial<Options<M, E>> = {
    entity: 'podcast' as E,
    limit: MAX_RESULTS,
    ...options,
  };
  const results = await search<M, E>(terms, searchOptions);
  if (!isNotEmpty(results?.results)) return [];

  return results.results.map(itunesResult => toGenericResult(itunesResult as ResultPodcast))
    .filter(isValidResult);
}

// TODO: Search for episodes: searchPodcast(terms, { entity: 'podcastEpisode', collectionId: id })
