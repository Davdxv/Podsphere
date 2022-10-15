/* eslint-disable no-await-in-loop */
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  QueryTransactionsArgs as GQLQueryTransactionsArgs,
  TagFilter as GQLTagFilter,
  Transaction as GraphQLTransaction,
  TransactionEdge as GQLTransactionEdge,
} from 'arlocal/bin/graphql/types.d';
import dedent from 'dedent';
// TODO: arbundles is currently unused, but we might need it in the future.
// import { Bundle, DataItem } from 'arbundles';
import {
  ALLOWED_ARWEAVE_TAGS_PLURALIZED,
  AllowedTagsPluralized,
  CachedArTx,
  GraphQLMetadata,
  Podcast,
  PodcastFeedError,
  PodcastTags,
  StringToStringMapping,
  Thread,
  ThreadReply,
} from '../interfaces';
import client from './client';
import { fetchArweaveUrlData } from '../axios';
import {
  concatMessages,
  episodesCount,
  hasMetadata,
  isEmpty,
  isNotEmpty,
  isValidDate,
  isValidString,
  isValidThread,
  isValidUuid,
  podcastFromDTO,
  toDate,
} from '../../utils';
import { toTag, fromTag, decompressMetadata } from './utils';
import { mergeArraysToLowerCase } from '../metadata-filtering/formatting';
import { mergeBatchMetadata, mergeBatchTags } from './sync/diff-merge-logic';
import { getCachedTxForFeed, txCache } from './cache/transactions';

/** Type signature accepted by Arweave API's `/graphql` endpoint */
type GraphQLQuery = {
  query: string,
  variables: GQLQueryTransactionsArgs,
};
type TagsToFilter = {
  [key: string]: string | string[];
};

export type ParsedGqlResult = {
  errorMessage?: string;
  metadata: Podcast | {};
  tags: PodcastTags | {};
  gqlMetadata: GraphQLMetadata | {};
};

const MAX_BATCHES = 100;
const MAX_GRAPHQL_NODES = 100;
const ERRONEOUS_TX_DATA = 'Erroneous data';

/** Helper function mapping each {tag: value, ...} to [{name: tag, values: value}, ...] */
const toGQLTagFilter = (tagsToFilter: TagsToFilter) : GQLTagFilter[] => Object.entries(tagsToFilter)
  .map(([tag, value]) => ({
    name: toTag(tag),
    values: Array.isArray(value) ? value : [value],
  }));

/**
 * @param feedUrl
 * @param feedType
 * @returns The existing uuid of the podcast matching `feedUrl` & `feedType`, if the GQL query
 *   returned `tags` where `tags.id` is a valid uuid. Else returns an empty string.
 */
export async function fetchPodcastId(
  feedUrl: Podcast['feedUrl'],
  feedType: Podcast['feedType'] = 'rss2',
) : Promise<Podcast['id']> {
  // TODO: pull from podcast-id cache & transaction cache first
  let gqlResults : ParsedGqlResult[];

  try {
    const gqlQuery = gqlQueryForTags({ feedUrl, feedType, metadataBatch: '0' }, [QueryField.TAGS]);
    gqlResults = await getGqlQueryResult(gqlQuery, true);
  }
  catch (_ex) {
    return '';
  }
  if (!gqlResults.length) return '';

  const { metadata, tags } = gqlResults[0];

  if (hasMetadata(metadata) && isNotEmpty(tags)) return isValidUuid(tags.id) ? tags.id : '';

  return '';
}

