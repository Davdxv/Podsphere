import { Output as ParserOutput } from 'rss-parser/index.d';
import parser from './parser';
import {
  Episode,
  Podcast,
  PodcastFeedError,
} from '../interfaces';
import {
  fillMissingEpisodeDates,
  hasMetadata,
  isNotEmpty,
  isValidString,
  omitEmptyMetadata,
  toDate,
  valuePresent,
  withCorsProxy,
} from '../../utils';
import {
  initializeKeywords,
  mergeArraysToLowerCase,
  sanitizeString,
  sanitizeUri,
} from '../metadata-filtering';
import { newCandidatePodcastId } from '../../podcast-id';

interface RssPodcastFeed<U = { [key: string]: any }> extends ParserOutput<U>,
  Omit<Podcast, 'feedUrl' | 'title' | 'lastBuildDate'> {
  categories?: string[];
  keywords?: string[];
  owner?: {
    name?: string;
    email?: string;
  };
  docs?: string;
  lastBuildDate?: string;
}

type OptionalPodcastTags = Omit<Podcast, 'id' | 'feedType' | 'feedUrl' | 'title' | 'episodes'>;
type OptionalEpisodeTags = Omit<Episode, 'title' | 'publishedAt'>;
type CategoriesWithSubs = {
  name?: string,
  subs?: { name: string }[],
};

/**
 * @param items The list of episodes as returned by `node_modules/rss-parser#parseURL()`.
 * @param optionalPodcastTags Used to diff away ep metadata duplicated from the podcast tags.
 *   > - RSS feed admins often leave non-mandatory Episode metadata empty, upon which their feed
 *       generator/host likely attempts to populate a subset of these,
 *       by copying certain identically-named Podcast metadata.
 *   > - For data-efficiency, we always omit each Episode's optional metadata that are exact
 *       duplicates of those in `optionalPodcastTags`.
 * @returns An indexed object with:
 *   - The parsed, validated, sanitized and data-optimized `episodes`
 *   - The merged `episodesKeywords`, to be appended to the Podcast tags
 */
function formatEpisodes(items: any[] = [], optionalPodcastTags: OptionalPodcastTags = {})
  : { episodes: Episode[], episodesKeywords: string[] } {
  const episodesKeywords = new Set<string>();
  const episodes : Episode[] = items.map(episode => {
    const itunes = isNotEmpty(episode.itunes) ? episode.itunes : {};

    // TODO: find a way to parse episodes' guest(s) to episodeKeywords
    const episodeKeywords = mergeArraysToLowerCase(episode.keywords, itunes.keywords);

    const optionalEpisodeTags : OptionalEpisodeTags = {
      subtitle: sanitizeString(episode.subtitle || itunes.subtitle || ''),
      contentHtml: sanitizeString(episode['content:encoded'] || episode.content || '', true),
      summary: sanitizeString(itunes.summary || episode.contentSnippet || ''),
      guid: sanitizeString(episode.guid || itunes.guid || ''),
      infoUrl: sanitizeUri(episode.link || episode.docs || ''),
      mediaUrl: sanitizeUri(episode.enclosure?.url || ''),
      mediaType: sanitizeString(episode.enclosure?.type || ''),
      mediaLength: sanitizeString(episode.enclosure?.length || episode.length || ''),
      duration: sanitizeString(episode.duration || itunes.duration || ''),
      imageUrl: sanitizeUri(episode.image?.url || itunes.image || ''),
      imageTitle: sanitizeString(episode.image?.title || ''),
      explicit: sanitizeString(episode.explicit || itunes.explicit || ''),
      categories: mergeArraysToLowerCase(episode.categories, itunes.categories),
      keywords: episodeKeywords,
    };
    // Select only the optionalEpisodeTags not yet present in the optionalPodcastTags
    let selectedEpisodeTags : OptionalEpisodeTags = {};
    Object.entries(optionalEpisodeTags).forEach(([tagName, value]) => {
      if (optionalPodcastTags[tagName as keyof OptionalPodcastTags] !== value) {
        selectedEpisodeTags = { ...selectedEpisodeTags, [tagName]: value };
      }
    });

    const mandatoryEpisodeTags = {
      title: sanitizeString(episode.title || itunes.title),
      publishedAt: toDate(episode.isoDate || episode.pubDate),
    };
    const formattedEpisode =
      omitEmptyMetadata({ ...mandatoryEpisodeTags, ...selectedEpisodeTags }) as Episode;

    const isValidEpisode = isValidString(formattedEpisode.title);
    if (isValidEpisode) episodeKeywords.forEach(key => episodesKeywords.add(key));

    return isValidEpisode ? formattedEpisode : {} as Episode;
  }).filter(episode => Object.keys(episode).length !== 0);

  return { episodes: fillMissingEpisodeDates(episodes), episodesKeywords: [...episodesKeywords] };
}

