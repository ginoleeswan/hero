// The Pulse composer — pure. Turns one ranked event from get_pulse_candidates
// into a queued post's title, caption and link, and refuses to emit a claim the
// data cannot support.
//
// Design: docs/superpowers/specs/2026-07-27-pulse-reach-design.md §2
// Ranking model + the copy discipline this follows: src/lib/home/pulse.ts
//
// WHY A SEPARATE PICKER RATHER THAN THE RAIL'S RANKER. The rail answers "order
// these N"; a post answers "is there one thing worth saying today, and which".
// Those are different questions and the second one is stricter — it has a
// shorter shelf life, no second slot to demote something into, and a cost when
// it is wrong. Mirroring rankPulse() into .mjs would buy nothing and add the
// repo's documented footgun (two copies of scored logic that drift silently).
// So: the same INPUT, a much simpler and more conservative rule.
//
// Everything here is pure so `node --test` covers it. I/O lives in
// pulse-post.mjs.
import { assertNoPortrait } from './ads/safe-assert.mjs';
import { DISCLAIMER } from './safety.mjs';

export const ORIGIN = 'https://mythique.app';

/** `issue` is deliberately absent. A weekly comic shipment is a schedule, not
 *  news; posting it because nothing else happened is how an account teaches
 *  people to ignore it. Same reasoning as MIN_NEWS_EVENTS in the rail. */
export const POST_KINDS = ['live_event', 'trailer', 'surge'];

/** Lower sorts first. Matches the rail's intent (live events pinned, trailers
 *  over surges) without importing its scoring. */
export const KIND_PRIORITY = { live_event: 0, trailer: 1, surge: 2 };

/**
 * How old a candidate may be, PER KIND — because `occurred_at` does not mean the
 * same thing for each.
 *
 * A trailer's `occurred_at` is an instant: the drop happened and is over. 120h
 * is the rail's own tuned trailer half-life — the point at which the app already
 * believes a trailer is worth half what it was — and past that an account
 * posting it is simply late.
 *
 * A surge's `occurred_at` is `surge_started_at`: the first day of a run that is
 * STILL RUNNING. The RPC nulls that column once the curve falls back, so a surge
 * appearing in the feed at all is a present-tense fact whatever its start date.
 * Age-gating it on the start date would refuse a live 11x surge for having begun
 * on Wednesday, which is not a thing that is wrong with it. The bound here is
 * the rail's own hard cutoff, kept only so nothing can live forever.
 *
 * A live event is judged by its window, not its age, and is absent from here.
 */
export const MAX_AGE_HOURS = { trailer: 120, surge: 24 * 14 };

/** Never post about the same event twice inside this many days. Longer than any
 *  candidate survives in the feed, so in practice: never twice. A live event's
 *  daily digest keys per day and is the intended exception. */
export const REPEAT_LOOKBACK_DAYS = 14;

/** A trailer or surge with no catalogue character behind it has nothing this app
 *  can say that a news account cannot say better. Mirrors MIN_CHARACTERS. */
export const MIN_CHARACTERS = 1;

const MS_PER_HOUR = 3_600_000;

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/** UTC date, YYYY-MM-DD. Every window in watched_events is a plain date. */
export function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Date.parse, hardened against how Postgres renders a timestamptz.
 *
 * Postgres writes a whole-hour UTC offset as `+00`, which ISO-8601 spells
 * `+00:00`. V8 tolerates that in its loose "2026-07-26 00:00:00+00" form and
 * returns NaN for the strict "2026-07-26T00:00:00+00" one — so the same instant
 * parses or does not depending on a separator no caller controls. A NaN here is
 * silent and total: `ageHours` goes null, every candidate fails `eligible`, and
 * the composer reports "nothing worth posting" forever.
 */
export function parseTs(s) {
  if (!s) return NaN;
  return Date.parse(
    String(s)
      .trim()
      .replace(' ', 'T')
      .replace(/([+-]\d{2})$/, '$1:00'),
  );
}

function ageHours(c, nowMs) {
  if (!c.occurred_at) return null;
  const t = parseTs(c.occurred_at);
  if (Number.isNaN(t)) return null;
  return (nowMs - t) / MS_PER_HOUR;
}

