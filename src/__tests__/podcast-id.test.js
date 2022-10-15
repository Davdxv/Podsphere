import {
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
