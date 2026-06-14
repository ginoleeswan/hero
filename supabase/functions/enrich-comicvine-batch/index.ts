// supabase/functions/enrich-comicvine-batch/index.ts
//
// Phase 2 of decoupling the app from ComicVine: move enrichment OFF the render
// path into a resumable, popularity-ordered background drain.
//
// The character screen used to call get-comicvine-hero live on (almost) every
// view. With the comicvine_status gate (Phase 1) it now only fetches heroes that
// are still `pending`. This function drains that backlog proactively so users
// land on already-enriched rows, and the live per-view fetch becomes a rare
// fallback instead of the norm.
//
// Design (mirrors the existing backfill-* batch functions):
//   * Manually triggered (POST). Resumable — each run grabs the next slice of
//     `pending` heroes by issue_count desc and flips their status, so repeated
//     calls walk the backlog with no separate cursor table.
//   * Uses the stored `comicvine_id` when present → one character call instead of
//     a name-search + detail, and no fragile name matching. Falls back to a name
//     search only when comicvine_id is missing.
//   * Writes the SAME columns/shapes as get-comicvine-hero so the client renders
//     identically regardless of which path enriched the row.
//
// POST body:
//   { limit?: number }       batch size, 1–50 (default 25)
//   { retryFailed?: boolean } also pick up rows previously marked 'failed'
//
// ComicVine throttles aggressively (~1 req/sec, ~200/hr per resource) and each
// hero costs several calls, so keep batches modest and run in bursts.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

const COMICVINE_API_KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';

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

// Pull a capped, de-duplicated name list out of a ComicVine relation array.
const nameList = (arr: unknown, cap: number): string[] =>
  Array.isArray(arr)
    ? arr
        .map((e) =>
          e && typeof (e as Record<string, unknown>).name === 'string'
            ? ((e as Record<string, unknown>).name as string)
            : null,
        )
        .filter((n): n is string => n !== null)
        .slice(0, cap)
    : [];

const cvParams = (extra: Record<string, string>) =>
  new URLSearchParams({ api_key: COMICVINE_API_KEY, format: 'json', ...extra });

// done  -> enriched and written
// failed-> ComicVine genuinely has no match for this hero (terminal; won't retry
//          unless explicitly asked via retryFailed)
// retry -> transient (rate limit / 5xx / network) — leave the row `pending` so
//          the next run picks it up again. Critical for the unattended cron:
//          a momentary ComicVine throttle must NOT permanently park a real hero.
type EnrichOutcome = 'done' | 'failed' | 'retry';

// Classify a non-OK ComicVine HTTP response. 420 is ComicVine's own
// "rate limit exceeded"; 429/5xx are transient too. Anything else (404, etc.)
// we treat as terminal.
const classifyHttp = (status: number): EnrichOutcome =>
  status === 420 || status === 429 || status >= 500 ? 'retry' : 'failed';

/**
 * Enrich one hero from ComicVine and persist every column. Identical parsing and
 * storage shape to get-comicvine-hero — kept self-contained because this project
 * deploys edge functions without cross-function `_shared` imports.
 */
