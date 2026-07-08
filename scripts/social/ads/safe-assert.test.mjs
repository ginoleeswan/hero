import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNoPortrait } from './safe-assert.mjs';

test('passes clean data-only HTML (data: URIs are fine)', () => {
  assertNoPortrait(`<div class="bar" style="background:url(data:image/svg+xml;utf8,x)">Goku 92</div>`);
});

test('throws on a remote <img>', () => {
  assert.throws(() => assertNoPortrait(`<img src="https://example.com/x.jpg">`), /portrait|remote image/i);
});

test('throws on known image hosts even outside <img>', () => {
  assert.throws(() => assertNoPortrait(`background:url(https://res.cloudinary.com/x/y.png)`), /portrait|remote image/i);
  assert.throws(() => assertNoPortrait(`https://comicvine.gamespot.com/a/uploads/scale_small/x.jpg`), /portrait|remote image/i);
});

test('throws on a portrait field leaking into the payload', () => {
  assert.throws(() => assertNoPortrait(`<div data-x='{"portrait_url":"https://x/y.png"}'></div>`), /portrait/i);
});

test('includes the label in the error', () => {
  assert.throws(() => assertNoPortrait(`<img src="http://x/y.png">`, 'reel:matchup'), /reel:matchup/);
});
