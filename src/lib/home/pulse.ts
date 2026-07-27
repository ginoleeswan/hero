// src/lib/home/pulse.ts — the Pulse rail's ranking model.
//
// One rail, mixed event types, newest-and-loudest first. Every card is a thing
// that HAPPENED at a knowable time, which is what lets the rail re-order itself
// as the world moves instead of restating the same states for months.
//
// A mixed feed needs one comparable score or the noisiest source wins forever:
//
//     score = weight(kind) × decay(age) × relevance
//     decay(h) = 2 ^ (−h / halfLife(kind))
//
// Expressed as a half-life per kind because that's the number worth arguing
// about: after `halfLife` hours an event is worth half as much as when it landed.
// Events with an explicit window (a convention) are PINNED above the curve for
// their duration — that's exactly what makes SDCC outrank a good trailer, and
// what makes it vanish cleanly when the window closes rather than lingering at a
// decayed-but-nonzero score.
//
// `relevance` gates on whether the catalogue can actually illustrate the event.
// Without it the rail inherits the Trending-Movers failure mode, where things
// nobody here recognises outrank things they do.
//
// Deliberately client-side rather than in SQL: this is the interesting part, and
// in SQL it would be the one part with no tests. get_pulse_candidates does the
// indexed recency selection; everything judgemental happens here.

import { relativeAgeLabel } from './freshness';

export type PulseKind = 'live_event' | 'trailer' | 'surge' | 'issue';

/** One row from get_pulse_candidates — facts only, no prebuilt copy. */
export interface PulseCandidate {
  kind: PulseKind;
  eventId: string;
  entityId: string;
  headline: string;
  subtype: string | null;
  imageUrl: string | null;
  accent: string | null;
  /** ISO-8601. A candidate without one can't be ranked and is dropped. */
  occurredAt: string | null;
  mediaKey: string | null;
  releaseDate: string | null;
  provider: string | null;
  publisher: string | null;
  characterCount: number;
  maxFame: number | null;
  /** The event's own window — live events only. Drives the day counter. */
  windowFrom?: string | null;
  windowTo?: string | null;
}

/** A ranked, display-ready card. */
export interface PulseEvent extends PulseCandidate {
  /** Hours since it happened. 0 for a pinned live event. */
  ageHours: number;
  /** e.g. "3H AGO". Null for a live event, which says "ON NOW" instead. */
  ageLabel: string | null;
  /** The card's badge — "New Trailer", "Live · SDCC", "On shelves". */
  badge: string;
  /** The "so what" second line. */
  subtitle: string | null;
  /** "DAY 4 OF 4" / "FINAL DAY" / "DAY 2". Live events with a known window only,
   *  and null once the window has closed. */
  dayLabel: string | null;
  /** "Live" while it's running, "Just wrapped" in the detection grace tail.
   *  Live events only. */
  statusLabel: string | null;
  score: number;
}

// ── the model ────────────────────────────────────────────────────────────────

/** Relative importance per kind, before decay. A trailer is the benchmark. */
export const KIND_WEIGHT: Record<PulseKind, number> = {
  // Pinned rather than weighted — see PIN_SCORE.
  live_event: 1,
  trailer: 1,
  // A surge is the audience telling us something happened, rather than a studio
  // announcing it. Slightly under a trailer: it's a second-order signal, and the
  // thing that caused it is usually a trailer we're also showing.
  surge: 0.85,
  // Real news, but a weekly cadence everyone expects; it shouldn't crowd out a
  // trailer that landed this morning.
  issue: 0.55,
};

/**
 * Hours after which an event of this kind is worth half as much.
 *
 * The trailer figure was 48h, set when the catalogue held no upcoming titles and
 * a trailer arrived every few weeks. Once the slate was ingested (2026-07-27)
 * that number was measurably wrong: trailers halved twice as fast as issues, so
 * a seven-day-old Avengers: Doomsday trailer scored 0.088 against a four-day-old
 * comic's 0.5, and the 0.55 issue weight nowhere near closed a 5.7x gap. The
 * single biggest story in the catalogue sat in the database and off the rail.
 *
 * 120h puts a week-old trailer at ~0.33 — still decaying visibly, still beaten
 * by anything from today, but no longer buried under the weekly shipment.
 */
export const KIND_HALF_LIFE: Record<PulseKind, number> = {
  live_event: Infinity, // pinned; never decays inside its window
  trailer: 120,
  // Attention decays on its own — surge_started_at already stops returning a date
  // once the curve falls back to baseline, so this only shapes ordering while the
  // surge is genuinely still running.
  surge: 96,
  issue: 96,
};

