import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, svgFilterDefs, styleAttr } from './stylize.mjs';

test('STYLES lists the supported treatments', () => {
  assert.deepEqual(STYLES, ['duotone', 'poster', 'halftone']);
});

test('svgFilterDefs defines a filter per style', () => {
  const svg = svgFilterDefs();
  assert.match(svg, /<svg/);
  assert.match(svg, /id="mq-duotone"/);
  assert.match(svg, /id="mq-poster"/);
  assert.match(svg, /id="mq-halftone"/);
  assert.match(svg, /feColorMatrix|feComponentTransfer/);
});

test('styleAttr references the right filter', () => {
  assert.equal(styleAttr('duotone'), 'filter:url(#mq-duotone);');
  assert.equal(styleAttr('poster'), 'filter:url(#mq-poster);');
});
