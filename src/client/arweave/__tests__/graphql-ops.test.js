import dedent from 'dedent';
import { strToU8, compressSync } from 'fflate';
import { fetchArweaveUrlData } from '../../axios';
import * as TxCache from '../cache/transactions';
import { getPodcastRss2Feed } from '../graphql-ops';
// eslint-disable-next-line import/named
import { transactions, api } from '../client';
import { toTag } from '../utils';

jest.mock('../client');
jest.mock('../../axios');

const getCachedTxForFeedSpy = jest.spyOn(TxCache, 'getCachedTxForFeed');

const FEED_URL = 'https://server.dummy/rss';
const TIMESTAMP = 1620172800;

function baseGqlResponse(edges = []) {
  return {
    data: {
      data: {
        transactions: {
          edges,
        },
      },
    },
  };
}

function emptyGqlResponse() {
  return baseGqlResponse([]);
}

/**
 * @param {{string: string}[]} specifiedFieldsPerNode
 */
function gqlResponse(specifiedFieldsPerNode = [{}]) {
  const nodes = specifiedFieldsPerNode.map(specifiedFields => {
    /* eslint-disable prefer-const */
    let { metadataBatch, id, txId, kind, ownerAddress, firstEpisodeDate, lastEpisodeDate,
      bundledInId } = (specifiedFields || {});
    metadataBatch = metadataBatch ? `${metadataBatch}` : '0';
    id ||= global.podcastId(1);
    txId ||= `txId${metadataBatch}`;
    kind ||= 'metadataBatch';
    ownerAddress ||= 'ownerAddress';
    return {
      node: {
        id: txId,
        owner: {
          address: ownerAddress,
          key: 'ownerKey',
        },
        tags: [
          { name: 'App-Name', value: 'Podsphere' },
          { name: 'App-Version', value: 'bestVersion' },
          { name: 'Content-Type', value: 'application/gzip' },
          { name: 'Unix-Time', value: `${TIMESTAMP}` },
          { name: 'id', value: id },
          { name: 'feedType', value: 'rss2' },
          { name: 'feedUrl', value: FEED_URL },
          { name: 'kind', value: kind },
          { name: 'title', value: 'That Podcast' },
          { name: 'description', value: 'The best of That Podcast' },
          { name: 'keyword', value: 'comedY' },
          { name: 'keyword', value: 'Comedy' },
          { name: 'category', value: 'PoLitics' },
          { name: 'category', value: 'CaTs' },
          { name: 'metadataBatch', value: `${metadataBatch}` },
          { name: 'firstEpisodeDate', value: firstEpisodeDate },
          { name: 'lastEpisodeDate', value: lastEpisodeDate },
        ].map(tag => ({ ...tag, name: toTag(tag.name) })),
        bundledIn: {
          id: bundledInId,
        },
      },
    };
  });

  return baseGqlResponse(nodes);
}

const ep4date = '2021-11-10T15:06:18.000Z';
const ep3date = '2021-11-09T15:06:18.000Z';
const ep2date = '2021-11-08T05:00:00.000Z';
const ep1date = '2021-11-08T04:00:00.000Z';

const episodes = [
  {
    title: 'Ep4',
    url: 'https://server.dummy/ep4',
    publishedAt: ep4date,
  },
  {
    title: 'Ep3',
    url: 'https://server.dummy/ep3',
    publishedAt: ep3date,
  },
  {
    title: 'Ep2',
    url: 'https://server.dummy/ep2',
    publishedAt: ep2date,
  },
  {
    title: 'Ep1',
    url: 'https://server.dummy/ep1',
    publishedAt: ep1date,
  },
];
const episodesWithDateObjs = episodes.map(ep => ({ ...ep, publishedAt: new Date(ep.publishedAt) }));

