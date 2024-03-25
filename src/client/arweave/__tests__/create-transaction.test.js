import { v4 as uuid } from 'uuid';
import { strToU8, compressSync } from 'fflate';
import * as TxCache from '../cache/transactions';
import {
  formatMetadataTxTags,
  newThreadTransaction,
  newTransactionFromMetadata,
} from '../create-transaction';
import { toTag } from '../utils';
// eslint-disable-next-line import/named
import { addTag, createTransaction } from '../client';
import { newCandidatePodcastId, removePrefixFromPodcastId } from '../../../podcast-id';

const MOCK_TIMESTAMP = 1234001234;
const MOCK_U8_METADATA = new Uint8Array([2, 3]);

jest.mock('fflate', () => ({
  strToU8: jest.fn(),
  compressSync: jest.fn().mockImplementation(() => MOCK_U8_METADATA),
}));
jest.mock('../../../utils', () => ({
  ...jest.requireActual('../../../utils'),
  unixTimestamp: jest.fn().mockImplementation(() => MOCK_TIMESTAMP),
}));
jest.mock('../client');

const mockResult = { addTag };
const ep4date = '2021-11-10T15:06:18.000Z';
const ep3date = '2021-11-09T15:06:18.000Z';
const ep2date = '2021-11-08T05:00:00.000Z';
const ep1date = '2021-11-08T04:00:00.000Z';
const allEpisodes = [
  {
    title: 'Ep4',
    url: 'https://server.dummy/ep4',
    publishedAt: new Date(ep4date),
    categories: ['cat4'],
    keywords: [],
  },
  {
    title: 'Ep3',
    url: 'https://server.dummy/ep3',
    publishedAt: new Date(ep3date),
    categories: [],
    keywords: ['key3'],
  },
  {
    title: 'Ep2',
    url: 'https://server.dummy/ep2',
    publishedAt: new Date(ep2date),
    categories: [],
    keywords: ['key2'],
  },
  {
    title: 'Ep1',
    url: 'https://server.dummy/ep1',
    publishedAt: new Date(ep1date),
    categories: ['cat1'],
    keywords: [],
  },
];

const PODCAST_ID = newCandidatePodcastId();
const BASE_CACHED_METADATA = {
  id: PODCAST_ID,
  feedType: 'rss2',
  feedUrl: 'https://server.dummy/foo',
  title: 'cachedTitle',
  description: 'cachedDescription',
  imageUrl: 'https://cached.imgurl/img.png?ver=0',
  imageTitle: 'cachedImageTitle',
  unknownField: 'cachedUnknownField',
  categories: ['cached cat'], // ignored by newTransactionFromMetadata
  keywords: ['cached key'], // ignored by newTransactionFromMetadata
  episodes: [], // ignored by newTransactionFromMetadata
};
const BASE_NEW_METADATA = {
  id: removePrefixFromPodcastId(PODCAST_ID),
  feedType: 'rss2',
  feedUrl: 'https://server.dummy/foo',
  title: 'newTitle',
  description: 'newDescription',
  language: 'en-us',
  categories: ['podcat1', 'podcat2'],
  keywords: ['podkey1', 'podkey2'],
  episodes: allEpisodes,
};

function cachedMetadata(additionalFields = {}) {
  return { ...BASE_CACHED_METADATA, ...additionalFields };
}

function newMetadata(additionalFields = {}) {
  return { ...BASE_NEW_METADATA, ...additionalFields };
}

let countCachedArTxs = 0;

function newCachedArTx(tags = null, additionalFields = {}) {
  const defaultTags = {
    firstEpisodeDate: new Date(ep1date),
    lastEpisodeDate: new Date(ep2date),
    metadataBatch: 0,
  };
  const defaultFields = {
    podcastId: removePrefixFromPodcastId(PODCAST_ID),
    txId: `txId${countCachedArTxs}`,
    kind: 'metadataBatch',
    txBlocked: false,
    tags: {
      ...(tags || defaultTags),
    },
    ownerAddress: 'ownerAddress',
    numEpisodes: 0,
  };
  countCachedArTxs++;

  return { ...defaultFields, ...additionalFields };
}

const stubbedWallet = {};

const originalVersion = process.env.REACT_APP_VERSION;
const originalTagPrefix = process.env.REACT_APP_TAG_PREFIX;
beforeAll(() => {
  Object.assign(process.env, {
    REACT_APP_VERSION: 'testVersion',
    REACT_APP_TAG_PREFIX: 'testPodsphere',
  });
  jest.useFakeTimers().setSystemTime(new Date('2019-11-05'));
});

