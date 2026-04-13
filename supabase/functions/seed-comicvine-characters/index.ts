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

/** Normalise a name for fuzzy dedup: lowercase, strip non-alphanumeric */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

interface CvCharacter {
  id: number;
  name: string;
  deck: string | null;
  publisher: { name: string } | null;
  image: { medium_url: string } | null;
  count_of_issue_appearances: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Read ingestion state
  const { data: state, error: stateErr } = await sb
    .from('cv_ingestion_state')
    .select('*')
    .eq('id', 1)
    .single();

  if (stateErr || !state) return json({ error: 'Failed to read ingestion state' }, 500);
  if (state.status === 'complete') return json({ message: 'Ingestion already complete', state });
  if (state.total_ingested >= state.target) {
    await sb.from('cv_ingestion_state').update({ status: 'complete' }).eq('id', 1);
    return json({ message: 'Target reached', state });
  }

  // Fetch one batch of 100 from ComicVine sorted by issue count descending
  const params = new URLSearchParams({
    api_key: COMICVINE_API_KEY,
    format: 'json',
    sort: 'count_of_issue_appearances:desc',
    offset: String(state.last_offset),
    limit: '100',
    field_list: 'id,name,deck,publisher,image,count_of_issue_appearances',
  });

  const cvRes = await fetch(`${COMICVINE_BASE}/characters/?${params}`);
  if (!cvRes.ok) return json({ error: `ComicVine error: ${cvRes.status}` }, 502);

  const cvJson = await cvRes.json();
  const characters: CvCharacter[] = cvJson.results ?? [];

  if (characters.length === 0) {
    await sb.from('cv_ingestion_state').update({ status: 'complete' }).eq('id', 1);
    return json({ message: 'No more characters', state });
  }

  // Load existing rows for dedup (cv_id set + name map)
  const { data: existing } = await sb.from('heroes').select('id, name, comicvine_id');
  const existingCvIds = new Set(
    (existing ?? []).map((h) => h.comicvine_id).filter(Boolean),
  );
  const existingByNorm = new Map(
    (existing ?? []).map((h) => [norm(h.name), h.id]),
  );

  let inserted = 0;
  let merged = 0;
  let skipped = 0;

  for (const char of characters) {
    const cvId = String(char.id);

    // Already seeded by CV ID
    if (existingCvIds.has(cvId)) { skipped++; continue; }

    const normalised = norm(char.name);
    const existingId = existingByNorm.get(normalised);

    if (existingId) {
      // Existing hero — write comicvine_id to merge
      await sb.from('heroes').update({ comicvine_id: cvId }).eq('id', existingId);
      merged++;
    } else {
      // New character — insert with CV data
      await sb.from('heroes').insert({
        id: `cv-${cvId}`,
        name: char.name,
        comicvine_id: cvId,
        summary: char.deck ?? null,
        image_url: char.image?.medium_url ?? null,
        publisher: char.publisher?.name ?? null,
        issue_count: char.count_of_issue_appearances ?? null,
        ai_stats_status: 'pending',
        enriched_at: new Date().toISOString(),
      });
      inserted++;
    }
  }

  const newTotal = state.total_ingested + inserted;
  const newOffset = state.last_offset + 100;
  const newStatus = newTotal >= state.target ? 'complete' : 'idle';

  await sb.from('cv_ingestion_state').update({
    last_offset: newOffset,
    total_ingested: newTotal,
    status: newStatus,
    last_run_at: new Date().toISOString(),
    error: null,
  }).eq('id', 1);

  return json({ inserted, merged, skipped, total_ingested: newTotal, status: newStatus });
});