function mergedBatchesResult(metadataBatch, firstEpisodeDate, lastEpisodeDate, numEpisodes = 4) {
  return {
    id: global.podcastId(1),
    feedType: 'rss2',
    feedUrl: FEED_URL,
    kind: 'metadataBatch',
    title: 'That Podcast',
    description: 'The best of That Podcast',
    categories: ['politics', 'cats'],
    keywords: ['comedy'],
    episodes: episodesWithDateObjs.slice(-numEpisodes),
    metadataBatch,
    firstEpisodeDate: new Date(firstEpisodeDate),
    lastEpisodeDate: new Date(lastEpisodeDate),
  };
}

function getDataResult(firstEpisodeDate, numEpisodes) {
  const firstEpisodeIndex = episodes.findIndex(ep => ep.publishedAt === firstEpisodeDate);
  if (firstEpisodeIndex < 0) throw new Error(`Invalid firstEpisodeDate: ${firstEpisodeDate}`);

  const metadataJson = JSON.stringify({
    // Episodes are ordered from newest to oldest
    episodes: episodes.slice(firstEpisodeIndex - numEpisodes + 1, firstEpisodeIndex + 1),
  });
  const metadataGzip = compressSync(strToU8(metadataJson, { level: 6, mem: 4 }));
  return metadataGzip;
}

const originalTagPrefix = process.env.REACT_APP_TAG_PREFIX;
beforeAll(() => {
  process.env.REACT_APP_TAG_PREFIX = 'testPodsphere';
});

afterAll(() => {
  process.env.REACT_APP_TAG_PREFIX = originalTagPrefix;
});