/** A live event is postable only while it is genuinely running. The rail gives
 *  a card a day of grace past `window_to` so detection lag cannot make an event
 *  vanish mid-convention; copy does not get that grace, because "live now" a day
 *  after the doors closed is simply false. */
export function isLive(c, nowMs) {
  if (!c.window_from) return false;
  const today = isoDay(nowMs);
  if (today < c.window_from) return false;
  return !c.window_to || today <= c.window_to;
}

/** Is this candidate worth a post at all, today? */
export function eligible(c, nowMs) {
  if (!POST_KINDS.includes(c.kind)) return false;
  if (c.kind === 'live_event') return isLive(c, nowMs);
  if ((c.character_count ?? 0) < MIN_CHARACTERS) return false;
  const age = ageHours(c, nowMs);
  return age !== null && age >= 0 && age <= MAX_AGE_HOURS[c.kind];
}

/** What the post is ABOUT, as a stable key — written to social_posts.source_key
 *  so tomorrow's run can tell it has already covered this. A live event is keyed
 *  per day: its daily digest is a legitimate repeat, everything else is not. */
export function sourceKeyFor(c, nowMs) {
  return c.kind === 'live_event' ? `${c.event_id}@${isoDay(nowMs)}` : c.event_id;
}

/** The single best thing to say today, or null for "say nothing".
 *  `posted` is the set of source keys already used inside the lookback. */
