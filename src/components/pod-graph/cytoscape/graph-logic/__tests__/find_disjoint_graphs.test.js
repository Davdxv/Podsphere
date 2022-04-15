import { findAllDisjointGraphs } from '../computation';

const getIdsFromGraphs = graph => graph.map(item => item.subscribeUrl).sort();

describe('findAllDisjointGraphs works correctly for', () => {
  test('connected graphs', () => {
    const nodes = [{ subscribeUrl: '1', keywordsAndCategories: ['a'] },
      { subscribeUrl: '2', keywordsAndCategories: ['b', 'c'] },
      { subscribeUrl: '3', keywordsAndCategories: ['a', 'b'] }];

    const result = findAllDisjointGraphs(nodes).map(graph => getIdsFromGraphs(graph));

    const expected = [['1', '2', '3']];

    expect(result).toEqual(expected);
  });

  test('disconnected graphs', () => {
    const nodes = [{ subscribeUrl: '1', keywordsAndCategories: ['a'] },
      { subscribeUrl: '2', keywordsAndCategories: ['c'] },
      { subscribeUrl: '3', keywordsAndCategories: ['b'] }];

    const result = findAllDisjointGraphs(nodes).map(graph => getIdsFromGraphs(graph));

    const expected = [['1'], ['2'], ['3']];

    expect(result).toEqual(expected);
  });

  test('two disjoint graphs', () => {
    const nodes = [{ subscribeUrl: '1', keywordsAndCategories: ['a'] },
      { subscribeUrl: '2', keywordsAndCategories: ['b', 'a'] },
      { subscribeUrl: '3', keywordsAndCategories: ['f'] }];

    const result = findAllDisjointGraphs(nodes).map(graph => getIdsFromGraphs(graph));

    const expected = [['1', '2'], ['3']];

    expect(result).toEqual(expected);
  });

  test('two disjoint graphs each containing multiple nodes', () => {
    const nodes = [{ subscribeUrl: '1', keywordsAndCategories: ['a', 'l'] },
      { subscribeUrl: '2', keywordsAndCategories: ['d', 'c'] },
      { subscribeUrl: '3', keywordsAndCategories: ['c', 'm'] },
      { subscribeUrl: '4', keywordsAndCategories: ['l', 'z'] },
      { subscribeUrl: '5', keywordsAndCategories: ['f', 'b', 'a'] }];

    const result = findAllDisjointGraphs(nodes).map(graph => getIdsFromGraphs(graph));

    const expected = [['1', '4', '5'], ['2', '3']];

    expect(result).toEqual(expected);
  });
});