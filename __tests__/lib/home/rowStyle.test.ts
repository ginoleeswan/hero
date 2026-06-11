// __tests__/lib/home/rowStyle.test.ts
import { rowStyle } from '../../../src/lib/home/rowStyle';
import { COLORS } from '../../../src/constants/colors';

describe('rowStyle', () => {
  it('marks leaderboard categories as ranked', () => {
    expect(rowStyle('iconic').ranked).toBe(true);
    expect(rowStyle('strongest').ranked).toBe(true);
    expect(rowStyle('minds').ranked).toBe(true);
    expect(rowStyle('villains').ranked).toBe(false);
  });

  it('makes the first curated row (iconic) the feature row', () => {
    expect(rowStyle('iconic').feature).toBe(true);
    expect(rowStyle('villains').feature).toBe(false);
  });

  it('puts villains, anti-heroes and strongest on dark bands', () => {
    expect(rowStyle('villains').tone).toBe('dark');
    expect(rowStyle('anti').tone).toBe('dark');
    expect(rowStyle('strongest').tone).toBe('dark');
    expect(rowStyle('iconic').tone).toBe('light');
  });

  it('assigns per-category accent colours', () => {
    expect(rowStyle('villains').accent).toBe(COLORS.red);
    expect(rowStyle('dc').accent).toBe(COLORS.blue);
    expect(rowStyle('xmen').accent).toBe(COLORS.purple);
  });

  it('falls back to a sane default for unknown keys', () => {
    const s = rowStyle('totally-unknown');
    expect(s).toEqual({ tone: 'light', accent: COLORS.orange, ranked: false, feature: false });
  });
});
