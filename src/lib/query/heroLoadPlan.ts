import type { Hero } from '../../types';

export type HeroLoadPlan = 'wait' | 'render-row' | 'not-found' | 'error';

export interface HeroLoadQueryState {
  isPlaceholderData: boolean;
  isError: boolean;
  isSuccess: boolean;
  row: Pick<Hero, 'id' | 'enriched_at'> | null | undefined;
}

/**
 * Decide how the character screen should source its data from the hero-row query
 * state. The DB is the only source: a row renders, an absent id is not-found.
 *
 * There used to be an 'external-api' plan that fetched base stats live from the
 * SuperheroAPI for numeric ids without a usable row. Once every numeric row was
 * fully enriched it served nothing but the phantom-page bug: ids deleted in a
 * merge (e.g. 70 → Batman 69) still resolve on SuperheroAPI, so the screen
 * fabricated a full character page — wrong art, wrong stats, no publisher — for
 * ~280 ids that no longer exist in the catalog.
 *
 *   • 'wait'       — still resolving (instant placeholder, or no row yet).
 *   • 'render-row' — a real DB row to paint from (then layer ComicVine on top).
 *   • 'not-found'  — query settled with no row; the id isn't in the catalog.
 *   • 'error'      — the row query failed; show the retryable error screen.
 */
export function planHeroLoad({
  isPlaceholderData,
  isError,
  isSuccess,
  row,
}: HeroLoadQueryState): HeroLoadPlan {
  // Ignore the instant placeholder (a cached list row used only for first paint).
  if (isPlaceholderData) return 'wait';
  // A transient query failure is not a 404 — keep it distinct so the screen can
  // offer a retry instead of declaring the character missing.
  if (isError) return 'error';
  // Settled with no row → the id isn't in the catalog.
  if (isSuccess && !row) return 'not-found';
  if (!row) return 'wait';
  return 'render-row';
}
