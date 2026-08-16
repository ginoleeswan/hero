import { trendingBadge } from '../../../src/lib/db/trending';

// A fixed "now" so the boundaries are assertions rather than a thing that only
// misbehaves on the day it matters.
const NOW = Date.parse('2026-08-16T09:00:00Z');
const t = (release_date: string | null, provider: string | null = null) => ({
  release_date,
  provider,
});

describe('trendingBadge', () => {
  it('counts down inside two months', () => {
    expect(trendingBadge(t('2026-09-29'), NOW)).toEqual({
      tone: 'coming',
      label: 'Out in 44 days',
    });
  });

  it('gives a distant title a month and year, not a four-digit countdown', () => {
    expect(trendingBadge(t('2028-06-15'), NOW)).toEqual({
      tone: 'coming',
      label: 'Out Jun 2028',
    });
  });

  it('says tomorrow rather than "in 1 days"', () => {
    expect(trendingBadge(t('2026-08-17'), NOW)).toEqual({ tone: 'coming', label: 'Out tomorrow' });
  });

  it('counts whole days between midnights, so the last day is not "0 days"', () => {
    // 09:00 today, released 00:00 in two days -> 2, never 1.
    expect(trendingBadge(t('2026-08-18'), NOW)).toEqual({ tone: 'coming', label: 'Out in 2 days' });
  });

  it('prefers the streamer once a title is out', () => {
    expect(trendingBadge(t('2025-07-09', 'Disney Plus'), NOW)).toEqual({
      tone: 'streaming',
      label: 'Disney Plus',
    });
  });

  it('shortens a long provider name to two words', () => {
    expect(trendingBadge(t('2025-06-04', 'HBO Max Amazon Channel'), NOW)).toEqual({
      tone: 'streaming',
      label: 'HBO Max',
    });
  });

  it('falls back to cinemas, matching the rail it sits in', () => {
    expect(trendingBadge(t('2026-07-29'), NOW)).toEqual({ tone: 'theaters', label: 'In cinemas' });
  });

  it('has nothing to say without a date or a provider', () => {
    expect(trendingBadge(t(null), NOW)).toBeNull();
  });
});
