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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { heroId, heroName } = await req.json() as { heroId: string; heroName: string };
    if (!heroId || !heroName) return json({ error: 'heroId and heroName required' }, 400);

    // List endpoint — get character id, deck, publisher, first issue
    const listParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      filter: `name:${heroName}`,
      field_list: 'id,deck,publisher,first_appeared_in_issue',
      limit: '1',
    });

    const listRes = await fetch(`${COMICVINE_BASE}/characters/?${listParams}`);
    if (!listRes.ok) return json({ error: `ComicVine error: ${listRes.status}` }, 502);

    const listJson = await listRes.json();
    const result = listJson.results?.[0];

    if (!result) return json({ summary: null, publisher: null, firstIssueId: null, powers: null });

    // Detail endpoint — powers are only available here
    let powers: string[] | null = null;
    if (result.id) {
      const detailParams = new URLSearchParams({
        api_key: COMICVINE_API_KEY,
        format: 'json',
        field_list: 'powers',
      });
      const detailRes = await fetch(`${COMICVINE_BASE}/character/4005-${result.id}/?${detailParams}`);
      if (detailRes.ok) {
        const detailJson = await detailRes.json();
        const raw: string[] = Array.isArray(detailJson.results?.powers)
          ? detailJson.results.powers
              .map((p: unknown) => (p && typeof (p as Record<string, unknown>).name === 'string' ? (p as Record<string, unknown>).name as string : null))
              .filter((n: string | null): n is string => n !== null)
          : [];
        powers = raw.length > 0 ? raw : null;
      }
    }

    const summary: string | null = result.deck ?? null;
    const publisher: string | null = result.publisher?.name ?? null;
    const firstIssueId: string | null = result.first_appeared_in_issue?.id
      ? String(result.first_appeared_in_issue.id)
      : null;

    // Write back to DB using service role (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    await supabase
      .from('heroes')
      .update({ summary, powers, comicvine_enriched_at: new Date().toISOString() })
      .eq('id', heroId)
      .is('comicvine_enriched_at', null);

    return json({ summary, publisher, firstIssueId, powers });
  } catch (err) {
    console.error('[get-comicvine-hero]', err);
    return json({ summary: null, publisher: null, firstIssueId: null, powers: null }, 500);
  }
});
