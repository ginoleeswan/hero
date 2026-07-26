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
import { mapVideoRows } from '../_shared/videos.ts';

type SB = ReturnType<typeof createClient>;

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const img = (p: string | null | undefined, size: string) => (p ? `${IMG}/${size}${p}` : null);

// ── extras builder (mirror of src/lib/tmdb/extras.ts) ───────────────────────
const yr = (s: string | null | undefined) => {
  const y = s ? parseInt(s.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? y : null;
};
function buildExtras(d: Record<string, any>, kind: 'movie' | 'tv') {
  const genres = (d.genres ?? []).map((g: any) => g.name).filter(Boolean);
  const crew: any[] = d.credits?.crew ?? [];
  const director = kind === 'movie' ? (crew.find((c) => c.job === 'Director')?.name ?? null) : null;
  const WRITER = new Set(['Writer', 'Screenplay', 'Story']);
  const writers =
    kind === 'tv'
      ? (d.created_by ?? []).map((c: any) => c.name).filter(Boolean)
      : [...new Set(crew.filter((c) => WRITER.has(c.job)).map((c) => c.name).filter(Boolean))].slice(
          0,
          3,
        );
  const kwSrc = kind === 'movie' ? d.keywords?.keywords : d.keywords?.results;
  const keywords = (kwSrc ?? []).map((k: any) => k.name).filter(Boolean).slice(0, 15);
  let certification: string | null = null;
  if (kind === 'movie') {
    const us = d.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
    certification =
      us?.release_dates?.map((x: any) => x.certification).find((c: string) => c && c.trim()) ?? null;
  } else {
    const us = d.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US');
    certification = us?.rating?.trim() ? us.rating : null;
  }
  const ext = d.external_ids ?? {};
  const externalIds = {
    imdb: ext.imdb_id ?? null,
    instagram: ext.instagram_id ?? null,
    twitter: ext.twitter_id ?? null,
    facebook: ext.facebook_id ?? null,
    homepage: d.homepage?.trim() ? d.homepage : null,
  };
  const hasExt = Object.values(externalIds).some((v) => v !== null);
  const recommendations = (d.recommendations?.results ?? [])
    .slice(0, 12)
    .map((r: any) => ({
      id: `tmdb:${r.id}`,
      title: (r.title ?? r.name ?? '').trim(),
      posterUrl: img(r.poster_path, 'w342'),
      year: yr(r.release_date ?? r.first_air_date),
    }))
    .filter((r: any) => r.title);
  const reviews = (d.reviews?.results ?? [])
    .slice(0, 5)
    .map((r: any) => ({
      author: (r.author ?? 'Anonymous').trim(),
      rating: typeof r.author_details?.rating === 'number' ? r.author_details.rating : null,
      content: (r.content ?? '').trim(),
      url: r.url ?? null,
    }))
    .filter((r: any) => r.content);
  const spokenLanguages = (d.spoken_languages ?? [])
    .map((l: any) => l.english_name ?? l.name)
    .filter(Boolean);
  const productionCompanies = (d.production_companies ?? []).map((c: any) => c.name).filter(Boolean);
  const productionCountries = (d.production_countries ?? []).map((c: any) => c.name).filter(Boolean);
  const col = d.belongs_to_collection;
  const collection =
    col && col.id && col.name
      ? { id: `tmdb-collection:${col.id}`, name: col.name, posterUrl: img(col.poster_path, 'w342') }
      : null;
  const nn = <T>(a: T[]): T[] | null => (a.length ? a : null);
  return {
    genres: nn(genres),
    tagline: d.tagline?.trim() ? d.tagline : null,
    certification,
    director,
    writers: nn(writers),
    keywords: nn(keywords),
    externalIds: hasExt ? externalIds : null,
    recommendations: nn(recommendations),
    reviews: nn(reviews),
    status: d.status?.trim() ? d.status : null,
    budget: typeof d.budget === 'number' && d.budget > 0 ? d.budget : null,
    originalLanguage: d.original_language?.trim() ? d.original_language : null,
    spokenLanguages: nn(spokenLanguages),
    productionCompanies: nn(productionCompanies),
    productionCountries: nn(productionCountries),
    voteCount: typeof d.vote_count === 'number' ? d.vote_count : null,
    collection,
  };
}

// ── matcher (mirror of src/lib/tmdb/match.ts) ───────────────────────────────
const ARTICLES = /^(the|a|an)\s+/;
const normalizeTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/-/g, '')
    .replace(ARTICLES, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
function similarity(a: string, b: string): number {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}
interface SearchResult {
  id: number;
  title: string;
  release_date: string | null;
}
function pickBestMatch(
  cvTitle: string,
  cands: SearchResult[],
  yearHint: string | null,
): SearchResult | null {
  const q = normalizeTitle(cvTitle);
  let best: SearchResult | null = null;
  let bestScore = 0;
  for (const c of cands) {
    let score = similarity(q, normalizeTitle(c.title));
    if (yearHint && c.release_date?.startsWith(yearHint)) score += 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 0.6 ? best : null;
}

// ── mapper (mirror of src/lib/tmdb/mapFilm.ts) ──────────────────────────────
function mapDetails(d: Record<string, any>) {
  const videos: any[] = d.videos?.results ?? [];
  const trailer =
    videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ??
    videos.find((v) => v.site === 'YouTube');
  const cast = (d.credits?.cast ?? []).slice(0, 10).map((c: any) => ({
    name: c.name,
    character: c.character?.trim() ? c.character : null,
    profile_url: img(c.profile_path, 'w185'),
  }));
  const stills = (d.images?.backdrops ?? [])
    .slice(0, 8)
    .map((b: any) => img(b.file_path, 'w780'))
    .filter(Boolean);
  const providers = d['watch/providers']?.results ?? null;
  return {
    title: d.title,
    release_date: d.release_date || null,
    poster_url: img(d.poster_path, 'w500'),
    backdrop_url: img(d.backdrop_path, 'w1280'),
    overview: d.overview?.trim() ? d.overview : null,
    vote_average: typeof d.vote_average === 'number' ? d.vote_average : null,
    popularity: typeof d.popularity === 'number' ? d.popularity : null,
    runtime: typeof d.runtime === 'number' ? d.runtime : null,
    revenue: typeof d.revenue === 'number' && d.revenue > 0 ? d.revenue : null,
    trailer_key: trailer?.key ?? null,
    watch_providers: providers && Object.keys(providers).length > 0 ? providers : null,
    cast_members: cast.length > 0 ? cast : null,
    stills: stills.length > 0 ? stills : null,
    details: buildExtras(d, 'movie'),
  };
}

async function runMatch(sb: SB, limit: number, retryUnmatched: boolean): Promise<number> {
  const statuses = retryUnmatched ? ['pending', 'unmatched'] : ['pending'];
  const { data: rows } = await sb
    .from('tmdb_match_queue')
    .select('cv_name, cv_year')
    .in('status', statuses)
    .limit(limit);
  if (!rows || rows.length === 0) return 0;
  let calls = 0;
  for (const row of rows as Array<{ cv_name: string; cv_year: string | null }>) {
    calls++;
    try {
      const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(row.cv_name)}${row.cv_year ? `&year=${encodeURIComponent(row.cv_year)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        await sleep(250);
        continue;
      } // transient: leave pending
      const body = await res.json();
      const best = pickBestMatch(row.cv_name, (body.results ?? []) as SearchResult[], row.cv_year);
      if (best) {
        await sb.rpc('register_film_match', {
          p_cv_name: row.cv_name,
          p_tmdb_id: String(best.id),
          p_media_type: 'movie',
          p_title: best.title,
        });
      } else {
        await sb
          .from('tmdb_match_queue')
          .update({ status: 'unmatched' })
          .eq('cv_name', row.cv_name);
      }
    } catch (err) {
      console.error('[enrich-tmdb-batch] match threw', row.cv_name, err); // leave pending
    }
    await sleep(120);
  }
  return calls;
}

// ── tv mapper (mirror of src/lib/tmdb/mapTv.ts) ─────────────────────────────
function mapTvDetails(d: Record<string, any>) {
  const videos: any[] = d.videos?.results ?? [];
  const trailer =
    videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ??
    videos.find((v) => v.site === 'YouTube');
  const cast = (d.credits?.cast ?? []).slice(0, 10).map((c: any) => ({
    name: c.name,
    character: c.character?.trim() ? c.character : null,
    profile_url: img(c.profile_path, 'w185'),
  }));
  const stills = (d.images?.backdrops ?? [])
    .slice(0, 8)
    .map((b: any) => img(b.file_path, 'w780'))
    .filter(Boolean);
  const providers = d['watch/providers']?.results ?? null;
  const networks = (d.networks ?? []).map((n: any) => n.name).filter(Boolean);
  const runtimes: number[] = Array.isArray(d.episode_run_time) ? d.episode_run_time : [];
  return {
    title: d.name,
    release_date: d.first_air_date || null,
    poster_url: img(d.poster_path, 'w500'),
    backdrop_url: img(d.backdrop_path, 'w1280'),
    overview: d.overview?.trim() ? d.overview : null,
    vote_average: typeof d.vote_average === 'number' ? d.vote_average : null,
    popularity: typeof d.popularity === 'number' ? d.popularity : null,
    trailer_key: trailer?.key ?? null,
    watch_providers: providers && Object.keys(providers).length > 0 ? providers : null,
    cast_members: cast.length > 0 ? cast : null,
    stills: stills.length > 0 ? stills : null,
    details: {
      ...buildExtras(d, 'tv'),
      seasons: typeof d.number_of_seasons === 'number' ? d.number_of_seasons : null,
      episodes: typeof d.number_of_episodes === 'number' ? d.number_of_episodes : null,
      episode_runtime: runtimes.length > 0 ? runtimes[0] : null,
      networks: networks.length > 0 ? networks : null,
    },
  };
}

async function runEnrich(sb: SB, limit: number): Promise<number> {
  const { data: titles } = await sb
    .from('titles')
    .select('id, external_id, media_type')
    .eq('source', 'tmdb')
    .in('media_type', ['film', 'tv'])
    .eq('enrich_status', 'pending')
    .limit(limit);
  if (!titles || titles.length === 0) return 0;
  let calls = 0;
  for (const t of titles as Array<{ id: string; external_id: string; media_type: string }>) {
    calls++;
    try {
      const path = t.media_type === 'tv' ? 'tv' : 'movie';
      const certParam = path === 'tv' ? 'content_ratings' : 'release_dates';
      const append = `videos,watch/providers,credits,images,recommendations,reviews,external_ids,keywords,${certParam}`;
      const url = `${TMDB_BASE}/${path}/${t.external_id}?api_key=${TMDB_API_KEY}&append_to_response=${append}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404)
          await sb.from('titles').update({ enrich_status: 'failed' }).eq('id', t.id);
        await sleep(250);
        continue;
      }
      const body = await res.json();
      const mapped = t.media_type === 'tv' ? mapTvDetails(body) : mapDetails(body);
      await sb
        .from('titles')
        .update({ ...mapped, enrich_status: 'done', enriched_at: new Date().toISOString() })
        .eq('id', t.id);

      // Persist the whole video list, not just the one trailer key the mappers
      // above keep. These were already fetched by the append_to_response on this
      // very request, so it costs no extra call — and published_at is the only
      // "a trailer just dropped" timestamp available anywhere in the stack.
      // Best-effort: a failure here must never undo the enrichment above.
      const { rows: videos } = mapVideoRows(t.id, body?.videos?.results);
      if (videos.length > 0) {
        const { error: vErr } = await sb
          .from('title_videos')
          .upsert(videos, { onConflict: 'id' });
        if (vErr) console.warn('[enrich-tmdb-batch] title_videos upsert', t.id, vErr.message);
      }
    } catch (err) {
      console.error('[enrich-tmdb-batch] enrich threw', t.id, err); // leave pending
    }
    await sleep(120);
  }
  return calls;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  const startedAt = Date.now();
  let limit = 25,
    phase: 'match' | 'enrich' | 'both' = 'both',
    retryUnmatched = false,
    triggeredBy = 'cron';
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === 'number') limit = Math.min(Math.max(1, body.limit), 50);
    if (body?.phase === 'match' || body?.phase === 'enrich' || body?.phase === 'both')
      phase = body.phase;
    if (body?.retryUnmatched === true) retryUnmatched = true;
    if (typeof body?.triggeredBy === 'string') triggeredBy = body.triggeredBy;
  } catch {
    /* empty body ok */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: runRow } = await sb
    .from('enrichment_runs')
    .insert({
      run_type: 'tmdb_drain',
      triggered_by: triggeredBy,
      status: 'running',
      started_at: new Date(startedAt).toISOString(),
    })
    .select('id')
    .single();
  const runId = (runRow as { id?: number } | null)?.id ?? null;

  let matchCalls = 0,
    enrichCalls = 0;
  try {
    if (phase === 'match' || phase === 'both')
      matchCalls = await runMatch(sb, limit, retryUnmatched);
    if (phase === 'enrich' || phase === 'both') enrichCalls = await runEnrich(sb, limit);
  } catch (err) {
    if (runId != null) await sb.from('enrichment_runs').update({ status: 'error' }).eq('id', runId);
    return json({ error: String(err) }, 500);
  }

  const totalCalls = matchCalls + enrichCalls;
  if (totalCalls > 0)
    await sb.from('api_usage').insert({ api: 'tmdb', endpoint: phase, units: totalCalls });
  if (runId != null)
    await sb
      .from('enrichment_runs')
      .update({
        status: 'done',
        done: totalCalls,
        processed: totalCalls,
        duration_ms: Date.now() - startedAt,
      })
      .eq('id', runId);

  return json({
    phase,
    matchCalls,
    enrichCalls,
    message: totalCalls === 0 ? 'nothing to do' : 'ok',
  });
});
