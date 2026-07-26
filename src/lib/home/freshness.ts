// src/lib/home/freshness.ts — how fresh is the "Right Now" band, honestly?
//
// The band header shipped with the literal string "Updated today". It happened to
// be true, but it was an unconditional claim: if a cron stalled, the label kept
// asserting freshness over week-old content with a live pulse animating above it.
// A feed that lies about being live is worse than one that admits it's quiet.
//
// Deliberately NOT derived from explore_bundle_cache.refreshed_at — the earlier
// design doc suggested that and it was wrong. The cache recomputes every ten
// minutes whether or not anything changed, so refreshed_at is always under ten
// minutes old and says nothing about the content. It would be a more precise
// version of the same lie. This measures the freshest actual *event* in the band.
//
// The terse uppercase register matches the existing 9px tracked micro-label (and
// admin/health/format.ts's relTime), but the policy is the point: past
// STALE_AFTER_HOURS the label goes null and the caller shows nothing rather than
// a number nobody wants to read.

/** Anything in the band that carries a real timestamp. All fields optional so
 *  callers can pass only what they have — the band gained sources over time and
 *  will gain more (trailer drops land with §8.1a). */
export interface FreshnessInput {
  /** ISO-8601 timestamps — trailer/teaser publish times. The sharpest signal. */
  publishedAt?: readonly (string | null | undefined)[];
  /** YYYY-MM-DD on-sale dates from comic_issues. Day granularity only. */
  storeDates?: readonly (string | null | undefined)[];
  /** True while a detected real-world event (SDCC, a Direct) is running. Outranks
   *  every timestamp: "live" beats "2h ago". */
  liveEventOngoing?: boolean;
  /** Name of that event, for the label. */
  liveEventLabel?: string | null;
  /** Injectable clock so the label is deterministic in tests. */
  now?: number;
}

export interface Freshness {
  /** Uppercase micro-label, or **null** when the band should make no freshness
   *  claim at all. Null is a real outcome, not an error. */
  label: string | null;
  /** Hours since the freshest dated item, or null if nothing was dated. */
  ageHours: number | null;
  /** Whether the pulse dot should animate. False over stale content — an
   *  animating dot above week-old cards is the exact thing to avoid. */
  pulse: boolean;
}

/** Past this, say nothing rather than "8D AGO". A week-old band is a stalled
 *  pipeline, and the honest presentation of that is silence, not a stat. */
export const STALE_AFTER_HOURS = 24 * 7;
/** The pulse only animates inside this window. */
export const PULSE_WITHIN_HOURS = 48;

const MS_PER_HOUR = 3_600_000;

/** Parse an ISO timestamp or a bare YYYY-MM-DD. Returns null for anything else —
 *  never a NaN date. Bare dates land at UTC midnight, which *understates*
 *  freshness by up to a day; that's the right direction to be wrong in. */
export function parseStamp(v: string | null | undefined): number | null {
  if (typeof v !== 'string' || v.trim() === '') return null;
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? `${v.trim()}T00:00:00Z` : v);
  return Number.isNaN(ms) ? null : ms;
}

/** The most recent parseable stamp across every source, or null. */
export function newestStamp(input: FreshnessInput): number | null {
  const all = [...(input.publishedAt ?? []), ...(input.storeDates ?? [])];
  let newest: number | null = null;
  for (const raw of all) {
    const ms = parseStamp(raw);
    if (ms === null) continue;
    if (newest === null || ms > newest) newest = ms;
  }
  return newest;
}

function ageLabel(hours: number): string {
  if (hours < 1) return 'JUST NOW';
  if (hours < 24) return `${Math.floor(hours)}H AGO`;
  if (hours < 48) return 'YESTERDAY';
  return `${Math.floor(hours / 24)}D AGO`;
}

/**
 * Derive the band's freshness claim. Pure, and clock-injectable so the label is
 * deterministic under test.
 */
export function computeFreshness(input: FreshnessInput): Freshness {
  const now = input.now ?? Date.now();

  // A running event outranks any timestamp — during SDCC the truthful header is
  // "live", not "6h ago".
  if (input.liveEventOngoing) {
    const name = input.liveEventLabel?.trim();
    return {
      label: name ? `${name.toUpperCase()} · LIVE` : 'LIVE NOW',
      ageHours: 0,
      pulse: true,
    };
  }

  const newest = newestStamp(input);
  if (newest === null) return { label: null, ageHours: null, pulse: false };

  // Clamp: a future stamp is bad data, not negative age.
  const ageHours = Math.max(0, (now - newest) / MS_PER_HOUR);
  if (ageHours > STALE_AFTER_HOURS) return { label: null, ageHours, pulse: false };

  return {
    label: ageLabel(ageHours),
    ageHours,
    pulse: ageHours <= PULSE_WITHIN_HOURS,
  };
}
