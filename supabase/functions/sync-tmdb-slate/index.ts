// sync-tmdb-slate — ingest the UPCOMING slate, because the catalogue had none.
//
// Measured 2026-07-27: of 2,507 TMDB titles, 9 were released in the last year and
// exactly ONE had a future release date. The newest Avengers film in the whole
// table was Endgame (2019) — Avengers: Doomsday, Ghost Rider, Black Panther 3,
// VisionQuest and Clayface had no rows at all, on the same weekend SDCC made
// every one of them a headline and drove Doctor Doom to 197,899 pageviews.
//
// Nothing downstream could have shown that. `sync-title-videos` sweeps a release
// window, so with no upcoming rows it re-checked the same ~9 titles nightly; the
// Pulse rail's trailer lane was therefore structurally empty and comics filled it
// by default. This job is the upstream fix: it doesn't rank, score or render
// anything, it just makes the rows exist.
//
// It writes deliberately THIN rows — id/source/external_id/media_type/title plus
// whatever /discover already gave us — at enrich_status='pending'. The existing
// enrich-tmdb-batch drain then fills in credits, images, providers and (since
// 2026-07-26) the video list, so a trailer becomes visible without this function
// knowing anything about trailers.
//
// Never overwrites: upsert ignores duplicates, so a re-run can't clobber an
// enriched row with a stub.
//
// POST body: { dryRun?: boolean, aheadDays?: number, behindDays?: number,
//              maxPages?: number, triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? '';
const TMDB = 'https://api.themoviedb.org/3';
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

// Resolved at runtime via /search/keyword rather than hard-coded numeric ids:
// TMDB keyword ids are opaque, and a wrong constant would silently narrow the
// sweep to nothing with no error to notice.
const KEYWORDS = [
  'superhero',
  'based on comic',
  'marvel comics',
  'dc comics',
  'anime',
  'based on manga',
  'based on video game',
];

const img = (p: string | null | undefined, size: string) =>
  p ? `https://image.tmdb.org/t/p/${size}${p}` : null;

interface DiscoverRow {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  popularity?: number;
}

async function resolveKeywordIds(): Promise<number[]> {
  const ids: number[] = [];
  for (const k of KEYWORDS) {
    try {
      const res = await fetch(
        `${TMDB}/search/keyword?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(k)}`,
      );
      if (!res.ok) continue;
      const body = await res.json();
      // Exact-name match only. A fuzzy match here quietly widens the sweep to
      // whatever TMDB felt was similar, which is how an ingest job ends up
      // pulling in unrelated cinema.
      const hit = (body.results ?? []).find(
        (r: { id: number; name: string }) => r.name.toLowerCase() === k.toLowerCase(),
      );
      if (hit) ids.push(hit.id);
    } catch {
      /* one bad lookup shouldn't fail the sweep */
    }
    await sleep(80);
  }
  return ids;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!TMDB_API_KEY) return json({ skipped: 'TMDB_API_KEY not set' });

  let dryRun = false;
  let aheadDays = 730;
  let behindDays = 60;
  let maxPages = 5;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.dryRun === 'boolean') dryRun = b.dryRun;
    if (typeof b?.aheadDays === 'number') aheadDays = Math.min(Math.max(0, b.aheadDays), 1460);
    if (typeof b?.behindDays === 'number') behindDays = Math.min(Math.max(0, b.behindDays), 365);
    if (typeof b?.maxPages === 'number') maxPages = Math.min(Math.max(1, b.maxPages), 20);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }

  const sb: SB = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const day = 86_400_000;
  const from = new Date(Date.now() - behindDays * day).toISOString().slice(0, 10);
  const to = new Date(Date.now() + aheadDays * day).toISOString().slice(0, 10);

  const keywordIds = await resolveKeywordIds();
  if (keywordIds.length === 0) {
    return json({ error: 'no TMDB keywords resolved — refusing to sweep unfiltered' }, 500);
  }
  // `|` is OR in TMDB's filter grammar. A comma would be AND, which matches
  // almost nothing.
  const withKeywords = keywordIds.join('|');

  const candidates = new Map<string, Record<string, unknown>>();
  let apiCalls = 0;

  for (const kind of ['movie', 'tv'] as const) {
    const mediaType = kind === 'movie' ? 'film' : 'tv';
    const dateField = kind === 'movie' ? 'primary_release_date' : 'first_air_date';
    for (let page = 1; page <= maxPages; page++) {
      const url =
        `${TMDB}/discover/${kind}?api_key=${TMDB_API_KEY}` +
        `&with_keywords=${withKeywords}` +
        `&${dateField}.gte=${from}&${dateField}.lte=${to}` +
        `&sort_by=popularity.desc&include_adult=false&page=${page}`;
      const res = await fetch(url);
      apiCalls++;
      if (!res.ok) break;
      const body = await res.json();
      const rows = (body.results ?? []) as DiscoverRow[];
      if (rows.length === 0) break;

      for (const r of rows) {
        const id = `tmdb:${r.id}`;
        const title = r.title ?? r.name;
        if (!title) continue;
        candidates.set(id, {
          id,
          source: 'tmdb',
          external_id: String(r.id),
          media_type: mediaType,
          title,
          release_date: r.release_date || r.first_air_date || null,
          poster_url: img(r.poster_path, 'w500'),
          backdrop_url: img(r.backdrop_path, 'w1280'),
          overview: r.overview || null,
          enrich_status: 'pending',
        });
      }
      if (page >= (body.total_pages ?? 1)) break;
      await sleep(120);
    }
  }

  const all = [...candidates.values()];
  // Which of these does the catalogue already have? Reported separately so the
  // run is legible: "found 300, 280 already known, 20 new" is the useful shape.
  const ids = all.map((r) => r.id as string);
  const known = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb
      .from('titles')
      .select('id')
      .in('id', ids.slice(i, i + 200));
    for (const r of (data ?? []) as { id: string }[]) known.add(r.id);
  }
  const fresh = all.filter((r) => !known.has(r.id as string));

  if (dryRun) {
    return json({
      dryRun: true,
      keywordIds,
      window: { from, to },
      apiCalls,
      found: all.length,
      alreadyKnown: known.size,
      wouldInsert: fresh.length,
      sample: fresh.slice(0, 25).map((r) => ({
        title: r.title,
        media_type: r.media_type,
        release_date: r.release_date,
      })),
      triggeredBy,
    });
  }

  let inserted = 0;
  for (let i = 0; i < fresh.length; i += 100) {
    const batch = fresh.slice(i, i + 100);
    // ignoreDuplicates: an enriched row must never be replaced by a stub. Also
    // covers the latent id collision in this schema — `tmdb:<n>` carries no
    // media_type, so a TV id can equal a film id and the incumbent wins.
    const { error } = await sb.from('titles').upsert(batch, {
      onConflict: 'id',
      ignoreDuplicates: true,
    });
    if (!error) inserted += batch.length;
  }

  if (apiCalls > 0) {
    await sb.from('api_usage').insert({ api: 'tmdb', endpoint: 'discover', units: apiCalls });
  }
  return json({
    window: { from, to },
    apiCalls,
    found: all.length,
    alreadyKnown: known.size,
    inserted,
    triggeredBy,
  });
});
