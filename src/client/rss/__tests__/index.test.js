import parser from '../parser';
import { getPodcastRss2Feed } from '..';

jest.mock('../parser');

const FEED_URL = 'https://test_url.crypto/rss';

const ep1date = '2021-11-08T04:00:00.000Z';
const ep2date = '2021-11-08T05:00:00.000Z';
const ep3date = '2021-11-09T15:06:18.000Z';
const ep4date = '2021-11-10T15:06:18.000Z';
const podcastDate = '2022-01-01T04:00:00.000Z';

const EPISODE_1_COMPLETE = {
  pubDate: ep1date,
  title: '',
  categories: ['Ep1cat1'],
  keywords: ['Ep1key1'],
  enclosure: {
    length: '12345678',
    type: 'audio/mpeg',
    url: 'https://test_url.crypto/ep1.mp3',
  },
  docs: 'https://test_url.crypto/info',
  image: {
    title: 'My imageTitle',
  },
  'content:encoded': '<b>html</b> Ep1 description',
  itunes: {
    title: 'Ep1',
    subtitle: '<b>Ep1 subtitle</b>',
    summary: 'Ep1 summary',
    guid: 'e6aa1148-e2c6-4fae-969c-0a38a977ce91',
    duration: '01:01',
    image: 'https://test_url.crypto/ep1image.jpeg',
    explicit: 'no',
    categories: ['ep1cat1', 'Ep1cat2'],
    keywords: ['Ep1key2'],
  },
};
const EPISODE_2_COMPLETE_NO_ITUNES = {
  isoDate: ep2date,
  title: 'Ep2',
  categories: ['Ep2cat'],
  keywords: ['Ep2key'],
  length: '12345678',
  enclosure: {
    type: 'audio/mpeg',
    url: 'https://test_url.crypto/ep2.mp3',
  },
  subtitle: '<b>Ep2 subtitle</b>',
  content: '<b>html</b> Ep2 description',
  guid: 'f6aa1148-e2c6-4fae-969c-0a38a977ce92',
  link: 'https://test_url.crypto/info',
  duration: '02:02',
  explicit: 'no',
  contentSnippet: 'Ep2 summary',
  image: {
    url: 'https://test_url.crypto/ep2image.jpeg',
    title: 'Specific imageTitle',
  },
};
const EPISODE_3_MINIMAL = {
  title: 'Ep3',
  isoDate: ep3date,
};
const EPISODE_4_NO_TITLE = {
  title: '',
  isoDate: ep4date,
  keywords: ['skipped episodesKeyword'],
};
const EPISODE_5_NO_DATE = {
  title: 'Ep5',
};
const EPISODE_6_NO_DATE = {
  title: 'Ep6',
};
const EPISODE_0_NO_DATE = {
  title: 'Ep0',
};
const EPISODES = [
  EPISODE_6_NO_DATE,
  EPISODE_5_NO_DATE,
  EPISODE_4_NO_TITLE,
  EPISODE_3_MINIMAL,
  EPISODE_2_COMPLETE_NO_ITUNES,
  EPISODE_1_COMPLETE,
  EPISODE_0_NO_DATE,
];

const COMPLETE_PODCAST = {
  feedUrl: FEED_URL,
  title: 'My podcast',
  categories: ['cat1'],
  keywords: ['key1'],
  docs: 'https://test_url.crypto/info',
  link: '',
  image: {
    title: 'My imageTitle',
  },
  unknownField: 'skipped field',
  lastBuildDate: podcastDate,
  itunes: {
    keywords: ['key2'],
    categories: ['cat2'],
    categoriesWithSubs: [
      {
        name: 'cat1',
        subs: [
          { name: 'subcat1' },
          { name: 'subcat2' },
        ],
      },
      {
        name: 'cat2',
        subs: null,
      },
    ],
    subtitle: '<b>Podcast subtitle</b>',
    description: 'Podcast description',
    summary: 'Podcast summary',
    image: 'https://test_url.crypto/podcast.jpeg',
    language: 'en',
    explicit: 'no',
    author: 'Podcast author',
    owner: {
      email: 'mail@test_url.crypto',
      name: 'Podcast owner',
    },
    copyright: 'Podcast copyright',
    managingEditor: 'Podcast editor',
  },
};
const COMPLETE_PODCAST_NO_ITUNES = {
  itunes: {},
  feedUrl: FEED_URL,
  title: 'My podcast',
  categories: ['cat1', 'cat2'],
  keywords: ['key1', 'key2'],
  docs: '',
  link: 'https://test_url.crypto/info',
  image: {
    title: 'My imageTitle',
    url: 'https://test_url.crypto/podcast.jpeg',
  },
  subtitle: '<b>Podcast subtitle</b>',
  description: 'Podcast description',
  summary: 'Podcast summary',
  language: 'en',
  explicit: 'no',
  author: '',
  creator: 'Podcast author',
  owner: {
    email: 'mail@test_url.crypto',
    name: 'Podcast owner',
  },
  copyright: 'Podcast copyright',
  lastBuildDate: podcastDate,
  managingEditor: 'Podcast editor',
};
const MINIMAL_PODCAST = {
  feedUrl: FEED_URL,
  title: 'My podcast',
};

