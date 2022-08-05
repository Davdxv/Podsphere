import { randomBytes } from 'crypto';
import { initArSyncTxs, startSync } from '..';
import { newCandidatePodcastId, podcastFromDTO } from '../../../../utils';
import { ArSyncTxStatus } from '../../../interfaces';
// eslint-disable-next-line import/named
import { addTag } from '../../client';
import {
  dispatchTransaction,
  newTransactionFromCompressedMetadata,
  signAndPostTransaction,
} from '../../create-transaction';
import { decompressMetadata } from '../../utils';
import { mergeBatchMetadata } from '../diff-merge-logic';

jest.mock('../../create-transaction', () => ({
  ...jest.requireActual('../../create-transaction'),
  dispatchTransaction: jest.fn(),
  newTransactionFromCompressedMetadata: jest.fn(),
  signAndPostTransaction: jest.fn(),
}));
jest.mock('../../client');

const integerArray = n => [...Array(n).keys()];

const decrementHours = (date, h) => new Date(date.setHours(date.getHours() - h));

const randomByteString = b => (b && b > 0 ? randomBytes(Math.floor(b / 2)).toString('hex') : '');

const generateEps = (numEps, randomBytesPerEp = 0) => [...new Array(numEps)]
  .map((_elem, index) => ({
    title: `${randomByteString(randomBytesPerEp)} ${numEps - index}`,
    url: `https://server.dummy/ep${numEps - index}`,
    publishedAt: decrementHours(new Date('2021-11-09T15:06:18.000Z'), index),
  }));

const wallet = {};
const mockTransaction = { addTag };
const mockTransaction2 = { addTag, id: 'transaction 2' };
const mockTransaction3 = { addTag, id: 'transaction 3' };
const mockDispatchResult = { id: 'dispatch_trx_id', type: 'BUNDLED' };
const mockError = new Error('mock error');
const mockError2 = new Error('mock error 2');

const ANYTHING = expect.anything();
const ANY_NUMBER = expect.any(Number);

const podcast1 = {
  id: newCandidatePodcastId(),
  feedType: 'rss2',
  feedUrl: 'https://example.com/podcast1',
  title: 'cachedTitle',
  description: 'cachedDescription',
  imageUrl: 'https://cached.imgurl/img.png?ver=0',
  imageTitle: 'cachedImageTitle',
  unknownField: 'cachedUnknownField',
  categories: ['cached cat'],
  keywords: ['cached key'],
  episodes: generateEps(2),
};
const podcast2episodes = generateEps(3);
const podcast2 = {
  id: newCandidatePodcastId(),
  feedType: 'rss2',
  feedUrl: 'https://example.com/podcast2',
  title: 'podcast2 cachedTitle',
  description: 'podcast2 cachedDescription',
  episodes: podcast2episodes,
};

/**
 * NOTE:
 *   - newTransactionFromCompressedMetadata() is mocked here, as it's already tested in
 *     create-transaction.test.js.
 *   - The tester relies on many external/helper functions, also used by the tested module (ArSync).
 *     Most of these are not mocked here, since ArSync represents an integrational module.
 *     Also, this ensures that tests remain valid upon most refactorings.
 */