/**
 * @param feed
 * @param feedUrl
 * @returns {Podcast}
 * @throws {Error} If any of the mandatory podcast metadata are empty/missing after filtering
 */
function formatPodcastFeed(feed: RssPodcastFeed, feedUrl: Podcast['feedUrl']) : Podcast {
  const { items, ...podcast } = feed;
  const podItunes = isNotEmpty(podcast.itunes) ? podcast.itunes : {};

  // Any subcategories are nested within podcast.itunes.categoriesWithSubs[i].subs[j].name
  const itunesSubCategories = (podItunes.categoriesWithSubs || [])
    .reduce((acc : string[], cat : CategoriesWithSubs) => acc
      .concat(Array.isArray(cat.subs) ? cat.subs.map(subCat => subCat.name) : []), []);

  const optionalPodcastTags : OptionalPodcastTags = {
    categories: mergeArraysToLowerCase(
      podcast.categories,
      (podItunes.categories || []).concat(itunesSubCategories),
    ),
    subtitle: sanitizeString(podcast.subtitle || podItunes.subtitle || ''),
    description: sanitizeString(podcast.description || podItunes.description || ''),
    summary: sanitizeString(podcast.summary || podItunes.summary || ''),
    infoUrl: sanitizeUri(podcast.link || podcast.docs || ''),
    imageUrl: sanitizeUri(podcast.image?.url || podItunes.image || ''),
    imageTitle: sanitizeString(podcast.image?.title || ''),
    language: sanitizeString(podcast.language || podItunes.language || ''),
    explicit: sanitizeString(podcast.explicit || podItunes.explicit || ''),
    author: sanitizeString(podItunes.author || podcast.author || podcast.creator || ''),
    ownerName: sanitizeString(podcast.owner?.name || podItunes.owner?.name || ''),
    ownerEmail: sanitizeString(podcast.owner?.email || podItunes.owner?.email || ''),
    copyright: sanitizeString(podcast.copyright || podItunes.copyright || ''),
    managingEditor: sanitizeString(podcast.managingEditor || podItunes.managingEditor || ''),
    lastBuildDate: toDate(podcast.lastBuildDate),
  };

  const { episodes, episodesKeywords } = formatEpisodes(items, optionalPodcastTags);
  // Add episode tags that must be GraphQL-searchable to top-level
  optionalPodcastTags.episodesKeywords = episodesKeywords;

  const mandatoryPodcastTags = {
    id: newCandidatePodcastId(),
    feedType: 'rss2',
    feedUrl,
    title: sanitizeString(podcast.title || ''),
    episodes,
    keywords: mergeArraysToLowerCase(podcast.keywords, podItunes.keywords),
  };

  // We should at least add one keyword referencing the Podcast Author(s)
  mandatoryPodcastTags.keywords = initializeKeywords({
    ...optionalPodcastTags,
    title: mandatoryPodcastTags.title,
  }, mandatoryPodcastTags.keywords);

  Object.entries(mandatoryPodcastTags).forEach(([tagName, value]) => {
    if (!valuePresent(value)) {
      throw new Error(
        `Could not parse RSS feed ${feedUrl}: required property '${tagName}' is empty.`,
      );
    }
  });

  return omitEmptyMetadata({ ...mandatoryPodcastTags, ...optionalPodcastTags }) as Podcast;
}

/**
 * @param feedUrl
 * @returns {(Podcast|PodcastFeedError)}
 */
export async function getPodcastRss2Feed(feedUrl: Podcast['feedUrl'], reformattedUrl = false)
  : Promise<Podcast | PodcastFeedError> {
  let errorMessage;
  let feed;
  try {
    feed = await parser.parseURL(withCorsProxy(feedUrl));
    return formatPodcastFeed(feed as RssPodcastFeed, feedUrl!);
  }
  catch (ex) {
    if (!reformattedUrl) {
      // Retry fetching feed once, adding url parameter `format=xml` (required for feedburner.com)
      // TODO: omit suffix from create-transaction, graphql-ops
      const newUrl = `${feedUrl}${feedUrl.match(/\?/) ? '&' : '?'}format=xml`;
      return getPodcastRss2Feed(newUrl, true);
    }

    const getFeedErrorMessage = `Could not fetch RSS feed ${feedUrl}.\n`
      + `Is the CORS Proxy configured under Settings working?\n\n${ex}`;
    const formatFeedErrorMessage = (ex as Error).message;
    errorMessage = hasMetadata(feed) ? formatFeedErrorMessage : getFeedErrorMessage;
  }
  return { errorMessage };
}
