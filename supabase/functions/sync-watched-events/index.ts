// sync-watched-events — detect whether a watched real-world event (SDCC, NYCC,
// a Nintendo Direct) is happening right now, from attention on its own Wikipedia
// article. There is no usable public calendar API for fan conventions (Wikidata
// has 16 dated comic cons, newest 2022), so nothing here reads a schedule.
//
// Per enabled row: 28 days of daily pageviews + the article's recent revisions,
// scored into a verdict and an inferred window. Both signals must agree for
// `live` — pageviews carry the signal but lag 1-2 days, edits have no lag and
// are what separate the convention that is running from one that merely drifted
// up in a quiet news week.
//
// Writes verdict/window/state only. It never sets `approval`, so detection alone
// can never re-skin Explore — see the migration for that reasoning.
//
// POST body: { limit?: number, triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

const WM =
  'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents';
const WP = 'https://en.wikipedia.org/w/api.php';
const UA = { 'User-Agent': 'mythique/1.0 (https://mythique.app)' };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ymdCompact = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

// ── mirror of src/lib/events/detect.ts ──────────────────────────────────────
// Deno can't import from src/, so this is a deliberate copy (same pattern as
// enrich-tmdb-batch mirroring src/lib/tmdb/mapFilm.ts). The unit tests for this
// logic live in __tests__/lib/events/detect.test.ts against the TS original —
// change both together.

interface DailyViews {
  date: string;
  views: number;
}
type EventShape = 'sustained' | 'decaying' | 'easing' | 'flat';
type EventVerdict = 'live' | 'watch' | 'idle';
interface EventDetection {
  verdict: EventVerdict;
  baseline: number;
  peak: number;
  spikeRatio: number;
  shape: EventShape;
  editsRecent: number;
  editBurstRatio: number;
  liveFrom: string | null;
  liveTo: string | null;
  ongoing: boolean;
}

const RECENT_DAYS = 4;
const SPIKE_MIN = 2.5;
const EDIT_BURST_MIN = 4;
const EDITS_ABS_MIN = 3;
// A ratio is meaningless on a low-traffic article: CCXP's median is 40 views/day,
// so its 2.5x gate is 100 views and its ordinary noise peak of 93 nearly clears
// it. See src/lib/events/detect.ts for the measured justification.
const MIN_PEAK_VIEWS = 250;
const MIN_EDIT_BASELINE = 0.05;
const WINDOW_ENTER = 2;
const MS_PER_DAY = 86_400_000;

const dayNumber = (ymd: string): number => {
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isNaN(ms) ? NaN : Math.floor(ms / MS_PER_DAY);
};
const dayNumberFromIso = (iso: string): number => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? NaN : Math.floor(ms / MS_PER_DAY);
};
const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
};
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

function classifyShape(baseline: number, peak: number, latest: number): EventShape {
  if (baseline <= 0 || peak / baseline < 1.2) return 'flat';
  if (latest >= peak * 0.85) return 'sustained';
  if (peak / Math.max(latest, 1) >= 2) return 'decaying';
  return 'easing';
}

