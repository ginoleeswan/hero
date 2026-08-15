// sync-wiki-pageviews: refresh each hero's last-7 vs prior-7 Wikipedia pageviews
// and a spike ratio, from the free Wikimedia Pageviews REST API. Processes the
// stalest rows first; cron cycles all heroes daily. The pageviews API lags ~1-2
// days, so the window ends today-2.
//
// POST body: { limit?: number (default 60), triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;
const WM = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents';
const UA = { 'User-Agent': 'mythique/1.0 (https://mythique.app)' };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let limit = 60;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.limit === 'number') limit = Math.min(Math.max(1, b.limit), 120);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }
  const sb: SB = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  // Window: 14 days ending today-2. Build the expected calendar dates.
  const end = new Date(Date.now() - 2 * 86_400_000);
  const start = new Date(end.getTime() - 13 * 86_400_000);
  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) dates.push(ymd(d));
  const weekDates = new Set(dates.slice(7)); // most recent 7
  const prevDates = new Set(dates.slice(0, 7)); // the 7 before

  const { data } = await sb
    .from('heroes')
    .select('id, enwiki_title')
    .not('enwiki_title', 'is', null)
    .neq('enwiki_title', '')
    .order('pageviews_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  const rows = (data ?? []) as Array<{ id: string; enwiki_title: string }>;

  let processed = 0;
  let failed = 0;
  for (const r of rows) {
    let week = 0;
    let prev = 0;
    // The full curve, not just the two sums. `pageviews_at` is when we looked;
    // only the series can say when the surge actually started, which is what
    // lets a spike become a timestamped Pulse event rather than an undated one.
    // Same data, same request — it was being parsed and dropped.
    let daily: Array<{ date: string; views: number }> = [];
    // Did we actually hear back? Distinct from "heard back, no views" — see the
    // write below, where the difference decides whether we touch the row at all.
    let ok = false;
    try {
      const article = encodeURIComponent(r.enwiki_title.replace(/ /g, '_'));
      const url = `${WM}/${article}/daily/${ymd(start)}/${ymd(end)}`;
      const res = await fetch(url, { headers: UA });
      ok = res.ok;
      if (res.ok) {
        const body = await res.json();
        for (const it of (body.items ?? []) as Array<{ timestamp: string; views: number }>) {
          const day = it.timestamp.slice(0, 8); // YYYYMMDD
          if (weekDates.has(day)) week += it.views ?? 0;
          else if (prevDates.has(day)) prev += it.views ?? 0;
          daily.push({
            date: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`,
            views: it.views ?? 0,
          });
        }
        daily.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      }
      // A real 404 counts as heard-back: the article does not exist, and zero is
      // the honest answer for it.
      if (res.status === 404) ok = true;
    } catch (_e) {
      /* network failure — `ok` stays false, handled at the write */
      daily = [];
    }

    // A FAILED fetch must not overwrite a curve we already have.
    //
    // This destroyed data. The write below is unconditional, so a rate-limited
    // or timed-out request stored pageviews_week = 0 and views_daily = null over
    // a perfectly good series: on 2026-08-15 it blanked Scarecrow (fame 76) and
    // Jiminy Cricket (72), both of which the Wikimedia API answers for happily
    // when asked again. Raising the batch size makes that more likely, not less,
    // because the failures are transient and load-related.
    //
    // views_daily is the input to the entire surge lane and cannot be
    // reconstructed — the API only serves a rolling window, so a series blanked
    // today loses whatever fell out of that window. Advance `pageviews_at` so the
    // rotation moves on and this row is not retried forever, and leave every
    // measurement exactly as it was.
    if (!ok) {
      await sb
        .from('heroes')
        .update({ pageviews_at: new Date().toISOString() })
        .eq('id', r.id);
      processed++;
      failed++;
      await sleep(120);
      continue;
    }
    const spike = (week + 1) / (prev + 1);
    await sb
      .from('heroes')
      .update({
        pageviews_week: week,
        pageviews_prev: prev,
        pageviews_spike: spike,
        // Null rather than [] on a failed fetch, so "never captured" stays
        // distinguishable from "captured, genuinely flat".
        views_daily: daily.length > 0 ? daily : null,
        pageviews_at: new Date().toISOString(),
      })
      .eq('id', r.id);
    processed++;
    await sleep(120);
  }

  if (processed > 0) await sb.from('api_usage').insert({ api: 'wikimedia', endpoint: 'pageviews', units: processed });
  // `failed` surfaced deliberately: a run that quietly skips half the batch
  // looks identical to a healthy one from the outside.
  return json({ processed, failed, triggeredBy });
});