describe('initArSyncTxs', () => {
  const subscriptions = [podcast1, podcast2];

  describe('When metadataToSync is empty', () => {
    const metadataToSync = [];

    it('returns 0 txs', async () => {
      const result = await initArSyncTxs(subscriptions, metadataToSync, wallet, null);
      expect(result).toStrictEqual([]);
    });
  });

  describe('When metadataToSync is effectively empty', () => {
    const metadataToSync = [{
      id: podcast2.id,
      episodes: [],
    }];

    it('returns 0 txs', async () => {
      const result = await initArSyncTxs(subscriptions, metadataToSync, wallet, null);
      expect(result).toStrictEqual([]);
    });
  });

  describe('When there is metadataToSync', () => {
    describe('When metadataToSync specifies 1 unsubscribed and 1 subscribed podcast', () => {
      const metadataToSync = [
        {
          id: newCandidatePodcastId(),
          title: 'unknown podcast newTitle',
        },
        {
          id: podcast2.id,
          title: 'podcast2 newTitle',
          episodes: podcast2episodes,
        },
      ];

      it('returns 1 initialized tx', async () => {
        newTransactionFromCompressedMetadata.mockResolvedValueOnce(mockTransaction);
        const result = await initArSyncTxs(subscriptions, metadataToSync, wallet, null);
        expect(result).toStrictEqual([
          {
            id: global.VALID_ID,
            podcastId: podcast2.id,
            title: 'podcast2 newTitle',
            resultObj: mockTransaction,
            metadata: {
              ...metadataToSync[1],
              firstEpisodeDate: podcast2episodes[2].publishedAt,
              lastEpisodeDate: podcast2episodes[0].publishedAt,
              metadataBatch: 0,
            },
            numEpisodes: 3,
            status: ArSyncTxStatus.INITIALIZED,
            timestamp: ANY_NUMBER,
          },
        ]);
      });
    });

    describe('When metadataToSync specifies 2 subscribed podcasts', () => {
      const metadataToSync = [
        {
          id: podcast1.id,
          title: 'newTitle',
          description: 'newDescription',
        },
        {
          id: podcast2.id,
          title: 'podcast2 newTitle',
          episodes: podcast2episodes,
        },
      ];

      describe('When both podcasts to sync return a Transaction', () => {
        it('returns 2 initialized txs', async () => {
          newTransactionFromCompressedMetadata.mockResolvedValueOnce(mockTransaction);
          newTransactionFromCompressedMetadata.mockResolvedValueOnce(mockTransaction2);
          const result = await initArSyncTxs(subscriptions, metadataToSync, wallet, null);
          expect(result).toStrictEqual([
            {
              id: global.VALID_ID,
              podcastId: podcast1.id,
              title: 'newTitle',
              resultObj: mockTransaction,
              metadata: metadataToSync[0],
              numEpisodes: 0,
              status: ArSyncTxStatus.INITIALIZED,
              timestamp: ANY_NUMBER,
            },
            {
              id: global.VALID_ID,
              podcastId: podcast2.id,
              title: 'podcast2 newTitle',
              resultObj: mockTransaction2,
              metadata: {
                ...metadataToSync[1],
                firstEpisodeDate: podcast2episodes[2].publishedAt,
                lastEpisodeDate: podcast2episodes[0].publishedAt,
                metadataBatch: 0,
              },
              numEpisodes: 3,
              status: ArSyncTxStatus.INITIALIZED,
              timestamp: ANY_NUMBER,
            },
          ]);
        });
      });

      describe('When 1 podcast to sync throws an error', () => {
        it('returns 1 initialized tx and 1 errored tx', async () => {
          newTransactionFromCompressedMetadata.mockRejectedValueOnce(mockError);
          newTransactionFromCompressedMetadata.mockResolvedValueOnce(mockTransaction);
          const result = await initArSyncTxs(subscriptions, metadataToSync, wallet, null);
          expect(result).toStrictEqual([
            {
              id: global.VALID_ID,
              podcastId: podcast1.id,
              title: 'newTitle',
              resultObj: mockError,
              metadata: metadataToSync[0],
              numEpisodes: 0,
              status: ArSyncTxStatus.ERRORED,
              timestamp: ANY_NUMBER,
            },
            {
              id: global.VALID_ID,
              podcastId: podcast2.id,
              title: 'podcast2 newTitle',
              resultObj: mockTransaction,
              metadata: {
                ...metadataToSync[1],
                firstEpisodeDate: podcast2episodes[2].publishedAt,
                lastEpisodeDate: podcast2episodes[0].publishedAt,
                metadataBatch: 0,
              },
              numEpisodes: 3,
              status: ArSyncTxStatus.INITIALIZED,
              timestamp: ANY_NUMBER,
            },
          ]);
        });
      });

      describe('When both podcasts to sync throw an error', () => {
        it('returns 2 errored txs', async () => {
          newTransactionFromCompressedMetadata.mockRejectedValueOnce(mockError);
          newTransactionFromCompressedMetadata.mockRejectedValueOnce(mockError2);
          const result = await initArSyncTxs(subscriptions, metadataToSync, wallet, null);
          expect(result).toStrictEqual([
            {
              id: global.VALID_ID,
              podcastId: podcast1.id,
              title: 'newTitle',
              resultObj: mockError,
              metadata: metadataToSync[0],
              numEpisodes: 0,
              status: ArSyncTxStatus.ERRORED,
              timestamp: ANY_NUMBER,
            },
            {
              id: global.VALID_ID,
              podcastId: podcast2.id,
              title: 'podcast2 newTitle',
              resultObj: mockError2,
              metadata: {
                ...metadataToSync[1],
                firstEpisodeDate: podcast2episodes[2].publishedAt,
                lastEpisodeDate: podcast2episodes[0].publishedAt,
                metadataBatch: 0,
              },
              numEpisodes: 3,
              status: ArSyncTxStatus.ERRORED,
              timestamp: ANY_NUMBER,
            },
          ]);
        });
      });
    });

    describe('When metadataToSync specifies 2 podcasts, 1 large enough to be partitioned', () => {
      const assertPartitionedResult = (asyncResultFn, metadataToSync, expectedNumTxsRange) => {
        let result = null;
        let newTxMockCalls = null;
        const [pod1, pod2] = metadataToSync;
        const [expectedTxsMin, expectedTxsMax] = expectedNumTxsRange;

        beforeAll(async () => {
          jest.resetModules();
          result = await asyncResultFn();
          newTxMockCalls = newTransactionFromCompressedMetadata.mock.calls;
        });

        it(`returns between ${expectedTxsMin} and ${expectedTxsMax} initialized txs`, () => {
          expect(result.length).toBeGreaterThanOrEqual(expectedTxsMin);
          expect(result.length).toBeLessThanOrEqual(expectedTxsMax);
          expect(result.every(tx => tx.status === ArSyncTxStatus.INITIALIZED)).toBe(true);
        });

        it('correctly partitions podcast 1 metadata (no episodes)', () => {
          const result1 = result[0];
          expect(result1).toStrictEqual({
            id: global.VALID_ID,
            podcastId: pod1.id,
            title: 'newTitle',
            resultObj: mockTransaction,
            metadata: pod1,
            numEpisodes: 0,
            status: ArSyncTxStatus.INITIALIZED,
            timestamp: ANY_NUMBER,
          });
        });

        it('correctly partitions podcast 2 metadata into a complete subset of batches', () => {
          const result2 = result.slice(1);
          expect(result2.every(tx => tx.numEpisodes === tx.metadata.episodes.length)).toBe(true);
          expect(result2.every(tx => tx.podcastId === pod2.id)).toBe(true);
          expect(result2.every(tx => tx.title === pod2.title)).toBe(true);

          const result2NumBatches = result2.length;
          const result2Metadata = result2.map(tx => tx.metadata);
          const result2MetadataBatchNumbers = result2Metadata.map(txMeta => txMeta.metadataBatch);
          expect(result2MetadataBatchNumbers).toStrictEqual(integerArray(result2NumBatches));

          const result2MergedMetadata = {
            ...mergeBatchMetadata(result2Metadata, true),
            keywords: ANYTHING,
          };
          const expected2MergedMetadata = {
            ...pod2,
            keywords: ANYTHING,
            firstEpisodeDate: pod2.episodes[pod2.episodes.length - 1].publishedAt,
            lastEpisodeDate: pod2.episodes[0].publishedAt,
            metadataBatch: result2NumBatches - 1,
          };
          expect(result2MergedMetadata).toEqual(expected2MergedMetadata);
        });

        it('creates a new Transaction per batch, with expected compressedMetadata and tags', () => {
          const result2 = result.slice(1);
          const result2NumBatches = result2.length;
          const expected2MergedMetadata = {
            ...pod2,
            keywords: ANYTHING,
            firstEpisodeDate: pod2.episodes[pod2.episodes.length - 1].publishedAt,
            lastEpisodeDate: pod2.episodes[0].publishedAt,
            metadataBatch: result2NumBatches - 1,
          };

          // Assert that the compressedMetadata comprise a complete subset of pod2
          const result2DecompressedMetadata = newTxMockCalls.slice(1)
            .map(params => podcastFromDTO(decompressMetadata(params[1])));
          const result2MergedDecompressedMetadata = {
            ...mergeBatchMetadata(result2DecompressedMetadata, true),
            keywords: ANYTHING,
          };
          expect(result2MergedDecompressedMetadata).toEqual(expected2MergedMetadata);

          // Assert that the tags per batch are correct by checking each batch's metadataBatch tag.
          // (Assertion of all tags is done in the relevant test module.)
          const result2Tags = newTxMockCalls.slice(1).map(params => params[2]);
          const result2BatchTagNumbers = result2Tags.map(tags => tags
            .find(tag => tag[0] === 'metadataBatch')[1])
            .map(metadataBatchValue => parseInt(metadataBatchValue, 10));
          // Spread to circumvent Jest's JSON String serialization hindrances
          expect([...result2BatchTagNumbers]).toStrictEqual(integerArray(result2NumBatches));
        });
      };

      const pod1 = {
        id: podcast1.id,
        feedType: podcast1.feedType,
        feedUrl: 'https://example.com/podcast1',
        title: 'newTitle',
        description: 'newDescription',
      };
      const pod2 = {
        id: podcast2.id,
        feedType: podcast2.feedType,
        feedUrl: 'https://example.com/podcast2',
        title: 'podcast2 newTitle',
      };

      describe('With a max batch size of 10 KB and 50 episodes x 1 entropic KB', () => {
        const metadataToSync = [pod1, { ...pod2, episodes: generateEps(50, 1024) }];

        const asyncResultFn = async () => {
          newTransactionFromCompressedMetadata.mockResolvedValueOnce(mockTransaction);
          newTransactionFromCompressedMetadata.mockResolvedValue(mockTransaction2);
          return initArSyncTxs(subscriptions, metadataToSync, wallet, 10 * 1024);
        };

        const expectedNumTxsRange = [3, 5];
        assertPartitionedResult(asyncResultFn, metadataToSync, expectedNumTxsRange);
      });

      describe('With a max batch size of 100 KB and 500 episodes x 1 entropic KB', () => {
        const metadataToSync = [pod1, { ...pod2, episodes: generateEps(500, 1024) }];

        const asyncResultFn = async () => {
          newTransactionFromCompressedMetadata.mockResolvedValueOnce(mockTransaction);
          newTransactionFromCompressedMetadata.mockResolvedValue(mockTransaction2);
          return initArSyncTxs(subscriptions, metadataToSync, wallet, 100 * 1024);
        };

        const expectedNumTxsRange = [3, 5];
        assertPartitionedResult(asyncResultFn, metadataToSync, expectedNumTxsRange);
      });

      describe('With a max batch size of 100 KB and 500 episodes x 2 entropic KB', () => {
        const metadataToSync = [pod1, { ...pod2, episodes: generateEps(500, 2048) }];

        const asyncResultFn = async () => {
          newTransactionFromCompressedMetadata.mockResolvedValueOnce(mockTransaction);
          newTransactionFromCompressedMetadata.mockResolvedValue(mockTransaction2);
          return initArSyncTxs(subscriptions, metadataToSync, wallet, 100 * 1024);
        };

        const expectedNumTxsRange = [5, 11]; // ~= previous test x 2
        assertPartitionedResult(asyncResultFn, metadataToSync, expectedNumTxsRange);
      });
    });
  });
});

