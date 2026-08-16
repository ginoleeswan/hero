// backfill-edition-movers — who the audience went to read about, in years already over.
//
// Every backfilled edition reads "measurement only", because heroes.views_daily
// is a rolling 27-day window and the movers for SDCC 2019 fell out of it years
// ago. That made the archive a shelf of curves: true, but not the thing worth
// reading. The recoverable part is that Wikimedia serves per-article daily views
// back to 2015 for CHARACTERS exactly as it does for events.
//
// Measured before building: during SDCC 2024 (25-29 July) Doctor Doom ran at
// 317x his own median — the RDJ-as-Doom reveal — against Deadpool at 4.3x and
// Wolverine at 2.8x the same week. That is the single best fact this app can
// state about a convention, and no news site publishes it.
//
// Shape of the work: one API call per HERO covers every edition window at once,
// so the sweep is hero-ordered and the output is edition-ordered. Hits are
// staged in edition_mover_hits and folded in by apply_backfilled_movers() at the
// end. `heroes.movers_backfilled_at` is the cursor, so ~1,500 heroes can be
// swept across many invocations without an edition ever holding half its movers.
//
// POST body: { limit?: number, apply?: boolean, minFame?: number }

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

const WM =
  'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user';
const UA = { 'User-Agent': 'Mythique/1.0 (mythique.app)' };

/** Lift over the character's OWN median required to count as moved. Same bar as
 *  the live surge lane, so an archived mover means what a live one means. */
const SPIKE_MIN = 2.5;
/** Absolute floor on the windowed peak. Lower than the live lane's 1,500/week
 *  because this is a peak DAY inside a known event window rather than a rolling
 *  weekly total — but still high enough that a quiet article cannot turn a
 *  handful of extra reads into a 3x. */
const PEAK_MIN = 400;

// ── the three guards that were missing ──────────────────────────────────────
// Measured against the 137 editions this function had already filled. The three
// numbers below are not taste; each one is answering a specific wrong row.

/** Minimum median daily views for the article to be scorable at all.
 *
 *  `spike` is peak/median, and median was falling back to 1 when the series was
 *  effectively empty — so a character whose `enwiki_title` is a REDIRECT (which
 *  Wikimedia serves almost no direct views for) scored spike = raw peak count.
 *  Luigi was being ranked on a baseline of 1 view/day, Beast on 3, Yelena Belova
 *  on 5. Beast's smallest "spike" across 64 editions was 134x and his largest
 *  was 8,493x, which is not a character breaking out, it is a division by
 *  nothing.
 *
 *  40/day is low enough to keep genuinely obscure characters who nonetheless
 *  have a real readership to move, and high enough that no redirect survives. */
const BASELINE_MIN = 40;

/** How exceptional this window has to be AMONG THIS CHARACTER'S OWN WINDOWS.
 *
 *  The old test compared a 5-day maximum against a 4,000-day median. For a
 *  right-skewed pageview series that is cleared by an ordinary busy week, so it
 *  measured "is this character volatile" and reported it as "this event moved
 *  this character". Bowser cleared it in 84 of 137 windows — 61% of every event
 *  in the archive, including Angouleme, Lucca and Comiket — with a FLOOR of
 *  6.2x, so no threshold on spike could have separated signal from him.
 *
 *  Ranking the window against every same-length window in the character's own
 *  history fixes it by construction: a character who spikes constantly has a
 *  high bar to clear, and one who never does has a low one. 0.97 keeps roughly
 *  the top ten windows of a decade. */
const PCTILE_MIN = 0.97;

/** How far the window must beat the SAME CALENDAR WINDOW in other years.
 *
 *  Comiket runs in late December, so its top movers were Santa Claus and The
 *  Grinch. Those spikes are real and were measured correctly — they are just
 *  caused by Christmas, and Christmas is not a doujinshi convention. Anything
 *  that happens every year at this time is not news about this year.
 *
 *  Only applied when at least two other years are available; below that there is
 *  no seasonal claim to test, and refusing the hit would silently drop the
 *  earliest editions of every event. */
const SEASON_RATIO_MIN = 1.6;
const SEASON_MIN_YEARS = 2;
/** Days either side of the frozen window. A reveal lands the day OF, and the
 *  readership answers that evening and the morning after. */
