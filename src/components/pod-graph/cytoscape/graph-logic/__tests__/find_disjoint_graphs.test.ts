import sample from 'lodash.samplesize';
import { v4 as uuid } from 'uuid';
import {
  computeEdgeWeight, DisjointGraph, findAllDisjointGraphs,
  generateEdges, groupSubscriptionsBySharedKeywords,
} from '../computation';

const getIdsFromGraphs = (graph: DisjointGraph) => graph.nodes.map(item => item.id).sort();

const fakeCategories = ['comedy', 'drama', 'humor', 'history', 'news', 'sports', 'fashion',
  'music', 'cooking', 'media', 'programming', 'design', 'engineering', 'business', 'art'];

const createFakePodcast = (id = '1') => {
  const numberOfCategories = Math.floor(Math.random() * 5);

  return ({
    id,
    feedUrl: 'https://server.dummy/rss',
    feedType: 'rss2',
    title: `Some Podcast ${uuid()}`,
    description: 'The best of That Podcast',
    categories: sample(fakeCategories, numberOfCategories),
    keywords: sample(fakeCategories, numberOfCategories),
    episodes: [],
    metadataBatch: 1,
    firstEpisodeDate: new Date(),
    lastEpisodeDate: new Date(),
  });
};

describe('findAllDisjointGraphs works correctly for', () => {
  test('connected graphs', () => {
    const nodes = [{ id: '1', keywordsAndCategories: ['a'], visited: false },
      { id: '2', keywordsAndCategories: ['b', 'c'], visited: false },
      { id: '3', keywordsAndCategories: ['a', 'b'], visited: false }];

    const disjointGraphs = findAllDisjointGraphs(nodes);
    const ids = disjointGraphs.map(graph => getIdsFromGraphs(graph));
    const keywords = disjointGraphs.map(graph => graph.sharedKeywordsAndCategories);

    const expectedIds = [['1', '2', '3']];
    const expectedKeywords = [[{ name: 'a', count: 2 },
      { name: 'b', count: 2 }, { name: 'c', count: 1 }]];

    expect(keywords).toEqual(expectedKeywords);
    expect(ids).toEqual(expectedIds);
  });

  test('disconnected graphs', () => {
    const nodes = [{ id: '1', keywordsAndCategories: ['a'], visited: false },
      { id: '2', keywordsAndCategories: ['c'], visited: false },
      { id: '3', keywordsAndCategories: ['b'], visited: false }];

    const disjointGraphs = findAllDisjointGraphs(nodes);
    const ids = disjointGraphs.map(graph => getIdsFromGraphs(graph));
    const keywords = disjointGraphs.map(graph => graph.sharedKeywordsAndCategories);

    const expectedIds = [['1'], ['2'], ['3']];
    const expectedKeywords = [[{ name: 'a', count: 1 }],
      [{ name: 'c', count: 1 }], [{ name: 'b', count: 1 }]];

    expect(keywords).toEqual(expectedKeywords);
    expect(ids).toEqual(expectedIds);
  });

  test('two disjoint graphs', () => {
    const nodes = [{ id: '1', keywordsAndCategories: ['a'], visited: false },
      { id: '2', keywordsAndCategories: ['b', 'a'], visited: false },
      { id: '3', keywordsAndCategories: ['f'], visited: false }];

    const disjointGraphs = findAllDisjointGraphs(nodes);
    const ids = disjointGraphs.map(graph => getIdsFromGraphs(graph));
    const keywords = disjointGraphs.map(graph => graph.sharedKeywordsAndCategories);

    const expectedIds = [['1', '2'], ['3']];
    const expectedKeywords = [[{ name: 'a', count: 2 },
      { name: 'b', count: 1 }], [{ name: 'f', count: 1 }]];

    expect(keywords).toEqual(expectedKeywords);
    expect(ids).toEqual(expectedIds);
  });

  test('two disjoint graphs each containing multiple nodes', () => {
    const nodes = [{ id: '1', keywordsAndCategories: ['a', 'l'], visited: false },
      { id: '2', keywordsAndCategories: ['d', 'c'], visited: false },
      { id: '3', keywordsAndCategories: ['c', 'm'], visited: false },
      { id: '4', keywordsAndCategories: ['l', 'z', 'a'], visited: false },
      { id: '5', keywordsAndCategories: ['f', 'b', 'a'], visited: false }];

    const disjointGraphs = findAllDisjointGraphs(nodes);
    const ids = disjointGraphs.map(graph => getIdsFromGraphs(graph));
    const keywords = disjointGraphs.map(graph => graph.sharedKeywordsAndCategories);

    const expectedIds = [['1', '4', '5'], ['2', '3']];
    const expectedKeywords = [[{ name: 'a', count: 3 },
      { name: 'l', count: 2 }, { name: 'z', count: 1 }, { name: 'f', count: 1 },
      { name: 'b', count: 1 }],
    [{ name: 'd', count: 1 }, { name: 'c', count: 2 }, { name: 'm', count: 1 }]];

    expect(keywords).toEqual(expectedKeywords);
    expect(ids).toEqual(expectedIds);
  });

  test('Basic performance regression test', () => {
    const SampleSize = 5;
    const MaxTime = 150; // miliseconds
    const N = 100;

    const start = Date.now();
    for (let i = 0; i < SampleSize; i++) {
      const subscriptions = [...Array(N).keys()].map(id => createFakePodcast(`${id}`));
      const { disjointGraphs, podcasts } = groupSubscriptionsBySharedKeywords(subscriptions);
      generateEdges(podcasts, disjointGraphs);
    }
    const averageTime = (Date.now() - start) / SampleSize;
    expect(averageTime).toBeLessThan(MaxTime);
  });
});