describe('getPodcastRss2Feed', () => {
  describe('With a complete podcast feed comprising 3 complete eps + 1 ep without title + 3 eps '
    + 'without date', () => {
    const expected = {
      id: global.VALID_TEMP_ID,
      feedType: 'rss2',
      feedUrl: 'https://test_url.crypto/rss',
      title: 'My podcast',
      episodes: [
        {
          title: 'Ep6',
          publishedAt: new Date(new Date(ep3date).getTime() + 2000),
        },
        {
          title: 'Ep5',
          publishedAt: new Date(new Date(ep3date).getTime() + 1000),
        },
        // Ep4 is skipped due to missing title
        {
          title: 'Ep3',
          publishedAt: new Date(ep3date),
        },
        {
          title: 'Ep2',
          publishedAt: new Date(ep2date),
          subtitle: 'Ep2 subtitle',
          contentHtml: '<b>html</b> Ep2 description',
          summary: 'Ep2 summary',
          guid: 'f6aa1148-e2c6-4fae-969c-0a38a977ce92',
          mediaUrl: 'https://test_url.crypto/ep2.mp3',
          mediaType: 'audio/mpeg',
          mediaLength: '12345678',
          duration: '02:02',
          imageUrl: 'https://test_url.crypto/ep2image.jpeg',
          imageTitle: 'Specific imageTitle',
          categories: ['ep2cat'],
          keywords: ['ep2key'],
        },
        {
          title: 'Ep1',
          publishedAt: new Date(ep1date),
          subtitle: 'Ep1 subtitle',
          contentHtml: '<b>html</b> Ep1 description',
          summary: 'Ep1 summary',
          guid: 'e6aa1148-e2c6-4fae-969c-0a38a977ce91',
          mediaUrl: 'https://test_url.crypto/ep1.mp3',
          mediaType: 'audio/mpeg',
          mediaLength: '12345678',
          duration: '01:01',
          imageUrl: 'https://test_url.crypto/ep1image.jpeg',
          categories: ['ep1cat1', 'ep1cat2'],
          keywords: ['ep1key1', 'ep1key2'],
        },
        {
          title: 'Ep0',
          publishedAt: new Date(1000),
        },
      ],
      keywords: ['podcast author', 'key1', 'key2'],
      categories: ['cat1', 'cat2', 'subcat1', 'subcat2'],
      subtitle: 'Podcast subtitle',
      description: 'Podcast description',
      summary: 'Podcast summary',
      infoUrl: 'https://test_url.crypto/info',
      imageUrl: 'https://test_url.crypto/podcast.jpeg',
      imageTitle: 'My imageTitle',
      language: 'en',
      explicit: 'no',
      author: 'Podcast author',
      ownerName: 'Podcast owner',
      ownerEmail: 'mail@test_url.crypto',
      copyright: 'Podcast copyright',
      managingEditor: 'Podcast editor',
      lastBuildDate: new Date(podcastDate),
      episodesKeywords: ['ep2key', 'ep1key1', 'ep1key2'],
    };

    it('returns a formatted Podcast object with 6 episodes including 3 fake dates', async () => {
      const mockFeed = { ...COMPLETE_PODCAST, items: EPISODES };
      parser.parseURL.mockResolvedValue(mockFeed);

      const result = await getPodcastRss2Feed(FEED_URL);
      expect(result).toEqual(expected);
    });

    describe('When using alternate fields and feed.itunes is empty', () => {
      it('returns the same formatted Podcast object except for itunes subcategories', async () => {
        const mockFeed = { ...COMPLETE_PODCAST_NO_ITUNES, items: EPISODES };
        parser.parseURL.mockResolvedValue(mockFeed);

        const result = await getPodcastRss2Feed(FEED_URL);
        expect(result).toEqual({ ...expected, categories: ['cat1', 'cat2'] });
      });
    });
  });

  describe('With a minimal podcast feed with 1 minimal episode', () => {
    it('returns a formatted Podcast object', async () => {
      const mockFeed = { ...MINIMAL_PODCAST, items: [EPISODE_3_MINIMAL] };
      parser.parseURL.mockResolvedValue(mockFeed);

      const result = await getPodcastRss2Feed(FEED_URL);
      expect(result).toEqual({
        id: global.VALID_TEMP_ID,
        feedType: 'rss2',
        feedUrl: 'https://test_url.crypto/rss',
        title: 'My podcast',
        episodes: [
          {
            title: 'Ep3',
            publishedAt: new Date(ep3date),
          },
        ],
        keywords: ['my podcast'],
      });
    });
  });

  describe('Error handling', () => {
    describe('With a podcast feed without title', () => {
      it('returns an error message object', async () => {
        const mockFeed = { title: '', items: EPISODES };
        parser.parseURL.mockResolvedValue(mockFeed);

        await expect(getPodcastRss2Feed(FEED_URL)).resolves
          .toMatchObject({ errorMessage: expect.stringMatching(/'title' is empty/) });
      });
    });

    describe('With a podcast feed without valid episodes', () => {
      it('returns an error message object (no episodes)', async () => {
        const mockFeed = { title: 'Title' };
        parser.parseURL.mockResolvedValue(mockFeed);

        await expect(getPodcastRss2Feed(FEED_URL)).resolves
          .toMatchObject({ errorMessage: expect.stringMatching(/'episodes' is empty/) });
      });

      it('returns an error message object (invalid episodes)', async () => {
        const mockFeed = { title: 'Title', items: [EPISODE_4_NO_TITLE] };
        parser.parseURL.mockResolvedValue(mockFeed);

        await expect(getPodcastRss2Feed(FEED_URL)).resolves
          .toMatchObject({ errorMessage: expect.stringMatching(/'episodes' is empty/) });
      });
    });

    describe('When the RSS Parser throws an error', () => {
      it('returns an error message object', async () => {
        const mockError = new Error('Parser Error');
        parser.parseURL.mockRejectedValue(mockError);

        await expect(getPodcastRss2Feed(FEED_URL)).resolves
          .toMatchObject({ errorMessage: expect.stringMatching(/Parser Error/) });
      });
    });
  });
});