describe('getPodcastRss2Feed', () => {
  afterEach(() => {
    // Empty transaction cache
    TxCache.initializeTxCache();
  });

  describe('With 1 metadata batch, 1 tx', () => {
    beforeEach(() => {
      api.post.mockResolvedValueOnce(gqlResponse([{
        metadataBatch: '0',
        firstEpisodeDate: ep1date,
        lastEpisodeDate: ep4date,
      }]));
      api.post.mockResolvedValueOnce(emptyGqlResponse());
      transactions.getData.mockResolvedValueOnce(getDataResult(ep1date, 4));
      expect(transactions.getData).not.toHaveBeenCalled();
    });

    it('returns the expected merged metadata', async () => {
      await expect(getPodcastRss2Feed(FEED_URL)).resolves
        .toEqual(mergedBatchesResult(0, ep1date, ep4date));

      expect(api.post).toHaveBeenCalledTimes(2);
      expect(transactions.getData).toHaveBeenCalledTimes(1);
      expect(transactions.getData).toHaveBeenCalledWith('txId0', { decode: true });
    });

    it('posts the expected GraphQL queries', async () => {
      const expectedGqlQuery = metadataBatch => ({
        query: dedent`
          query GetPodcast($tags: [TagFilter!]!) {
            transactions(tags: $tags, first: 100, sort: HEIGHT_DESC) {
              edges {
                node {
                  id
                  owner {
                    address
                  }
                  tags {
                    name
                    value
                  }
                  bundledIn {
                    id
                  }
                }
              }
            }
          }
        `,
        variables: {
          tags: [
            {
              name: 'testPodsphere-feedUrl',
              values: ['https://server.dummy/rss'],
            },
            {
              name: 'testPodsphere-feedType',
              values: ['rss2'],
            },
            {
              name: 'testPodsphere-kind',
              values: ['metadataBatch'],
            },
            {
              name: 'testPodsphere-metadataBatch',
              values: [metadataBatch],
            },
          ],
        },
      });

      await getPodcastRss2Feed(FEED_URL);

      expect(api.post.mock.calls).toEqual([
        ['/graphql', expectedGqlQuery('0')],
        ['/graphql', expectedGqlQuery('1')],
      ]);
    });

    describe('getPodcastFeedsForGqlQuery, Transaction Cache interaction', () => {
      const expectedGqlMetadata = {
        timestamp: TIMESTAMP,
        txId: 'txId0',
        ownerAddress: 'ownerAddress',
      };
      const expectedTags = {
        categories: ['politics', 'cats'],
        keywords: ['comedy'],
        episodesKeywords: [],
        id: global.podcastId(1),
        feedType: 'rss2',
        feedUrl: 'https://server.dummy/rss',
        kind: 'metadataBatch',
        title: 'That Podcast',
        description: 'The best of That Podcast',
        metadataBatch: '0',
        firstEpisodeDate: new Date(ep1date),
        lastEpisodeDate: new Date(ep4date),
      };
      const expectedMetadata = expect.objectContaining({ episodes: episodesWithDateObjs });

      it('getPodcastFeedsForGqlQuery returns the expected gqlMetadata, tags, metadata, for which '
          + 'a CachedArTx object is created/fetched', async () => {
        await getPodcastRss2Feed(FEED_URL);

        expect(getCachedTxForFeedSpy).toHaveBeenCalledWith(
          expectedGqlMetadata,
          expectedTags,
          expectedMetadata,
        );

        // Query 2: with added gqlMetadata.txBundledIn
        fetchArweaveUrlData.mockResolvedValueOnce(getDataResult(ep1date, 4));
        api.post.mockResolvedValueOnce(gqlResponse([{
          metadataBatch: '0',
          firstEpisodeDate: ep1date,
          lastEpisodeDate: ep4date,
          bundledInId: 'bundledTxId',
        }]));
        await getPodcastRss2Feed(FEED_URL);

        expect(getCachedTxForFeedSpy.mock.calls.at(-1)).toEqual([
          { ...expectedGqlMetadata, txBundledIn: 'bundledTxId' },
          expectedTags,
          expectedMetadata,
        ]);
      });

      it('if a CachedArTx object could not be created due to improper params the transaction is '
          + 'skipped', async () => {
        getCachedTxForFeedSpy.mockReturnValueOnce(null);
        await expect(getPodcastRss2Feed(FEED_URL)).resolves
          .toEqual({});
      });
    });
  });

  describe('With 2 metadata batches, 2 txs', () => {
    it('returns the expected merged metadata and tags', async () => {
      api.post.mockResolvedValueOnce(gqlResponse([{
        metadataBatch: '0',
        firstEpisodeDate: ep1date,
        lastEpisodeDate: ep2date,
      }]));
      transactions.getData.mockResolvedValueOnce(getDataResult(ep1date, 2));

      api.post.mockResolvedValueOnce(gqlResponse([{
        metadataBatch: '1',
        firstEpisodeDate: ep3date,
        lastEpisodeDate: ep4date,
      }]));
      transactions.getData.mockResolvedValueOnce(getDataResult(ep3date, 2));

      api.post.mockResolvedValueOnce(emptyGqlResponse());

      await expect(getPodcastRss2Feed(FEED_URL)).resolves
        .toEqual(mergedBatchesResult(1, ep1date, ep4date));

      expect(api.post).toHaveBeenCalledTimes(3);
      expect(transactions.getData.mock.calls).toEqual([
        ['txId0', { decode: true }],
        ['txId1', { decode: true }],
      ]);
    });

    describe('When the 2nd batch encounters a getData error', () => {
      it('returns the merged metadata and tags of the first batch '
         + 'and does not block either tx', async () => {
        const mockError = new Error('getData Error');

        api.post.mockResolvedValueOnce(gqlResponse([{
          metadataBatch: '0',
          firstEpisodeDate: ep1date,
          lastEpisodeDate: ep2date,
        }]));
        transactions.getData.mockResolvedValueOnce(getDataResult(ep1date, 2));

        api.post.mockResolvedValueOnce(gqlResponse([{
          metadataBatch: '1',
          firstEpisodeDate: ep3date,
          lastEpisodeDate: ep4date,
        }]));
        transactions.getData.mockRejectedValueOnce(mockError);

        api.post.mockResolvedValueOnce(emptyGqlResponse());

        await expect(getPodcastRss2Feed(FEED_URL)).resolves
          .toEqual(mergedBatchesResult(0, ep1date, ep2date, 2));

        expect(api.post).toHaveBeenCalledTimes(3);
        expect(transactions.getData.mock.calls).toEqual([
          ['txId0', { decode: true }],
          ['txId1', { decode: true }],
        ]);

        expect(TxCache.findCachedTx('txId0')).toMatchObject({ txBlocked: false });
        expect(TxCache.findCachedTx('txId1')).toBeNull();
      });
    });

    describe('When the 2nd batch encounters erroneous metadata', () => {
      it('returns the merged metadata and tags of the first batch '
         + 'and blocks the 2nd tx', async () => {
        api.post.mockResolvedValueOnce(gqlResponse([{
          metadataBatch: '0',
          firstEpisodeDate: ep1date,
          lastEpisodeDate: ep2date,
        }]));
        transactions.getData.mockResolvedValueOnce(getDataResult(ep1date, 2));

        api.post.mockResolvedValueOnce(gqlResponse([{
          metadataBatch: '1',
          firstEpisodeDate: ep3date,
          lastEpisodeDate: ep4date,
        }]));
        transactions.getData.mockResolvedValueOnce({ badData: 1 });

        api.post.mockResolvedValueOnce(emptyGqlResponse());

        await expect(getPodcastRss2Feed(FEED_URL)).resolves
          .toEqual(mergedBatchesResult(0, ep1date, ep2date, 2));

        expect(api.post).toHaveBeenCalledTimes(3);
        expect(transactions.getData.mock.calls).toEqual([
          ['txId0', { decode: true }],
          ['txId1', { decode: true }],
        ]);

        expect(TxCache.findCachedTx('txId0')).toMatchObject({ txBlocked: false });
        expect(TxCache.findCachedTx('txId1')).toMatchObject({ txBlocked: true });
      });
    });
  });

  describe('With 3 metadata batches, 3 txs', () => {
    it('returns the expected merged metadata and tags', async () => {
      // oldest episode
      api.post.mockResolvedValueOnce(gqlResponse([{
        metadataBatch: '0',
        firstEpisodeDate: ep1date,
        lastEpisodeDate: ep1date,
      }]));
      transactions.getData.mockResolvedValueOnce(getDataResult(ep1date, 1));

      // oldest 2 episodes (including 1 duplicate)
      api.post.mockResolvedValueOnce(gqlResponse([{
        metadataBatch: '1',
        firstEpisodeDate: ep1date,
        lastEpisodeDate: ep2date,
      }]));
      transactions.getData.mockResolvedValueOnce(getDataResult(ep1date, 2));

      // newest 2 episodes
      api.post.mockResolvedValueOnce(gqlResponse([{
        metadataBatch: '2',
        firstEpisodeDate: ep3date,
        lastEpisodeDate: ep4date,
      }]));
      transactions.getData.mockResolvedValueOnce(getDataResult(ep3date, 2));

      api.post.mockResolvedValueOnce(emptyGqlResponse());

      await expect(getPodcastRss2Feed(FEED_URL)).resolves
        .toEqual(mergedBatchesResult(2, ep1date, ep4date));

      expect(api.post).toHaveBeenCalledTimes(4);
      expect(transactions.getData.mock.calls).toEqual([
        ['txId0', { decode: true }],
        ['txId1', { decode: true }],
        ['txId2', { decode: true }],
      ]);
    });

    describe('When the middle batch returns empty metadata', () => {
      beforeEach(() => {
        api.post.mockResolvedValueOnce(gqlResponse([{
          metadataBatch: '0',
          firstEpisodeDate: ep1date,
          lastEpisodeDate: ep2date,
        }]));
        transactions.getData.mockResolvedValueOnce(getDataResult(ep1date, 2));

        api.post.mockResolvedValueOnce(gqlResponse([{
          metadataBatch: '1',
          firstEpisodeDate: ep1date,
          lastEpisodeDate: ep2date,
        }]));
        transactions.getData.mockResolvedValueOnce(null);

        api.post.mockResolvedValueOnce(gqlResponse([{
          metadataBatch: '2',
          firstEpisodeDate: ep2date,
          lastEpisodeDate: ep3date,
        }]));
        transactions.getData.mockResolvedValueOnce(getDataResult(ep2date, 2));

        api.post.mockResolvedValueOnce(emptyGqlResponse());
      });

      it('returns the merged metadata and tags of the first and last batch', async () => {
        await expect(getPodcastRss2Feed(FEED_URL)).resolves
          .toEqual(mergedBatchesResult(2, ep1date, ep3date, 3));

        expect(api.post).toHaveBeenCalledTimes(4);
        expect(transactions.getData.mock.calls).toEqual([
          ['txId0', { decode: true }],
          ['txId1', { decode: true }],
          ['txId2', { decode: true }],
        ]);
      });

      it('blocks the middle tx', async () => {
        await getPodcastRss2Feed(FEED_URL);

        expect(TxCache.findCachedTx('txId0')).toMatchObject({ txBlocked: false });
        expect(TxCache.findCachedTx('txId1')).toMatchObject({ txBlocked: true });
        expect(TxCache.findCachedTx('txId2')).toMatchObject({ txBlocked: false });
      });
    });
  });

  describe('With 3 metadata batches, 5 txs', () => {
    beforeEach(() => {
      api.post.mockResolvedValueOnce(gqlResponse([
        {
          metadataBatch: '0',
          firstEpisodeDate: ep2date,
          lastEpisodeDate: ep2date,
          txId: 'txId0',
        },
        {
          metadataBatch: '0',
          firstEpisodeDate: ep1date,
          lastEpisodeDate: ep2date,
          txId: 'txId1',
        },
      ]));
      transactions.getData.mockResolvedValueOnce(getDataResult(ep2date, 1));
      transactions.getData.mockResolvedValueOnce(getDataResult(ep1date, 2));

      api.post.mockResolvedValueOnce(gqlResponse([{
        metadataBatch: '1',
        firstEpisodeDate: ep2date,
        lastEpisodeDate: ep2date,
        txId: 'txId2',
      }]));
      transactions.getData.mockResolvedValueOnce(getDataResult(ep2date, 1));

      api.post.mockResolvedValueOnce(gqlResponse([
        {
          metadataBatch: '2',
          firstEpisodeDate: ep3date,
          lastEpisodeDate: ep4date,
          txId: 'txId3',
        },
        {
          metadataBatch: '2',
          firstEpisodeDate: ep3date,
          lastEpisodeDate: ep3date,
          txId: 'txId4',
        },
      ]));
      transactions.getData.mockResolvedValueOnce(getDataResult(ep3date, 2));
      transactions.getData.mockResolvedValueOnce(getDataResult(ep3date, 1));

      api.post.mockResolvedValueOnce(emptyGqlResponse());
    });

    it('returns the expected merged metadata and tags, preferring larger batches', async () => {
      await expect(getPodcastRss2Feed(FEED_URL)).resolves
        .toEqual(mergedBatchesResult(2, ep1date, ep4date));

      expect(api.post).toHaveBeenCalledTimes(4);
      expect(transactions.getData).toHaveBeenCalledTimes(5);
    });

    it('caches all 5 txs and does not block any', async () => {
      await getPodcastRss2Feed(FEED_URL);

      expect(TxCache.findCachedTx('txId0')).toMatchObject({ txBlocked: false });
      expect(TxCache.findCachedTx('txId1')).toMatchObject({ txBlocked: false });
      expect(TxCache.findCachedTx('txId2')).toMatchObject({ txBlocked: false });
      expect(TxCache.findCachedTx('txId3')).toMatchObject({ txBlocked: false });
      expect(TxCache.findCachedTx('txId4')).toMatchObject({ txBlocked: false });
    });
  });

  describe('When GraphQL throws an error', () => {
    it('catches the GraphQL request error and returns an errorMessage object', async () => {
      const mockError = new Error('GraphQL Error');

      api.post.mockRejectedValueOnce(mockError);
      transactions.getData.mockResolvedValueOnce(getDataResult(ep1date, 4));

      await expect(getPodcastRss2Feed(FEED_URL)).resolves
        .toMatchObject({ errorMessage: expect.stringMatching(/GraphQL/) });

      expect(api.post).toHaveBeenCalledTimes(1);
      expect(transactions.getData).not.toHaveBeenCalled();
    });
  });
});