describe('computeEdgeWeight:', () => {
  const graphs : DisjointGraph[] = [
    { nodes: [
      { id: 'a', keywordsAndCategories: ['key 1', 'key 2'], visited: false },
      { id: 'b', keywordsAndCategories: ['key 3', 'key 2'], visited: false },
      { id: 'c', keywordsAndCategories: ['key 4', 'key 1'], visited: false },
      { id: 'd', keywordsAndCategories: ['key 1', 'key 5'], visited: false },
      { id: 'e', keywordsAndCategories: ['key 4'], visited: false },
    ],
    sharedKeywordsAndCategories: [
      { name: 'key 1', count: 3 },
      { name: 'key 2', count: 2 },
      { name: 'key 3', count: 1 },
      { name: 'key 4', count: 2 },
      { name: 'key 5', count: 1 },
    ] },
    { nodes: [
      { id: 'f', keywordsAndCategories: ['comedy', 'drama'], visited: false },
      { id: 'g', keywordsAndCategories: ['movie', 'game'], visited: false },
      { id: 'h', keywordsAndCategories: ['art', 'painting', 'drama'], visited: false },
    ],
    sharedKeywordsAndCategories: [
      { name: 'comedy', count: 1 },
      { name: 'drama', count: 2 },
      { name: 'movie', count: 1 },
      { name: 'game', count: 1 },
      { name: 'art', count: 1 },
      { name: 'painting', count: 1 },
    ] },
  ];
  test('Returns correct weight for two nodes from the first graph', () => {
    expect(computeEdgeWeight(graphs, 'a', 'c')).toBeCloseTo(10 / 9);
  });
  test('Returns correct weight for two nodes from the second graph', () => {
    expect(computeEdgeWeight(graphs, 'f', 'h')).toBeCloseTo(7 / 7);
  });
  test('Returns correct weight when there are no common keywords between two nodes', () => {
    expect(computeEdgeWeight(graphs, 'g', 'h')).toBeCloseTo(6 / 7);
  });
  test('Throws an error when nodes do not belong to the same graph', () => {
    expect(() => computeEdgeWeight(graphs, 'g', 'b')).toThrow();
  });
});
