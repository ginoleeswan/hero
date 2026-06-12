import type { Hero } from '../../types';

// SuperheroAPI / akabab-CDN character ids are purely numeric — only those can be
// resolved by `fetchHeroStats`. Every other id scheme in the DB is a
// `cv-<comicvineId>` ComicVine hero, which has no SuperheroAPI record at all.
const SUPERHERO_API_ID = /^\d+$/;

export function isSuperheroApiId(id: string): boolean {
  return SUPERHERO_API_ID.test(id);
}

export type HeroLoadPlan = 'wait' | 'render-row' | 'external-api';

export interface HeroLoadQueryState {
  isPlaceholderData: boolean;
  isError: boolean;
  isSuccess: boolean;
  row: Pick<Hero, 'id' | 'enriched_at'> | null | undefined;
}

/**
 * Decide how the character screen should source its data from the hero-row query
 * state. Extracted as a pure function because the branching is subtle and was the
 * source of a "content flashes then vanishes" bug: ComicVine-only heroes (`cv-`
 * ids) are never `enriched_at` — the ComicVine pipeline only sets
 * `comicvine_enriched_at` — so they were routed to the SuperheroAPI fetch, which
 * 404s on a non-numeric id and flipped the whole screen to "not found".
 *
 *   • 'wait'         — still resolving (instant placeholder, or no row yet).
 *   • 'render-row'   — a real DB row to paint from (then layer ComicVine on top).
 *   • 'external-api' — no usable row; fetch base stats from SuperheroAPI by id.
 */
export function planHeroLoad({
  isPlaceholderData,
  isError,
  isSuccess,
  row,
}: HeroLoadQueryState): HeroLoadPlan {
  // Ignore the instant placeholder (a cached list row used only for first paint).
  if (isPlaceholderData) return 'wait';
  // Query errored, or settled with no row → the hero isn't in our DB. The only
  // remaining source is the external SuperheroAPI (numeric ids).
  if (isError || (isSuccess && !row)) return 'external-api';
  if (!row) return 'wait';
  // A real row exists. Render straight from it when it carries base data
  // (`enriched_at` set) OR when its id isn't a SuperheroAPI id — a `cv-` hero has
  // no SuperheroAPI record, so the row is the only base layer we'll ever get and
  // ComicVine enrichment fills the rest. Only an un-enriched *SuperheroAPI-id*
  // stub still needs the external base-stats fetch.
  if (row.enriched_at != null || !isSuperheroApiId(row.id)) return 'render-row';
  return 'external-api';
}
