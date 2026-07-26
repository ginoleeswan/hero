// src/lib/events/detect.ts — "is a real-world event happening right now?"
//
// Real-world fan events (SDCC, NYCC, D23, a Nintendo Direct) have no usable
// public calendar API. Wikidata models only 16 dated comic conventions and the
// newest is from 2022, so there is no schedule to read — instead we DETECT the
// event from attention on its own Wikipedia article. Two independent free
// signals, no API key on either:
//
//   * daily pageviews — high signal, but the Wikimedia API lags 1-2 days
//   * edit rate       — no lag at all, so it's what catches an event on day one
//
// Requiring BOTH is what keeps precision up. Measured over the same 28 days
// during SDCC 2026 (live as this was written): the SDCC article ran 3.35x its
// baseline pageviews AND took 13 edits in four days, while NYCC — not running —
// drifted to 1.74x on pageviews with exactly 1 edit.
//
// Pure functions only, and deliberately clock-free (`asOf` is passed in) so the
// verdict is deterministic in tests. The sync-watched-events edge function
// mirrors this file — Deno can't import from src/ — so keep the two in step.

/** One day of Wikipedia pageviews for an article. */
export interface DailyViews {
  /** YYYY-MM-DD. */
  date: string;
  views: number;
}

export interface EventSignals {
  /** Daily pageviews in any order; ~28 days is the intended window. A median
   *  over four weeks can't be contaminated by the event's own days (a four-day
   *  convention is under 20% of the sample). */
  views: DailyViews[];
  /** ISO timestamps of recent revisions to the article, any order. */
  editTimestamps: string[];
  /** The calendar day (YYYY-MM-DD) to treat as "now". Edits are real-time so
   *  they're measured against this; pageviews are measured against the newest
   *  day actually present in `views`, which lags it. */
  asOf: string;
}

/** How the attention curve is moving — the same spike ratio means different
 *  things depending on shape, and the shape decides the copy and the decay. */
export type EventShape =
  /** Still at or near its peak on the newest day — an event in progress. */
  | 'sustained'
  /** Peaked and dropped hard — a discrete announcement (trailer, casting). */
  | 'decaying'
  /** Past peak but drifting down slowly. */
  | 'easing'
  /** No meaningful lift at all. */
  | 'flat';

/** `live` = both signals agree, safe to surface. `watch` = one signal only,
 *  worth showing an operator but not the front page. */
export type EventVerdict = 'live' | 'watch' | 'idle';

export interface EventDetection {
  verdict: EventVerdict;
  /** Median daily pageviews across the whole window. */
  baseline: number;
  /** Highest daily pageviews inside the recent window. */
  peak: number;
  /** peak ÷ baseline. */
  spikeRatio: number;
  shape: EventShape;
  /** Revisions inside the recent window. */
  editsRecent: number;
  /** Recent edits/day ÷ the article's own longer-run edits/day. */
  editBurstRatio: number;
  /** Inferred event window — the contiguous run of elevated days. Null when no
   *  day in the sample clears the entry threshold. */
  liveFrom: string | null;
  liveTo: string | null;
  /** True when the elevated run reaches the newest day we have data for, i.e.
   *  the event probably hasn't finished (pageview lag means "newest day" is
   *  usually 1-2 days behind reality). */
  ongoing: boolean;
}

// ── thresholds ───────────────────────────────────────────────────────────────
// Seeded from two measured events (SDCC 2026 live, NYCC 2026 dormant) and then
// checked against a full 20-row production run — enough to place them, not
// enough to call them final. Re-tune when a second convention actually runs.

/** Days counted as "recent" for both the pageview peak and the edit burst. */
export const RECENT_DAYS = 4;
/** Pageview lift required. SDCC measured 3.35x; NYCC 1.74x. */
export const SPIKE_MIN = 2.5;
/** Edit-rate multiple required. SDCC measured 21.5x in production. */
export const EDIT_BURST_MIN = 4;
/** Floor on absolute recent edits, so a near-dormant article can't turn one
 *  drive-by edit into a huge ratio. This is the guard that actually rejects a
 *  dormant con: in the production run NYCC's single edit scored 4.32x off its
 *  years-long baseline, clearing EDIT_BURST_MIN. One edit is not a burst
 *  regardless of ratio. */
export const EDITS_ABS_MIN = 3;
/** Absolute floor on the recent peak, because a ratio alone is meaningless on a
 *  low-traffic article. Measured medians on the smallest watched articles: CCXP
 *  40/day, Angoulême 61, Lucca 66 — so CCXP's 2.5x gate is just 100 views, and
 *  its ordinary noise peak of 93 nearly clears it. Three edits from one keen
 *  editor would then read as a live convention.
 *
 *  250 sits above every noise peak measured across the six smallest articles
 *  (max 230) and far below SDCC's 3,688. The cost is that a convention which is
 *  genuinely big but small *on en.wikipedia* (CCXP is a ~250k-attendee Brazilian
 *  show read mostly in Portuguese) needs real traffic to trigger. Revisit — and
 *  consider a per-row override column — the first time one of those actually
 *  runs. */
export const MIN_PEAK_VIEWS = 250;
/** Below this, an article's long-run edit rate is treated as this value rather
 *  than dividing by ~zero. Note this floor dominates on any article whose
 *  sampled history is sparse: with only a handful of older revisions the burst
 *  ratio reports the floor rather than a real rate (a trimmed test fixture reads
 *  65x where production, sampling 100 revisions, reads 21.5x for the same days). */
