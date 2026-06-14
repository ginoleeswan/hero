// supabase/functions/enrich-tmdb-batch/index.ts
//
// Resumable TMDB drain. Two phases per run:
//   match  — take pending tmdb_match_queue rows, /search/movie, on confident
//            match call register_film_match (creates films stub + appearance
//            edges); otherwise mark the queue row 'unmatched'.
//   enrich — take films rows still tmdb_status='pending', one detail call with
//            append_to_response, write media columns, flip to 'done'.
// TMDB has no hard rate limit (~50 req/s tolerated); a small delay keeps us polite.
//
// POST body: { limit?: number (1-50, default 25), phase?: 'match'|'enrich'|'both',
//              retryUnmatched?: boolean, triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const img = (p: string | null | undefined, size: string) => (p ? `${IMG}/${size}${p}` : null);

// ── matcher (mirror of src/lib/tmdb/match.ts) ───────────────────────────────
const ARTICLES = /^(the|a|an)\s+/;
const normalizeTitle = (t: string) =>
  t.toLowerCase().replace(/['']/g, '').replace(/-/g, '').replace(ARTICLES, '').replace(/[^a-z0-9]+/g, ' ').trim();
function similarity(a: string, b: string): number {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}
interface SearchResult { id: number; title: string; release_date: string | null }
function pickBestMatch(cvTitle: string, cands: SearchResult[], yearHint: string | null): SearchResult | null {
  const q = normalizeTitle(cvTitle);
  let best: SearchResult | null = null;
  let bestScore = 0;
  for (const c of cands) {
    let score = similarity(q, normalizeTitle(c.title));
    if (yearHint && c.release_date?.startsWith(yearHint)) score += 0.15;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= 0.6 ? best : null;
}

// ── mapper (mirror of src/lib/tmdb/mapFilm.ts) ──────────────────────────────
function mapDetails(d: Record<string, any>) {
  const videos: any[] = d.videos?.results ?? [];
  const trailer = videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ?? videos.find((v) => v.site === 'YouTube');
  const cast = (d.credits?.cast ?? []).slice(0, 10).map((c: any) => ({
    name: c.name, character: c.character?.trim() ? c.character : null, profile_url: img(c.profile_path, 'w185'),
  }));
  const stills = (d.images?.backdrops ?? []).slice(0, 8).map((b: any) => img(b.file_path, 'w780')).filter(Boolean);
  const providers = d['watch/providers']?.results ?? null;
  return {
    title: d.title, release_date: d.release_date || null,
    poster_url: img(d.poster_path, 'w500'), backdrop_url: img(d.backdrop_path, 'w1280'),
    overview: d.overview?.trim() ? d.overview : null,
    vote_average: typeof d.vote_average === 'number' ? d.vote_average : null,
    runtime: typeof d.runtime === 'number' ? d.runtime : null,
    revenue: typeof d.revenue === 'number' && d.revenue > 0 ? d.revenue : null,
    trailer_key: trailer?.key ?? null,
    watch_providers: providers && Object.keys(providers).length > 0 ? providers : null,
    cast_members: cast.length > 0 ? cast : null,
    stills: stills.length > 0 ? stills : null,
  };
}

async function runMatch(sb: SB, limit: number, retryUnmatched: boolean): Promise<number> {
  const statuses = retryUnmatched ? ['pending', 'unmatched'] : ['pending'];
  const { data: rows } = await sb
    .from('tmdb_match_queue').select('cv_name, cv_year').in('status', statuses).limit(limit);
  if (!rows || rows.length === 0) return 0;
  let calls = 0;
  for (const row of rows as Array<{ cv_name: string; cv_year: string | null }>) {
    calls++;
    try {
      const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(row.cv_name)}${row.cv_year ? `&year=${encodeURIComponent(row.cv_year)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) { await sleep(250); continue; } // transient: leave pending
      const body = await res.json();
      const best = pickBestMatch(row.cv_name, (body.results ?? []) as SearchResult[], row.cv_year);
      if (best) {
        await sb.rpc('register_film_match', {
          p_cv_name: row.cv_name, p_tmdb_id: String(best.id), p_media_type: 'movie', p_title: best.title,
        });
      } else {
        await sb.from('tmdb_match_queue').update({ status: 'unmatched' }).eq('cv_name', row.cv_name);
      }
    } catch (err) {
      console.error('[enrich-tmdb-batch] match threw', row.cv_name, err); // leave pending
    }
    await sleep(120);
  }
  return calls;
}

async function runEnrich(sb: SB, limit: number): Promise<number> {
  const { data: films } = await sb
    .from('films').select('tmdb_id').eq('tmdb_status', 'pending').limit(limit);
  if (!films || films.length === 0) return 0;
  let calls = 0;
  for (const f of films as Array<{ tmdb_id: string }>) {
    calls++;
    try {
      const url = `${TMDB_BASE}/movie/${f.tmdb_id}?api_key=${TMDB_API_KEY}&append_to_response=videos,watch/providers,credits,images`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) await sb.from('films').update({ tmdb_status: 'failed' }).eq('tmdb_id', f.tmdb_id);
        await sleep(250); continue;
      }
      const mapped = mapDetails(await res.json());
      await sb.from('films').update({ ...mapped, tmdb_status: 'done', tmdb_enriched_at: new Date().toISOString() }).eq('tmdb_id', f.tmdb_id);
    } catch (err) {
      console.error('[enrich-tmdb-batch] enrich threw', f.tmdb_id, err); // leave pending
    }
    await sleep(120);
  }
  return calls;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  const startedAt = Date.now();
  let limit = 25, phase: 'match' | 'enrich' | 'both' = 'both', retryUnmatched = false, triggeredBy = 'cron';
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === 'number') limit = Math.min(Math.max(1, body.limit), 50);
    if (body?.phase === 'match' || body?.phase === 'enrich' || body?.phase === 'both') phase = body.phase;
    if (body?.retryUnmatched === true) retryUnmatched = true;
    if (typeof body?.triggeredBy === 'string') triggeredBy = body.triggeredBy;
  } catch { /* empty body ok */ }

  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  const { data: runRow } = await sb.from('enrichment_runs').insert({
    run_type: 'tmdb_drain', triggered_by: triggeredBy, status: 'running',
    started_at: new Date(startedAt).toISOString(),
  }).select('id').single();
  const runId = (runRow as { id?: number } | null)?.id ?? null;

  let matchCalls = 0, enrichCalls = 0;
  try {
    if (phase === 'match' || phase === 'both') matchCalls = await runMatch(sb, limit, retryUnmatched);
    if (phase === 'enrich' || phase === 'both') enrichCalls = await runEnrich(sb, limit);
  } catch (err) {
    if (runId != null) await sb.from('enrichment_runs').update({ status: 'error' }).eq('id', runId);
    return json({ error: String(err) }, 500);
  }

  const totalCalls = matchCalls + enrichCalls;
  if (totalCalls > 0) await sb.from('api_usage').insert({ api: 'tmdb', endpoint: phase, units: totalCalls });
  if (runId != null) await sb.from('enrichment_runs').update({
    status: 'done', done: totalCalls, processed: totalCalls, duration_ms: Date.now() - startedAt,
  }).eq('id', runId);

  return json({ phase, matchCalls, enrichCalls, message: totalCalls === 0 ? 'nothing to do' : 'ok' });
});