/** Live events sort above everything by construction. A very large constant
 *  rather than an ordering special-case, so one comparator handles every kind. */
export const PIN_SCORE = 1_000_000;

/** Beyond this an event is history, whatever it scores. */
export const MAX_AGE_HOURS = 24 * 14;

/** Relevance floor. An event with no catalogue characters with art can't be
 *  rendered as a Mythique card, so it isn't news here. Issues are exempt: a comic
 *  cover illustrates itself. */
export const MIN_CHARACTERS = 1;

/**
 * Per-kind ceiling on the rail, because score alone can't defend against volume.
 *
 * Measured against the first real production payload (2026-07-26): 20 issues, 2
 * trailers, 1 live event. Comics ship ~20 at a time on a Wednesday, so a dozen of
 * them sit at 3-4 days old scoring ~0.28 — which beat a 6-day-old trailer at
 * 0.12 and pushed it off the rail entirely. The rail rendered 1 event + 1 trailer
 * + 10 comics.
 *
 * That's the ComicCoverRail with timestamps, and the band already renders a full
 * ComicCoverRail directly below. A regular weekly cadence must not crowd out the
 * irregular things the rail exists to report, however fresh the cadence is.
 *
 * Live events and trailers are uncapped: there are only ever a handful, and they
 * are the point.
 */
export const KIND_CAP: Record<PulseKind, number> = {
  live_event: Infinity,
  trailer: Infinity,
  // Grouped by publisher upstream, so each card is already a whole franchise
  // moment rather than one character. Two is a rail that reports what the
  // audience is doing; more is a leaderboard.
  surge: 2,
  issue: 3,
};

/**
 * The rail needs at least this many non-issue events to appear at all.
 *
 * With zero, "Just Happened" would be three comic covers — strictly worse than
 * the dedicated comics rail sitting below it, and a claim that something happened
 * when the only thing that happened is the weekly shipment. Fail toward silence.
 */
export const MIN_NEWS_EVENTS = 1;

const MS_PER_HOUR = 3_600_000;

/** 2 ^ (−age / halfLife). 1 at age 0, 0.5 at one half-life, and exactly 1 for a
 *  pinned kind (Infinity half-life). */
export function decay(ageHours: number, halfLifeHours: number): number {
  if (!Number.isFinite(halfLifeHours)) return 1;
  if (halfLifeHours <= 0) return 0;
  return Math.pow(2, -Math.max(0, ageHours) / halfLifeHours);
}

/** Can the catalogue illustrate this? Scales with cast size (saturating) and the
 *  fame of its most recognisable character. */
export function relevance(c: PulseCandidate): number {
  if (c.kind === 'issue') {
    // The cover carries it; cast only sweetens.
    const fame = (c.maxFame ?? 50) / 100;
    return 0.6 + 0.4 * Math.min(1, c.characterCount / 4) * Math.max(0.2, fame);
  }
  if (c.characterCount < MIN_CHARACTERS) return 0;
  // Saturating: six recognisable characters isn't six times one.
  const breadth = Math.min(1, c.characterCount / 6);
  const fame = Math.max(0.2, (c.maxFame ?? 50) / 100);
  return 0.5 + 0.5 * breadth * fame;
}

/** The comparable score. 0 means "don't surface". */
export function scoreCandidate(c: PulseCandidate, now: number): number {
  const at = c.occurredAt === null ? NaN : Date.parse(c.occurredAt);
  if (Number.isNaN(at)) return 0;
  // A live event is pinned regardless of when it was first detected.
  if (c.kind === 'live_event') return PIN_SCORE;
  const ageHours = Math.max(0, (now - at) / MS_PER_HOUR);
  if (ageHours > MAX_AGE_HOURS) return 0;
  const rel = relevance(c);
  if (rel <= 0) return 0;
  return KIND_WEIGHT[c.kind] * decay(ageHours, KIND_HALF_LIFE[c.kind]) * rel;
}

// ── copy ─────────────────────────────────────────────────────────────────────

/**
 * How far past the end of the window we still treat an event as running.
 *
 * get_live_events keeps an `ongoing` row for three days after `live_to` so the
 * 1-2 day Wikipedia pageview lag can't retire a convention that's still on. That
 * grace is right for DETECTION and wrong for COPY: on 2026-07-27 it had the card
 * reading "LIVE · DAY 5" for a three-day convention that ended on the 25th —
 * a claim anyone could disprove with one search.
 *
 * One day of tolerance keeps the lag protection (the window really can trail
 * reality by a day); beyond that the event has ended and the card should say so.
 */
