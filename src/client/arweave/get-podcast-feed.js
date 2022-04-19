/* eslint-disable no-await-in-loop */
import client from './client';
import {
  isEmpty,
  hasMetadata,
  toDate,
  podcastWithDateObjects,
  concatMessages,
} from '../../utils';
import { toTag, fromTag } from './utils';
import { mergeBatchMetadata, mergeBatchTags } from './sync/diff-merge-logic';

const MAX_BATCH_NUMBER = 100;

export async function getPodcastFeed(subscribeUrl) {
  const errorMessages = [];
  const metadataBatches = [];
  const tagBatches = [];
  // TODO: negative batch numbers
  let batch = 0;
  do {
    // console.debug(`getPodcastFeedForBatch(${subscribeUrl}, ${batch})`);
    const { errorMessage, metadata, tags } = await getPodcastFeedForBatch(subscribeUrl, batch);
    // console.debug('errorMessage=', errorMessage);
    // console.debug('metadata=', metadata);
    // console.debug('tags=', tags);
    if (errorMessage) errorMessages.push(errorMessage);

    if (!isEmpty(tags)) {
      if (!hasMetadata(metadata)) {
        // Match found for this batch number, but with invalid/empty metadata
        // TODO: prioritize next trx.id with this batch number;
        //       for now, we continue to attempt the next batch number
      }
      else {
        metadataBatches.push(metadata);
        tagBatches.push(tags);
      }
    }
    else break;

    batch++;
  }
  while (batch < MAX_BATCH_NUMBER);

  const mergedMetadata = { ...mergeBatchMetadata(metadataBatches), ...mergeBatchTags(tagBatches) };
  if (!hasMetadata(mergedMetadata) && errorMessages.length) {
    // Only return an errorMessage if no metadata was found, since GraphQL likely was unreachable.
    return { errorMessage: `Encountered the following errors when fetching ${subscribeUrl} ` +
                           `metadata from Arweave:\n${concatMessages(errorMessages, true)}` };
  }

  return mergedMetadata;
}

async function getPodcastFeedForBatch(subscribeUrl, batch) {
  const gqlQuery = {
    query: `
      query GetPodcast($tags: [TagFilter!]!) {
        transactions(tags: $tags, first: 100, sort: HEIGHT_DESC) {
          edges {
            node {
              id
              tags {
                name
                value
              }
            }
          }
        }
      }
    `,
    variables: {
      tags: [
        {
          name: toTag('subscribeUrl'),
          values: [subscribeUrl],
        },
        {
          name: toTag('metadataBatch'),
          // Here we could get multiple batches at the same time, but fetching one at a time
          // allows us to select the best metadata from many (partial) copies of the same batch,
          // without quickly exceeding the 100 transaction limit of the GraphQL response.
          values: [`${batch}`],
        },
      ],
    },
  };

  let edges;
  let errorMessage;
  try {
    const response = await client.api.post('/graphql', gqlQuery);
    // console.debug('GraphQL response:', response);
    edges = response.data.data.transactions.edges;
  }
  catch (ex) {
    errorMessage = `GraphQL returned an error: ${ex}`;
    console.warn(errorMessage);
    edges = [];
  }
  // console.debug('GraphQL edges:', edges);
  if (errorMessage || !edges.length) return { errorMessage, metadata: {}, tags: {} };

  // TODO: We currently simply grab the newest transaction matching this `batch` nr.
  //       In the future we should fetch multiple transactions referencing the same batch and
  //       merge the result.
  const trx = edges[0].node;
  const tags = (isEmpty(trx.tags) ? {} : trx.tags
    .filter(tag => !['Content-Type', 'Unix-Time', toTag('version')].includes(tag.name))
    .map(tag => ({
      ...tag,
      name: fromTag(tag.name),
      value: ['firstEpisodeDate', 'lastEpisodeDate'].includes(fromTag(tag.name)) ?
        toDate(tag.value) : tag.value,
    }))
    .reduce((acc, tag) => ({
      ...acc,
      [tag.name]: Array.isArray(acc[tag.name]) ? acc[tag.name].concat(tag.value) : tag.value,
    }), {
      categories: [],
      keywords: [],
    })
  );

  let getDataResult;
  try {
    // TODO: T252 Create localStorage cache { trx.id: { podcastMetadata, trx.tags } } for
    //       transactions that are selected for the result of getPodcastFeed(),
    //       so that we may skip this client.transactions.getData() call.
    getDataResult = await client.transactions.getData(trx.id, { decode: true, string: true });
  }
  catch (ex) {
    errorMessage = `Error fetching data for transaction id ${trx.id}: ${ex}`;
    console.warn(errorMessage);
  }
  if (errorMessage) return { errorMessage, metadata: {}, tags };

  let metadata;
  try {
    metadata = JSON.parse(getDataResult);
    metadata = podcastWithDateObjects(metadata, true);
  }
  catch (ex) {
    // TODO: T251 blacklist trx.id
    errorMessage = `Malformed data for transaction id ${trx.id}: ${ex}`;
    console.warn(errorMessage);
  }
  if (errorMessage) return { errorMessage, metadata: {}, tags };

  // TODO: T251 sanity check podcastMetadata => reject episodes where !isValidDate(publishedAt)
  return { metadata, tags };
}
