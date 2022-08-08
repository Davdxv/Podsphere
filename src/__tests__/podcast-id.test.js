import {
  isValidUuid,
  newCandidatePodcastId,
  removePrefixFromPodcastId,
} from '../podcast-id';

describe('newCandidatePodcastId, removePrefixFromPodcastId', () => {
  it('returns a valid uuid with a prefix', () => {
    expect(newCandidatePodcastId()).toEqual(global.VALID_TEMP_ID);
  });

  it('strips the prefix correctly', () => {
    const uuid = removePrefixFromPodcastId(newCandidatePodcastId());
    expect(uuid).toEqual(global.VALID_ID);
    expect(uuid).not.toEqual(global.VALID_TEMP_ID);
  });
});

describe('isValidUuid', () => {
  it('works as expected', () => {
    const idWithPrefix = newCandidatePodcastId();
    expect(isValidUuid(idWithPrefix)).toBe(true);

    expect(isValidUuid('e50f10c8-c418-4900-8d79-9de7b1060b8c')).toBe(true);
    expect(isValidUuid('e50f10c8-c418-4900-8d79-9de7b1060b8cz')).toBe(false);
    expect(isValidUuid('e50f10c8-c418-4900-8d79-')).toBe(false);
    expect(isValidUuid('e50f10c8')).toBe(false);
    expect(isValidUuid('0')).toBe(false);
    expect(isValidUuid(1)).toBe(false);
    expect(isValidUuid(null)).toBe(false);
  });
});
