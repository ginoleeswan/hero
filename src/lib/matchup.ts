import { getIconicHeroes, getHeroById, type Hero } from './db/heroes';
import { getCachedVerdict } from './db/verdicts';
import { compareStats } from './compare';
import { generateVerdict } from './api';
import { getDailyDebate, todayIso } from './db/dailyDebate';

export interface MatchupHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  publisher: string | null;
  /** head-to-head stats (0–100); present because the daily pool carries
   *  full stat rows. Optional so older cached shapes stay valid. */
  intelligence?: number | null;
  strength?: number | null;
  speed?: number | null;
}

export interface TodaysMatchup {
  heroA: MatchupHero;
  heroB: MatchupHero;
  winsA: number;
  winsB: number;
  verdict: string;
}

// A stable seed for "today" — same pair all day, new pair tomorrow.
// UTC on purpose: the server-curated daily_debates row is keyed by UTC date
// (todayIso), so the fallback pair must rotate on the SAME calendar or the two
// code paths disagree about "today" around midnight in non-UTC timezones.
function dailySeed(d = new Date()): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
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
  intelligence: h.intelligence,
  strength: h.strength,
  speed: h.speed,
});

async function buildMatchup(a: Hero, b: Hero): Promise<TodaysMatchup> {
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

/**
 * Resolve the server-curated pair against the supplied pool, fetching by id
 * for any hero not already in it. Null if either side can't be resolved at
 * all (e.g. a deleted hero) — the caller falls back to the seeded pick.
 */
async function resolveDebatePair(
  pool: Hero[],
  dd: { heroAId: string; heroBId: string },
): Promise<[Hero, Hero] | null> {
  const byId = new Map(pool.map((h) => [h.id, h]));

  // Off-pool heroes are fetched with getHeroById (full `select *` rows) so a
  // curated pair outside the top-24 auto pool still carries its real stats —
  // the picker's whole point is pairs the pool wouldn't have chosen.
  const resolve = async (id: string): Promise<Hero | null> =>
    byId.get(id) ?? (await getHeroById(id));
  const [a, b] = await Promise.all([resolve(dd.heroAId), resolve(dd.heroBId)]);

  if (!a || !b) return null;
  return [a, b];
}

/**
 * Today's featured battle: deterministically pick two iconic heroes for the
 * current day, compute the stat matchup, and resolve a verdict (cached per pair,
 * generated via the AI edge function on first request with a graceful fallback).
 */
export async function getTodaysMatchup(): Promise<TodaysMatchup | null> {
  return getTodaysMatchupFromPool(await getIconicHeroes(24));
}

/**
 * Same as getTodaysMatchup, but the fame-ranked iconic pool is supplied by the
 * caller — the explore bundle already carries it, so only the verdict (cached
 * per pair) costs a round trip. Pass the first 24 heroes to match
 * getTodaysMatchup's pool and keep the daily pair identical across surfaces.
 *
 * The server-curated `daily_debate` row (Task 1) is authoritative when present
 * — it's checked first and takes the pair over the seeded pick. Absent a
 * server row (or an unresolvable pair), this falls through unchanged to the
 * deterministic per-day seed over the pool.
 */
export async function getTodaysMatchupFromPool(pool: Hero[]): Promise<TodaysMatchup | null> {
  const dd = await getDailyDebate(todayIso());
  if (dd) {
    const pair = await resolveDebatePair(pool, dd);
    if (pair) return buildMatchup(pair[0], pair[1]);
  }

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

  return buildMatchup(a, b);
}
