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

const HOOKS = ['WAIT — WHAT?', "MOST PEOPLE DON'T KNOW THIS", 'DID YOU KNOW', null];

/** Deterministic hook pick so the same fact content always renders the same
 *  eyebrow (or none) across re-runs/batches — no per-render randomness. */
function hookFor(content) {
  let sum = 0;
  for (let i = 0; i < content.length; i++) sum += content.charCodeAt(i);
  return HOOKS[sum % HOOKS.length];
}

/** A narrative-fact row → the render shape. Headline = the fact's first
 *  sentence when it's short enough to punch as a standalone line; otherwise
 *  falls back to the hero name. detail always carries the FULL fact body.
 *  No number (stat null) → the renderers show the fact card, not the
 *  odometer. hook rotates the eyebrow line (null = bare claim, no eyebrow) —
 *  provoke, not inform. */
export function factFromRow(row) {
  const name = row.name;
  const content = row.content.trim();
  const first = content.split(/(?<=[.!?])\s/)[0];
  const headline = first.length <= 70 ? first : name;
  return { headline, detail: content, stat: null, hook: hookFor(content) };
}

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
  let attempts = 0;
  while (matchups.length < 10 && pool.length > 4 && attempts < 400) {
    attempts++;
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

  // facts: real narrative lore (self-contained, punchy), computed superlatives
  // only as a thin-catalog fallback.
  const factRows = await sb.rest(
    `hero_narrative_facts?select=content,subject,hero_id,heroes!inner(name,fame_score)` +
    `&kind=in.(did_you_know,era_summary,power_explainer)&needs_review=eq.false` +
    `&heroes.fame_score=gte.25&limit=400`,
  ).catch(() => []);
  const facts = factRows
    .filter((r) => r.heroes && r.content && r.content.length > 40)
    .map((r) => factFromRow({ name: r.heroes.name, subject: r.subject, content: r.content }));
  if (facts.length < 6) {
    const byStat = (k) => [...pool].sort((x, y) => y.stats[k] - x.stats[k])[0];
    const fastest = byStat('speed'), strongest = byStat('strength');
    if (fastest) facts.push({ headline: `The fastest character we've ever rated`, detail: `${fastest.name} — speed ${fastest.stats.speed}/100`, stat: `${fastest.stats.speed}`, hook: 'DID YOU KNOW' });
    if (strongest) facts.push({ headline: `Pure strength, ranked`, detail: `${strongest.name} sits at ${strongest.stats.strength}/100`, stat: `${strongest.stats.strength}`, hook: 'DID YOU KNOW' });
    facts.push({ headline: `35,000+ heroes & villains, every one rated`, detail: `powers · matchups · rankings · lore`, stat: '35k+', hook: 'DID YOU KNOW' });
  }

  return { matchups, rankings, guesses, facts };
}
