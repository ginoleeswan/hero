// backfill-event-editions — recover the years that happened before Mythique watched.
//
// event_editions only ever grows forward: an edition is frozen while the event
// is live, so the archive started the day the freeze shipped and a hub read "One
// edition on record so far". That is a table of contents with one entry, and
// the whole argument for edition pages — a URL that can hold a ranking for
// "d23 2026" — needs years to be worth anything.
//
// The past is recoverable. Wikimedia serves daily pageviews back to 2015, so the
// same evidence that detects a live event detects the ones already over. Run
// over D23's history it finds the 2019, 2022 and 2024 expos with peaks of 12k,
// 14k and 26k a day against a 182 median — and those dates check out against the
// real calendar (D23 Expo 2019 ran 23-25 August, 2022 ran 9-11 September, 2024
// ran 9-11 August).
//
// This is NOT the live detector. That one asks "is this on right now" of a
// 27-day window; this asks "which weeks in eight years were events" of a 3,000
// day series, which is a different question and gets a different algorithm:
//
//   1. runs of days at >= 2x the all-time median
//   2. keep the biggest run per calendar year — an annual convention has one
//   3. require >= MIN_RUN_DAYS and >= PEAK_MULT x median, which is what
//      separates an expo from an ordinary news blip
//   4. narrow to the core around the peak, because a run at 2x trails for weeks
//      after a big year and the window should name the event, not its aftermath
//
// What a backfilled edition CANNOT have is movers: heroes.views_daily is a
// rolling 27-day window, so who moved during D23 2019 is gone for good. It gets
// an empty list rather than a fabricated one. Trailers and announcements are
// recomputed from the frozen window at read time, and title_videos does hold
// TMDB's history, so old editions still show what dropped.
//
// POST body: { slug?: string, dryRun?: boolean, from?: 'YYYYMMDD' }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

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

const WM = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user';
const UA = { 'User-Agent': 'Mythique/1.0 (mythique.app)' };

/** A day must clear this multiple of the all-time median to be part of a run. */
const RUN_ENTER = 2;
/** Below this a run is a news blip, not a convention. D23's real expos sit at
 *  7x-142x; its ordinary noise peaks sit under 4x. */
const PEAK_MULT = 4;
/** A convention moves an article for days. Three-day blips are announcements. */
const MIN_RUN_DAYS = 5;
/** Narrowing floor: within a qualifying run, the core is the contiguous days
 *  around the peak still at this share of it. A run at 2x trails for weeks. */
const CORE_SHARE = 0.35;
/** Days of context stored either side of the window, so the page has a curve to
 *  draw rather than a flat block. */
const CURVE_PAD = 18;

interface Day {
  date: string; // YYYY-MM-DD
  views: number;
}

