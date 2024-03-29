import { Podcast, PodcastDTO } from '../interfaces';
import { valueToLowerCase, mergeArraysToLowerCase } from './formatting';

/**
 * @param metadata sanitized metadata
 * @returns A keyword comprising the podcast author name, or (as a last resort) the podcast title,
 *   or an empty string if not generable
 */
function getPrimaryKeyword(metadata: Partial<Podcast> | Partial<PodcastDTO>) : string {
  const primaryKeyword = metadata.author || metadata.ownerName || metadata.title;
  return valueToLowerCase(primaryKeyword);
}

/**
 * @param metadata sanitized metadata
 * @param keywords existing keywords
 * @returns {Array.<string>} A filtered array of `keywords` with an additional primary keyword
 */
export function initializeKeywords(
  metadata: Partial<Podcast> | Partial<PodcastDTO>,
  keywords: string[] = [],
) : string[] {
  const primaryKeyword = getPrimaryKeyword(metadata);
  const result = mergeArraysToLowerCase([primaryKeyword], keywords);

  // Sometimes iTunes has keywords ['jimmy', 'dore', ...]; merge these with `primaryKeyword`
  const duplicateKeywords = primaryKeyword.split(' ');
  if (duplicateKeywords.length > 1) return result.filter(key => !duplicateKeywords.includes(key));

  return result;
}
