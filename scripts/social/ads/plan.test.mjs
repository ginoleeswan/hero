import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, rng } from './plan.mjs';

const H = (name, over = {}) => ({ name, fame_score: 90, tier: 'A',
  stats: { intelligence: 60, strength: 90, speed: 80, durability: 70, power: 85, combat: 95, ...over } });
const pools = {
  matchups: Array.from({ length: 12 }, (_, i) => ({ a: H(`A${i}`), b: H(`B${i}`), rounds: [['SPEED', 80, 70], ['POWER', 60, 90], ['COMBAT', 95, 50]] })),
  rankings: Array.from({ length: 10 }, (_, i) => ({ dimension: `d${i}`, label: `dim ${i}`, rows: Array.from({ length: 10 }, (_, j) => ({ name: `R${i}-${j}`, value: 100 - j })) })),
  guesses: Array.from({ length: 8 }, (_, i) => H(`G${i}`)),
  facts: Array.from({ length: 8 }, (_, i) => ({ headline: `Fact ${i}`, detail: `detail ${i}`, stat: `${i}` })),
};

test('produces n entries with the requested format mix', () => {
  const plan = buildPlan({ n: 30, seed: 7, mix: { carousel: 18, reel: 12 }, pools });
  assert.equal(plan.length, 30);
  assert.equal(plan.filter((e) => e.format === 'carousel').length, 18);
  assert.equal(plan.filter((e) => e.format === 'reel').length, 12);
});

test('every angle appears in both formats', () => {
  const plan = buildPlan({ n: 30, seed: 7, mix: { carousel: 18, reel: 12 }, pools });
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