afterAll(() => {
  process.env.REACT_APP_VERSION = originalVersion;
  process.env.REACT_APP_TAG_PREFIX = originalTagPrefix;
  jest.useRealTimers();
});

beforeEach(() => {
  countCachedArTxs = 0;
});

afterEach(() => {
  TxCache.initializeTxCache();
});

function assertAddTagCalls(expectedTags) {
  const formattedExpectedTags = [
    ['App-Name', 'testPodsphere'],
    ['App-Version', 'testVersion'],
    ['Content-Type', 'application/gzip'],
    ['Unix-Time', `${MOCK_TIMESTAMP}`],
  ].concat(expectedTags.map(([k, v]) => [toTag(k), v]));

  expect(addTag.mock.calls).toEqual(formattedExpectedTags);
}

const withAndWithoutArConnect = assertTest => {
  describe('With ArConnect disabled', () => {
    assertTest();
  });

  describe('With ArConnect enabled', () => {
    beforeAll(() => { global.enableArConnect(); });

    afterAll(() => { global.disableArConnect(); });

    assertTest({ useArConnect: true });
  });
};

/**
 * newTransactionFromCompressedMetadata() is implicitly tested through newTransactionFromMetadata()
 */
describe('newTransactionFromMetadata, newTransactionFromCompressedMetadata', () => {
  describe('When there is no cached metadata yet for the podcast to be posted to Arweave', () => {
    const assertTest = (modifiers = { useArConnect: false }) => {
      it('creates a transaction with the expected metadata and tags', async () => {
        const expectedMetadata = newMetadata();
        const expectedTags = [
          ['id', removePrefixFromPodcastId(PODCAST_ID)],
          ['kind', 'metadataBatch'],
          ['feedType', 'rss2'],
          ['feedUrl', 'https://server.dummy/foo'],
          ['title', 'newTitle'],
          ['description', 'newDescription'],
          ['language', 'en-us'],
          ['firstEpisodeDate', ep1date],
          ['lastEpisodeDate', ep4date],
          ['metadataBatch', '0'],
          ['category', 'podcat1'],
          ['category', 'podcat2'],
          ['keyword', 'podkey1'],
          ['keyword', 'podkey2'],
        ];

        const result = await newTransactionFromMetadata(stubbedWallet, expectedMetadata, {});
        expect(result).toEqual(mockResult);

        expect(strToU8).toHaveBeenCalledWith(JSON.stringify(expectedMetadata));
        expect(compressSync).toHaveBeenCalled();

        const params = modifiers.useArConnect
          ? [{ data: MOCK_U8_METADATA }]
          : [{ data: MOCK_U8_METADATA }, stubbedWallet];
        expect(createTransaction).toHaveBeenCalledWith(...params);

        assertAddTagCalls(expectedTags);
      });
    };

    withAndWithoutArConnect(assertTest);
  });

  describe('When 1 cached batch of older metadata exists', () => {
    const assertTest = (modifiers = { useArConnect: false }) => {
      it('creates a transaction with the expected metadata and tags', async () => {
        const currentBatchFields = {
          firstEpisodeDate: new Date(ep1date),
          lastEpisodeDate: new Date(ep2date),
          metadataBatch: 0,
        };
        const expectedMetadata = newMetadata({ episodes: allEpisodes.slice(0, 2) });
        const expectedTags = [
          ['id', removePrefixFromPodcastId(PODCAST_ID)],
          ['kind', 'metadataBatch'],
          ['feedType', 'rss2'],
          ['feedUrl', 'https://server.dummy/foo'],
          ['title', 'newTitle'],
          ['description', 'newDescription'],
          ['language', 'en-us'],
          ['firstEpisodeDate', ep3date],
          ['lastEpisodeDate', ep4date],
          ['metadataBatch', '1'],
          ['category', 'podcat1'],
          ['category', 'podcat2'],
          ['keyword', 'podkey1'],
          ['keyword', 'podkey2'],
        ];
        const result = await newTransactionFromMetadata(
          stubbedWallet,
          expectedMetadata,
          cachedMetadata(currentBatchFields),
        );
        expect(result).toEqual(mockResult);

        expect(strToU8).toHaveBeenCalledWith(JSON.stringify(expectedMetadata));
        expect(compressSync).toHaveBeenCalled();

        const params = modifiers.useArConnect
          ? [{ data: MOCK_U8_METADATA }]
          : [{ data: MOCK_U8_METADATA }, stubbedWallet];
        expect(createTransaction).toHaveBeenCalledWith(...params);

        assertAddTagCalls(expectedTags);
      });
    };

    withAndWithoutArConnect(assertTest);
  });

  describe('When 1 cached batch of newer metadata exists', () => {
    const assertTest = (modifiers = { useArConnect: false }) => {
      it('looks up the best batch number from the Transaction Cache '
         + 'and creates a transaction with the expected metadata and tags', async () => {
        const currentBatchFields = {
          firstEpisodeDate: new Date(ep1date),
          lastEpisodeDate: new Date(ep4date),
          metadataBatch: 1,
        };
        const expectedMetadata = newMetadata({ episodes: allEpisodes.slice(2, 4) });
        const expectedTags = [
          ['id', removePrefixFromPodcastId(PODCAST_ID)],
          ['kind', 'metadataBatch'],
          ['feedType', 'rss2'],
          ['feedUrl', 'https://server.dummy/foo'],
          ['title', 'newTitle'],
          ['description', 'newDescription'],
          ['language', 'en-us'],
          ['firstEpisodeDate', ep1date],
          ['lastEpisodeDate', ep2date],
          ['metadataBatch', '0'],
          ['category', 'podcat1'],
          ['category', 'podcat2'],
          ['keyword', 'podkey1'],
          ['keyword', 'podkey2'],
        ];

        TxCache.initializeTxCache([
          newCachedArTx({
            firstEpisodeDate: new Date(ep3date),
            lastEpisodeDate: new Date(ep4date),
            metadataBatch: 1,
          }),
          newCachedArTx({
            firstEpisodeDate: new Date(ep1date),
            lastEpisodeDate: new Date(ep1date),
            metadataBatch: 0,
          }),
        ]);

        const result = await newTransactionFromMetadata(
          stubbedWallet,
          expectedMetadata,
          cachedMetadata(currentBatchFields),
        );
        expect(result).toEqual(mockResult);

        expect(strToU8).toHaveBeenCalledWith(JSON.stringify(expectedMetadata));
        expect(compressSync).toHaveBeenCalled();

        const params = modifiers.useArConnect
          ? [{ data: MOCK_U8_METADATA }]
          : [{ data: MOCK_U8_METADATA }, stubbedWallet];
        expect(createTransaction).toHaveBeenCalledWith(...params);

        assertAddTagCalls(expectedTags);
      });
    };

    withAndWithoutArConnect(assertTest);
  });

  describe('When 2 aggregated cached batches of older metadata exist', () => {
    const assertTest = (modifiers = { useArConnect: false }) => {
      it('creates a transaction with the expected metadata and tags', async () => {
        const currentBatchFields = {
          firstEpisodeDate: new Date(ep1date),
          lastEpisodeDate: new Date(ep3date),
          metadataBatch: 1,
        };
        const expectedMetadata = newMetadata({ episodes: allEpisodes.slice(0, 1) });
        const expectedTags = [
          ['id', removePrefixFromPodcastId(PODCAST_ID)],
          ['kind', 'metadataBatch'],
          ['feedType', 'rss2'],
          ['feedUrl', 'https://server.dummy/foo'],
          ['title', 'newTitle'],
          ['description', 'newDescription'],
          ['language', 'en-us'],
          ['firstEpisodeDate', ep4date],
          ['lastEpisodeDate', ep4date],
          ['metadataBatch', '2'],
          ['category', 'podcat1'],
          ['category', 'podcat2'],
          ['keyword', 'podkey1'],
          ['keyword', 'podkey2'],
        ];
        const result = await newTransactionFromMetadata(
          stubbedWallet,
          expectedMetadata,
          cachedMetadata(currentBatchFields),
        );
        expect(result).toEqual(mockResult);

        expect(strToU8).toHaveBeenCalledWith(JSON.stringify(expectedMetadata));
        expect(compressSync).toHaveBeenCalled();

        const params = modifiers.useArConnect
          ? [{ data: MOCK_U8_METADATA }]
          : [{ data: MOCK_U8_METADATA }, stubbedWallet];
        expect(createTransaction).toHaveBeenCalledWith(...params);

        assertAddTagCalls(expectedTags);
      });
    };

    withAndWithoutArConnect(assertTest);
  });

  describe('Error handling', () => {
    /** NOTE: test `return assertThrow()` to get a proper stack trace if test fails */
    const assertThrow = async (erroneousMetadata, errorRegex) => {
      await expect(newTransactionFromMetadata(stubbedWallet, erroneousMetadata, {}))
        .rejects.toThrow(errorRegex);

      expect(createTransaction).not.toHaveBeenCalled();
      expect(addTag).not.toHaveBeenCalled();
    };

    it('throws an Error if the newest episode has a null date', async () => {
      const erroneousMetadata = newMetadata({
        episodes: [
          { ...allEpisodes[0], publishedAt: null },
          allEpisodes[1],
        ],
      });
      return assertThrow(erroneousMetadata, /invalid date/);
    });

    it('throws an Error if the oldest episode has an invalid date', async () => {
      const erroneousMetadata = newMetadata({
        episodes: [
          allEpisodes[0],
          { ...allEpisodes[1], publishedAt: new Date(undefined) },
        ],
      });
      return assertThrow(erroneousMetadata, /invalid date/);
    });

    it('throws an Error if the oldest episode has a zero date', async () => {
      const erroneousMetadata = newMetadata({
        episodes: [
          allEpisodes[0],
          { ...allEpisodes[1], publishedAt: new Date(0) },
        ],
      });
      return assertThrow(erroneousMetadata, /invalid date/);
    });

    describe('Mandatory tags', () => {
      const mandatoryMetadata = {
        id: newCandidatePodcastId(),
        feedType: 'rss2',
        feedUrl: 'https://server.dummy/foo',
        title: 'myTitle',
      };

      it('does not throw an Error if exclusively mandatory podcast tags are given', async () => {
        await expect(newTransactionFromMetadata(stubbedWallet, mandatoryMetadata, {}))
          .resolves.not.toThrow();
      });

      it('throws an Error if the id is invalid', async () => {
        const insufficientMetadata = { ...mandatoryMetadata, id: 'x' };
        return assertThrow(insufficientMetadata, /id is missing/);
      });

      it('throws an Error if the id is missing', async () => {
        const { id, ...insufficientMetadata } = mandatoryMetadata;
        return assertThrow(insufficientMetadata, /id is missing/);
      });

      it('throws an Error if the feedType is missing', async () => {
        const { feedType, ...insufficientMetadata } = mandatoryMetadata;
        return assertThrow(insufficientMetadata, /feedType is missing/);
      });

      it('throws an Error if the feedUrl is missing', async () => {
        const { feedUrl, ...insufficientMetadata } = mandatoryMetadata;
        return assertThrow(insufficientMetadata, /feedUrl is missing/);
      });

      it('throws an Error if the kind is missing or invalid', () => {
        expect(() => formatMetadataTxTags(mandatoryMetadata, {}, 'ABC')).toThrow(/kind is missing/);
        expect(() => formatMetadataTxTags(mandatoryMetadata, {}, 1)).toThrow(/kind is missing/);
      });

      it('throws an Error if the title is missing', async () => {
        const { title, ...insufficientMetadata } = mandatoryMetadata;
        return assertThrow(insufficientMetadata, /title is missing/);
      });
    });
  });
});

