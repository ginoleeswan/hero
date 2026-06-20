import { applyResult, previousDay, EMPTY_STREAK } from '../../../src/lib/game/streak';

describe('previousDay', () => {
  it('steps back a calendar day, including across month boundaries', () => {
    expect(previousDay('2026-06-19')).toBe('2026-06-18');
    expect(previousDay('2026-07-01')).toBe('2026-06-30');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
  });
});

describe('applyResult', () => {
  it('starts a streak at 1 on the first win', () => {
    expect(applyResult(EMPTY_STREAK, '2026-06-19', true)).toEqual({
      current: 1,
      max: 1,
      lastDate: '2026-06-19',
      lastWon: true,
    });
  });

  it('increments on a consecutive-day win and tracks the max', () => {
    const day1 = applyResult(EMPTY_STREAK, '2026-06-18', true);
    const day2 = applyResult(day1, '2026-06-19', true);
    expect(day2).toMatchObject({ current: 2, max: 2 });
  });

  it('resets to 1 after a skipped day', () => {
    const day1 = applyResult(EMPTY_STREAK, '2026-06-17', true);
    const day3 = applyResult(day1, '2026-06-19', true); // skipped the 18th
    expect(day3).toMatchObject({ current: 1, max: 1 });
  });

  it('resets to 0 on a loss but keeps the max', () => {
    const day1 = applyResult(EMPTY_STREAK, '2026-06-18', true);
    const day2 = applyResult(day1, '2026-06-19', false);
    expect(day2).toMatchObject({ current: 0, max: 1, lastWon: false });
  });

  it('is idempotent for the same day', () => {
    const once = applyResult(EMPTY_STREAK, '2026-06-19', true);
    expect(applyResult(once, '2026-06-19', false)).toBe(once);
  });
});
