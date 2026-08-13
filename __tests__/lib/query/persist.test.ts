import { PERSIST_MAX_AGE, shouldPersistQuery } from '../../../src/lib/query/persist';

const ok = (queryKey: unknown[], status = 'success') =>
  shouldPersistQuery({ queryKey, state: { status } } as never);

describe('shouldPersistQuery', () => {
  it('keeps the catalogue — the point of the feature', () => {
    expect(ok(['heroes', 'detail', 'h_1'])).toBe(true);
    expect(ok(['heroes', 'category', 'villains', {}])).toBe(true);
    expect(ok(['heroes', 'biography', 'h_1'])).toBe(true);
    expect(ok(['explore', 'bundle'])).toBe(true);
    expect(ok(['teams', 'detail', 't_1'])).toBe(true);
    expect(ok(['comics', 'issue', 'i_1'])).toBe(true);
  });

  // The single most revealing thing anyone does in this app. Already refused
  // by the analytics scrubber; it has no business on disk either.
  it('never writes a search query to disk', () => {
    expect(ok(['heroes', 'search', 'batman', 'All', 'All'])).toBe(false);
  });

  // A week-old take count or vote tally rendered as current is a small lie.
  it('drops community content that moves under the reader', () => {
    expect(ok(['heroes', 'takes', 'a', 'b'])).toBe(false);
    expect(ok(['heroes', 'verdict', 'a', 'b'])).toBe(false);
  });

  // Restoring yesterday's matchup as today's is worse than showing nothing.
  it('drops the daily loop', () => {
    expect(ok(['explore', 'matchup'])).toBe(false);
    expect(ok(['explore', 'debateYesterday'])).toBe(false);
  });

  // Per-account, and the one screen where being stale is obvious.
  it('never persists a profile', () => {
    expect(ok(['profile', 'u_1', 'data'])).toBe(false);
    expect(ok(['profile', 'u_1', 'isAdmin'])).toBe(false);
  });

  // An allowlist, so a new query root is NOT persisted until someone decides
  // it should be. Being wrong here writes someone's reading to disk.
  it('refuses an unknown root by default', () => {
    expect(ok(['somethingNew', 'x'])).toBe(false);
    expect(ok([123, 'x'])).toBe(false);
    expect(ok([])).toBe(false);
  });

  // A restored error renders as a broken screen with nothing to retry it.
  it('never persists a non-success state', () => {
    expect(ok(['heroes', 'detail', 'h_1'], 'error')).toBe(false);
    expect(ok(['heroes', 'detail', 'h_1'], 'pending')).toBe(false);
  });
});

describe('PERSIST_MAX_AGE', () => {
  // The catalogue barely moves, and the alternative to a week-old page is a
  // blank screen. Anything genuinely live is excluded by key, not aged out.
  it('is a week', () => {
    expect(PERSIST_MAX_AGE).toBe(1000 * 60 * 60 * 24 * 7);
  });
});