export async function getPodcastRss2Feed(
  feedUrl: Podcast['feedUrl'],
) : Promise<Partial<Podcast> | PodcastFeedError> {
  const errorMessages : string[] = [];
  const metadataBatches : Podcast[] = [];
  const tagBatches : PodcastTags[] = [];

  /**
   * Filter the given `txs` and return valid candidate txs:
   *   1. Gathers errorMessage for each tx and rejects those not matching ERRONEOUS_TX_DATA, so that
   *      these are not blocked and can be retried later.
   *   2. Rejects txs with empty tags or empty gqlMetadata
   *   3. Caches txs and set cachedTx.txBlocked = true if tx has erroneous metadata
   *   4. Reject txs where cachedTx.txBlocked == true
   *   5. Sorts the remaining txs by most episodes
   *
   *   - TODO: Select the best candidateTx of kind='metadataBatch'
   *   - TODO: Merge with candidateTxs of kind='customMetadata'
   */
  const filterCandidateTxs = (txs: ParsedGqlResult[]) : ParsedGqlResult[] => txs
    .filter(({ errorMessage, metadata, tags, gqlMetadata }) => {
      if (errorMessage) {
        errorMessages.push(errorMessage);
        if (!errorMessage.match(ERRONEOUS_TX_DATA)) return false;
      }

      if (isEmpty(tags) || isEmpty(gqlMetadata)) return false;

      const cachedTx : CachedArTx | null = getCachedTxForFeed(
        gqlMetadata as GraphQLMetadata,
        tags as PodcastTags,
        metadata,
      );

      if (cachedTx && !hasMetadata(metadata)) {
        cachedTx.txBlocked = true;
      }
      if (!cachedTx || cachedTx.txBlocked) {
        // tx has invalid/empty gqlMetadata or metadata, or is set as blocked
        return false;
      }
      return true;
    })
    .sort((a, b) => (episodesCount(b.metadata) - episodesCount(a.metadata)));

  // TODO: negative batch numbers
  let batch = 0;
  do {
    const gqlQuery = gqlQueryForTags(
      { feedUrl, feedType: 'rss2', kind: 'metadataBatch', metadataBatch: `${batch}` },
      [QueryField.OWNER_ADDRESS, QueryField.TAGS, QueryField.BUNDLEDIN],
    );
    const parsedTxs = await getGqlQueryResult(gqlQuery, true);
    if (parsedTxs.length) {
      if (parsedTxs.every(tx => isEmpty(tx.tags) || isEmpty(tx.gqlMetadata))) {
        // GraphQL error or batch number not found
        errorMessages.push(...parsedTxs.map(tx => tx.errorMessage).filter(isValidString));
        break;
      }
    }
    else {
      // No valid metadata for this batch number found
      break;
    }

    const filteredCandidateTxs = filterCandidateTxs(parsedTxs);
    console.debug('filteredCandidateTxs', filteredCandidateTxs);
    if (filteredCandidateTxs.length) {
      // Pending the TODOs in filterCandidateTxs(), we select the 1 tx that has the most episodes
      const selectedTx = filteredCandidateTxs[0];
      const { metadata, tags } = selectedTx;
      metadataBatches.push(metadata as Podcast);
      tagBatches.push(tags as PodcastTags);

      // /** Uncomment temporarily to generate batched arlocal seeds */
      // const batchMetadata = { ...(metadata as Podcast), ...(tags as PodcastTags) };
      // let { metadataBatch } = batchMetadata;
      // if (isValidString(metadataBatch)) metadataBatch = parseInt(metadataBatch, 10);
      // console.debug(`PodcastDTO for batch ${batch} of ${batchMetadata.title}:`, {
      //   ...batchMetadata,
      //   metadataBatch,
      // });
    }

    batch++;
  }
  while (batch < MAX_BATCHES);
  console.debug('new txCache after fetching batches', txCache);

  const mergedMetadata : Partial<Podcast> = { ...mergeBatchMetadata(metadataBatches),
    ...mergeBatchTags(tagBatches) };
  if (!hasMetadata(mergedMetadata) && errorMessages.length) {
    // Only return an errorMessage if no metadata was found, since GraphQL likely was unreachable.
    return { errorMessage: `Encountered the following errors when fetching ${feedUrl} `
                           + `metadata from Arweave:\n${concatMessages(errorMessages, true)}` };
  }

  return mergedMetadata;
}

export async function getAllThreads(podcastIds: string[]) : Promise<Thread[]> {
  const gqlResultsToThreads = (results: ParsedGqlResult[]) : Thread[] => results.map(({ tags }) => {
    if (isNotEmpty(tags)) {
      return {
        isDraft: false,
        id: tags.threadId || '',
        podcastId: tags.id,
        episodeId: isValidDate(toDate(tags.episodeId)) ? toDate(tags.episodeId) : null,
        content: tags.content || '',
        type: tags.type || 'public',
        subject: tags.subject || '',
      } as Thread;
    }
    return null;
  }).filter(isValidThread);

  if (isEmpty(podcastIds)) return [];
  const gqlQueries = podcastIds.map(id => gqlQueryForTags(
    { id, kind: 'thread' }, [QueryField.OWNER_ADDRESS, QueryField.TAGS, QueryField.BUNDLEDIN],
  ));
  const results = await Promise.all(gqlQueries.map(gqlQuery => getGqlQueryResult(gqlQuery, false)));
  console.debug('results', results);

  const threads = results.map(gqlResultsToThreads).filter(isNotEmpty).flat();
  console.debug('threads', threads);

  return threads;
}

