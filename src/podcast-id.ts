import { v4 as uuid } from 'uuid';
import { Podcast } from './client/interfaces';

const PODCAST_ID_PREFIX = 'temp-';
const PODCAST_ID_REGEX = new RegExp(`^${PODCAST_ID_PREFIX}`);

/**
 * Fast & loose uuid validation.
 * @param id If the `id` has a `temp-` prefix, the prefix is excluded from the validation
 * @returns true if the given `id` is a string comprised of 32-64 hex chars and any dashes
 */
export function isValidPodcastId(id: unknown) : id is Podcast['id'] {
  const isHex = (char: string) => '0123456789abcdef'.includes(char.toLowerCase());

  if (!id || typeof id !== 'string') return false;

  const guid = removePrefixFromPodcastId(id).replaceAll('-', '');
  return guid.length >= 32 && guid.length <= 64 && [...guid].every(isHex);
}

/**
 * @returns A new uuid prefixed with `temp-`. Prefix is removed once the uuid is confirmed through
 *   `./client/arweave/cache/podcast-id#getPodcastId()` (data structures are updated accordingly).
 */
export function newCandidatePodcastId() : string {
  return `${PODCAST_ID_PREFIX}${uuid()}`;
}

export function removePrefixFromPodcastId(candidateId: Podcast['id']) : string {
  return candidateId.replace(PODCAST_ID_REGEX, '');
}

/** Useful for filtering metadata lists by outdated id's */
export function addPrefixToPodcastId(id: Podcast['id']) : string {
  return `${PODCAST_ID_PREFIX}${removePrefixFromPodcastId(id)}`;
}

export function isCandidatePodcastId(id: Podcast['id']) : boolean {
  return !!id.match(PODCAST_ID_REGEX);
}

export function findBestId(ids: any[]) : string {
  const validIds = ids.filter(isValidPodcastId);
  const bestId = validIds.find(id => !isCandidatePodcastId(id));
  return bestId || validIds.at(-1) || ids.at(-1) || '';
}
