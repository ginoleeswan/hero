// src/lib/analytics/events.ts — the event taxonomy, as types.
//
// Pure. No SDK import, so it is unit-testable and safe from anywhere.
//
// WHY A CLOSED TAXONOMY: analytics rots by accretion. Left to free-form
// strings, the same action gets logged as `daily_won`, `dailyWin` and
// `daily-complete` by three call sites six weeks apart, and the funnel that
// should answer "do people come back the next day" silently measures a third of
// the traffic. Naming the events in one place makes adding one a deliberate act
// and makes renaming one a compile error rather than a data problem.
//
// WHAT IS NOT HERE, ON PURPOSE: no hero names, no take bodies, no email, no
// display names, no free text of any kind. Ids and enums only. Analytics is the
// easiest place in an app to leak something you did not mean to, because nobody
// reads the payloads after the week they are added.

/** Every event the app may emit, with the exact shape of its properties. */
export interface EventMap {
  // ── the events that already existed (Vercel, web-only until now) ──
  // Names kept EXACTLY as they were. Renaming `matchup_vote` to `matchup_voted`
  // to match a newer convention would look tidier and would sever every event
  // from its own history in the dashboard — the cost of a rename is paid by the
  // question you cannot answer six months later, not by the diff.
  sign_up: { method: AuthMethod };
  log_in: { method: AuthMethod };
  matchup_vote: { authed: boolean; source?: MatchupSource };
  favourite_add: { hero_id: string };
  // The LENGTH, never the query. Whoever wrote this got it right first time:
  // search text is the single most revealing thing a reader types.
  search: { length: number };
  sponsor_impression: { promo: string; placement: string };
  sponsor_click: { promo: string; placement: string };

  // ── the daily loop, which is the whole retention story ──
  daily_opened: { streak: number };
  daily_guess: { attempt: number; correct: boolean };
  daily_finished: { won: boolean; attempts: number; streak: number };
  daily_shared: Record<string, never>;

  // ── the arena ──
  matchup_opened: { source: 'explore' | 'search' | 'character' | 'link' };
  take_posted: Record<string, never>;
  take_agreed: Record<string, never>;

  // ── the share funnel this week's work built ──
  share_started: { surface: ShareSurface; kind: 'link' | 'image' };
  share_completed: { surface: ShareSurface; kind: 'link' | 'image' };

  // ── acquisition, the half we have never been able to see ──
  deep_link_opened: { path_kind: PathKind; cold_start: boolean };

  // ── notifications ──
  notif_prompt_shown: Record<string, never>;
  notif_prompt_answered: { granted: boolean };
  notif_opened: { kind: 'streak_reminder' | 'daily_push' | 'unknown' };

  // ── discovery ──
  character_opened: { source: CharacterSource };

  // ── the ask ──
  review_prompt_requested: { trigger: 'daily_streak' | 'arena_finished' };
}

export type AuthMethod = 'password' | 'google' | 'apple';

export type MatchupSource = 'explore' | 'arena' | 'daily_debate' | 'web';

export type ShareSurface =
  | 'character'
  | 'arena'
  | 'daily_game'
  | 'daily_debate'
  | 'universe'
  | 'profile'
  | 'house'
  | 'event'
  | 'title';

export type PathKind =
  'character' | 'compare' | 'social-web' | 'house' | 'event' | 'title' | 'play' | 'other';

export type CharacterSource =
  'explore' | 'search' | 'spotlight' | 'category' | 'arena' | 'house' | 'title' | 'link' | 'other';

export type EventName = keyof EventMap;

/**
 * Classify a path for `deep_link_opened`.
 *
 * The SEGMENT, never the id. `/character/h_batman` tells us someone opened a
 * character; the id would tell us which, which is a thing about a person's
 * reading rather than about the product.
 */
export function pathKind(path: string): PathKind {
  const seg = path.replace(/^\//, '').split(/[/?#]/)[0];
  switch (seg) {
    case 'character':
    case 'compare':
    case 'social-web':
    case 'house':
    case 'event':
    case 'title':
    case 'play':
      return seg;
    default:
      return 'other';
  }
}

/**
 * A last line of defence: refuse a property that looks like free text.
 *
 * The taxonomy above is typed, so this should never fire — but types are a
 * build-time promise and a leak here is permanent, so the runtime checks too.
 * Long strings and anything shaped like an email are dropped rather than sent.
 */
export function scrubProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'string') {
      if (v.length > 64 || v.includes('@')) continue;
    }
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}
