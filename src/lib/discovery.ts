import type { Hero } from './db/heroes';
import type { FeaturedTeam } from './db/teams';

export interface HeroLite {
  id: string;
  name: string;
  image_url?: string | null;
  portrait_url?: string | null;
}
export interface Matchup {
  a: HeroLite;
  b: HeroLite;
}
export interface TeamMatchup {
  a: FeaturedTeam;
  b: FeaturedTeam;
}

const lite = (h: Hero): HeroLite => ({
  id: h.id,
  name: h.name,
  image_url: h.image_url,
  portrait_url: h.portrait_url,
});

function pubKey(p?: string | null): 'marvel' | 'dc' | 'other' {
  const s = (p ?? '').toLowerCase();
  if (s.includes('marvel')) return 'marvel';
  if (s.includes('dc')) return 'dc';
  return 'other';
}

/** Sum of the six powerstats (null → 0) — the "weight class" for upsets. */
export function heroPowerTotal(h: Hero): number {
  return (
    (h.intelligence ?? 0) +
    (h.strength ?? 0) +
    (h.speed ?? 0) +
    (h.durability ?? 0) +
    (h.power ?? 0) +
    (h.combat ?? 0)
  );
}

/** Cross-universe fantasy: pair the i-th most-popular Marvel icon with the i-th DC
 *  icon (pool is popularity-ranked). Only ever cross-publisher; never self-pairs. */
export function buildDreamMatches(pool: Hero[], n: number): Matchup[] {
  const marvel = pool.filter((h) => pubKey(h.publisher) === 'marvel');
  const dc = pool.filter((h) => pubKey(h.publisher) === 'dc');
  const out: Matchup[] = [];
  const len = Math.min(marvel.length, dc.length, n);
  for (let i = 0; i < len; i++) out.push({ a: lite(marvel[i]), b: lite(dc[i]) });
  return out;
}

/** Power-gap upsets: the underdog (low total) vs a heavyweight (high total).
 *  Pairs the i-th strongest with the i-th weakest, underdog listed first. */
export function buildGoliathMatches(pool: Hero[], n: number): Matchup[] {
  const ranked = pool.filter((h) => heroPowerTotal(h) > 0).sort((x, y) => heroPowerTotal(y) - heroPowerTotal(x));
  const out: Matchup[] = [];
  const max = Math.min(n, Math.floor(ranked.length / 2));
  for (let i = 0; i < max; i++) {
    const strong = ranked[i];
    const weak = ranked[ranked.length - 1 - i];
    if (strong.id === weak.id) break;
    out.push({ a: lite(weak), b: lite(strong) });
  }
  return out;
}

/** Featured team vs featured team — consecutive distinct pairs from the list. */
export function buildTeamMatches(teams: FeaturedTeam[], n: number): TeamMatchup[] {
  const out: TeamMatchup[] = [];
  for (let i = 0; i + 1 < teams.length && out.length < n; i += 2) {
    if (teams[i].id !== teams[i + 1].id) out.push({ a: teams[i], b: teams[i + 1] });
  }
  return out;
}