export interface HistoricalEdition {
  year: string;
  liveFrom: string;
  liveTo: string;
  peak: number;
  baseline: number;
  spikeRatio: number;
  curve: Day[];
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Find every past edition in a full daily series. Pure — unit-testable, and
 *  mirrored by no one, because only this function needs it. */
export function findEditions(series: Day[]): HistoricalEdition[] {
  if (series.length < 60) return [];
  const med = median(series.map((d) => d.views)) || 1;

  // 1. contiguous runs above the entry threshold
  const runs: { from: number; to: number; peak: number }[] = [];
  let cur: { from: number; to: number; peak: number } | null = null;
  series.forEach((d, i) => {
    if (d.views >= RUN_ENTER * med) {
      cur = cur ? { from: cur.from, to: i, peak: Math.max(cur.peak, d.views) } : { from: i, to: i, peak: d.views };
    } else if (cur) {
      runs.push(cur);
      cur = null;
    }
  });
  if (cur) runs.push(cur);

  // 2 + 3. biggest qualifying run per calendar year.
  //
  // Keyed on the year of the PEAK, not of the run's first day. A run opens on
  // the quiet slope before the event and can therefore start on the far side of
  // New Year — which is how a Nintendo Direct held on 9 January 2020 came to be
  // labelled 2019, and Emerald City Comic Con 2019 came to be labelled 2018.
  // The peak IS the event; the run's edges are just where the noise floor is.
  const peakIndex = (r: { from: number; to: number }) => {
    let p = r.from;
    for (let i = r.from; i <= r.to; i++) if (series[i].views > series[p].views) p = i;
    return p;
  };
  const best = new Map<string, { from: number; to: number; peak: number }>();
  for (const r of runs) {
    const days = r.to - r.from + 1;
    if (days < MIN_RUN_DAYS || r.peak < PEAK_MULT * med) continue;
    const year = series[peakIndex(r)].date.slice(0, 4);
    const held = best.get(year);
    if (!held || r.peak > held.peak) best.set(year, r);
  }

  // 4. narrow to the core around the peak
  const out: HistoricalEdition[] = [];
  for (const [year, r] of [...best.entries()].sort()) {
    const peakIdx = peakIndex(r);
    const floor = Math.max(RUN_ENTER * med, CORE_SHARE * r.peak);
    let lo = peakIdx;
    let hi = peakIdx;
    while (lo > r.from && series[lo - 1].views >= floor) lo--;
    while (hi < r.to && series[hi + 1].views >= floor) hi++;

    const c0 = Math.max(0, lo - CURVE_PAD);
    const c1 = Math.min(series.length - 1, hi + CURVE_PAD);
    out.push({
      year,
      liveFrom: series[lo].date,
      liveTo: series[hi].date,
      peak: r.peak,
      baseline: Math.round(med),
      spikeRatio: Math.round((r.peak / med) * 100) / 100,
      curve: series.slice(c0, c1 + 1),
    });
  }
  return out;
}

async function fetchSeries(title: string, from: string, to: string): Promise<Day[]> {
  const url = `${WM}/${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${from}/${to}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return [];
  const body = await res.json();
  return ((body.items ?? []) as { timestamp: string; views: number }[]).map((i) => ({
    date: `${i.timestamp.slice(0, 4)}-${i.timestamp.slice(4, 6)}-${i.timestamp.slice(6, 8)}`,
    views: i.views ?? 0,
  }));
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let slug: string | null = null;
  let dryRun = false;
  let from = '20180101';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.slug === 'string') slug = b.slug;
    if (b?.dryRun === true) dryRun = true;
    if (typeof b?.from === 'string' && /^\d{8}$/.test(b.from)) from = b.from;
  } catch {
    /* empty body ok */
  }

  const sb: SB = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let q = sb
    .from('watched_events')
    .select('slug, headline, accent, enwiki_title')
    .eq('enabled', true)
    .not('enwiki_title', 'is', null);
  if (slug) q = q.eq('slug', slug);
  const { data: events, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const to = ymd(new Date(Date.now() - 86_400_000));
  const report: Record<string, unknown>[] = [];
  let inserted = 0;

  for (const ev of (events ?? []) as unknown as {
    slug: string;
    headline: string;
    accent: string | null;
    enwiki_title: string;
  }[]) {
    try {
      const series = await fetchSeries(ev.enwiki_title, from, to);
      const found = findEditions(series);
      report.push({ slug: ev.slug, days: series.length, editions: found.length });

      if (!dryRun) {
        for (const e of found) {
          // Merges rather than skips. A historical pass can be MORE accurate
          // than a live freeze: SDCC 2026 was frozen at 0.82x because its spike
          // had already rolled out of the 27-day curve, while eight years of
          // daily views put it at 9.71x. Measurements only move up, and the
          // movers list is never touched — see merge_backfilled_edition.
          const { error: mErr } = await sb.rpc('merge_backfilled_edition', {
            p_slug: ev.slug,
            p_edition: e.year,
            p_headline: ev.headline,
            p_accent: ev.accent,
            p_live_from: e.liveFrom,
            p_live_to: e.liveTo,
            p_curve: e.curve,
            p_baseline: e.baseline,
            p_peak: e.peak,
            p_spike: e.spikeRatio,
          });
          if (!mErr) inserted++;
        }
      }
      // Wikimedia asks for courteous pacing and this job is never urgent.
      await sleep(250);
    } catch (err) {
      report.push({ slug: ev.slug, error: err instanceof Error ? err.message : 'failed' });
    }
  }

  return json({ events: events?.length ?? 0, inserted, dryRun, report });
});
