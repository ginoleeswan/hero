// src/lib/query/persist.ts — what survives closing the app, and what does not.
//
// The app already KNEW it was offline: useIsOffline, OfflineBanner and
// appOnline.ts have been wiring connectivity into React Query for a while. All
// of that only ever went as far as telling the reader the app was broken. The
// cache was memory-only, so quitting the app threw away everything.
//
// That is the wrong shape for an encyclopedia. This is the app you open on the
// Tube, on a plane, in a basement at a convention — exactly where it used to
// show a banner and nothing else. A reference app that needs signal to show you
// the character you read yesterday is not really a reference app.
//
// NATIVE ONLY. On the web this is a website: it has a service worker for
// assets, localStorage is a fraction of the size, and a stale page served to a
// browser that could simply have refetched is a worse trade than a cold load.
// Offline matters where the app is installed, not where it is visited.
import { Platform } from 'react-native';
import type { Query } from '@tanstack/react-query';

/**
 * How long a restored cache is allowed to be trusted.
 *
 * A week, because the catalogue barely moves — a character's powers and first
 * appearance are the same in seven days — and because the alternative to a
 * week-old page is a blank screen. Anything genuinely live (a vote tally, the
 * daily puzzle) is excluded below rather than aged out here.
 */
export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

/**
 * Query roots worth carrying across launches.
 *
 * Deliberately an ALLOWLIST. A denylist would mean every new query is persisted
 * by default and someone has to remember to opt a private or a live one out —
 * which is the same accretion problem the analytics taxonomy exists to avoid.
 * Being wrong here writes someone's reading to disk, so the default is no.
 */
const PERSIST_ROOTS = new Set(['heroes', 'explore', 'teams', 'comics', 'houses', 'events']);

/**
 * Keys that must NEVER outlive the session, checked against the SECOND segment.
 *
 *  • search   — a query someone typed. The single most revealing thing in the
 *               app, and the one we already refuse to send to analytics; it has
 *               no business being written to disk either.
 *  • takes / verdict — community content that changes under you; a week-old
 *               take count shown as current is a small lie.
 *  • matchup / debateYesterday — the daily loop. Restoring yesterday's matchup
 *               as today's is worse than showing nothing.
 */
const NEVER_PERSIST = new Set(['search', 'takes', 'verdict', 'matchup', 'debateYesterday']);

/**
 * `profile` is excluded wholesale rather than by segment: it is per-account, it
 * includes another person's data on nobody's device but theirs, and a stale
 * profile is the one screen where being wrong is obvious to the reader.
 */
export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  // Never persist a failure. A restored error state renders as a broken screen
  // with no way to retry until something invalidates it.
  if (query.state.status !== 'success') return false;

  const [root, second] = query.queryKey as unknown[];
  if (typeof root !== 'string') return false;
  if (!PERSIST_ROOTS.has(root)) return false;
  if (typeof second === 'string' && NEVER_PERSIST.has(second)) return false;
  return true;
}

/** Web keeps its service worker; this is for the installed app. */
export const persistenceEnabled = Platform.OS !== 'web';