async function enrichHero(
  sb: SB,
  hero: { id: string; name: string; comicvine_id: string | null },
): Promise<EnrichOutcome> {
  // ── Resolve the ComicVine character + its lightweight fields ────────────────
  // Prefer the stored comicvine_id (one direct call, no name ambiguity). Only
  // fall back to a name search when we have no id on file.
  let cvId = hero.comicvine_id;
  let summary: string | null = null;
  let publisher: string | null = null;
  let charImageUrl: string | null = null;
  let firstIssueId: string | null = null;

  const CHAR_FIELDS = [
    'id',
    'image',
    'deck',
    'publisher',
    'first_appeared_in_issue',
    'powers',
    'origin',
    'character_enemies',
    'character_friends',
    'creators',
    'count_of_issue_appearances',
    'movies',
    'description',
    'teams',
  ].join(',');

  let d: Record<string, unknown> = {};

  if (cvId) {
    const res = await fetch(
      `${COMICVINE_BASE}/character/4005-${cvId}/?${cvParams({ field_list: CHAR_FIELDS })}`,
    );
    if (!res.ok) return classifyHttp(res.status);
    const body = await res.json();
    // ComicVine rate limit is HTTP 200 + status_code 107 — transient, retry later.
    if (body?.status_code === 107) return 'retry';
    d = body.results ?? {};
    if (!d || !d.id) return 'failed';
  } else {
    // No id on file — search by name to discover it, then fetch full detail.
    const listRes = await fetch(
      `${COMICVINE_BASE}/characters/?${cvParams({
        filter: `name:${hero.name}`,
        field_list: 'id',
        limit: '1',
      })}`,
    );
    if (!listRes.ok) return classifyHttp(listRes.status);
    const listBody = await listRes.json();
    // Rate limited (HTTP 200 + status_code 107) — transient, leave row pending.
    if (listBody?.status_code === 107) return 'retry';
    const match = listBody.results?.[0];
    if (!match?.id) return 'failed';
    cvId = String(match.id);
    const res = await fetch(
      `${COMICVINE_BASE}/character/4005-${cvId}/?${cvParams({ field_list: CHAR_FIELDS })}`,
    );
    if (!res.ok) return classifyHttp(res.status);
    const body = await res.json();
    // ComicVine rate limit is HTTP 200 + status_code 107 — transient, retry later.
    if (body?.status_code === 107) return 'retry';
    d = body.results ?? {};
    if (!d || !d.id) return 'failed';
  }

  summary = (d.deck as string | null) ?? null;
  publisher = (d.publisher as { name?: string } | null)?.name ?? null;
  // Character art — store the largest variant into image_url (the source the AI
  // portrait generator reads). Only set when ComicVine returns art (never null it).
  const cvImage = d.image as Record<string, string> | null;
  charImageUrl =
    cvImage?.super_url ?? cvImage?.original_url ?? cvImage?.screen_large_url ?? cvImage?.medium_url ?? null;
  const fai = d.first_appeared_in_issue as { id?: number | string } | null;
  firstIssueId = fai?.id != null ? String(fai.id) : null;

  // ── First issue (cover + credits) ───────────────────────────────────────────
  let firstIssueImageUrl: string | null = null;
  let firstIssueData: Record<string, unknown> | null = null;
  if (firstIssueId) {
    const issueRes = await fetch(
      `${COMICVINE_BASE}/issue/4000-${firstIssueId}/?${cvParams({
        field_list:
          'id,image,name,cover_date,store_date,issue_number,deck,volume,person_credits,first_appearance_characters',
      })}`,
    );
    if (issueRes.ok) {
      const r = (await issueRes.json()).results ?? {};
      firstIssueImageUrl = r.image?.medium_url ?? null;
      const personCredits = nameList(r.person_credits, 5);
      const debutCharacters = nameList(r.first_appearance_characters, 8);
      firstIssueData = {
        id: firstIssueId,
        imageUrl: firstIssueImageUrl,
        name: r.name ?? null,
        coverDate: r.cover_date ?? null,
        storeDate: r.store_date ?? null,
        issueNumber: r.issue_number != null ? String(r.issue_number) : null,
        deck: r.deck ?? null,
        seriesName: r.volume?.name ?? null,
        personCredits: personCredits.length > 0 ? personCredits : null,
        debutCharacters: debutCharacters.length > 0 ? debutCharacters : null,
      };
    }
  }

  // ── Detail fields (already fetched in `d`) ──────────────────────────────────
  const rawPowers = nameList(d.powers, 100);
  const powers = rawPowers.length > 0 ? rawPowers : null;

  const rawDesc = typeof d.description === 'string' ? d.description.trim() : '';
  const description = rawDesc.length > 0 ? rawDesc : null;

  const origin = typeof (d.origin as { name?: string } | null)?.name === 'string'
    ? (d.origin as { name: string }).name
    : null;

  const issueCount =
    typeof d.count_of_issue_appearances === 'number' ? d.count_of_issue_appearances : null;

  const rawCreators = nameList(d.creators, 5);
  const creators = rawCreators.length > 0 ? rawCreators : null;

  // Enemies/friends arrive alphabetically — store a wide slice; the UI resolves
  // them to heroes and re-orders by popularity (same as get-comicvine-hero).
  const rawEnemies = nameList(d.character_enemies, 120);
  const enemies = rawEnemies.length > 0 ? rawEnemies : null;
  const rawFriends = nameList(d.character_friends, 120);
  const friends = rawFriends.length > 0 ? rawFriends : null;

  const rawTeams = nameList(d.teams, 20);
  const teams = rawTeams.length > 0 ? rawTeams : null;

  // ── Movies (+ poster/meta for the first 10) ─────────────────────────────────
  const rawMovieItems: Array<{
    name: string;
    year: string | null;
    apiDetailUrl: string | null;
    url: string | null;
  }> = Array.isArray(d.movies)
    ? d.movies
        .filter((m: unknown) => m && typeof (m as Record<string, unknown>).name === 'string')
        .map((m: unknown) => {
          const mo = m as Record<string, unknown>;
          const date = typeof mo.date === 'string' ? mo.date : null;
          return {
            name: mo.name as string,
            year: date ? date.slice(0, 4) : null,
            apiDetailUrl: typeof mo.api_detail_url === 'string' ? mo.api_detail_url : null,
            url: typeof mo.site_detail_url === 'string' ? mo.site_detail_url : null,
          };
        })
    : [];

  const movieCount = rawMovieItems.length > 0 ? rawMovieItems.length : null;

  const enrichedMovies = await Promise.all(
    rawMovieItems.slice(0, 10).map(async ({ name, year, apiDetailUrl, url }) => {
      const blank = {
        name,
        year,
        imageUrl: null,
        url,
        rating: null,
        runtime: null,
        deck: null,
        totalRevenue: null,
      };
      if (!apiDetailUrl) return blank;
      try {
        const res = await fetch(
          `${apiDetailUrl}?${cvParams({ field_list: 'image,rating,runtime,deck,total_revenue' })}`,
        );
        if (!res.ok) return blank;
        const r = (await res.json()).results ?? {};
        return {
          name,
          year,
          imageUrl: r.image?.medium_url ?? null,
          url,
          rating: typeof r.rating === 'string' ? r.rating : null,
          runtime: r.runtime != null ? String(r.runtime) : null,
          deck: typeof r.deck === 'string' && r.deck.trim() ? r.deck.trim() : null,
          totalRevenue: r.total_revenue != null ? String(r.total_revenue) : null,
        };
      } catch {
        return blank;
      }
    }),
  );
  // Append any movies beyond the first 10 without poster/meta (parity with the
  // shape get-comicvine-hero stores: every listed movie is present).
  const restMovies = rawMovieItems.slice(10).map(({ name, year, url }) => ({
    name,
    year,
    imageUrl: null,
    url,
    rating: null,
    runtime: null,
    deck: null,
    totalRevenue: null,
  }));
  const movies = [...enrichedMovies, ...restMovies];

  // ── Persist ─────────────────────────────────────────────────────────────────
  await sb
    .from('heroes')
    .update({
      ...(charImageUrl ? { image_url: charImageUrl } : {}),
      summary,
      publisher,
      comicvine_status: 'done',
      powers,
      description,
      origin,
      issue_count: issueCount,
      creators,
      enemies,
      friends,
      movies: movies.length > 0 ? (movies as unknown as Record<string, unknown>[]) : null,
      movie_count: movieCount,
      teams,
      first_issue_image_url: firstIssueImageUrl,
      first_issue_id: firstIssueId,
      first_issue_data: firstIssueData,
      comicvine_enriched_at: new Date().toISOString(),
      comicvine_id: cvId ?? undefined,
    })
    .eq('id', hero.id);

  return 'done';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const startedAt = Date.now();
  let limit = 25;
  let retryFailed = false;
  let triggeredBy = 'cron';
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === 'number') limit = Math.min(Math.max(1, body.limit), 50);
    if (body?.retryFailed === true) retryFailed = true;
    if (typeof body?.triggeredBy === 'string') triggeredBy = body.triggeredBy;
  } catch {
    /* empty body is fine */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Next slice of the backlog, most-viewed first.
  const statuses = retryFailed ? ['pending', 'failed'] : ['pending'];
  const { data: batch, error: batchErr } = await sb
    .from('heroes')
    .select('id, name, comicvine_id')
    .in('comicvine_status', statuses)
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (batchErr) return json({ error: batchErr.message }, 500);
  if (!batch || batch.length === 0) {
    return json({ processed: 0, done: 0, failed: 0, remaining: 0, message: 'backlog empty' });
  }

  let done = 0;
  let failed = 0;
  let retry = 0;
  let cancelled = false;

  // ── Log the run as `running` up front so the admin console sees it live ──────
  const { data: runRow } = await sb
    .from('enrichment_runs')
    .insert({
      run_type: retryFailed ? 'comicvine_retry' : 'comicvine_drain',
      triggered_by: triggeredBy,
      status: 'running',
      started_at: new Date(startedAt).toISOString(),
      processed: batch.length,
    })
    .select('id')
    .single();
  const runId = (runRow as { id?: number } | null)?.id ?? null;

  try {
    for (const hero of batch as Array<{ id: string; name: string; comicvine_id: string | null }>) {
      let outcome: EnrichOutcome;
      try {
        outcome = await enrichHero(sb, hero);
      } catch (err) {
        // Network/exception — transient. Leave pending so a later run retries.
        console.error('[enrich-comicvine-batch] hero threw', hero.id, err);
        outcome = 'retry';
      }
      if (outcome === 'done') {
        done++;
      } else if (outcome === 'failed') {
        // Terminal: ComicVine has no match. Park it so we stop retrying.
        failed++;
        await sb.from('heroes').update({ comicvine_status: 'failed' }).eq('id', hero.id);
      } else {
        // Transient: leave the row `pending` untouched — next run tries again.
        retry++;
      }
      // Push live progress every few heroes AND check for a stop request in the
      // same round trip (the admin console sets cancel_requested via RPC).
      if (runId != null && (done + failed + retry) % 3 === 0) {
        const { data: ctrl } = await sb
          .from('enrichment_runs')
          .update({ done, failed, retry })
          .eq('id', runId)
          .select('cancel_requested')
          .single();
        if ((ctrl as { cancel_requested?: boolean } | null)?.cancel_requested) {
          cancelled = true;
          break;
        }
      }
      // Be polite to ComicVine between heroes (each hero already made several calls).
      await sleep(350);
    }

    const { count: remaining } = await sb
      .from('heroes')
      .select('*', { count: 'exact', head: true })
      .eq('comicvine_status', 'pending');

    // ── Finalise the run + log ComicVine usage ────────────────────────────────
    if (runId != null) {
      await sb
        .from('enrichment_runs')
        .update({
          status: cancelled ? 'stopped' : 'done',
          done,
          failed,
          retry,
          remaining: remaining ?? null,
          duration_ms: Date.now() - startedAt,
        })
        .eq('id', runId);
    }
    await sb.from('api_usage').insert({ api: 'comicvine', endpoint: 'character', units: batch.length });

    return json({ processed: batch.length, done, failed, retry, remaining: remaining ?? null });
  } catch (err) {
    // Hard failure mid-run — mark the run errored so it never silently vanishes.
    if (runId != null) {
      await sb
        .from('enrichment_runs')
        .update({ status: 'error', done, failed, retry, duration_ms: Date.now() - startedAt })
        .eq('id', runId);
    }
    console.error('[enrich-comicvine-batch] run failed', err);
    return json({ error: String(err) }, 500);
  }
});
