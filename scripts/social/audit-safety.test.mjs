import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from './audit-safety.mjs';

const ROWS = [
  { id: 'm1', publisher: 'Marvel', fame_score: 90 },              // S, famous
  { id: 'dc1', publisher: 'DC Comics', fame_score: 50 },          // A, famous
  { id: 'pd1', publisher: 'In the Public Domain', fame_score: 70 },// C, famous (band 60-79)
  { id: 'pd2', publisher: 'In the Public Domain', fame_score: 10 },// C, not famous (band 1-19)
  { id: 'x1', publisher: 'Weird New Pub', fame_score: 45 },       // untiered -> A, famous
  { id: 'n1', publisher: null, fame_score: 0 },                   // null -> A, not famous
];

test('buildReport: tier totals and famous counts', () => {
  const r = buildReport(ROWS, { famousMin: 40 });
  assert.equal(r.total, 6);
  assert.deepEqual(r.tierTotals, { S: 1, A: 3, B: 0, C: 2 });
  assert.deepEqual(r.tierFamous, { S: 1, A: 2, B: 0, C: 1 });
});

test('buildReport: untiered publishers flagged, null excluded', () => {
  const r = buildReport(ROWS, { famousMin: 40 });
  assert.deepEqual(r.untieredPublishers, ['Weird New Pub']);
});

test('buildReport: safe-face bands count Tier-C by fame band', () => {
  const r = buildReport(ROWS, { famousMin: 40 });
  const band = (label) => r.safeFaceBands.find((b) => b.label === label).count;
  assert.equal(band('60-79'), 1); // pd1
  assert.equal(band('1-19'), 1);  // pd2
  assert.equal(band('80-100'), 0);
});

test('buildReport: publishers sorted by famous desc (total desc tiebreak)', () => {
  const r = buildReport(ROWS, { famousMin: 40 });
  for (let i = 1; i < r.publishers.length; i++) {
    const prev = r.publishers[i - 1];
    const cur = r.publishers[i];
    // non-increasing by famous, then by total
    assert.ok(prev.famous > cur.famous || (prev.famous === cur.famous && prev.total >= cur.total));
  }
  assert.ok(r.publishers.every((p) => typeof p.tier === 'string'));
});