const WINDOW_LAG_GRACE_DAYS = 1;

export type EventPhase = 'live' | 'wrapped';

/** Whether the event is still running, given the inferred window. Unknown or
 *  not-yet-started windows read as `live`, matching the previous behaviour. */
export function eventPhase(
  windowFrom: string | null | undefined,
  windowTo: string | null | undefined,
  now: number,
): EventPhase {
  if (!windowTo) return 'live';
  const end = Date.parse(`${windowTo}T00:00:00Z`);
  if (Number.isNaN(end)) return 'live';
  const today = Math.floor(now / 86_400_000);
  const endDay = Math.floor(end / 86_400_000);
  return today > endDay + WINDOW_LAG_GRACE_DAYS ? 'wrapped' : 'live';
}

/** The card's status word. "Live" only while it actually is. */
export function eventStatusLabel(
  windowFrom: string | null | undefined,
  windowTo: string | null | undefined,
  now: number,
): string {
  return eventPhase(windowFrom, windowTo, now) === 'wrapped' ? 'Just wrapped' : 'Live';
}

/**
 * Where we are inside a running event — "DAY 4 OF 4", "FINAL DAY", "DAY 2".
 *
 * "Happening now" is true but static. A counter that advances is what makes a
 * live card read as live rather than merely labelled, and it's the one piece of
 * urgency a convention card can honestly carry. Null when the window is unknown
 * or nonsensical, so the caller shows nothing rather than "DAY NAN".
 *
 * Also null once the event has wrapped: a day number is a claim about something
 * in progress, and there's nothing honest to count once it isn't.
 */
export function eventDayLabel(
  windowFrom: string | null | undefined,
  windowTo: string | null | undefined,
  now: number,
): string | null {
  if (!windowFrom) return null;
  if (eventPhase(windowFrom, windowTo, now) === 'wrapped') return null;
  const start = Date.parse(`${windowFrom}T00:00:00Z`);
  if (Number.isNaN(start)) return null;
  const today = Math.floor(now / 86_400_000);
  const startDay = Math.floor(start / 86_400_000);
  const day = today - startDay + 1;
  if (day < 1) return null;

  const end = windowTo ? Date.parse(`${windowTo}T00:00:00Z`) : NaN;
  if (Number.isNaN(end)) return `DAY ${day}`;
  const total = Math.floor(end / 86_400_000) - startDay + 1;
  if (total < 1) return `DAY ${day}`;
  // Inside the lag grace: the window may trail reality by a day, so don't invent
  // a bigger total — call it the final day rather than "DAY 4 OF 3".
  if (day >= total) return 'FINAL DAY';
  return `DAY ${day} OF ${total}`;
}

/** The card's badge. Short, and it carries the *kind* so the rail reads at a
 *  glance without a legend. */
export function badgeFor(c: PulseCandidate): string {
  switch (c.kind) {
    case 'live_event':
      return 'Live now';
    case 'trailer':
      return c.subtype === 'Teaser' ? 'New teaser' : 'New trailer';
    case 'surge':
      return 'Surging';
    case 'issue':
      return 'On shelves';
  }
}

/** The "so what" line: an event paired with its consequence. Null when there's
 *  nothing honest to add — an empty line beats a padded one. */
export function subtitleFor(c: PulseCandidate, now: number): string | null {
  if (c.kind === 'live_event') return c.headline === null ? null : 'Happening now';
  if (c.kind === 'issue') {
    return c.subtype ? `#${c.subtype}` : (c.publisher ?? null);
  }
  if (c.kind === 'surge') {
    // subtype carries the group's loudest multiple, characterCount its size.
    // "and 9 others" is the part that makes it a franchise moment rather than
    // one character having a day.
    // Kept tight: the meta row is "5D AGO · <this>" on a 208px card, and
    // "and 10 more" truncated to "and 10 m…" in production.
    const others = Math.max(0, c.characterCount - 1);
    const lift = c.subtype ? `${c.subtype}\u00d7 reads` : 'Surging';
    return others > 0 ? `${lift} · +${others} more` : lift;
  }
  // Trailer: pair the drop with the release it's advertising.
  if (c.releaseDate) {
    const ms = Date.parse(`${c.releaseDate}T00:00:00Z`);
    if (!Number.isNaN(ms)) {
      const days = Math.ceil((ms - now) / (24 * MS_PER_HOUR));
      if (days > 1) return `In cinemas in ${days} days`;
      if (days === 1) return 'In cinemas tomorrow';
      if (days === 0) return 'In cinemas today';
      if (c.provider) return `On ${c.provider}`;
      return 'In cinemas now';
    }
  }
  return c.provider ? `On ${c.provider}` : null;
}

