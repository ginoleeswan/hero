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

export type PulseKind = 'live_event' | 'trailer' | 'issue';

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
  score: number;
}

// ── the model ────────────────────────────────────────────────────────────────

/** Relative importance per kind, before decay. A trailer is the benchmark. */
export const KIND_WEIGHT: Record<PulseKind, number> = {
  // Pinned rather than weighted — see PIN_SCORE.
  live_event: 1,
  trailer: 1,
  // Real news, but a weekly cadence everyone expects; it shouldn't crowd out a
  // trailer that landed this morning.
  issue: 0.55,
};

/** Hours after which an event of this kind is worth half as much. */
export const KIND_HALF_LIFE: Record<PulseKind, number> = {
  live_event: Infinity, // pinned; never decays inside its window
  trailer: 48,
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

/** The card's badge. Short, and it carries the *kind* so the rail reads at a
 *  glance without a legend. */
export function badgeFor(c: PulseCandidate): string {
  switch (c.kind) {
    case 'live_event':
      return 'Live now';
    case 'trailer':
      return c.subtype === 'Teaser' ? 'New teaser' : 'New trailer';
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
    });
  }

  scored.sort((a, b) => b.score - a.score || Date.parse(b.occurredAt!) - Date.parse(a.occurredAt!));

  const seen = new Set<string>();
  const out: PulseEvent[] = [];
  for (const e of scored) {
    if (seen.has(e.entityId)) continue;
    seen.add(e.entityId);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
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
