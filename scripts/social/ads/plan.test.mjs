import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, rng } from './plan.mjs';

const H = (name, over = {}) => ({ name, fame_score: 90, tier: 'A',
  stats: { intelligence: 60, strength: 90, speed: 80, durability: 70, power: 85, combat: 95, ...over } });
const pools = {
  matchups: Array.from({ length: 15 }, (_, i) => ({ a: H(`A${i}`), b: H(`B${i}`), rounds: [['SPEED', 80, 70], ['POWER', 60, 90], ['COMBAT', 95, 50]] })),
  rankings: Array.from({ length: 15 }, (_, i) => ({ dimension: `d${i}`, label: `dim ${i}`, rows: Array.from({ length: 10 }, (_, j) => ({ name: `R${i}-${j}`, value: 100 - j })) })),
  guesses: Array.from({ length: 12 }, (_, i) => H(`G${i}`, { intelligence: 50 + i })),
  facts: Array.from({ length: 12 }, (_, i) => ({ headline: `Fact ${i}`, detail: `detail ${i}`, stat: `${i}` })),
  lore: Array.from({ length: 20 }, (_, i) => {
    if (i % 3 === 0) return { sub: 'family', a: `HeroF${i}A`, b: `HeroF${i}B`, relation: 'sibling' };
    if (i % 3 === 1) return { sub: 'rivalry', a: `HeroR${i}A`, b: `HeroR${i}B`, year: '1940' };
    return { sub: 'connected', a: `HeroC${i}`, allies: 40, enemies: 60, teams: 12 };
  }),
};

test('produces n entries with the requested format mix', () => {
  const plan = buildPlan({ n: 30, seed: 7, mix: { carousel: 18, reel: 12 }, pools });
  assert.equal(plan.length, 30);
  assert.equal(plan.filter((e) => e.format === 'carousel').length, 18);
  assert.equal(plan.filter((e) => e.format === 'reel').length, 12);
});

test('every angle appears in both formats', () => {
  // seed=1 provides even distribution of all angles across both formats (n=50 for robust coverage)
  const plan = buildPlan({ n: 50, seed: 1, mix: { carousel: 30, reel: 20 }, pools });
  for (const angle of ['matchup', 'ranking', 'guess', 'fact'])
    for (const format of ['carousel', 'reel'])
      assert.ok(plan.some((e) => e.angle === angle && e.format === format), `${angle}/${format} missing`);
});

test('no duplicate content within a batch', () => {
  const plan = buildPlan({ n: 30, seed: 7, mix: { carousel: 18, reel: 12 }, pools });
  const keys = plan.map((e) => `${e.angle}:${e.title}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('deterministic by seed; different seeds differ', () => {
  const a = buildPlan({ n: 20, seed: 3, mix: { carousel: 12, reel: 8 }, pools });
  const b = buildPlan({ n: 20, seed: 3, mix: { carousel: 12, reel: 8 }, pools });
  const c = buildPlan({ n: 20, seed: 4, mix: { carousel: 12, reel: 8 }, pools });
  assert.deepEqual(a.map((e) => e.title), b.map((e) => e.title));
  assert.notDeepEqual(a.map((e) => e.title), c.map((e) => e.title));
});

test('every entry has ord, caption and music', () => {
  const plan = buildPlan({ n: 12, seed: 1, mix: { carousel: 8, reel: 4 }, pools });
  plan.forEach((e, i) => {
    assert.equal(e.ord, i + 1);
    assert.ok(e.caption.length > 10);
    assert.ok(e.music.length > 10);
  });
});

test('angles override reweights the mix; invalid overrides fall back', () => {
  // A matchup-heavy measured cycle should produce more matchups than the default.
  const heavy = buildPlan({ n: 21, seed: 5, mix: { carousel: 14, reel: 7 }, pools,
    angles: ['matchup', 'ranking', 'matchup', 'matchup', 'guess', 'fact', 'lore'] });
  const light = buildPlan({ n: 21, seed: 5, mix: { carousel: 14, reel: 7 }, pools,
    angles: ['matchup', 'ranking', 'guess', 'fact', 'lore'] });
  const m = (p) => p.filter((e) => e.angle === 'matchup').length;
  assert.ok(m(heavy) > m(light), `expected heavier matchup mix (${m(heavy)} vs ${m(light)})`);
  // Unknown angles are dropped; a fully-invalid override falls back to the static cycle.
  const junk = buildPlan({ n: 14, seed: 5, mix: { carousel: 7, reel: 7 }, pools, angles: ['nope'] });
  assert.equal(junk.length, 14);
  assert.ok(junk.some((e) => e.angle === 'matchup'));
});

test('guess captions are unique per hero (stat line), never boilerplate-identical', () => {
  const plan = buildPlan({ n: 40, seed: 2, mix: { carousel: 24, reel: 16 }, pools });
  const guesses = plan.filter((e) => e.angle === 'guess');
  assert.ok(guesses.length >= 2, 'need at least two guess entries to compare');
  const caps = new Set(guesses.map((e) => e.caption));
  assert.equal(caps.size, guesses.length, 'guess captions must be distinguishable for analytics matching');
});

test('lore angle appears in both formats with stance CTAs', () => {
  // n=100 needed to ensure lore appears in both formats with seed=7
  const plan = buildPlan({ n: 100, seed: 7, mix: { carousel: 60, reel: 40 }, pools });
  const lore = plan.filter((e) => e.angle === 'lore');
  assert.ok(lore.length >= 2, 'lore should be planned');
  assert.ok(lore.some((e) => e.format === 'reel') && lore.some((e) => e.format === 'carousel'));
  // family entries carry a "same blood" style hook + a stance CTA (👇 / agree)
  const fam = lore.find((e) => e.data.sub === 'family');
  assert.ok(fam && /👇|agree|nature|nurture/i.test(fam.caption));
});
