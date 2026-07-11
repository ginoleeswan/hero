import { planHeroLoad } from '../../../src/lib/query/heroLoadPlan';
import type { Hero } from '../../../src/types';

// Minimal row builder — planHeroLoad only reads id + enriched_at.
const row = (id: string, enriched_at: string | null) =>
  ({ id, enriched_at }) as Pick<Hero, 'id' | 'enriched_at'>;

const ENRICHED = '2026-01-01T00:00:00.000Z';

describe('planHeroLoad', () => {
  const settled = { isPlaceholderData: false, isError: false, isSuccess: true };

  it('waits while the instant placeholder row is showing', () => {
    expect(
      planHeroLoad({
        isPlaceholderData: true,
        isError: false,
        isSuccess: false,
        row: row('cv-55028', null),
      }),
    ).toBe('wait');
  });

  it('waits when the query has not produced a row yet', () => {
    expect(
      planHeroLoad({ isPlaceholderData: false, isError: false, isSuccess: false, row: undefined }),
    ).toBe('wait');
  });

  it('renders straight from an enriched numeric-id row', () => {
    expect(planHeroLoad({ ...settled, row: row('70', ENRICHED) })).toBe('render-row');
  });

  it('renders straight from an enriched cv- row', () => {
    expect(planHeroLoad({ ...settled, row: row('cv-1442', ENRICHED) })).toBe('render-row');
  });

  it('renders from the row for an un-enriched cv- hero', () => {
    expect(planHeroLoad({ ...settled, row: row('cv-55028', null) })).toBe('render-row');
  });

  // Every numeric row in the DB is enriched with real stats — an un-enriched
  // numeric row still renders from what it has rather than reaching out to the
  // external SuperheroAPI (that fallback fabricated pages; see below).
  it('renders from the row even for an un-enriched numeric-id row', () => {
    expect(planHeroLoad({ ...settled, row: row('620', null) })).toBe('render-row');
  });

  // The phantom-page bug: ids absent from the DB (e.g. 70, merged into 69) used
  // to fall through to a live SuperheroAPI fetch that fabricated a full character
  // page — wrong art, wrong stats, no publisher. Absent must mean not-found.
  it('reports not-found when the hero is not in the DB at all', () => {
    expect(planHeroLoad({ ...settled, row: null })).toBe('not-found');
  });

  // A transient query failure is not a 404 — surface the retryable error screen.
  it('reports error when the row query errors', () => {
    expect(
      planHeroLoad({ isPlaceholderData: false, isError: true, isSuccess: false, row: null }),
    ).toBe('error');
  });
});