// TODO: to be used in ArSync v1.6+ when user can specify whitelisted/blacklisted txIds per podcast
export async function getPodcastFeedForTxIds(txIds: string[]) {
  return getGqlQueryResult(gqlQueryForIds(txIds, [QueryField.TAGS]));
}

/** @returns the id's that are unreachable through GraphQL */
export async function pingTxIds(ids: string[]) : Promise<string[]> {
  const { errorMessage, edges } = await getGqlResponse(gqlQueryForIds(ids, [QueryField.BUNDLEDIN]));
  if (errorMessage) return [];

  const candidateIds = ids.slice(0, MAX_GRAPHQL_NODES);
  if (edges.length === candidateIds.length) return [];

  const onlineIds =
    edges.map(edge => (isValidUuid(edge?.node?.id) ? edge.node.id : null)).filter(x => x);
  const downIds = candidateIds.filter(id => !onlineIds.includes(id));
  console.debug(`The following id's are down: ${downIds}\nRefresh subscriptions to update txCache`);
  return downIds;
}

/**
 * Arweave API's `getData()` queries the `/tx` endpoint which (Aug 2022) only supports Layer 1
 * Arweave transactions, not bundled transactions.
 * In order to getData() the data contained within a bundled transaction, we have to first find out
 * the parent id. This functionality is deprecated by fetchArweaveUrlData(). However, we still use
 * this function for adding the bundle id to the transaction history.
 * @param node One of the edges resulting from a GraphQL query, representing a transaction
 * @returns The transaction id to be used with `getData()`, which if it was bundled is the parent
 *   id; otherwise simply the `node.id`.
 */
const getParentTxId = (node: GraphQLTransaction) : string => (
  isBundledTx(node) ? node.bundledIn!.id : node.id);

const isBundledTx = (node: GraphQLTransaction) => isNotEmpty(node.bundledIn) && node.bundledIn.id;

export async function getArBundledParentIds(ids: string[]) : Promise<StringToStringMapping> {
  const result : StringToStringMapping = {};
  const { edges } = await getGqlResponse(gqlQueryForIds(ids, [QueryField.BUNDLEDIN]));

  edges.forEach(edge => {
    const { id } = edge.node;
    const parentId = getParentTxId(edge.node);
    if (id && parentId && id !== parentId) result[id] = parentId;
  });

  return result;
}

async function getGqlResponse(gqlQuery: GraphQLQuery)
  : Promise<{ edges: GQLTransactionEdge[], errorMessage?: string }> {
  let edges = [];
  let errorMessage;

  try {
    const response = await client.api.post('/graphql', gqlQuery);
    // console.debug('GraphQL response:', response);
    edges = response.data.data.transactions.edges;
  }
  catch (ex) {
    errorMessage = `GraphQL returned an error: ${ex}`;
    console.warn(errorMessage);
  }
  return { edges, errorMessage };
}

// function unbundleData(rawBundle: Uint8Array, bundledTxId: string) : Uint8Array {
//   const bundle = new Bundle(Buffer.from(rawBundle));
//   const dataItems : DataItem[] = bundle.items;
//   const dataItem = dataItems.find(item => item.id === bundledTxId);
//   return (dataItem ? dataItem.rawData : []) as Uint8Array;
// }

function parseGqlTags(tx: GraphQLTransaction) : Pick<ParsedGqlResult, 'tags' | 'gqlMetadata'> {
  let tags : Partial<PodcastTags> = {};
  let gqlMetadata : GraphQLMetadata | {} = {};

  if (tx?.id && tx?.owner?.address) {
    gqlMetadata = { txId: tx.id, ownerAddress: tx.owner.address };
  }
  if (isBundledTx(tx)) gqlMetadata = { ...gqlMetadata, txBundledIn: tx.bundledIn!.id };

  if (isNotEmpty(tx.tags)) {
    tags = tx.tags
      .filter(tag => ALLOWED_ARWEAVE_TAGS_PLURALIZED.includes(
        fromTag(tag.name) as AllowedTagsPluralized,
      ))
      .map(tag => ({
        ...tag,
        name: fromTag(tag.name),
        value: (['firstEpisodeDate', 'lastEpisodeDate', 'lastBuildDate'].includes(
          fromTag(tag.name),
        ) ? toDate(tag.value) : tag.value),
      }))
      .reduce((acc, tag) => ({
        ...acc,
        [tag.name]: Array.isArray(acc[tag.name as keyof typeof acc])
          ? mergeArraysToLowerCase(acc[tag.name as keyof typeof acc], [`${tag.value}`])
          : tag.value,
      }), {
        categories: [],
        keywords: [],
        episodesKeywords: [],
      });
  }
  return { tags, gqlMetadata };
}

