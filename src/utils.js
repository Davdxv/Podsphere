export function unixTimestamp(date = null) {
  return `${Math.floor(date ? date.getTime() : Date.now() / 1000)}`;
}

export function toISOString(date) {
  try {
    return date.toISOString();
  }
  catch (error) {
    return '';
  }
}

/**
 * @param {(string|Date)} date
 * @return {(Date|null)} One of the following:
 *   - A new Date object, if `date` is a valid date string.
 *   - null, if `date` is not a valid date string.
 *   - `date`, if `date` is already a Date object.
 */
export function toDate(date) {
  if (!date) return null;
  if (date instanceof Date) return date;

  const dateObj = new Date(date);
  return dateObj.getTime() ? dateObj : null;
}

export function podcastWithDateObjects(podcast, sortEpisodes = true) {
  const conditionalSort = episodes => (sortEpisodes ?
    episodes.sort((a, b) => b.publishedAt - a.publishedAt) : episodes);
  const episodes = conditionalSort(
    (podcast.episodes || []).map(episode => ({
      ...episode,
      publishedAt: toDate(episode.publishedAt),
    })),
  );

  return Object.assign(
    { ...podcast, episodes },
    podcast.firstEpisodeDate ? { firstEpisodeDate: toDate(podcast.firstEpisodeDate) } : null,
    podcast.lastEpisodeDate ? { lastEpisodeDate: toDate(podcast.lastEpisodeDate) } : null,
  );
}

export function podcastsWithDateObjects(podcasts, sortEpisodes = true) {
  return podcasts.filter(podcast => !isEmpty(podcast))
    .map(podcast => podcastWithDateObjects(podcast, sortEpisodes));
}

/* Returns true if the given array or object is empty or not an object */
export function isEmpty(obj) {
  return (typeof obj !== 'object' || Object.keys(obj).length === 0);
}

/* Returns true if the given arrays or objects' values are equal */
export function valuesEqual(a = {}, b = {}) {
  if (a === b) return true;
  if (!a || !b) return false;

  return (Object.values(a).every(x => b.includes(x)) &&
    Object.values(b).every(x => a.includes(x)));
}

export function corsApiHeaders() {
  switch (corsProxyURL()) {
    case 'https://cors.bridged.cc/':
      /* See: https://github.com/gridaco/base/issues/23 */
      return { 'x-cors-grida-api-key': 'MyAPIKey' };
    default:
      return {};
  }
}

export function corsProxyURL() {
  return 'https://corsanywhere.herokuapp.com/';
}

export function withCorsProxy(url) {
  return corsProxyURL() + url;
}
