import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierOf, adImagery, tierAllowed, DISCLAIMER } from './safety.mjs';

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
