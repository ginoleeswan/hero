// node --test scripts/social/postUrl.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postUrl, ORIGIN } from './lib.mjs';

test('links to the subject, not the homepage', () => {
  const u = postUrl('character/cv-1699', { campaign: 'bios', content: 'cv-1699' });
  assert.ok(u.startsWith(`${ORIGIN}/character/cv-1699?`));
  const q = new URL(u).searchParams;
  assert.equal(q.get('utm_source'), 'tiktok');
  assert.equal(q.get('utm_medium'), 'social');
  assert.equal(q.get('utm_campaign'), 'bios');
  assert.equal(q.get('utm_content'), 'cv-1699');
});

test('tolerates a leading slash without doubling it', () => {
  assert.ok(postUrl('/compare/a/b').startsWith(`${ORIGIN}/compare/a/b?`));
});

test('omits utm_content when there is no subject id', () => {
  assert.equal(new URL(postUrl('explore')).searchParams.has('utm_content'), false);
});

test('an empty path is the origin, still tagged', () => {
  const u = new URL(postUrl(''));
  assert.equal(u.pathname, '/');
  assert.equal(u.searchParams.get('utm_medium'), 'social');
});

test('preserves an already-encoded id rather than double-encoding it', () => {
  // Title ids look like `tmdb:969681`; the caller encodes the segment because
  // only the caller knows which part is an id.
  const u = postUrl('title/tmdb%3A969681', { campaign: 'pulse' });
  assert.ok(u.includes('/title/tmdb%3A969681?'));
  // The point is that it is not encoded a second time into %253A — URL keeps
  // the escape as written, which is what the route expects.
  assert.equal(new URL(u).pathname, '/title/tmdb%3A969681');
  assert.ok(!u.includes('%253A'));
});

test('the source can be overridden for a non-TikTok surface', () => {
  assert.equal(
    new URL(postUrl('x', { source: 'instagram' })).searchParams.get('utm_source'),
    'instagram',
  );
});