const PAD_BEFORE = 1;
const PAD_AFTER = 3;

interface Edition {
  slug: string;
  edition_slug: string;
  live_from: string;
  live_to: string;
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const shift = (ymd: string, days: number): string =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

type Day = { date: string; views: number };

/**
 * Where `peak` ranks among the peaks of every same-length window in the series.
 *
 * This is the distinctiveness test, and it is the whole fix. Returns the
 * fraction of windows this one beats, so 0.99 means "higher than 99% of the
 * weeks this character has ever had" and 0.4 means "a Tuesday".
 *
 * Sliding maximum by brute force: `len` is at most a couple of weeks and the
 * series is a decade, so this is a few tens of thousands of comparisons per
 * character — far cheaper than the network call that fetched the series.
 */
function windowPercentile(series: Day[], len: number, peak: number): number {
  if (series.length <= len) return 0;
  let below = 0;
  let total = 0;
  for (let i = 0; i + len <= series.length; i++) {
    let m = 0;
    for (let k = 0; k < len; k++) if (series[i + k].views > m) m = series[i + k].views;
    total++;
    if (m < peak) below++;
  }
  return total ? below / total : 0;
}

/**
 * The same slice of the calendar, in every other year.
 *
 * Compares like with like — a late-December window against other late
 * Decembers — so an annual pattern cannot be sold as this year's news. Returns
 * the median of those other years' peaks, and how many years it found, so the
 * caller can decline to judge when there is nothing to compare against.
 */
function seasonalPeaks(series: Day[], from: string, to: string): { med: number; years: number } {
  const md = (d: string) => d.slice(5);
  const yr = (d: string) => Number(d.slice(0, 4));
  const targetYear = yr(from);
  const lo = md(from);
  const hi = md(to);
  // A window that crosses new year is not comparable this way — the month-day
  // range wraps — and no watched event does it. Skip rather than mis-handle.
  if (hi < lo) return { med: 0, years: 0 };

  const byYear = new Map<number, number>();
  for (const d of series) {
    const y = yr(d.date);
    if (y === targetYear) continue;
    const m = md(d.date);
    if (m < lo || m > hi) continue;
    byYear.set(y, Math.max(byYear.get(y) ?? 0, d.views));
  }
  const peaks = [...byYear.values()];
  return { med: median(peaks), years: peaks.length };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let limit = 40;
  let apply = false;
  let minFame = 25;
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.limit === 'number') limit = Math.min(Math.max(1, b.limit), 120);
    if (b?.apply === true) apply = true;
    if (typeof b?.minFame === 'number') minFame = b.minFame;
  } catch {
    /* empty body ok */
  }

  const sb: SB = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Fold-in pass. Separate call so it runs once, after the sweep is done.
  if (apply) {
    const { data, error } = await sb.rpc('apply_backfilled_movers');
    return error ? json({ error: error.message }, 500) : json({ applied: data });
  }

  const { data: eds } = await sb
    .from('event_editions')
    .select('slug, edition_slug, live_from, live_to');
  const editions = (eds ?? []) as unknown as Edition[];
  if (editions.length === 0) return json({ error: 'no editions to fill' }, 400);

  // Earliest window we care about bounds the fetch — no point pulling 2015.
  const from = editions.reduce((a, e) => (e.live_from < a ? e.live_from : a), '2999-01-01');
  const start = shift(from, -30).replace(/-/g, '');
  const end = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');

  // Popularity-ordered: the famous movers are the ones an archive page is for,
  // and a run that is interrupted should have done the useful half first.
  const { data: heroes, error } = await sb
    .from('heroes')
    .select('id, enwiki_title, fame_score')
    .is('movers_backfilled_at', null)
    .not('enwiki_title', 'is', null)
    .neq('enwiki_title', '')
    .gte('fame_score', minFame)
    // Same exclusion the live surge lane already applies. Kim Jong-il, Buffalo
    // Bill and Louis XI were all ranked as characters who "broke out" at comic
    // conventions — 59, 44 and 66 editions respectively. They are real people in
    // the catalogue, their articles move for reasons that are never a
    // convention, and no reader of an SDCC page wants them.
    .not('publisher', 'in', '("Non-Fictional","In the Public Domain")')
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return json({ error: error.message }, 500);

  let swept = 0;
  let hits = 0;
  const rows: Record<string, unknown>[] = [];

  for (const h of (heroes ?? []) as unknown as {
    id: string;
    enwiki_title: string;
    fame_score: number | null;
  }[]) {
    try {
      const url = `${WM}/${encodeURIComponent(h.enwiki_title.replace(/ /g, '_'))}/daily/${start}/${end}`;
      const res = await fetch(url, { headers: UA });
      if (res.ok) {
        const body = await res.json();
        const series = ((body.items ?? []) as { timestamp: string; views: number }[]).map((i) => ({
          date: `${i.timestamp.slice(0, 4)}-${i.timestamp.slice(4, 6)}-${i.timestamp.slice(6, 8)}`,
          views: i.views ?? 0,
        }));
        if (series.length >= 60) {
          // The character's own baseline across the whole span. A per-window
          // baseline would be contaminated by the very spike being measured.
          //
          // No `|| 1` fallback any more. That fallback was the single most
          // destructive line in this function: it turned "this article has no
          // readership" into "this article spiked by its entire view count", and
          // it is why a redirect page outranked Doctor Doom.
          const med = median(series.map((d) => d.views));
          if (med >= BASELINE_MIN) {
            for (const e of editions) {
              const lo = shift(e.live_from, -PAD_BEFORE);
              const hi = shift(e.live_to, PAD_AFTER);
              let peak = 0;
              for (const d of series)
                if (d.date >= lo && d.date <= hi && d.views > peak) peak = d.views;
              if (peak < PEAK_MIN) continue;

              const spike = peak / med;
              if (spike < SPIKE_MIN) continue;

              // Is this window remarkable for THIS character? The window length
              // is the event's own padded span, so a three-day convention is
              // ranked against every other three-day stretch of their decade.
              const len =
                Math.round((Date.parse(`${hi}T00:00:00Z`) - Date.parse(`${lo}T00:00:00Z`)) / 86_400_000) + 1;
              const pctile = windowPercentile(series, len, peak);
              if (pctile < PCTILE_MIN) continue;

              // Is it remarkable for this TIME OF YEAR? Christmas is not an
              // announcement.
              const season = seasonalPeaks(series, lo, hi);
              const seasonRatio = season.med > 0 ? peak / season.med : null;
              if (
                season.years >= SEASON_MIN_YEARS &&
                seasonRatio !== null &&
                seasonRatio < SEASON_RATIO_MIN
              )
                continue;

              rows.push({
                slug: e.slug,
                edition_slug: e.edition_slug,
                hero_id: h.id,
                spike: Math.round(spike * 100) / 100,
                peak,
                // Stored so the bar can be re-tuned in SQL without re-fetching
                // 1,500 Wikimedia series — which is why the old bar was never
                // revisited.
                baseline: Math.round(med * 100) / 100,
                window_pctile: Math.round(pctile * 10000) / 10000,
                season_ratio: seasonRatio === null ? null : Math.round(seasonRatio * 100) / 100,
              });
              hits++;
            }
          }
        }
      }
      // Marked swept even on a failed fetch: the cursor must advance or the
      // sweep stalls on one bad article forever. A miss costs one character in
      // one archive section, which is recoverable by clearing the column.
      await sb
        .from('heroes')
        .update({ movers_backfilled_at: new Date().toISOString() })
        .eq('id', h.id);
      swept++;
      await sleep(120);
    } catch {
      /* same reasoning: never let one article stall the sweep */
    }
  }

  if (rows.length) {
    await sb.from('edition_mover_hits').upsert(rows, {
      onConflict: 'slug,edition_slug,hero_id',
      ignoreDuplicates: true,
    });
  }

  const { count: remaining } = await sb
    .from('heroes')
    .select('id', { count: 'exact', head: true })
    .is('movers_backfilled_at', null)
    .not('enwiki_title', 'is', null)
    .neq('enwiki_title', '')
    .gte('fame_score', minFame);

  return json({ swept, hits, remaining: remaining ?? 0 });
});
