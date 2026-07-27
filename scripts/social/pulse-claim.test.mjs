import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickPost,
  eligible,
  isLive,
  sourceKeyFor,
  composePost,
  causeClause,
  assertSafeClaim,
  count,
  orderCast,
  joinNames,
  MAX_AGE_HOURS,
  TIMING_CAVEAT,
  MAX_CAPTION_CHARS,
} from './pulse-claim.mjs';

const NOW = Date.parse('2026-07-27T12:00:00Z');
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();

// Shapes taken from a real get_pulse_candidates response, 2026-07-27.
const trailer = {
  kind: 'trailer',
  event_id: 'video:tLkx4BNsSiM',
  entity_id: 'tmdb:969681',
  headline: 'Spider-Man: Brand New Day',
  subtype: 'Teaser',
  occurred_at: hoursAgo(24),
  media_key: 'tLkx4BNsSiM',
  release_date: '2026-07-28',
  character_count: 5,
  max_fame: 100,
  image_url: 'https://img/poster.jpg',
};
const surge = {
  kind: 'surge',
  event_id: 'surge:Mattel',
  entity_id: 'cv-16423',
  headline: 'He-Man',
  subtype: '11.0',
  occurred_at: '2026-07-26T00:00:00+00',
  publisher: 'Mattel',
  character_count: 12,
  max_fame: 94,
  cause_kind: 'trailer',
  cause_label: 'Masters of the Universe',
  cause_date: '2026-07-24',
  cause_confidence: 'high',
};
const issue = {
  kind: 'issue',
  event_id: 'issue:cvi:1181826',
  entity_id: 'cvi:1181826',
  headline: 'Void Rivals',
  subtype: '32',
  occurred_at: hoursAgo(12),
  character_count: 4,
};
const event = {
  kind: 'live_event',
  event_id: 'event:sdcc',
  entity_id: 'sdcc',
  headline: 'San Diego Comic-Con',
  occurred_at: hoursAgo(2),
  window_from: '2026-07-25',
  window_to: '2026-07-28',
  character_count: 0,
};

// --- selection -------------------------------------------------------------

test('issues are never postable — a shipping schedule is not news', () => {
  assert.equal(eligible(issue, NOW), false);
  assert.equal(pickPost([issue], NOW), null);
});

test('a quiet feed produces no post at all', () => {
  assert.equal(pickPost([], NOW), null);
  assert.equal(pickPost([issue, issue], NOW), null);
});

test('a live event outranks a fresher trailer', () => {
  assert.equal(pickPost([trailer, surge, event, issue], NOW).kind, 'live_event');
});

test('a trailer outranks a surge, and freshest wins within a kind', () => {
  assert.equal(pickPost([surge, trailer], NOW).kind, 'trailer');
  const older = { ...trailer, event_id: 'video:old', occurred_at: hoursAgo(60) };
  assert.equal(pickPost([older, trailer], NOW).event_id, trailer.event_id);
});

test('a stale trailer is not news — a drop is an instant and it is over', () => {
  assert.equal(
    eligible({ ...trailer, occurred_at: hoursAgo(MAX_AGE_HOURS.trailer + 1) }, NOW),
    false,
  );
  assert.equal(
    eligible({ ...trailer, occurred_at: hoursAgo(MAX_AGE_HOURS.trailer - 1) }, NOW),
    true,
  );
});

test('a surge that began days ago is still postable — it is still happening', () => {
  // surge_started_at is the first day of a run the RPC nulls out once the curve
  // falls back, so a surge in the feed is present-tense whatever its start date.
  // Gating it like a trailer refused a live 11x surge for having begun on
  // Wednesday, which is not a thing that is wrong with it.
  assert.equal(eligible({ ...surge, occurred_at: hoursAgo(134) }, NOW), true);
  assert.equal(eligible({ ...surge, occurred_at: hoursAgo(MAX_AGE_HOURS.surge + 1) }, NOW), false);
});

test('a trailer with no catalogue character is dropped — nothing to add', () => {
  assert.equal(eligible({ ...trailer, character_count: 0 }, NOW), false);
});

test('a wrapped event is not live, even one day out — copy gets no grace', () => {
  assert.equal(isLive({ ...event, window_to: '2026-07-26' }, NOW), false);
  assert.equal(isLive({ ...event, window_to: '2026-07-27' }, NOW), true);
  assert.equal(isLive({ ...event, window_from: '2026-08-01' }, NOW), false);
  assert.equal(isLive({ ...event, window_to: null }, NOW), true);
});