export const MIN_EDIT_BASELINE = 0.05;
/** Multiple of baseline a day must clear to count as part of the event window.
 *  Higher than SPIKE_MIN on purpose: it trims the ramp-up so the window lands
 *  on the event itself. */
export const WINDOW_ENTER = 2;

const MS_PER_DAY = 86_400_000;

/** Whole days since the epoch for a YYYY-MM-DD date, or NaN if unparseable. */
function dayNumber(ymd: string): number {
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isNaN(ms) ? NaN : Math.floor(ms / MS_PER_DAY);
}

/** Whole days since the epoch for a full ISO timestamp, or NaN. */
function dayNumberFromIso(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? NaN : Math.floor(ms / MS_PER_DAY);
}

/** Median of a numeric list — robust to the event's own days sitting in the
 *  sample, which a mean is not. Returns 0 for an empty list. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const IDLE: EventDetection = {
  verdict: 'idle',
  baseline: 0,
  peak: 0,
  spikeRatio: 0,
  shape: 'flat',
  editsRecent: 0,
  editBurstRatio: 0,
  liveFrom: null,
  liveTo: null,
  ongoing: false,
};

/** Classify the curve from its peak, its newest value, and the baseline. */
function classifyShape(baseline: number, peak: number, latest: number): EventShape {
  if (baseline <= 0 || peak / baseline < 1.2) return 'flat';
  if (latest >= peak * 0.85) return 'sustained';
  if (peak / Math.max(latest, 1) >= 2) return 'decaying';
  return 'easing';
}

/**
 * Score one watched article's signals into a verdict plus the inferred event
 * window. Never throws: malformed dates and empty inputs degrade to `idle` so a
 * single bad row can't take the whole sync down.
 */
export function detectEvent(signals: EventSignals): EventDetection {
  const series = signals.views
    .filter((v) => Number.isFinite(v.views) && !Number.isNaN(dayNumber(v.date)))
    .map((v) => ({ ...v, day: dayNumber(v.date) }))
    .sort((a, b) => a.day - b.day);
  if (series.length === 0) return IDLE;

  const baseline = median(series.map((v) => v.views));
  // Anchor the recent window to the newest day we actually have, not to `asOf`
  // — the pageviews API is 1-2 days behind, and anchoring to `asOf` would slide
  // the window off the end of the data and read a live event as flat.
  const newest = series[series.length - 1];
  const recent = series.filter((v) => newest.day - v.day < RECENT_DAYS);
  const peak = Math.max(...recent.map((v) => v.views));
  const spikeRatio = baseline > 0 ? peak / baseline : 0;
  const shape = classifyShape(baseline, peak, newest.views);

  // Edits are real-time, so they're measured against `asOf`.
  const asOfDay = dayNumber(signals.asOf);
  const editDays = signals.editTimestamps
    .map(dayNumberFromIso)
    .filter((d) => !Number.isNaN(d))
    .sort((a, b) => a - b);
  const cutoff = Number.isNaN(asOfDay) ? newest.day : asOfDay;
  const recentEdits = editDays.filter((d) => cutoff - d < RECENT_DAYS && d <= cutoff);
  const olderEdits = editDays.filter((d) => cutoff - d >= RECENT_DAYS);
  // Span the older edits actually cover, so a long quiet history correctly
  // reads as a low rate rather than being averaged over an arbitrary window.
  const olderSpan =
    olderEdits.length > 0 ? Math.max(1, cutoff - RECENT_DAYS - olderEdits[0] + 1) : 0;
  const olderPerDay = olderSpan > 0 ? olderEdits.length / olderSpan : 0;
  const recentPerDay = recentEdits.length / RECENT_DAYS;
  const editBurstRatio = recentPerDay / Math.max(olderPerDay, MIN_EDIT_BASELINE);

  // A lift is only meaningful if there's enough traffic for the ratio to mean
  // anything — see MIN_PEAK_VIEWS.
  const viewsHot = spikeRatio >= SPIKE_MIN && peak >= MIN_PEAK_VIEWS;
  const editsHot = recentEdits.length >= EDITS_ABS_MIN && editBurstRatio >= EDIT_BURST_MIN;
  const verdict: EventVerdict =
    viewsHot && editsHot ? 'live' : viewsHot || editsHot ? 'watch' : 'idle';

  // The window: walk back from the newest elevated day through the contiguous
  // run of elevated days. Trailing quiet days are skipped first so an event
  // that ended a day or two ago still reports the window it occupied.
  const enter = baseline * WINDOW_ENTER;
  let liveFrom: string | null = null;
  let liveTo: string | null = null;
  let end = series.length - 1;
  while (end >= 0 && series[end].views < enter) end--;
  if (end >= 0) {
    liveTo = series[end].date;
    let start = end;
    while (start - 1 >= 0 && series[start - 1].views >= enter) start--;
    liveFrom = series[start].date;
  }

  return {
    verdict,
    baseline,
    peak,
    spikeRatio: round2(spikeRatio),
    shape,
    editsRecent: recentEdits.length,
    editBurstRatio: round2(editBurstRatio),
    liveFrom,
    liveTo,
    ongoing: liveTo !== null && liveTo === newest.date,
  };
}
