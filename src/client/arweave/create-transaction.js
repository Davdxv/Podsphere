import client from './client';
import { toTag } from './utils';
import {
  unixTimestamp,
  toISOString,
  isEmpty,
  hasMetadata,
  isValidDate,
  isValidInteger,
} from '../../utils';

async function newTransaction(wallet, newMetadata, tags = []) {
  try {
    const trx = await client.createTransaction({ data: JSON.stringify(newMetadata) }, wallet);
    trx.addTag('Content-Type', 'application/json');
    trx.addTag('Unix-Time', `${unixTimestamp()}`);
    trx.addTag(toTag('version'), process.env.VERSION);
    tags.forEach(([k, v]) => {
      trx.addTag(toTag(k), `${v}`);
    });
    return trx;
  }
  catch (error) {
    console.error(error);
    return new Error('Creating transaction failed: please try reloading your wallet.');
  }
}

export async function signAndPostTransaction(trx, wallet) {
  let postResponse;
  try {
    await client.transactions.sign(trx, wallet); // has no return value
    postResponse = await client.transactions.post(trx);
  }
  catch (error) {
    console.error(error);
    if (!postResponse) {
      return new Error('Signing transaction failed: please try reloading your wallet.');
    }
    return new Error('Posting transaction failed: please try reloading your wallet.');
  }

  if (!isEmpty(postResponse.data.error)) {
    return new Error(`${postResponse.data.error.code}. Posting transaction failed: ` +
      `${postResponse.data.error.msg}`);
  }
  return trx;
}

/**
 * @param {Object} wallet
 * @param {Object} newMetadata Assumed to already be a diff vs `cachedMetadata`
 * @param {Object} cachedMetadata
 * @returns {Object} an Arweave Transaction or an Error object
 */
export async function newMetadataTransaction(wallet, newMetadata, cachedMetadata = {}) {
  const optionalPodcastTags = [
    // TODO: expand this list to be as complete as possible.
    // imgUrl and imageTitle are optional metadata as well, but these do not belong in the tags,
    // as they do not have to be GraphQL-searchable.
    'language',
  ];
  const mandatoryPodcastTags = [
    ['subscribeUrl', newMetadata.subscribeUrl || cachedMetadata.subscribeUrl],
    ['title', newMetadata.title || cachedMetadata.title],
    ['description', newMetadata.description || cachedMetadata.description],
  ];

  try {
    mandatoryPodcastTags.forEach(([name, value]) => {
      if (!value) {
        throw new Error('Could not upload metadata for ' +
          `${mandatoryPodcastTags.title || mandatoryPodcastTags.subscribeUrl}: ` +
          `${name} is missing`);
      }
    });
  }
  catch (ex) {
    return ex;
  }

  const podcastTags = [...mandatoryPodcastTags];
  optionalPodcastTags.forEach(tagName => {
    if (newMetadata[tagName]) podcastTags.push([tagName, newMetadata[tagName]]);
  });

  // Add new categories and keywords in string => string format
  (newMetadata.categories || []).forEach(cat => podcastTags.push(['category', cat]));
  (newMetadata.keywords || []).forEach(key => podcastTags.push(['keyword', key]));

  let episodeBatchTags;
  try {
    episodeBatchTags = episodeTags(newMetadata.episodes, cachedMetadata);
  }
  catch (ex) {
    return ex;
  }

  return newTransaction(wallet, newMetadata, podcastTags.concat(episodeBatchTags));
}

/**
 * @param {Array.<Object>} newEpisodes
 * @param {Array.<Object>} cachedMetadata
 * @returns {[[string, string]]} The metadata transaction tags for the given list of newEpisodes
 */
function episodeTags(newEpisodes, cachedMetadata) {
  if (!newEpisodes.length) { return []; }

  const firstEpisodeDate = newEpisodes[newEpisodes.length - 1].publishedAt;
  const lastEpisodeDate = newEpisodes[0].publishedAt;
  const metadataBatch = getMetadataBatchNumber(cachedMetadata, firstEpisodeDate, lastEpisodeDate);

  return [
    ['firstEpisodeDate', toISOString(firstEpisodeDate)],
    ['lastEpisodeDate', toISOString(lastEpisodeDate)],
    ['metadataBatch', `${metadataBatch}`],
  ];
}

/**
 * @param {Array.<Object>} cachedMetadata
 * @param {Date} firstNewEpisodeDate
 * @param {Date} lastNewEpisodeDate
 * @returns {number}
 *   An integer denoting the batch number for the [firstEpisodeDate, lastEpisodeDate] interval
 */
function getMetadataBatchNumber(cachedMetadata, firstNewEpisodeDate, lastNewEpisodeDate) {
  if (!isValidDate(firstNewEpisodeDate) || !isValidDate(lastNewEpisodeDate)) {
    throw new Error(`Could not upload metadata for ${cachedMetadata.title}: ` +
                     'Invalid date found for one of its episodes.');
  }
  const cachedBatchNumber = Number.parseInt(cachedMetadata.metadataBatch, 10);

  /* First metadata batch for this podcast */
  if (!hasMetadata(cachedMetadata) || !isValidInteger(cachedBatchNumber)) {
    return 0;
  }

  /* Retroactive inserting of metadata */
  // if (cachedMetadata.firstBatch.firstEpisodeDate >= lastNewEpisodeDate) {
  //   return cachedMetadata.firstBatch.count - 1;
  // }

  if (cachedBatchNumber && cachedMetadata.lastEpisodeDate > lastNewEpisodeDate) {
    // return queryMiddleMetadataBatchNumber(cachedMetadata,firstNewEpisodeDate,lastNewEpisodeDate);
    throw new Error('Supplementing existing metadata is not implemented yet.');
  }

  /* Next consecutive metadata batch */
  return cachedBatchNumber + 1;
}
