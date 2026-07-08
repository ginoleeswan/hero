import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestMusic } from './music.mjs';

test('kind defaults: each known kind gets a distinct suggestion', () => {
  const kinds = ['matchup', 'ranking', 'bio', 'brand'];
  const out = kinds.map((k) => suggestMusic(k, ''));
  assert.equal(new Set(out).size, kinds.length);
  for (const s of out) assert.ok(s.length > 20);
});

test('unknown kind falls back to the generic suggestion', () => {
  assert.ok(suggestMusic('mystery', '').includes('Trending sound'));
});

test('anime titles override the kind default', () => {
  const s = suggestMusic('matchup', 'goku vs superman');
  assert.match(s, /anime/i);
});

test('villain titles get the menace underscore regardless of kind', () => {
  assert.match(suggestMusic('ranking', 'Top 10 Most Famous Villains'), /villain|menace/i);
});

test('strongest/power rankings get the hype countdown', () => {
  assert.match(suggestMusic('ranking', 'top 10 strongest'), /countdown/i);
});
