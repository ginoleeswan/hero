// src/lib/events/schedule.ts — the few event windows we actually KNOW.
//
// Everything else about a watched event is inferred from attention: detect.ts
// walks the contiguous run of days above 2x baseline on the event's own
// Wikipedia article and calls that the window. That is the right default and it
// is why this app has event pages at all — there is no usable public calendar
// API for fan conventions (Wikidata holds 16 dated comic cons, newest 2022).
//
// It cannot, however, be right about dates, for two structural reasons:
//
//   1. **It can only see the past.** `fetchViews` ends at today-1 and Wikimedia
//      lags another day, so the inferred `live_to` is ALWAYS at least a day
//      behind. A running event's window therefore always looks like it just
//      ended, which is what made every live card read "FINAL DAY" from day one.
//   2. **Anticipation looks exactly like attendance.** Gamescom 2026 runs
//      Aug 26-30. On Aug 25 the inferred window was Aug 23-24 — press days and
//      pre-show coverage — so the card announced the final day of an event that
//      had not opened.
//
// A curated window fixes both, for the handful of events where the dates are
// published years ahead and a reader can check them in one search. It is
// deliberately NOT a calendar: nothing here is scraped, guessed, or defaulted
// from "the third weekend of August". An entry exists only when someone read the
// organiser's own dates, and an event with no entry keeps behaving exactly as it
// did — the detector's window, and copy that declines to count days it cannot
// know (see eventDayLabel).
//
// Keyed by `watched_events.slug` then by edition slug — the same '2026' /
// '2026-08' segment the edition routes use, so a hub row, an edition page and
// the Pulse card all resolve the same window.

export interface PublishedWindow {
  /** First day, inclusive. ISO date, no time — an event runs in its own city's
   *  day, not in a timezone we could meaningfully store. */
  from: string;
  /** Last day, inclusive. */
  to: string;
}

/**
 * Only what has been read off the organiser's own listing.
 *
 * Adding one is the whole maintenance cost of the feature, so keep the bar
 * where it is: a published, checkable date range for a specific edition. Do not
 * add an event because its dates are "usually" a certain weekend — the point of
 * this table is that it contains no inference.
 */
export const PUBLISHED_WINDOWS: Record<string, Record<string, PublishedWindow>> = {
  // gamescom.global — trade day Aug 26, public through Aug 30. Opening Night
  // Live is the evening of the 25th, which is the day the detector first sees.
  gamescom: { '2026': { from: '2026-08-26', to: '2026-08-30' } },
  // newyorkcomiccon.com — Javits Center, Thu-Sun.
  nycc: { '2026': { from: '2026-10-08', to: '2026-10-11' } },
};

/** The year an edition belongs to, from its slug ('2026', '2026-08') or from any
 *  date inside it. */
const yearOf = (s: string | null | undefined): string =>
  typeof s === 'string' && /^\d{4}/.test(s) ? s.slice(0, 4) : '';

/**
 * The published window for one edition, or null when we do not have one.
 *
 * `edition` is the edition slug where the caller has it (edition pages, hub
 * rows, the Pulse card). The live dossier does not — it reads the current
 * `watched_events` row, which has no edition — so `near` takes any date inside
 * the event instead, normally the detected window's start.
 */
export function publishedWindow(
  slug: string | null | undefined,
  edition?: string | null,
  near?: string | null,
): PublishedWindow | null {
  if (!slug) return null;
  const editions = PUBLISHED_WINDOWS[slug];
  if (!editions) return null;

  if (edition && editions[edition]) return editions[edition];

  // Fall back to the year, but only when it identifies ONE edition. Comiket runs
  // twice a year, so '2026' alone cannot pick between '2026-08' and '2026-12',
  // and guessing would put the wrong dates on the page — the failure this module
  // exists to remove.
  const year = yearOf(edition) || yearOf(near);
  if (!year) return null;
  const matches = Object.entries(editions).filter(
    ([key, w]) => yearOf(key) === year || w.from.startsWith(year),
  );
  return matches.length === 1 ? matches[0][1] : null;
}

/** A window plus where it came from — the distinction every caller needs, since
 *  a published end date can be counted down to and an inferred one cannot. */
export interface StatedWindow {
  from: string | null;
  to: string | null;
  /** True only when these are the organiser's dates. */
  published: boolean;
}

/**
 * What to SAY the window is: the published dates when we have them, the detected
 * ones otherwise.
 *
 * Copy uses this. The curve does not — it shades the detected window, because it
 * is a figure about detection and shading anything else would make the evidence
 * disagree with itself.
 */
export function statedWindow(
  slug: string | null | undefined,
  edition: string | null | undefined,
  detected: { from: string | null; to: string | null },
): StatedWindow {
  const published = publishedWindow(slug, edition, detected.from);
  if (published) return { from: published.from, to: published.to, published: true };
  return { from: detected.from, to: detected.to, published: false };
}
