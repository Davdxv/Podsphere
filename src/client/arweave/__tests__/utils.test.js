import { toTag, fromTag } from '../utils';

const originalTagPrefix = process.env.REACT_APP_TAG_PREFIX;
const testTag = 'testPodsphere';

beforeAll(() => {
  Object.assign(process.env, { REACT_APP_TAG_PREFIX: testTag });
});

afterAll(() => {
  process.env.REACT_APP_TAG_PREFIX = originalTagPrefix;
});

describe('toTag, fromTag', () => {
  it('toTag() prepends tag prefix to name', () => {
    expect(toTag('foo')).toBe('testPodsphere-foo');
  });

  it('fromTag() removes prepending prefix to name', () => {
    expect(fromTag(toTag('foo'))).toBe('foo');
  });
});
