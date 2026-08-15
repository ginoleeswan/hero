// sync-title-videos — daily sweep of TMDB /videos for titles in the window where
// trailers actually drop, so "a trailer dropped 3h ago" is knowable.
//
// Why a dedicated function rather than leaning on the existing enrichment:
// enrich-tmdb-batch already fetches videos (and now persists them — see the
// mapper it shares), but it only runs on rows flipped to enrich_status='pending',
// and refresh-tmdb-trending only re-flips rows untouched for 14 days. Fourteen
// days is useless for a same-day trailer, and driving that job harder would
// re-run the full heavy append_to_response (credits, images, reviews, keywords)
// just to re-read one array. /videos is a tiny endpoint. Sweep it separately.
//
// Scope: a narrow release window plus anything recently trending — trailers drop
// before release, so the window leans forward. Round-robin by
// titles.videos_checked_at so a limit smaller than the window degrades to "each
// title every few days" instead of starving the tail.
//
// The window is keyed on titles.release_date, which for TV is TMDB's
// `first_air_date` — the date the series FIRST aired, not the date anything new
// arrives. A returning show therefore ages out of the window permanently and is
// never swept again: Ahsoka premiered 2023-08-22, so on the day its season-2
// trailer dropped its videos_checked_at was still null. It had never been
// checked once. That was 431 of 530 TV titles, i.e. most of television.
//
// Hence the third arm below, on `details->>'status'`. TMDB marks a show
// 'Returning Series' or 'In Production' while more of it is coming, which is
// exactly the condition under which a trailer can drop, and it is independent of
// when the show began. 38 of those sat outside the release window.
//
// POST body: { limit?: number, aheadDays?: number, behindDays?: number,
//              triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapVideoRows, pickTrailerKey } from '../_shared/videos.ts';

type SB = ReturnType<typeof createClient>;

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
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

// ── sweep ───────────────────────────────────────────────────────────────────

interface TitleRow {
  id: string;
  external_id: string;
  media_type: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!TMDB_API_KEY) return json({ skipped: 'TMDB_API_KEY not set' });

  let limit = 200;
  let aheadDays = 365;
  let behindDays = 60;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.limit === 'number') limit = Math.min(Math.max(1, b.limit), 500);
    if (typeof b?.aheadDays === 'number') aheadDays = Math.min(Math.max(0, b.aheadDays), 1095);
    if (typeof b?.behindDays === 'number') behindDays = Math.min(Math.max(0, b.behindDays), 1095);
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
  const trendingSince = new Date(Date.now() - 7 * day).toISOString();

  // Two reads rather than one `.or()` across a range and a timestamp — PostgREST
  // can express it, but the resulting filter string can't use either partial
  // index. Merged and de-duplicated below.
  const base = () =>
    sb
      .from('titles')
      .select('id, external_id, media_type')
      .eq('source', 'tmdb')
      .in('media_type', ['film', 'tv'])
      .order('videos_checked_at', { ascending: true, nullsFirst: true })
      .limit(limit);

  const [windowed, trending, active] = await Promise.all([
    base().gte('release_date', from).lte('release_date', to),
    base().gt('trending_at', trendingSince),
    // Shows with more still to come, whenever they began. `Planned` and `Pilot`
    // are deliberately included: a show that has not aired at all is the one
    // most likely to be announced with a trailer.
    // `.filter` with a pre-quoted list rather than `.in`: the values contain
    // spaces, and PostgREST needs them double-quoted inside `in.()`. `.filter`
    // passes the string through verbatim, so the quoting is visible here rather
    // than dependent on the client version's escaping.
    base()
      .eq('media_type', 'tv')
      .filter(
        'details->>status',
        'in',
        '("Returning Series","In Production","Planned","Pilot")',
      ),
  ]);
  if (windowed.error && trending.error && active.error) {
    return json({ error: windowed.error.message ?? active.error?.message }, 500);
  }

  const byId = new Map<string, TitleRow>();
  for (const r of [
    ...(windowed.data ?? []),
    ...(trending.data ?? []),
    ...(active.data ?? []),
  ] as unknown as TitleRow[]) {
    if (r.external_id) byId.set(r.id, r);
  }
  const rows = [...byId.values()].slice(0, limit);

  let checked = 0;
  let upserted = 0;
  let undatedTotal = 0;
  let trailerKeysChanged = 0;

  for (const t of rows) {
    try {
      const path = t.media_type === 'tv' ? 'tv' : 'movie';
      const res = await fetch(
        `${TMDB_BASE}/${path}/${t.external_id}/videos?api_key=${TMDB_API_KEY}`,
      );
      if (!res.ok) {
        // 404 means the id is gone from TMDB; stamp it so the round-robin moves
        // on instead of retrying the same dead row every night.
        if (res.status === 404) {
          await sb
            .from('titles')
            .update({ videos_checked_at: new Date().toISOString() })
            .eq('id', t.id);
        }
        await sleep(120);
        continue;
      }
      const body = await res.json();
      const { rows: videos, undated } = mapVideoRows(t.id, body?.results);
      undatedTotal += undated;

      if (videos.length > 0) {
        // Upsert, never delete-then-insert: first_seen_at is how we know a video
        // is new to us even when TMDB backfills an old published_at.
        const { error } = await sb.from('title_videos').upsert(videos, { onConflict: 'id' });
        if (!error) upserted += videos.length;

        // Keep titles.trailer_key in step, using the incumbent precedence so the
        // rest of the app keeps playing what it already played.
        const trailerKey = pickTrailerKey(videos);
        if (trailerKey) {
          const { data: updated } = await sb
            .from('titles')
            .update({ trailer_key: trailerKey })
            .eq('id', t.id)
            .neq('trailer_key', trailerKey)
            .select('id');
          if (updated && updated.length > 0) trailerKeysChanged++;
        }
      }

      await sb
        .from('titles')
        .update({ videos_checked_at: new Date().toISOString() })
        .eq('id', t.id);
      checked++;
    } catch (err) {
      // Leave videos_checked_at alone so a transient failure retries first next
      // run rather than going to the back of the queue.
      console.error('[sync-title-videos] threw', t.id, err);
    }
    await sleep(120);
  }

  if (checked > 0) {
    await sb.from('api_usage').insert({ api: 'tmdb', endpoint: 'videos', units: checked });
  }
  // `published_at` is a documented-only field — it has never been observed in
  // this codebase. If every row comes back undated the field name is wrong, and
  // this line is how that gets noticed instead of silently emptying the rail.
  if (checked > 0 && upserted > 0 && undatedTotal === upserted) {
    console.warn(
      `[sync-title-videos] every one of ${upserted} videos parsed WITHOUT published_at — ` +
        `check TMDB's field name before trusting trailer recency`,
    );
  }
  return json({ checked, upserted, undated: undatedTotal, trailerKeysChanged, triggeredBy });
});
