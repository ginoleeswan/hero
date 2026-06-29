// supabase/functions/backfill-cv-meta/index.ts
//
// Surgical, reversible backfill of THREE fields from ComicVine for the legacy
// SuperheroAPI roster (numeric ids). Those rows were marked comicvine_status
// 'done' at seed time without the full enrichment ever running, so they kept
// SuperheroAPI's free-text `publisher` (Groot→"Sirius Entertainment",
// Vegeta→"DC Comics") and never got `movie_count`. Each row already has a
// resolved `comicvine_id`, so we re-fetch deterministically BY ID (no fragile
// name search → no Bane↛Wolfsbane collisions) and overwrite ONLY:
//     publisher, issue_count, movie_count
// Curated text (description/powers/enemies/friends/summary/movies[]) is left
// untouched — unlike a full re-enrich. A backup table
// (heroes_meta_backup_20260629) snapshots the prior values for rollback.
//
// Resumable via an id cursor the caller threads through:
//   POST { afterId?: number, limit?: number }  (limit 1–50, default 25)
//   → { processed, updated, changes[], lastId, remaining, rateLimited }
// Re-invoke with lastId until remaining = 0. On a ComicVine rate-limit (HTTP
// 200 + status_code 107) it stops early WITHOUT advancing past the throttled
// row, so the next run resumes cleanly.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
const cvParams = (extra: Record<string, string>) =>
  new URLSearchParams({ api_key: COMICVINE_API_KEY, format: 'json', ...extra });

const FIELDS = 'id,publisher,count_of_issue_appearances,movies';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  let afterId = 0;
  let limit = 25;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.afterId === 'number') afterId = Math.max(0, Math.floor(body.afterId));
    if (typeof body?.limit === 'number') limit = Math.min(Math.max(1, body.limit), 50);
  } catch {
    /* empty body is fine */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Target: legacy numeric-id heroes that already carry a comicvine_id. Cursor
  // walks them in numeric id order. (PostgREST can't cast id→int, so fetch a
  // padded window and filter/sort numerically in code.)
  const { data: rows, error: selErr } = await sb
    .from('heroes')
    .select('id, name, publisher, issue_count, movie_count, comicvine_id')
    .not('comicvine_id', 'is', null)
    .order('id', { ascending: true })
    .limit(5000);
  if (selErr) return json({ error: selErr.message }, 500);

  const numeric = (rows ?? [])
    .filter((r) => /^[0-9]+$/.test(r.id as string))
    .map((r) => ({ ...r, n: parseInt(r.id as string, 10) }))
    .filter((r) => r.n > afterId)
    .sort((a, b) => a.n - b.n);

  const slice = numeric.slice(0, limit);
  const changes: Array<{
    id: string;
    name: string;
    publisher: [string | null, string | null];
    issue_count: [number | null, number | null];
    movie_count: [number | null, number | null];
  }> = [];

  let updated = 0;
  let lastId = afterId;
  let rateLimited = false;

  for (const hero of slice) {
    const res = await fetch(
      `${COMICVINE_BASE}/character/4005-${hero.comicvine_id}/?${cvParams({ field_list: FIELDS })}`,
    );
    // Transient throttle/5xx → stop WITHOUT advancing past this row.
    if (res.status === 420 || res.status === 429 || res.status >= 500) {
      rateLimited = true;
      break;
    }
    if (!res.ok) {
      // 404 (stale id) etc. — skip this row but advance the cursor past it.
      lastId = hero.n;
      await sleep(1100);
      continue;
    }
    const body = await res.json();
    if (body?.status_code === 107) {
      rateLimited = true;
      break;
    }
    const d = (body?.results ?? {}) as Record<string, unknown>;
    if (!d?.id) {
      lastId = hero.n;
      await sleep(1100);
      continue;
    }

    const publisher = (d.publisher as { name?: string } | null)?.name ?? null;
    const issueCount =
      typeof d.count_of_issue_appearances === 'number' ? d.count_of_issue_appearances : null;
    const movieCount = Array.isArray(d.movies) && d.movies.length > 0 ? d.movies.length : null;

    const changed =
      publisher !== hero.publisher ||
      issueCount !== hero.issue_count ||
      movieCount !== hero.movie_count;

    if (changed) {
      const { error: upErr } = await sb
        .from('heroes')
        .update({ publisher, issue_count: issueCount, movie_count: movieCount })
        .eq('id', hero.id);
      if (!upErr) {
        updated++;
        changes.push({
          id: hero.id as string,
          name: hero.name as string,
          publisher: [hero.publisher as string | null, publisher],
          issue_count: [hero.issue_count as number | null, issueCount],
          movie_count: [hero.movie_count as number | null, movieCount],
        });
      }
    }

    lastId = hero.n;
    await sleep(1100); // ~1 req/sec — ComicVine throttles hard.
  }

  const remaining = numeric.filter((r) => r.n > lastId).length;
  return json({
    processed: slice.length,
    updated,
    rateLimited,
    lastId,
    remaining,
    changes,
  });
});
