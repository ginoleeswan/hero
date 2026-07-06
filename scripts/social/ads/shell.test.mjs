import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adShell } from './shell.mjs';

const F = { R: '', F: '', FR: '', S: '' }; // fonts are base64-embedded; empty is fine for structure tests

test('adShell renders at the requested size with brand + disclaimer + inner', () => {
  const html = adShell(F, { w: 1080, h: 1080 }, '<div class="probe">hi</div>');
  assert.match(html, /width:1080px/);
  assert.match(html, /height:1080px/);
  assert.match(html, /class="probe"/);
  assert.match(html, /mythique/);
  assert.match(html, /@mythiqueapp/);
  assert.match(html, /Unofficial fan encyclopedia\. Characters © their respective owners\./);
  assert.match(html, /id="mq-duotone"/); // stylize defs injected
});