async function parseGqlPodcastMetadata(tx: GraphQLTransaction)
  : Promise<ParsedGqlResult['metadata']> {
  let metadata : Podcast | {};
  let getDataResult;
  try {
    if (isBundledTx(tx)) {
      getDataResult = await fetchArweaveUrlData(tx.id);
    }
    else {
      getDataResult = await client.transactions.getData(tx.id, { decode: true }) as Uint8Array;
    }
  }
  catch (ex) {
    throw new Error(`Error fetching data for transaction id ${tx.id}: ${ex}`);
  }

  getDataResult ||= new Uint8Array([]);
  if (!getDataResult.length) {
    throw new Error(`${ERRONEOUS_TX_DATA} for transaction id ${tx.id}: data is empty`);
  }

  try {
    const decompressedMetadata = decompressMetadata(getDataResult);
    metadata = podcastFromDTO(decompressedMetadata, true);
  }
  catch (ex) {
    throw new Error(`${ERRONEOUS_TX_DATA} for transaction id ${tx.id}: ${ex}`);
  }
  return metadata;
}

async function parseGqlResult(tx: GraphQLTransaction, getData: boolean) : Promise<ParsedGqlResult> {
  let errorMessage : ParsedGqlResult['errorMessage'];
  let tags : ParsedGqlResult['tags'] = {};
  let gqlMetadata : ParsedGqlResult['gqlMetadata'] = {};
  let metadata : ParsedGqlResult['metadata'] = {};

  try {
    ({ tags, gqlMetadata } = parseGqlTags(tx));
  }
  catch (ex) {
    errorMessage = `Error parsing tags for transaction id ${tx?.id}: ${ex}`;
    console.warn(errorMessage);
  }
  if (errorMessage) return { errorMessage, metadata: {}, tags, gqlMetadata };

  if (getData) {
    // TODO: Perhaps skip fetching data if txId is already in txCache and cachedTx.lastMutatedAt
    //       === subscription.lastMutatedAt
    try {
      metadata = await parseGqlPodcastMetadata(tx);
    }
    catch (ex) {
      errorMessage = (ex as Error).message;
      console.warn(errorMessage);
    }
    if (errorMessage || isEmpty(metadata)) {
      return { errorMessage, metadata: {}, tags, gqlMetadata };
    }
  }

  return { metadata, tags, gqlMetadata };
}

async function getGqlQueryResult(gqlQuery: GraphQLQuery, getData = true)
  : Promise<ParsedGqlResult[]> {
  const { edges, errorMessage } = await getGqlResponse(gqlQuery);
  if (errorMessage || isEmpty(edges)) {
    return [{ errorMessage, metadata: {}, tags: {}, gqlMetadata: {} }];
  }

  const txs : GraphQLTransaction[] = edges.map(edge => edge.node);
  const result : ParsedGqlResult[] = await Promise.all(txs.map(tx => parseGqlResult(tx, getData)));
  return result;
}

enum QueryField {
  TAGS = `
              tags {
                name
                value
              }`,
  BUNDLEDIN = `
              bundledIn {
                id
              }`,
  OWNER_ADDRESS = `
              owner {
                address
              }`,
}

/**
 * @param tagsToFilter
 * @param queryFields The fields of the node structure to query, besides `id`
 * @returns An Object with the query formatted for Arweave's '/graphql' endpoint
 */
function gqlQueryForTags(tagsToFilter: TagsToFilter, queryFields: QueryField[] = [QueryField.TAGS])
  : GraphQLQuery {
  const tags = toGQLTagFilter(tagsToFilter);

  return {
    query: dedent`
      query GetPodcast($tags: [TagFilter!]!) {
        transactions(tags: $tags, first: ${MAX_GRAPHQL_NODES}, sort: HEIGHT_DESC) {
          edges {
            node {
              id${queryFields.join('')}
            }
          }
        }
      }
    `,
    variables: { tags },
  };
}

/**
 * @param ids
 * @param queryFields The fields of the node structure to query, besides `id`
 * @returns An Object with the query formatted for Arweave's '/graphql' endpoint
 */
function gqlQueryForIds(ids: string[], queryFields: QueryField[]) : GraphQLQuery {
  return {
    query: dedent`
      query GetPodcast($ids: [ID!]!) {
        transactions(ids: $ids, first: ${MAX_GRAPHQL_NODES}, sort: HEIGHT_DESC) {
          edges {
            node {
              id${queryFields.join('')}
            }
          }
        }
      }
    `,
    variables: { ids },
  };
}
