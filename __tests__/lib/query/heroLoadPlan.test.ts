import { planHeroLoad, isSuperheroApiId } from '../../../src/lib/query/heroLoadPlan';
import type { Hero } from '../../../src/types';

// Minimal row builder — planHeroLoad only reads id + enriched_at.
const row = (id: string, enriched_at: string | null) =>
  ({ id, enriched_at }) as Pick<Hero, 'id' | 'enriched_at'>;

const ENRICHED = '2026-01-01T00:00:00.000Z';

describe('isSuperheroApiId', () => {
  it('treats purely numeric ids as SuperheroAPI ids', () => {
    expect(isSuperheroApiId('70')).toBe(true);
    expect(isSuperheroApiId('620')).toBe(true);
  });

  it('rejects cv- ComicVine ids (no SuperheroAPI record exists)', () => {
    expect(isSuperheroApiId('cv-55028')).toBe(false);
    expect(isSuperheroApiId('cv-162251')).toBe(false);
  });
});

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

  it('renders straight from an enriched SuperheroAPI-id row', () => {
    expect(planHeroLoad({ ...settled, row: row('70', ENRICHED) })).toBe('render-row');
  });

  it('renders straight from an enriched cv- row', () => {
    expect(planHeroLoad({ ...settled, row: row('cv-1442', ENRICHED) })).toBe('render-row');
  });

  // The bug: a franchise hero (cv- id) is never `enriched_at` because the
  // ComicVine pipeline only sets `comicvine_enriched_at`. It must render from the
  // row and enrich via ComicVine — NOT be routed to the SuperheroAPI fetch, which
  // 404s on a non-numeric id and flips the screen to "not found".
  it('renders from the row for an un-enriched cv- hero (no SuperheroAPI fetch)', () => {
    expect(planHeroLoad({ ...settled, row: row('cv-55028', null) })).toBe('render-row');
  });

  it('falls back to the SuperheroAPI for an un-enriched numeric-id stub', () => {
    expect(planHeroLoad({ ...settled, row: row('620', null) })).toBe('external-api');
  });

  it('falls back to the SuperheroAPI when the hero is not in the DB at all', () => {
    expect(planHeroLoad({ ...settled, row: null })).toBe('external-api');
  });

  it('falls back to the SuperheroAPI when the row query errors', () => {
    expect(
      planHeroLoad({ isPlaceholderData: false, isError: true, isSuccess: false, row: null }),
    ).toBe('external-api');
  });
});