export function pickPost(candidates, nowMs, posted = new Set()) {
  const live = candidates
    .filter((c) => eligible(c, nowMs))
    .filter((c) => !posted.has(sourceKeyFor(c, nowMs)));
  if (!live.length) return null;
  return live.sort((a, b) => {
    const k = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    if (k) return k;
    // Within a kind: freshest, then the one the catalogue can illustrate best.
    const at = parseTs(a.occurred_at) || 0;
    const bt = parseTs(b.occurred_at) || 0;
    if (bt !== at) return bt - at;
    return (b.max_fame ?? 0) - (a.max_fame ?? 0);
  })[0];
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

const WORDS = [
  'no',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
];

/** Sentence-leading counts read as words; anything past twelve reads as a
 *  numeral, which is the normal English convention and not worth a table. */
export function count(n) {
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

export function joinNames(names) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Put the characters the film is NAMED AFTER first, keeping fame order within
 * each group.
 *
 * `hero_media_appearances.rank` looks like billing order and is not — for
 * Spider-Man: Brand New Day it reads 0, 0, 0, 1170, 2966. So the cast arrives
 * fame-ordered, and fame alone opened a Spider-Man post with Hulk, who ties him
 * at 100 and wins on id. Anyone reading that stops trusting the account on the
 * first line.
 *
 * Short names are excluded from the match: a two- or three-letter name is a
 * substring of far too many titles to mean anything.
 */
export function orderCast(cast, headline) {
  const title = String(headline ?? '').toLowerCase();
  const titular = (h) => {
    const n = String(h?.name ?? '');
    return n.length >= 4 && title.includes(n.toLowerCase());
  };
  return [...cast.filter(titular), ...cast.filter((h) => !titular(h))];
}

/** Whole days between a cause and the surge breaking out. */
function lagDays(c) {
  if (!c.cause_date || !c.occurred_at) return null;
  const cause = parseTs(`${c.cause_date}T00:00:00Z`);
  const started = parseTs(c.occurred_at);
  if (Number.isNaN(cause) || Number.isNaN(started)) return null;
  return Math.max(0, Math.round((started - cause) / 24 / MS_PER_HOUR));
}

/** The attribution sentence. TEMPORAL, NEVER CAUSAL — the join says two things
 *  happened near each other in time, which is not proof one caused the other.
 *  Same rule and the same phrasings as surgeCauseLabel() in src/lib/home/pulse.ts;
 *  the wording is duplicated but the discipline is enforced by assertSafeClaim,
 *  so a drifting copy fails the gate rather than shipping a stronger claim. */
export function causeClause(c) {
  if (!c.cause_label || !c.cause_kind) return null;
  // Tenseless on purpose. The row carries the event's start date but not its end,
  // so a present-tense "it is happening during San Diego Comic-Con" goes quietly
  // false the morning the doors close — and a surge outlives the convention that
  // set it off. "Started during" is true either way, and it matches the shape of
  // every other branch here.
  if (c.cause_kind === 'live_event') return `It started during ${c.cause_label}.`;
  const what = c.cause_kind === 'trailer' ? `${c.cause_label} trailer` : c.cause_label;
  if (c.cause_confidence === 'low') return `It started around the ${what}.`;
  const lag = lagDays(c);
  if (lag === null || lag <= 0) return `It started the day the ${what} landed.`;
  if (lag === 1) return `It started the day after the ${what}.`;
  return `It started ${lag} days after the ${what}.`;
}

/** The line that makes this account different from a news account: we are
 *  reporting a measurement and its timing, and saying out loud that timing is
 *  not cause. Only used when there is an attribution to qualify. */
export const TIMING_CAVEAT = 'We measure the timing, not the reason.';

function linkFor(c) {
  switch (c.kind) {
    case 'surge':
      return `${ORIGIN}/character/${encodeURIComponent(c.entity_id)}`;
    case 'trailer':
      return `${ORIGIN}/title/${encodeURIComponent(c.entity_id)}`;
    case 'live_event':
      return `${ORIGIN}/event/${encodeURIComponent(c.entity_id)}`;
    default:
      return ORIGIN;
  }
}

/** In-cinemas phrasing, matching the rail's subtitleFor so the app and the
 *  account never disagree about the same film on the same day. */
function releaseClause(c, nowMs) {
  if (!c.release_date) return c.provider ? `On ${c.provider}.` : null;
  const ms = parseTs(`${c.release_date}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  const days = Math.ceil((ms - nowMs) / 24 / MS_PER_HOUR);
  if (days > 1) return `In cinemas in ${days} days.`;
  if (days === 1) return 'In cinemas tomorrow.';
  if (days === 0) return 'In cinemas today.';
  return c.provider ? `On ${c.provider}.` : 'Out now.';
}

const para = (parts) => parts.filter(Boolean).join('\n\n');

/**
 * Compose the post body.
 *
 * @param candidate one row from get_pulse_candidates
 * @param cast      resolved catalogue characters, for a trailer (name-ordered by fame)
 * @param inWindow  other candidates inside a live event's window, for the digest
 * @param nowMs     clock
 */
export function composePost({ candidate: c, cast = [], inWindow = [], nowMs }) {
  const link = linkFor(c);
  let title;
  let body;

  if (c.kind === 'trailer') {
    const label = c.subtype === 'Teaser' ? 'teaser' : 'trailer';
    title = `New ${label} — ${c.headline}`;
    const names = orderCast(cast, c.headline).map((h) => h.name);
    const n = c.character_count ?? names.length;
    const castLine = names.length
      ? `${count(names.length)} of its characters have pages here: ${joinNames(names)}.`
      : n > 0
        ? `${count(n)} of its characters have pages here.`
        : null;
    body = para([`A ${label} for ${c.headline} is out.`, castLine, releaseClause(c, nowMs)]);
  } else if (c.kind === 'surge') {
    const mult = c.subtype ? `${c.subtype}×` : null;
    title = `${c.headline} is surging`;
    const cause = causeClause(c);
    const others = Math.max(0, (c.character_count ?? 1) - 1);
    body = para([
      mult
        ? `${c.headline} is being read ${mult} more than usual this week.`
        : `${c.headline} is being read far more than usual this week.`,
      cause ? `${cause} ${TIMING_CAVEAT}` : null,
      others > 0
        ? `${count(others)} other ${c.publisher ?? 'catalogue'} character${others === 1 ? '' : 's'} moved with ${c.headline}.`
        : null,
    ]);
  } else {
    const day = c.window_from
      ? Math.floor(
          (parseTs(`${isoDay(nowMs)}T00:00:00Z`) - parseTs(`${c.window_from}T00:00:00Z`)) /
            24 /
            MS_PER_HOUR,
        ) + 1
      : null;
    title = day ? `${c.headline} — day ${day}` : c.headline;
    const trailers = inWindow.filter((x) => x.kind === 'trailer');
    const surges = inWindow.filter((x) => x.kind === 'surge');
    body = para([
      `${c.headline} is on${day ? `, day ${day}` : ''}. Here is what the catalogue can see from it.`,
      trailers.length
        ? `${count(trailers.length)} trailer${trailers.length === 1 ? '' : 's'} dropped inside the window: ${joinNames(trailers.map((t) => t.headline))}.`
        : null,
      surges.length
        ? `${count(surges.length)} character${surges.length === 1 ? '' : 's'} started being read far more than usual: ${joinNames(surges.map((s) => s.headline))}.`
        : null,
      surges.length || trailers.length ? TIMING_CAVEAT : null,
    ]);
  }

  const caption = `${body}\n\n${link}\n\n${DISCLAIMER}`;
  return { title, caption, link, body };
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/** Language that asserts causation. The app joins a surge to a nearby event by
 *  DATE; nothing in that join supports "because". Every phrase here turns a
 *  defensible observation into a claim the data cannot carry. */
export const CAUSAL_PATTERNS = [
  [/\bbecause\b/i, 'asserts causation'],
  [/\bthanks to\b/i, 'asserts causation'],
  [/\bcaused? by\b/i, 'asserts causation'],
  [/\bdue to\b/i, 'asserts causation'],
  [/\bas a result of\b/i, 'asserts causation'],
  [/\b(?:drove|driving|sparked|triggered|fuelled|fueled)\b/i, 'asserts causation'],
  [/\bled to\b/i, 'asserts causation'],
  [/\bthat[' ]?s why\b/i, 'asserts causation'],
  [/\bsent .{0,24}(?:soaring|through the roof)\b/i, 'asserts causation'],
];

/** Language that asserts knowledge the app does not have. It reads Wikipedia
 *  pageviews, a TMDB video list and a ComicVine shipping schedule — it has no
 *  source inside a studio and must never sound like it does. */
export const OVERCLAIM_PATTERNS = [
  [/\b(?:confirm(?:ed|s)?|official(?:ly)?)\b/i, 'claims insider confirmation'],
  [/\b(?:leak(?:ed|s)?|exclusive|scoop)\b/i, 'claims insider knowledge'],
  [/\b(?:announce[ds]?|reveal(?:ed|s)?|first look)\b/i, 'claims to be reporting an announcement'],
  [/\b(?:biggest|best|greatest) ever\b/i, 'unverifiable superlative'],
  [/\b(?:everyone|the internet) is\b/i, 'unverifiable claim about people'],
  [/\byou wo?n[' ]?t believe\b/i, 'engagement bait'],
  [/\bbroke the internet\b/i, 'engagement bait'],
];

/** Instagram's caption ceiling. Past it the tail is silently truncated, which
 *  is exactly where the link and the disclaimer live. */
export const MAX_CAPTION_CHARS = 2200;

/**
 * The mandatory gate. Nothing reaches the queue without passing.
 *
 * On the ad track this delegates to the existing safe-assert, which bans remote
 * imagery from ad creative. Pulse posts are ORGANIC — safety.mjs is explicit
 * that organic posting is unrestricted for imagery, and a surge post without the
 * character's portrait is not a post — so the organic gate checks the thing that
 * is actually risky here: the claim.
 *
 * It fails CLOSED. A trailer whose own title contains a banned word ("Because of
 * Winn-Dixie") blocks that post rather than softening it, and the day passes
 * without one. Per the spec: a wrong claim published automatically is much more
 * expensive than a slow one.
 */
export function assertSafeClaim(post, { context = 'organic', html = null } = {}) {
  const label = `pulse post "${post.title}"`;
  const text = `${post.title}\n${post.caption}`;
  for (const [re, why] of [...CAUSAL_PATTERNS, ...OVERCLAIM_PATTERNS]) {
    const m = text.match(re);
    if (m) throw new Error(`[safe-claim] ${label}: "${m[0]}" ${why}`);
  }
  if (!post.caption.includes(post.link)) {
    throw new Error(`[safe-claim] ${label}: caption must link to the page it is about`);
  }
  if (!post.caption.includes(DISCLAIMER)) {
    throw new Error(`[safe-claim] ${label}: caption must carry the disclaimer`);
  }
  if (post.caption.length > MAX_CAPTION_CHARS) {
    throw new Error(
      `[safe-claim] ${label}: caption is ${post.caption.length} chars, over the ${MAX_CAPTION_CHARS} ceiling`,
    );
  }
  if (context === 'ad' && html) assertNoPortrait(html, label);
  return post;
}