test('an event already posted about is skipped; the next-best is chosen', () => {
  const posted = new Set([sourceKeyFor(event, NOW)]);
  assert.equal(pickPost([event, trailer], NOW, posted).kind, 'trailer');
  posted.add(sourceKeyFor(trailer, NOW));
  assert.equal(pickPost([event, trailer], NOW, posted), null);
});

test('a live event keys per day so its digest may repeat; nothing else may', () => {
  const tomorrow = NOW + 86_400_000;
  assert.notEqual(sourceKeyFor(event, NOW), sourceKeyFor(event, tomorrow));
  assert.equal(sourceKeyFor(trailer, NOW), sourceKeyFor(trailer, tomorrow));
});

// --- copy ------------------------------------------------------------------

test('attribution is temporal, never causal', () => {
  assert.equal(causeClause(surge), 'It started 2 days after the Masters of the Universe trailer.');
  assert.equal(
    causeClause({ ...surge, cause_date: '2026-07-25' }),
    'It started the day after the Masters of the Universe trailer.',
  );
  assert.equal(
    causeClause({ ...surge, cause_date: '2026-07-26' }),
    'It started the day the Masters of the Universe trailer landed.',
  );
  assert.equal(
    causeClause({ ...surge, cause_confidence: 'low' }),
    'It started around the Masters of the Universe trailer.',
  );
  assert.equal(
    causeClause({ ...surge, cause_kind: 'live_event', cause_label: 'San Diego Comic-Con' }),
    'It started during San Diego Comic-Con.',
  );
  assert.equal(causeClause({ ...surge, cause_label: null }), null);
});

test('a surge post carries the multiple, the timing and the caveat', () => {
  const post = composePost({ candidate: surge, nowMs: NOW });
  assert.match(post.caption, /He-Man is being read 11\.0× more than usual this week\./);
  assert.match(post.caption, /It started 2 days after the Masters of the Universe trailer\./);
  assert.ok(post.caption.includes(TIMING_CAVEAT));
  assert.match(post.caption, /Eleven other Mattel characters moved with He-Man\./);
  assert.ok(post.caption.includes('https://mythique.app/character/cv-16423'));
});

test('a surge with nothing to point at drops the caveat rather than padding', () => {
  const bare = { ...surge, cause_kind: null, cause_label: null, character_count: 1 };
  const post = composePost({ candidate: bare, nowMs: NOW });
  assert.ok(!post.caption.includes(TIMING_CAVEAT));
  assert.ok(!post.caption.includes('moved with'));
});

test('a trailer post names the catalogue characters — the actual differentiator', () => {
  // Fame order as it really arrives: Hulk ties Spider-Man at 100 and wins on id.
  const cast = [{ name: 'Hulk' }, { name: 'Spider-Man' }, { name: 'Punisher' }];
  const post = composePost({ candidate: trailer, cast, nowMs: NOW });
  assert.equal(post.title, 'New teaser — Spider-Man: Brand New Day');
  assert.match(
    post.caption,
    /Three of its characters have pages here: Spider-Man, Hulk and Punisher\./,
  );
  assert.match(post.caption, /In cinemas tomorrow\./);
  assert.ok(post.caption.includes('https://mythique.app/title/tmdb%3A969681'));
});

test('a trailer post falls back to the count when no names resolve', () => {
  const post = composePost({ candidate: trailer, cast: [], nowMs: NOW });
  assert.match(post.caption, /Five of its characters have pages here\./);
});

test('a live-event post digests what the catalogue saw inside the window', () => {
  const post = composePost({ candidate: event, inWindow: [trailer, surge], nowMs: NOW });
  assert.equal(post.title, 'San Diego Comic-Con — day 3');
  assert.match(post.caption, /One trailer dropped inside the window: Spider-Man: Brand New Day\./);
  assert.match(post.caption, /One character started being read far more than usual: He-Man\./);
  assert.ok(post.caption.includes('https://mythique.app/event/sdcc'));
});

test('the film leads with the character it is named after, not the famous one', () => {
  const cast = [{ name: 'Hulk' }, { name: 'Spider-Man' }, { name: 'Scorpion' }];
  assert.deepEqual(
    orderCast(cast, 'Spider-Man: Brand New Day').map((h) => h.name),
    ['Spider-Man', 'Hulk', 'Scorpion'],
  );
  // No titular match: fame order survives untouched.
  assert.deepEqual(
    orderCast(cast, 'Avengers: Doomsday').map((h) => h.name),
    ['Hulk', 'Spider-Man', 'Scorpion'],
  );
  // A short name is a substring of too much to mean anything.
  assert.deepEqual(
    orderCast([{ name: 'Hulk' }, { name: 'Ka' }], 'Kaiju No. 8').map((h) => h.name),
    ['Hulk', 'Ka'],
  );
});

