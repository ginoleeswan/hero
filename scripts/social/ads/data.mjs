// Ad-safe data selectors — everything the content factory renders comes from
// here, and NOTHING here carries a portrait. toSafeHero is the chokepoint:
// name + stats + fame + tier only.
import { STAT_KEYS, RIVALRIES, heroByName, famousPool } from '../lib.mjs';
import { tierOf } from '../safety.mjs';

export function toSafeHero(row) {
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = row[k] ?? 0;
  return { name: row.name, fame_score: row.fame_score ?? 0, stats, tier: tierOf(row), gender: row.gender ?? null, alignment: row.alignment ?? null };
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

const RELATION_PHRASE = { parent: 'the parent of', child: 'the child of', sibling: 'the sibling of', aunt_uncle: 'the aunt/uncle of', grandparent: 'the grandparent of', cousin: 'the cousin of', clone: 'a clone of', ancestor: 'an ancestor of', other: 'family to' };
export const relationPhrase = (r) => RELATION_PHRASE[r] ?? 'family to';

const yearOf = (s) => { const m = /(\d{4})/.exec(s ?? ''); return m ? m[1] : null; };

/** Lore pools — family feud (lead), rivalry, most-connected. Names + numbers
 *  only (no ids/portraits). Each entry carries `sub`; family entries come
 *  first (priority order) in fetchPools' returned array.
 *
 *  Embed hints: `heroes!hero_id(...)` / `heroes!related_hero_id(...)` (and the
 *  hero_relationships equivalents `heroes!hero_id` / `heroes!related_id`) are
 *  verified against the live schema — PostgREST accepts the bare FK-column
 *  hint, no need to spell out the full constraint name.
 *
 *  Connected-pool note: hero_relationships is stored directionally (a hero's
 *  edges show up as either hero_id OR related_id, not symmetrically — e.g.
 *  Batman has 163 rows as hero_id but 1000+ as related_id), and the table is
 *  646k rows so a naive `select=hero_id,kind` full-table fetch both exceeds
 *  PostgREST's 1000-row default cap and would undercount degree even if it
 *  didn't. Instead: take the top ~15 heroes by fame_score, and for each run
 *  two bounded per-hero queries (as hero_id, as related_id) and merge kind
 *  tallies — ≤30 cheap indexed queries total. */
export async function fetchLore(sb, rand, { excludeTierS = false } = {}) {
  const out = [];
  // FAMILY: relatives whose related_hero_id is a famous hero AND an enemy edge
  // exists between the pair — the templates frame conflict ("Same blood.
  // Opposite sides."), so allied/teammate family is off-message. `relation`
  // describes the RELATIVE'S role toward the hero (hero=Luke, related=Vader,
  // relation='parent' ⇒ Vader is Luke's parent), so the relative takes the `a`
  // slot: the copy renders "<a> is the <relation> of <b>". spouse is excluded
  // (not same blood).
  const fam = await sb.rest(
    `hero_relatives?select=relation,heroes!hero_id(id,name,fame_score,gender,alignment),related:heroes!related_hero_id(id,name,fame_score,gender,alignment)` +
    `&related_hero_id=not.is.null&limit=600`,
  ).catch(() => []);
  const famCandidates = [];
  for (const r of fam) {
    const hero = r.heroes, rel = r.related;
    if (!hero || !rel || r.relation === 'spouse' || r.relation === 'in_law') continue; // not same blood
    if ((hero.fame_score ?? 0) < 30 || (rel.fame_score ?? 0) < 30) continue;
    famCandidates.push({ hero, rel, relation: r.relation });
  }
  // One bounded query: enemy edges among the candidates' ids (both directions
  // — hero_relationships is directional).
  const famIds = [...new Set(famCandidates.flatMap((c) => [c.hero.id, c.rel.id]))];
  const idList = famIds.map((id) => `"${id}"`).join(',');
  const enemyEdges = famIds.length === 0 ? [] : await sb.rest(
    `hero_relationships?select=hero_id,related_id&kind=eq.enemy&hero_id=in.(${idList})&related_id=in.(${idList})&limit=1000`,
  ).catch(() => []);
  const enemySet = new Set(enemyEdges.flatMap((e) => [`${e.hero_id}|${e.related_id}`, `${e.related_id}|${e.hero_id}`]));
  for (const { hero, rel, relation } of famCandidates) {
    if (!enemySet.has(`${hero.id}|${rel.id}`)) continue;
    out.push({ sub: 'family', a: rel.name, b: hero.name, relation, aHint: { gender: rel.gender, alignment: rel.alignment }, bHint: { gender: hero.gender, alignment: hero.alignment } });
  }
  // RIVALRY: famous enemy pairs, best-effort year from first_appearance.
  const riv = await sb.rest(
    `hero_relationships?select=kind,a:heroes!hero_id(name,fame_score,first_appearance,gender,alignment),b:heroes!related_id(name,fame_score,first_appearance,gender,alignment)` +
    `&kind=eq.enemy&limit=800`,
  ).catch(() => []);
  const rivPairs = [];
  for (const r of riv) {
    const a = r.a, b = r.b;
    if (!a || !b || (a.fame_score ?? 0) < 30 || (b.fame_score ?? 0) < 30) continue;
    rivPairs.push({ sub: 'rivalry', a: a.name, b: b.name, year: yearOf(a.first_appearance) || yearOf(b.first_appearance), aHint: { gender: a.gender, alignment: a.alignment }, bHint: { gender: b.gender, alignment: b.alignment } });
  }
  // CONNECTED: degree leaderboard, top famous heroes, both edge directions.
  const famousIds = await sb.rest(`heroes?select=id,name,fame_score,gender,alignment&order=fame_score.desc.nullslast&limit=60`).catch(() => []);
  const connected = [];
  for (const h of famousIds.slice(0, 15)) {
    if ((h.fame_score ?? 0) < 40) continue;
    const [asHero, asRelated] = await Promise.all([
      sb.rest(`hero_relationships?select=kind&hero_id=eq.${h.id}&limit=1000`).catch(() => []),
      sb.rest(`hero_relationships?select=kind&related_id=eq.${h.id}&limit=1000`).catch(() => []),
    ]);
    const m = { ally: 0, enemy: 0, teammate: 0 };
    for (const r of [...asHero, ...asRelated]) m[r.kind] = (m[r.kind] ?? 0) + 1;
    connected.push({ sub: 'connected', a: h.name, allies: m.ally, enemies: m.enemy, teams: m.teammate, aHint: { gender: h.gender, alignment: h.alignment } });
    if (connected.length >= 4) break;
  }
  // interleave: family (all, priority) then a capped shuffled rivalry set then connected.
  const rivShuffled = [...rivPairs];
  for (let i = rivShuffled.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rivShuffled[i], rivShuffled[j]] = [rivShuffled[j], rivShuffled[i]]; }
  const family = out.filter((e) => e.sub === 'family');
  return [...family, ...rivShuffled.slice(0, 20), ...connected];
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

  const lore = await fetchLore(sb, rand, { excludeTierS });

  return { matchups, rankings, guesses, facts, lore };
}
