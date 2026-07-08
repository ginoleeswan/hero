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

test('throws on protocol-relative <img src>', () => {
  assert.throws(() => assertNoPortrait(`<img src="//example.com/x.jpg">`), /remote image|portrait/i);
});

test('throws on remote srcset without src', () => {
  assert.throws(() => assertNoPortrait(`<img srcset="https://example.com/x.jpg 1x">`), /srcset|remote|portrait/i);
});

test('throws on protocol-relative srcset', () => {
  assert.throws(() => assertNoPortrait(`<img srcset="//example.com/x.jpg 1x">`), /srcset|remote|portrait/i);
});

test('throws on <source> tag with remote srcset', () => {
  assert.throws(() => assertNoPortrait(`<source srcset="https://example.com/x.jpg">`), /srcset|remote|portrait/i);
});

test('throws on url() with whitespace and remote https', () => {
  assert.throws(() => assertNoPortrait(`background:url( https://example.com/x.jpg)`), /remote css|portrait/i);
});

test('throws on url() with protocol-relative URL', () => {
  assert.throws(() => assertNoPortrait(`background:url(//example.com/x.jpg)`), /remote css|portrait/i);
});

test('throws on image_url field in JSON payload', () => {
  assert.throws(() => assertNoPortrait(`<div data-x='{"image_url":"https://x/y.png"}'></div>`), /portrait/i);
});

test('throws on double-quoted image_url field', () => {
  assert.throws(() => assertNoPortrait(`<div data-x='{\"image_url\":\"https://x/y.png\"}'></div>`), /portrait/i);
});

test('passes url() with data: URI and no remote', () => {
  assertNoPortrait(`background:url(data:image/svg+xml;utf8,<svg></svg>)`);
});

test('passes HTML containing imageUrl as a JS identifier', () => {
  assertNoPortrait(`<script>const imageUrl = "data:image/png;base64,...";</script>`);
});