describe('startSync', () => {
  const mockMetadata1 = { feedUrl: 'https://example.com/podcast1' };
  const mockMetadata2 = { feedUrl: 'https://example.com/podcast2' };
  const mockMetadata3 = { feedUrl: 'https://example.com/podcast3' };

  describe('When pendingTxs is empty', () => {
    const pendingTxs = [];

    it('returns 0 txs and 0 failedTxs', async () => {
      const result = await startSync(pendingTxs, wallet);
      expect(result).toStrictEqual([]);
    });
  });

  describe('When there are 2 initialized txs and 1 fails to post', () => {
    const arSyncTxs = [
      {
        id: '1',
        feedUrl: 'https://example.com/podcast1',
        title: 'cachedTitle',
        resultObj: mockTransaction,
        metadata: mockMetadata1,
        numEpisodes: 0,
        status: ArSyncTxStatus.INITIALIZED,
      },
      {
        id: '2',
        feedUrl: 'https://example.com/podcast2',
        title: 'podcast2 cachedTitle',
        resultObj: mockTransaction,
        metadata: mockMetadata2,
        numEpisodes: 0,
        status: ArSyncTxStatus.INITIALIZED,
      },
    ];
    const expected = (modifiers = { useArConnect: false }) => [
      {
        dispatchResult: undefined,
        id: '1',
        feedUrl: 'https://example.com/podcast1',
        title: 'cachedTitle',
        resultObj: mockError,
        metadata: mockMetadata1,
        numEpisodes: 0,
        status: ArSyncTxStatus.ERRORED,
      },
      {
        dispatchResult: modifiers.useArConnect ? mockDispatchResult : undefined,
        id: '2',
        feedUrl: 'https://example.com/podcast2',
        title: 'podcast2 cachedTitle',
        resultObj: mockTransaction,
        metadata: mockMetadata2,
        numEpisodes: 0,
        status: ArSyncTxStatus.POSTED,
      },
    ];

    describe('With ArConnect disabled', () => {
      it('returns 1 posted tx and 1 errored tx', async () => {
        signAndPostTransaction.mockRejectedValueOnce(mockError);
        signAndPostTransaction.mockResolvedValueOnce(mockTransaction);

        const result = await startSync(arSyncTxs, wallet);
        expect(result).toStrictEqual(expected());

        expect(dispatchTransaction).not.toHaveBeenCalled();
        expect(signAndPostTransaction).toHaveBeenCalled();
      });
    });

    describe('With ArConnect enabled', () => {
      beforeAll(() => { global.enableArConnect(); });

      afterAll(() => { global.disableArConnect(); });

      it('returns the same result as when ArConnect is disabled, but populates the '
         + 'ArSyncTx.dispatchResult prop for the successful tx', async () => {
        dispatchTransaction.mockRejectedValueOnce(mockError);
        dispatchTransaction.mockResolvedValueOnce(mockDispatchResult);

        const result = await startSync(arSyncTxs, wallet);
        expect(result).toStrictEqual(expected({ useArConnect: true }));

        expect(signAndPostTransaction).not.toHaveBeenCalled();
        expect(dispatchTransaction).toHaveBeenCalled();
      });
    });
  });

  describe('When there are 1 initialized tx and 2 other txs', () => {
    const arSyncTxs = [
      {
        id: '1',
        feedUrl: 'https://example.com/podcast1',
        title: 'cachedTitle',
        resultObj: mockTransaction,
        metadata: mockMetadata1,
        numEpisodes: 0,
        status: ArSyncTxStatus.ERRORED,
      },
      {
        id: '2',
        feedUrl: 'https://example.com/podcast2',
        title: 'podcast2 cachedTitle',
        resultObj: mockTransaction2,
        metadata: mockMetadata2,
        numEpisodes: 0,
        status: ArSyncTxStatus.INITIALIZED,
      },
      {
        id: '3',
        feedUrl: 'https://example.com/podcast3',
        title: 'podcast3 cachedTitle',
        resultObj: mockTransaction3,
        metadata: mockMetadata3,
        numEpisodes: 0,
        status: ArSyncTxStatus.CONFIRMED,
      },
    ];

    it('returns 1 posted tx along with the 2 other txs', async () => {
      signAndPostTransaction.mockResolvedValueOnce(mockTransaction2);
      const result = await startSync(arSyncTxs, wallet);
      expect(result).toEqual([
        {
          id: '1',
          feedUrl: 'https://example.com/podcast1',
          title: 'cachedTitle',
          resultObj: mockTransaction,
          metadata: mockMetadata1,
          numEpisodes: 0,
          status: ArSyncTxStatus.ERRORED,
        },
        {
          id: '2',
          feedUrl: 'https://example.com/podcast2',
          title: 'podcast2 cachedTitle',
          resultObj: mockTransaction2,
          metadata: mockMetadata2,
          numEpisodes: 0,
          status: ArSyncTxStatus.POSTED,
        },
        {
          id: '3',
          feedUrl: 'https://example.com/podcast3',
          title: 'podcast3 cachedTitle',
          resultObj: mockTransaction3,
          metadata: mockMetadata3,
          numEpisodes: 0,
          status: ArSyncTxStatus.CONFIRMED,
        },
      ]);
    });
  });
});