test('count and joinNames read as English', () => {
  assert.equal(count(1), 'One');
  assert.equal(count(12), 'Twelve');
  assert.equal(count(13), '13');
  assert.equal(joinNames(['A']), 'A');
  assert.equal(joinNames(['A', 'B']), 'A and B');
  assert.equal(joinNames(['A', 'B', 'C']), 'A, B and C');
});

// --- the gate --------------------------------------------------------------

const pass = (candidate, extra = {}) =>
  assertSafeClaim(composePost({ candidate, nowMs: NOW, ...extra }));

test('every composed post passes its own gate', () => {
  pass(surge);
  pass(trailer, { cast: [{ name: 'Spider-Man' }, { name: 'Hulk' }] });
  pass(event, { inWindow: [trailer, surge] });
  pass({ ...surge, cause_confidence: 'low' });
  pass({ ...surge, cause_kind: 'live_event', cause_label: 'San Diego Comic-Con' });
});

test('the disclaimer does not trip the "official" rule on its own "Unofficial"', () => {
  const post = composePost({ candidate: surge, nowMs: NOW });
  assert.ok(post.caption.includes('Unofficial fan encyclopedia'));
  assert.doesNotThrow(() => assertSafeClaim(post));
});

for (const [why, text] of [
  ['because', 'He-Man is surging because of the trailer.'],
  ['thanks to', 'Reads are up thanks to the new trailer.'],
  ['due to', 'The spike is due to the announcement window.'],
  ['drove', 'The trailer drove a 10x spike in reads.'],
  ['sparked', 'The teaser sparked a wave of interest.'],
  ['led to', 'The drop led to a surge in reads.'],
  ["that's why", "The trailer landed Monday. That's why he is surging."],
  ['sent soaring', 'The trailer sent his page views soaring.'],
]) {
  test(`the gate refuses causal language: ${why}`, () => {
    assert.throws(
      () => assertSafeClaim({ title: 'x', caption: `${text}\n\nlink`, link: 'link' }),
      /asserts causation/,
    );
  });
}

for (const [why, text] of [
  ['confirmed', 'Marvel confirmed the cast today.'],
  ['official', 'The official synopsis is out.'],
  ['leaked', 'A leaked still shows the suit.'],
  ['exclusive', 'An exclusive first look at the villain.'],
  ['announced', 'Marvel announced the film this morning.'],
  ['revealed', 'The trailer revealed a new villain.'],
  ['biggest ever', 'The biggest ever spike in our data.'],
  ['everyone is', 'Everyone is reading about He-Man today.'],
  ['bait', "You won't believe what is surging."],
]) {
  test(`the gate refuses overclaim: ${why}`, () => {
    assert.throws(
      () => assertSafeClaim({ title: 'x', caption: `${text}\n\nlink`, link: 'link' }),
      /\[safe-claim\]/,
    );
  });
}

test('the gate refuses a post that does not land anywhere', () => {
  const post = composePost({ candidate: surge, nowMs: NOW });
  assert.throws(
    () => assertSafeClaim({ ...post, caption: post.caption.replace(post.link, '') }),
    /must link to the page/,
  );
});

test('the gate requires the disclaimer', () => {
  const post = composePost({ candidate: surge, nowMs: NOW });
  assert.throws(
    () => assertSafeClaim({ ...post, caption: post.caption.replace(/Unofficial.*$/s, '') }),
    /must carry the disclaimer/,
  );
});

test('the gate refuses a caption long enough to truncate the link away', () => {
  const post = composePost({ candidate: surge, nowMs: NOW });
  assert.throws(
    () => assertSafeClaim({ ...post, caption: 'x'.repeat(MAX_CAPTION_CHARS) + post.caption }),
    /over the 2200 ceiling/,
  );
});

test('the gate fails closed on a title it cannot vet, rather than softening it', () => {
  // "Because of Winn-Dixie" is a real film. The composer would interpolate it
  // into a caption containing the word "because", and the honest outcome is a
  // quiet day rather than a post nobody vetted.
  const awkward = { ...trailer, headline: 'Because of Winn-Dixie', subtype: 'Trailer' };
  assert.throws(
    () => assertSafeClaim(composePost({ candidate: awkward, nowMs: NOW })),
    /asserts causation/,
  );
});
