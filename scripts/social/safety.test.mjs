import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierOf, adImagery, tierAllowed, filterPool, portraitPlan, DISCLAIMER } from './safety.mjs';

test('tierOf: per-character override wins over publisher', () => {
  assert.equal(tierOf({ id: 'ov1', publisher: 'Marvel' }), 'C'); // ov1 overridden to C below
});

test('tierOf: known publishers map to their tier', () => {
  assert.equal(tierOf({ publisher: 'Marvel' }), 'S');
  assert.equal(tierOf({ publisher: 'Pokémon' }), 'S');
  assert.equal(tierOf({ publisher: 'DC Comics' }), 'A');
  assert.equal(tierOf({ publisher: 'Company-Licensed' }), 'B');
  assert.equal(tierOf({ publisher: 'In the Public Domain' }), 'C');
});

test('tierOf: high-value film/TV/literary franchises are S (no-depict)', () => {
  for (const p of ['J. K. Rowling', 'Alien', 'Predator', 'The Lord of the Rings',
    'Game of Thrones', 'South Park', 'Halloween', 'Indiana Jones', 'The Lego Group',
    'Jurassic Park', 'The Chronicles of Narnia', 'Hakusensha']) {
    assert.equal(tierOf({ publisher: p }), 'S', p);
  }
});

test('tierOf: major game studios and comic publishers are A (stylized only)', () => {
  for (const p of ['Bethesda', 'Blizzard Entertainment', 'Electronic Arts',
    'Ubisoft Entertainment', 'Dark Horse Comics', 'Boom! Studios']) {
    assert.equal(tierOf({ publisher: p }), 'A', p);
  }
});

test('tierOf: unknown / missing publisher defaults to A (conservative)', () => {
  assert.equal(tierOf({ publisher: 'Totally New Publisher' }), 'A');
  assert.equal(tierOf({ publisher: null }), 'A');
  assert.equal(tierOf({}), 'A');
  assert.equal(tierOf(null), 'A');
});

test('adImagery: tier maps to allowed depiction', () => {
  assert.equal(adImagery({ publisher: 'Marvel' }), 'none');
  assert.equal(adImagery({ publisher: 'DC Comics' }), 'stylized');
  assert.equal(adImagery({ publisher: 'Company-Licensed' }), 'small-raw');
  assert.equal(adImagery({ publisher: 'In the Public Domain' }), 'full');
});

test('tierAllowed: maxTier admits its tier and every less-risky one', () => {
  assert.equal(tierAllowed('C', 'C'), true);
  assert.equal(tierAllowed('B', 'C'), false);
  assert.equal(tierAllowed('B', 'B'), true);
  assert.equal(tierAllowed('C', 'B'), true);
  assert.equal(tierAllowed('A', 'B'), false);
  assert.equal(tierAllowed('S', 'A'), false);
  assert.equal(tierAllowed('A', 'S'), true);
});

test('DISCLAIMER is the exact approved copy', () => {
  assert.equal(DISCLAIMER, 'Unofficial fan encyclopedia. Characters © their respective owners.');
});

test('portraitPlan: organic uses the full fallback chain, never stylized', () => {
  assert.deepEqual(portraitPlan({ publisher: 'Marvel' }, 'organic'),
    { fields: ['portrait_url', 'image_url', 'image_md_url'], stylize: false });
});

test('portraitPlan: ad never references official art (only portrait_url or nothing)', () => {
  assert.deepEqual(portraitPlan({ publisher: 'Marvel' }, 'ad'), { fields: [], stylize: false }); // S: none
  assert.deepEqual(portraitPlan({ publisher: 'DC Comics' }, 'ad'), { fields: ['portrait_url'], stylize: true }); // A: stylized
  assert.deepEqual(portraitPlan({ publisher: 'Company-Licensed' }, 'ad'), { fields: ['portrait_url'], stylize: false }); // B: small-raw
  assert.deepEqual(portraitPlan({ publisher: 'In the Public Domain' }, 'ad'), { fields: ['portrait_url'], stylize: false }); // C: full
});

test('filterPool: keeps only heroes no riskier than maxTier, above minFame', () => {
  const rows = [
    { id: 'm', publisher: 'Marvel', fame_score: 90 },           // S
    { id: 'dc', publisher: 'DC Comics', fame_score: 80 },       // A
    { id: 'cl', publisher: 'Company-Licensed', fame_score: 70 },// B
    { id: 'pd', publisher: 'In the Public Domain', fame_score: 65 }, // C
    { id: 'pdlow', publisher: 'In the Public Domain', fame_score: 5 }, // C, low fame
  ];
  const c = filterPool(rows, { maxTier: 'C', minFame: 40 }).map((h) => h.id);
  assert.deepEqual(c, ['pd']); // only C-tier above fame 40

  const b = filterPool(rows, { maxTier: 'B', minFame: 0 }).map((h) => h.id);
  assert.deepEqual(b, ['cl', 'pd', 'pdlow']); // B and C tiers, any fame

  const a = filterPool(rows, { maxTier: 'A', minFame: 0 }).map((h) => h.id);
  assert.deepEqual(a, ['dc', 'cl', 'pd', 'pdlow']); // A, B, C — never S
});
