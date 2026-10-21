import { memoryReplayStore } from '../../../src/middleware/auth/replayStore';

describe('memoryReplayStore', () => {
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => jest.restoreAllMocks());

  it('accepts a new key and rejects it while unexpired', () => {
    const store = memoryReplayStore();
    expect(store.add('a', now + 1000)).toBe(true);
    expect(store.add('a', now + 1000)).toBe(false);
  });

  it('accepts a key again once it has expired', () => {
    const store = memoryReplayStore();
    store.add('a', now + 1000);
    now += 1000;
    expect(store.add('a', now + 1000)).toBe(true);
  });

  it('keeps distinct keys separate', () => {
    const store = memoryReplayStore();
    expect(store.add('a', now + 1000)).toBe(true);
    expect(store.add('b', now + 1000)).toBe(true);
  });

  it('honours expiry of a key left behind an unexpired entry', () => {
    const store = memoryReplayStore();
    store.add('long', now + 5000);
    store.add('short', now + 1000);
    now += 2000;
    expect(store.add('short', now + 1000)).toBe(true);
    expect(store.add('long', now + 1000)).toBe(false);
  });
});
