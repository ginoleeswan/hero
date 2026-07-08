// Ad-safe data selectors — everything the content factory renders comes from
// here, and NOTHING here carries a portrait. toSafeHero is the chokepoint:
// name + stats + fame + tier only.
import { STAT_KEYS, RIVALRIES, heroByName, famousPool } from '../lib.mjs';
import { tierOf } from '../safety.mjs';

export function toSafeHero(row) {
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = row[k] ?? 0;
  return { name: row.name, fame_score: row.fame_score ?? 0, stats, tier: tierOf(row) };
}

export const distinctive = (h) => {
  const v = Object.values(h.stats).filter((n) => n > 0);
  return v.length === STAT_KEYS.length && Math.max(...v) - Math.min(...v) >= 30;
};

/** 3-4 stat rounds picked for contrast (biggest gaps first, mixed winners). */
export function buildRounds(a, b) {
  const LABELS = { intelligence: 'INTELLIGENCE', strength: 'STRENGTH', speed: 'SPEED', durability: 'DURABILITY', power: 'POWER', combat: 'COMBAT' };
  const scored = STAT_KEYS
    .map((k) => ({ k, av: a.stats[k], bv: b.stats[k], gap: Math.abs(a.stats[k] - b.stats[k]) }))
    .filter((s) => s.av > 0 && s.bv > 0)
    .sort((x, y) => y.gap - x.gap);
  const aWins = scored.filter((s) => s.av >= s.bv).slice(0, 2);
  const bWins = scored.filter((s) => s.bv > s.av).slice(0, 2);
  return [...aWins, ...bWins].slice(0, 4).map((s) => [LABELS[s.k], s.av, s.bv]);
}

const RANK_LABELS = { intelligence: 'smartest', strength: 'strongest', speed: 'fastest', durability: 'toughest', power: 'most powerful', combat: 'best fighters', fame_score: 'most famous' };

export async function fetchPools(sb, rand, { excludeTierS = false } = {}) {
  const pool = (await famousPool(sb)).map(toSafeHero).filter((h) => !excludeTierS || h.tier !== 'S');

  // matchups: rivalries that resolve, topped up with contrasting famous pairs
  const matchups = [];
  for (const [an, bn] of RIVALRIES) {
    if (matchups.length >= 10) break;
    const [ar, br] = await Promise.all([heroByName(sb, an), heroByName(sb, bn)]);
    if (!ar || !br) continue;
    const a = toSafeHero(ar), b = toSafeHero(br);
    if (excludeTierS && (a.tier === 'S' || b.tier === 'S')) continue;
    const rounds = buildRounds(a, b);
    if (rounds.length >= 3) matchups.push({ a, b, rounds });
  }
  while (matchups.length < 10 && pool.length > 4) {
    const a = pool[Math.floor(rand() * Math.min(40, pool.length))];
    const b = pool[Math.floor(rand() * Math.min(40, pool.length))];
    if (a === b || matchups.some((m) => m.a.name === a.name && m.b.name === b.name)) continue;
    const rounds = buildRounds(a, b);
    if (rounds.length >= 3) matchups.push({ a, b, rounds });
  }

  // rankings: every dimension, names+values only
  const rankings = [];
  for (const dim of [...STAT_KEYS, 'fame_score']) {
    const rows = await sb.rest(`heroes?select=name,${dim},publisher,fame_score&order=${dim}.desc.nullslast,fame_score.desc&limit=14`);
    const top = rows
      .filter((r) => !excludeTierS || tierOf(r) !== 'S')
      .slice(0, 10)
      .map((r) => ({ name: r.name, value: r[dim] ?? 0 }));
    if (top.length === 10) rankings.push({ dimension: dim, label: RANK_LABELS[dim], rows: top });
  }

  // guesses: distinctive famous heroes (recognizable = guessable)
  const guesses = pool.filter(distinctive).slice(0, 12);

  // facts: computed superlatives from the pools already in hand
  const facts = [];
  const byStat = (k) => [...pool].sort((x, y) => y.stats[k] - x.stats[k])[0];
  const fastest = byStat('speed'), smartest = byStat('intelligence'), strongest = byStat('strength');
  if (fastest) facts.push({ headline: `The fastest character we've ever rated`, detail: `${fastest.name} — speed ${fastest.stats.speed}/100`, stat: `${fastest.stats.speed}` });
  if (smartest) facts.push({ headline: `The highest intelligence on record`, detail: `${smartest.name} — intelligence ${smartest.stats.intelligence}/100`, stat: `${smartest.stats.intelligence}` });
  if (strongest) facts.push({ headline: `Pure strength, ranked`, detail: `${strongest.name} sits at ${strongest.stats.strength}/100`, stat: `${strongest.stats.strength}` });
  const perfect = pool.filter((h) => Object.values(h.stats).some((v) => v >= 100));
  facts.push({ headline: `Only ${perfect.length} characters have a perfect 100 stat`, detail: `Out of 35,000+ rated files`, stat: `${perfect.length}` });
  const famous = [...pool].sort((x, y) => y.fame_score - x.fame_score)[0];
  if (famous) facts.push({ headline: `The most famous character on Mythique`, detail: `${famous.name} — fame ${famous.fame_score}/100`, stat: `${famous.fame_score}` });
  facts.push({ headline: `35,000+ heroes & villains, every one rated`, detail: `powers · matchups · rankings · lore`, stat: '35k+' });

  return { matchups, rankings, guesses, facts };
}
