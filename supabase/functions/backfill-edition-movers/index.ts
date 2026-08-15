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
          const med = median(series.map((d) => d.views)) || 1;
          for (const e of editions) {
            const lo = shift(e.live_from, -PAD_BEFORE);
            const hi = shift(e.live_to, PAD_AFTER);
            let peak = 0;
            for (const d of series) if (d.date >= lo && d.date <= hi && d.views > peak) peak = d.views;
            if (peak < PEAK_MIN) continue;
            const spike = peak / med;
            if (spike < SPIKE_MIN) continue;
            rows.push({
              slug: e.slug,
              edition_slug: e.edition_slug,
              hero_id: h.id,
              spike: Math.round(spike * 100) / 100,
              peak,
            });
            hits++;
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