function detectEvent(signals: {
  views: DailyViews[];
  editTimestamps: string[];
  asOf: string;
}): EventDetection {
  const series = signals.views
    .filter((v) => Number.isFinite(v.views) && !Number.isNaN(dayNumber(v.date)))
    .map((v) => ({ ...v, day: dayNumber(v.date) }))
    .sort((a, b) => a.day - b.day);
  if (series.length === 0) return IDLE;

  const baseline = median(series.map((v) => v.views));
  const newest = series[series.length - 1];
  const recent = series.filter((v) => newest.day - v.day < RECENT_DAYS);
  const peak = Math.max(...recent.map((v) => v.views));
  const spikeRatio = baseline > 0 ? peak / baseline : 0;
  const shape = classifyShape(baseline, peak, newest.views);

  const asOfDay = dayNumber(signals.asOf);
  const cutoff = Number.isNaN(asOfDay) ? newest.day : asOfDay;
  const editDays = signals.editTimestamps
    .map(dayNumberFromIso)
    .filter((d) => !Number.isNaN(d))
    .sort((a, b) => a - b);
  const recentEdits = editDays.filter((d) => cutoff - d < RECENT_DAYS && d <= cutoff);
  const olderEdits = editDays.filter((d) => cutoff - d >= RECENT_DAYS);
  const olderSpan =
    olderEdits.length > 0 ? Math.max(1, cutoff - RECENT_DAYS - olderEdits[0] + 1) : 0;
  const olderPerDay = olderSpan > 0 ? olderEdits.length / olderSpan : 0;
  const recentPerDay = recentEdits.length / RECENT_DAYS;
  const editBurstRatio = recentPerDay / Math.max(olderPerDay, MIN_EDIT_BASELINE);

  const viewsHot = spikeRatio >= SPIKE_MIN && peak >= MIN_PEAK_VIEWS;
  const editsHot = recentEdits.length >= EDITS_ABS_MIN && editBurstRatio >= EDIT_BURST_MIN;
  const verdict: EventVerdict =
    viewsHot && editsHot ? 'live' : viewsHot || editsHot ? 'watch' : 'idle';

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

// ── fetchers ────────────────────────────────────────────────────────────────

/** 28 days of daily pageviews ending today-1. The API lags 1-2 days, so the
 *  newest day is often absent; detectEvent anchors to the newest day present
 *  rather than to today, which is why a gap here is harmless. */
async function fetchViews(article: string): Promise<DailyViews[]> {
  const end = new Date(Date.now() - MS_PER_DAY);
  const start = new Date(end.getTime() - 27 * MS_PER_DAY);
  const path = encodeURIComponent(article.replace(/ /g, '_'));
  const url = `${WM}/${path}/daily/${ymdCompact(start)}/${ymdCompact(end)}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return [];
  const body = await res.json();
  return ((body.items ?? []) as Array<{ timestamp: string; views: number }>).map((i) => ({
    date: `${i.timestamp.slice(0, 4)}-${i.timestamp.slice(4, 6)}-${i.timestamp.slice(6, 8)}`,
    views: i.views ?? 0,
  }));
}

/** Recent revision timestamps. 100 is plenty to establish both the burst and a
 *  long-run baseline — a dormant con article's 100 revisions reach back years,
 *  which is exactly the low rate we want to divide by. */
async function fetchEdits(article: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    titles: article.replace(/_/g, ' '),
    rvlimit: '100',
    rvprop: 'timestamp',
    format: 'json',
    formatversion: '2',
  });
  const res = await fetch(`${WP}?${params}`, { headers: UA });
  if (!res.ok) return [];
  const body = await res.json();
  const pages = (body.query?.pages ?? []) as Array<{
    revisions?: Array<{ timestamp: string }>;
  }>;
  return (pages[0]?.revisions ?? []).map((r) => r.timestamp).filter(Boolean);
}

interface WatchedRow {
  slug: string;
  enwiki_title: string;
  verdict: string;
  first_detected_at: string | null;
}

/**
 * Tell a person when an event starts publishing itself.
 *
 * Approval is a veto rather than a prerequisite (20260815080000), which is the
 * right default — the opt-in gate was unreachable and D23 sat unpublished
 * through its own weekend. But a veto nobody hears about is only exercisable by
 * someone who happens to be looking at the admin screen, and D23 went live at
 * 00:07 UTC. This is the channel that reaches someone who is not looking.
 *
 * Fail-soft in every direction. No BREVO_API_KEY (it is set manually and may not
 * be) means the sweep still succeeds; a send failure is swallowed. Detection is
 * the job, and it must never fail because a mail server did.
 */
async function alertNewlyLive(events: { slug: string; spike: number }[]): Promise<void> {
  const apiKey = Deno.env.get('BREVO_API_KEY') ?? '';
  if (!apiKey) return;
  const to = Deno.env.get('REPORT_ALERT_TO') ?? 'ginoswanepoel@gmail.com';
  const senderEmail = Deno.env.get('REPORT_ALERT_FROM') ?? 'reports@mythique.app';
  const senderName = Deno.env.get('REPORT_ALERT_FROM_NAME') ?? 'Mythique';

  const rows = events
    .map(
      (e) =>
        `<li><strong>${e.slug}</strong> — ${e.spike.toFixed(2)}× usual readership ` +
        `(<a href="https://mythique.app/event/${encodeURIComponent(e.slug)}">page</a>)</li>`,
    )
    .join('');
  const html =
    `<p>Detected as live and <strong>already publishing</strong> to Explore:</p>` +
    `<ul>${rows}</ul>` +
    `<p>Nothing is required of you. If one of these is wrong, veto it in ` +
    `<a href="https://mythique.app/admin/health?domain=pipelines&sub=signals">Build → Signals</a>.</p>`;

  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject:
          events.length === 1
            ? `Now live on Mythique: ${events[0].slug}`
            : `${events.length} events now live on Mythique`,
        htmlContent: html,
      }),
    });
  } catch {
    /* a mail failure must never fail the detection sweep */
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let limit = 40;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.limit === 'number') limit = Math.min(Math.max(1, b.limit), 100);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }

  const sb: SB = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data, error } = await sb
    .from('watched_events')
    .select('slug, enwiki_title, verdict, first_detected_at')
    .eq('enabled', true)
    .order('checked_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) return json({ error: error.message }, 500);
  const rows = (data ?? []) as unknown as WatchedRow[];

  const asOf = new Date().toISOString().slice(0, 10);
  const live: string[] = [];
  const newlyLive: { slug: string; spike: number }[] = [];
  let processed = 0;

  for (const row of rows) {
    try {
      const [views, editTimestamps] = await Promise.all([
        fetchViews(row.enwiki_title),
        fetchEdits(row.enwiki_title),
      ]);
      const d = detectEvent({ views, editTimestamps, asOf });

      await sb
        .from('watched_events')
        .update({
          views_daily: views,
          baseline: Math.round(d.baseline),
          peak: d.peak,
          spike_ratio: d.spikeRatio,
          shape: d.shape,
          edits_recent: d.editsRecent,
          edit_burst_ratio: d.editBurstRatio,
          verdict: d.verdict,
          live_from: d.liveFrom,
          live_to: d.liveTo,
          ongoing: d.ongoing,
          checked_at: new Date().toISOString(),
          // Stamped on the first transition into `live` and then left alone, so
          // an operator can see how long a detection has been standing.
          first_detected_at:
            d.verdict === 'live' && row.verdict !== 'live'
              ? new Date().toISOString()
              : row.first_detected_at,
        })
        .eq('slug', row.slug);

      if (d.verdict === 'live') {
        live.push(row.slug);
        // Newly live THIS pass — the same transition first_detected_at marks.
        // Publishing is automatic now, so this mail is not a request for
        // permission; it is the notification that makes the veto reachable.
        // Without it "rejected" is a control that can only be exercised by
        // someone who happened to be looking, which is how D23 published itself
        // at 00:07 with nobody told.
        if (row.verdict !== 'live') newlyLive.push({ slug: row.slug, spike: d.spikeRatio });
      }
      processed++;
    } catch (_e) {
      // Transient network/parse failure: leave the row's last-known state and
      // let the next run retry. One bad article never fails the batch.
    }
    // Wikimedia asks for courteous pacing; this job is tiny and never urgent.
    await sleep(150);
  }

  // One mail per pass, however many events turned over. A per-event mail during
  // a convention season is a mail nobody reads, and this is the only channel
  // that reaches a person who is not already looking at the admin screen.
  if (newlyLive.length > 0) {
    await alertNewlyLive(newlyLive);
  }

  if (processed > 0) {
    await sb
      .from('api_usage')
      .insert({ api: 'wikimedia', endpoint: 'watched-events', units: processed * 2 });
  }

  // Snapshot every live event into event_editions before this row's state is
  // overwritten by the next pass. watched_events holds one row per SERIES and
  // this function is what overwrites it, so anything not captured here is
  // unrecoverable a month later: views_daily is a rolling ~27-day series, and
  // SDCC 2026's spike had already rolled out of its own row by 2026-08-15,
  // leaving a stored spike_ratio of 0.82 for an event detected at 3.35x.
  //
  // Runs on every pass, not on a live→idle transition, so there is no single
  // moment to miss and a flickering verdict cannot lose an edition. It also
  // lets the frozen window follow the detector as lagging pageviews extend it.
  const { data: frozen, error: freezeErr } = await sb.rpc('freeze_live_editions');

  return json({
    processed,
    live,
    editions: freezeErr ? { error: freezeErr.message } : frozen,
    triggeredBy,
  });
});
