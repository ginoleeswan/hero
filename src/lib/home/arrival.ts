// src/lib/home/arrival.ts
// What was the visitor watching before they got here?
//
// Measured 2026-08-16: of 2,466 sessions that arrived from TikTok, 2,464 landed
// on `/` or `/explore` and left at 1.1 pages per session, while visitors who
// reached a character page read 4.3 of them. Social captions now deep-link to
// their subject, which fixes the common case — but a link is not a guarantee.
// TikTok's in-app browser and every link shortener strip or rewrite paths, and a
// caption URL can simply be scrolled past while the profile-bio link is tapped
// instead. In all of those the visitor still arrives at the feed.
//
// So the post also carries its subject in `utm_content`, which survives as a
// query parameter far more reliably than a path does, and the landing surface
// uses it to put the right thing first.
//
// This module is only the RESOLVER, and it is pure so the parsing is testable:
// deciding whether an attribution names something we can show is entirely a
// question about strings, and it should not need a database or a browser to
// answer.

/** A subject named by a landing, resolved to something the feed can lead with. */
export interface ArrivalSubject {
  kind: 'hero';
  id: string;
}

/**
 * Hero ids in this catalogue take three shapes, and the reason this function
 * exists rather than a bare truthiness check is that `utm_content` is an
 * attacker-and-typo-reachable string that we are about to turn into a database
 * lookup and a link:
 *
 *   cv-16423                              ComicVine-derived
 *   h_3bdf77b4-00e2-4ea6-86d2-b76d595ec…  the h_<uuid> convention
 *   485                                   legacy numeric
 *
 * Matchup posts set `utm_content` to `<aId>-<bId>`, which cannot be split back
 * apart unambiguously — "cv-1-cv-2" has three plausible readings. Those posts
 * deep-link to /compare anyway, so the fallback simply declines rather than
 * guessing, and a wrong guess would be worse than no lead at all.
 */
const HERO_ID =
  /^(?:cv-\d+|h_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{1,7})$/;

/**
 * The subject a landing names, or null when it names nothing we can show.
 *
 * Pure: takes the already-parsed `utm_content` token rather than a URL, because
 * attribution.ts owns the parsing and normalisation and this should not have a
 * second opinion about it.
 */
export function arrivalSubject(utmContent: string | null | undefined): ArrivalSubject | null {
  const v = (utmContent ?? '').trim();
  if (!v || !HERO_ID.test(v)) return null;
  return { kind: 'hero', id: v };
}
