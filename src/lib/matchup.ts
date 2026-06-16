import { getIconicHeroes, type Hero } from './db/heroes';
import { getCachedVerdict } from './db/verdicts';
import { compareStats } from './compare';
import { generateVerdict } from './api';

export interface MatchupHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  publisher: string | null;
}

export interface TodaysMatchup {
  heroA: MatchupHero;
  heroB: MatchupHero;
  winsA: number;
  winsB: number;
  verdict: string;
}

// A stable seed for "today" — same pair all day, new pair tomorrow.
function dailySeed(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const STAT_KEYS = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'] as const;

function statsString(h: Hero): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of STAT_KEYS) o[k] = String((h[k] as number | null) ?? 0);
  return o;
}
function statsNumber(h: Hero): Record<string, number> {
  const o: Record<string, number> = {};
  for (const k of STAT_KEYS) o[k] = (h[k] as number | null) ?? 0;
  return o;
}

const toMatchupHero = (h: Hero): MatchupHero => ({
  id: h.id,
  name: h.name,
  image_url: h.image_url,
  portrait_url: h.portrait_url,
  publisher: h.publisher,
});

/**
 * Today's featured battle: deterministically pick two iconic heroes for the
 * current day, compute the stat matchup, and resolve a verdict (cached per pair,
 * generated via the AI edge function on first request with a graceful fallback).
 */
export async function getTodaysMatchup(): Promise<TodaysMatchup | null> {
  const pool = await getIconicHeroes(24);
  if (pool.length < 2) return null;

  const seed = dailySeed();
  const iA = seed % pool.length;
  let iB = (seed * 7 + 3) % pool.length;
  if (iB === iA) iB = (iB + 1) % pool.length;

  // getIconicHeroes already returns full stat rows (HOME_SPOT), so use the pool
  // entries directly rather than re-fetching each hero by id.
  const a = pool[iA];
  const b = pool[iB];
  if (!a || !b) return null;

  const cmp = compareStats(a.name, statsString(a), b.name, statsString(b));

  let verdict = await getCachedVerdict(a.id, b.id);
  if (!verdict) {
    verdict = await generateVerdict({
      heroAId: a.id,
      heroBId: b.id,
      heroA: a.name,
      heroB: b.name,
      winsA: cmp.winsA,
      winsB: cmp.winsB,
      statsA: statsNumber(a),
      statsB: statsNumber(b),
    });
  }

  return {
    heroA: toMatchupHero(a),
    heroB: toMatchupHero(b),
    winsA: cmp.winsA,
    winsB: cmp.winsB,
    verdict,
  };
}
