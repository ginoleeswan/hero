import { test } from 'node:test';
import assert from 'node:assert/strict';
import { medianViewsByFamily, weightedCycle, latestAngleViews, describeCycle } from './weights.mjs';

test('medianViewsByFamily: medians per family, outlier-resistant, unknown angles ignored', () => {
  const rows = [
    { angle: 'gauntlet', views: 40000 },
    { angle: 'thisorthat', views: 30000 },
    { angle: 'matchup', views: 100 }, // matchup family: [100, 30000, 40000] → median 30000
    { angle: 'ranking', views: 37000 },
    { angle: 'ranking', views: 26000 },
    { angle: 'brand', views: 80 },
    { angle: 'mystery-angle', views: 999999 }, // unmapped → ignored
    { angle: 'guess', views: null }, // null views → ignored
  ];
  const m = medianViewsByFamily(rows);
  assert.equal(m.matchup, 30000);
  assert.equal(m.ranking, 31500);
  assert.equal(m.brand, 80);
  assert.equal(m.guess, undefined);
  assert.equal(m['mystery-angle'], undefined);
});

test('weightedCycle: floor of one slot each, extras follow the scores', () => {
  const cycle = weightedCycle(
    ['matchup', 'ranking', 'brand'],
    { matchup: 30000, ranking: 31500, brand: 80 },
    { slots: 7, maxShare: 3 },
  );
  assert.equal(cycle.length, 7);
  const count = (f) => cycle.filter((x) => x === f).length;
  assert.equal(count('brand'), 1); // the loser keeps exactly its floor
  assert.equal(count('matchup') + count('ranking'), 6);
  assert.ok(count('matchup') >= 2 && count('ranking') >= 2, 'winners split the extras');
});

test('weightedCycle: cap stops a runaway winner; repeats are spread out', () => {
  const cycle = weightedCycle(
    ['matchup', 'ranking', 'guess', 'fact', 'lore'],
    { matchup: 1_000_000, ranking: 10, guess: 10, fact: 10, lore: 10 },
    { slots: 7, maxShare: 3 },
  );
  assert.equal(cycle.filter((x) => x === 'matchup').length, 3); // capped
  assert.notEqual(cycle[0], cycle[1], 'repeats interleaved, not clumped');
});

test('weightedCycle: unmeasured families get a neutral prior, not zero', () => {
  const cycle = weightedCycle(
    ['matchup', 'ranking', 'newthing'],
    { matchup: 30000, ranking: 20000 }, // newthing unmeasured
    { slots: 6, maxShare: 3 },
  );
  const n = cycle.filter((x) => x === 'newthing').length;
  assert.ok(n >= 1, 'unmeasured keeps at least its floor');
  assert.ok(n <= 3, 'and stays within the cap');
});

test('weightedCycle: deterministic; no scores → even split', () => {
  const a = weightedCycle(['x', 'y'], { x: 5, y: 5 }, { slots: 4 });
  const b = weightedCycle(['x', 'y'], { x: 5, y: 5 }, { slots: 4 });
  assert.deepEqual(a, b);
  assert.equal(a.filter((v) => v === 'x').length, 2);
});

test('latestAngleViews: latest snapshot per post+platform wins', () => {
  const rows = latestAngleViews([
    { post_id: 'p1', platform: 'tiktok', views: 100, recorded_at: '2026-07-01', angle: 'matchup' },
    { post_id: 'p1', platform: 'tiktok', views: 900, recorded_at: '2026-07-20', angle: 'matchup' },
    {
      post_id: 'p1',
      platform: 'instagram',
      views: 50,
      recorded_at: '2026-07-10',
      angle: 'matchup',
    },
  ]);
  assert.equal(rows.length, 2);
  assert.ok(rows.some((r) => r.views === 900));
  assert.ok(!rows.some((r) => r.views === 100), 'stale snapshot dropped');
});

test('describeCycle: compact human summary, biggest first', () => {
  assert.equal(describeCycle(['a', 'b', 'a', 'a', 'b', 'c', 'a']), 'a×4 b×2 c×1');
});
