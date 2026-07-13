// supabase/functions/sync-tmdb-trending/index.ts
//
// Daily TMDB trending. Fetch /trending/all/day (films + TV), map each to a title
// we already have by its TMDB id, and stamp trending_rank (its position in the
// list) + trending_at. get_trending_on_screen surfaces titles on a rolling 7-day
// `trending_at` window, so we DON'T nuke every rank each run — that would discard
// the window's signal and collapse the feed on a thin-match day (the original bug).
// Instead each title keeps its last-known rank; we only clear ranks once a title
// has aged out of the window. Mirrors enrich-tmdb-batch's shape.
//
// POST body: { pages?: number (1-2, default 2), triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

interface TrendingResult {
  id: number;
  media_type: string; // 'movie' | 'tv' | 'person'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let pages = 2;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.pages === 'number') pages = Math.min(Math.max(1, b.pages), 2);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    // Collect trending film/tv ids in order across pages.
    const ordered: Array<{ externalId: string; mediaType: 'film' | 'tv' }> = [];
    for (let p = 1; p <= pages; p++) {
      const res = await fetch(`${TMDB_BASE}/trending/all/day?api_key=${TMDB_API_KEY}&page=${p}`);
      if (!res.ok) break;
      const body = await res.json();
      for (const r of (body.results ?? []) as TrendingResult[]) {
        if (r.media_type === 'movie') ordered.push({ externalId: String(r.id), mediaType: 'film' });
        else if (r.media_type === 'tv') ordered.push({ externalId: String(r.id), mediaType: 'tv' });
      }
    }

    // Retire ranks only for titles that have dropped out of the 7-day window the
    // reader uses — keeps the table tidy without erasing in-window signal.
    const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await sb
      .from('titles')
      .update({ trending_rank: null })
      .not('trending_rank', 'is', null)
      .lt('trending_at', windowStart);

    let matched = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < ordered.length; i++) {
      const { externalId, mediaType } = ordered[i];
      const { data } = await sb
        .from('titles')
        .update({ trending_rank: i + 1, trending_at: now })
        .eq('source', 'tmdb')
        .eq('external_id', externalId)
        .eq('media_type', mediaType)
        .select('id');
      if (data && data.length > 0) matched++;
    }

    if (ordered.length > 0)
      await sb.from('api_usage').insert({ api: 'tmdb', endpoint: 'trending', units: pages });
    return json({ fetched: ordered.length, matched, triggeredBy });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