// ── ranking ──────────────────────────────────────────────────────────────────

/**
 * Score, filter, de-duplicate and cap. Pure and clock-injectable.
 *
 * De-duplication is by `entityId`, not `eventId`: a title that dropped a teaser
 * and a trailer in the same week is one story, and showing it twice makes a short
 * rail look thin. The highest-scoring card for an entity wins.
 */
export function rankPulse(
  candidates: readonly PulseCandidate[],
  now: number = Date.now(),
  limit = 12,
): PulseEvent[] {
  const scored: PulseEvent[] = [];
  for (const c of candidates) {
    const score = scoreCandidate(c, now);
    if (score <= 0) continue;
    const at = Date.parse(c.occurredAt as string);
    const ageHours = c.kind === 'live_event' ? 0 : Math.max(0, (now - at) / MS_PER_HOUR);
    scored.push({
      ...c,
      score,
      ageHours,
      ageLabel: c.kind === 'live_event' ? null : relativeAgeLabel(ageHours),
      badge: badgeFor(c),
      subtitle: subtitleFor(c, now),
      dayLabel: c.kind === 'live_event' ? eventDayLabel(c.windowFrom, c.windowTo, now) : null,
      statusLabel: c.kind === 'live_event' ? eventStatusLabel(c.windowFrom, c.windowTo, now) : null,
    });
  }

  scored.sort((a, b) => b.score - a.score || Date.parse(b.occurredAt!) - Date.parse(a.occurredAt!));

  const seen = new Set<string>();
  const taken: Record<PulseKind, number> = { live_event: 0, trailer: 0, surge: 0, issue: 0 };
  const out: PulseEvent[] = [];
  for (const e of scored) {
    if (seen.has(e.entityId)) continue;
    // Volume gate, not a score gate — see KIND_CAP. Skip rather than break, so a
    // lower-scoring trailer still gets the slot a surplus comic would have taken.
    if (taken[e.kind] >= KIND_CAP[e.kind]) continue;
    seen.add(e.entityId);
    taken[e.kind]++;
    out.push(e);
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * What the rail can actually put on screen, as opposed to what ranked.
 *
 * Two rules, both learned from the first render:
 *
 * 1. **A media event with no artwork can't be a card.** It becomes a flat colour
 *    block beside real cover art and reads as a broken image. This catches a
 *    trailer whose title has neither backdrop nor poster.
 *
 *    Live events are exempt: they never have art (`watched_events` stores none,
 *    and Wikipedia's lead image is *absent* for San Diego Comic-Con and a crowd
 *    photo or bare logo for the rest), so they get a purpose-built card treatment
 *    instead of a poster they'll never have. Filtering them out here would only
 *    hide the design problem.
 * 2. **Nothing but comics isn't news.** The band renders a dedicated
 *    `ComicCoverRail` below; three covers under a "Just Happened" heading is
 *    strictly worse than it, and claims something happened when the only thing
 *    that happened is the weekly shipment.
 *
 * Kept here rather than in either rail so both platforms can't drift.
 */
export function railEvents(events: readonly PulseEvent[]): PulseEvent[] {
  const withArt = events.filter((e) => e.kind === 'live_event' || !!e.imageUrl);
  const news = withArt.filter((e) => e.kind !== 'issue').length;
  return news >= MIN_NEWS_EVENTS ? withArt : [];
}

/** The live event in a ranked list, if any — what the band header's "· LIVE"
 *  label keys off. */
export function livePulseEvent(events: readonly PulseEvent[]): PulseEvent | null {
  return events.find((e) => e.kind === 'live_event') ?? null;
}

/** Trailer drops in the shape the auto-hero picker wants, so the hero and the
 *  rail agree on what today's news is instead of querying it twice. */
export function trailerPicks(
  events: readonly PulseEvent[],
): { titleId: string; publishedAt: string; videoType: string | null }[] {
  return events
    .filter((e) => e.kind === 'trailer' && e.occurredAt !== null)
    .map((e) => ({
      titleId: e.entityId,
      publishedAt: e.occurredAt as string,
      videoType: e.subtype,
    }));
}