describe('newThreadTransaction', () => {
  describe('New Thread', () => {
    const THREAD = {
      isDraft: false,
      id: uuid(),
      podcastId: uuid(),
      episodeId: new Date(ep1date),
      type: 'public',
      content: '0123456789'.repeat(500),
      subject: 'My Subject',
      timestamp: MOCK_TIMESTAMP,
    };

    const assertTest = (modifiers = { useArConnect: false }) => {
      it('creates a transaction with the expected thread and tags', async () => {
        const expectedTags = [
          ['id', THREAD.podcastId],
          ['kind', 'thread'],
          ['threadId', THREAD.id],
          ['type', THREAD.type],
          ['content', expect.stringContaining(THREAD.content.substring(0, 2048))],
          ['subject', THREAD.subject],
          ['episodeId', ep1date],
        ];

        const result = await newThreadTransaction(stubbedWallet, THREAD, {});
        expect(result).toEqual(mockResult);

        expect(strToU8).toHaveBeenCalledWith(JSON.stringify(THREAD));
        expect(compressSync).toHaveBeenCalled();

        const params = modifiers.useArConnect
          ? [{ data: MOCK_U8_METADATA }]
          : [{ data: MOCK_U8_METADATA }, stubbedWallet];
        expect(createTransaction).toHaveBeenCalledWith(...params);

        assertAddTagCalls(expectedTags);
      });
    };

    withAndWithoutArConnect(assertTest);

    describe('Error handling', () => {
      /** NOTE: test `return assertThrow()` to get a proper stack trace if test fails */
      const assertThrow = async (erroneousThread, errorRegex) => {
        await expect(newThreadTransaction(stubbedWallet, erroneousThread, {}))
          .rejects.toThrow(errorRegex);

        expect(createTransaction).not.toHaveBeenCalled();
        expect(addTag).not.toHaveBeenCalled();
      };

      it('throws an Error if the thread id is invalid', async () => {
        const insufficientMetadata = { ...THREAD, id: 'x' };
        return assertThrow(insufficientMetadata, /threadId is missing/);
      });

      it('throws an Error if the podcast id is invalid', async () => {
        const insufficientMetadata = { ...THREAD, podcastId: 'x' };
        return assertThrow(insufficientMetadata, /id is missing/);
      });

      it('throws an Error if the thread type is invalid', async () => {
        const insufficientMetadata = { ...THREAD, type: 'x' };
        return assertThrow(insufficientMetadata, /type is missing/);
      });

      it('throws an Error if the subject is missing', async () => {
        const { subject, ...insufficientMetadata } = THREAD;
        return assertThrow(insufficientMetadata, /subject is missing/);
      });

      it('throws an Error if the content is missing', async () => {
        const { content, ...insufficientMetadata } = THREAD;
        return assertThrow(insufficientMetadata, /content is missing/);
      });
    });
  });

  describe('New Reply', () => {
    const REPLY = {
      isDraft: false,
      id: uuid(),
      podcastId: uuid(),
      episodeId: null,
      type: 'public',
      content: 'My Reply',
      parentThreadId: uuid(),
      parentPostId: uuid(),
      timestamp: MOCK_TIMESTAMP,
    };

    const assertTest = (modifiers = { useArConnect: false }) => {
      it('creates a transaction with the expected reply and tags', async () => {
        const expectedTags = [
          ['id', REPLY.podcastId],
          ['kind', 'threadReply'],
          ['threadId', REPLY.id],
          ['type', REPLY.type],
          ['content', REPLY.content],
          ['parentThreadId', REPLY.parentThreadId],
          ['parentPostId', REPLY.parentPostId],
        ];

        const result = await newThreadTransaction(stubbedWallet, REPLY, {});
        expect(result).toEqual(mockResult);

        expect(strToU8).toHaveBeenCalledWith(JSON.stringify(REPLY));
        expect(compressSync).toHaveBeenCalled();

        const params = modifiers.useArConnect
          ? [{ data: MOCK_U8_METADATA }]
          : [{ data: MOCK_U8_METADATA }, stubbedWallet];
        expect(createTransaction).toHaveBeenCalledWith(...params);

        assertAddTagCalls(expectedTags);
      });
    };

    withAndWithoutArConnect(assertTest);

    describe('Error handling', () => {
      /** NOTE: test `return assertThrow()` to get a proper stack trace if test fails */
      const assertThrow = async (erroneousThread, errorRegex) => {
        await expect(newThreadTransaction(stubbedWallet, erroneousThread, {}))
          .rejects.toThrow(errorRegex);

        expect(createTransaction).not.toHaveBeenCalled();
        expect(addTag).not.toHaveBeenCalled();
      };

      it('throws an Error if the thread id is invalid', async () => {
        const insufficientMetadata = { ...REPLY, id: 'x' };
        return assertThrow(insufficientMetadata, /threadId is missing/);
      });

      it('throws an Error if the podcast id is invalid', async () => {
        const insufficientMetadata = { ...REPLY, podcastId: 'x' };
        return assertThrow(insufficientMetadata, /id is missing/);
      });

      it('throws an Error if the thread type is invalid', async () => {
        const insufficientMetadata = { ...REPLY, type: 'x' };
        return assertThrow(insufficientMetadata, /type is missing/);
      });

      it('throws an Error if the parent id is invalid', async () => {
        const insufficientMetadata = { ...REPLY, parentThreadId: 'x' };
        return assertThrow(insufficientMetadata, /parentThreadId is missing/);
      });

      it('throws an Error if the content is empty', async () => {
        const insufficientMetadata = { ...REPLY, content: '' };
        return assertThrow(insufficientMetadata, /content is missing/);
      });
    });
  });
});
