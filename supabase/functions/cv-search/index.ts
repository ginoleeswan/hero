// cv-search: ComicVine lookup proxy for the admin ingestion console.
// POST body:
//   { kind: 'character', query }      -> characters matching a name
//   { kind: 'team', query }           -> teams matching a name
//   { kind: 'team_members', teamId }  -> a team's character roster
// Server-side ComicVine key; logs a unit to api_usage.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CV = 'https://comicvine.gamespot.com/api';
const KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const UA = { 'User-Agent': 'mythique/1.0 (admin ingestion)' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

const img = (image: Record<string, string> | null | undefined): string | null =>
  image?.small_url ?? image?.medium_url ?? image?.icon_url ?? null;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let kind = '', query = '', teamId = '';
  try {
    const b = await req.json();
    kind = String(b?.kind ?? '');
    query = String(b?.query ?? '').trim();
    teamId = String(b?.teamId ?? '').trim();
  } catch { /* ignore */ }

  try {
    let out: unknown;
    if (kind === 'character') {
      if (query.length < 2) return json({ results: [] });
      const url = `${CV}/characters/?api_key=${KEY}&format=json&filter=name:${encodeURIComponent(query)}&field_list=id,name,publisher,image,deck&limit=24`;
      const res = await fetch(url, { headers: UA });
      const body = await res.json();
      out = {
        results: (body.results ?? []).map((r: Record<string, any>) => ({
          id: String(r.id),
          name: r.name,
          publisher: r.publisher?.name ?? null,
          image: img(r.image),
          deck: r.deck ?? null,
        })),
      };
    } else if (kind === 'team') {
      if (query.length < 2) return json({ results: [] });
      const url = `${CV}/search/?api_key=${KEY}&format=json&query=${encodeURIComponent(query)}&resources=team&field_list=id,name,count_of_team_members&limit=15`;
      const res = await fetch(url, { headers: UA });
      const body = await res.json();
      out = {
        results: (body.results ?? []).map((r: Record<string, any>) => ({
          id: String(r.id),
          name: r.name,
          members: typeof r.count_of_team_members === 'number' ? r.count_of_team_members : null,
        })),
      };
    } else if (kind === 'team_members') {
      if (!teamId) return json({ teamName: null, characters: [] });
      const url = `${CV}/team/4060-${teamId}/?api_key=${KEY}&format=json&field_list=name,characters`;
      const res = await fetch(url, { headers: UA });
      const body = await res.json();
      const r = body.results ?? {};
      out = {
        teamName: r.name ?? null,
        characters: (r.characters ?? []).map((c: Record<string, any>) => ({ id: String(c.id), name: c.name })),
      };
    } else {
      return json({ error: 'bad kind' }, 400);
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    await sb.from('api_usage').insert({ api: 'comicvine', endpoint: `search:${kind}`, units: 1 });
    return json(out);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
