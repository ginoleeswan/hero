// cv-search: ComicVine lookup proxy for the admin ingestion console.
// POST body:
//   { kind: 'character', query }                  -> characters matching a name
//   { kind: 'group', resource, query }            -> groups matching a name
//   { kind: 'group_members', resource, id }       -> a group's character roster
// resource ∈ 'team' | 'volume' | 'person' | 'movie'. Server-side key; logs usage.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CV = 'https://comicvine.gamespot.com/api';
const KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const UA = { 'User-Agent': 'mythique/1.0 (admin ingestion)' };
// ComicVine type-id prefix per resource path.
const PREFIX: Record<string, string> = { team: '4060', volume: '4050', person: '4040', movie: '4025' };
// Which field on a resource holds its character roster (person uses created_characters).
const MEMBER_FIELD: Record<string, string> = {
  team: 'characters',
  volume: 'characters',
  movie: 'characters',
  person: 'created_characters',
};

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
  let kind = '', query = '', resource = '', id = '';
  try {
    const b = await req.json();
    kind = String(b?.kind ?? '');
    query = String(b?.query ?? '').trim();
    resource = String(b?.resource ?? '');
    id = String(b?.id ?? '').trim();
  } catch { /* ignore */ }

  try {
    let out: unknown;
    if (kind === 'character') {
      if (query.length < 2) return json({ results: [] });
      const url = `${CV}/characters/?api_key=${KEY}&format=json&filter=name:${encodeURIComponent(query)}&field_list=id,name,publisher,image,deck&limit=24`;
      const body = await (await fetch(url, { headers: UA })).json();
      out = {
        results: (body.results ?? []).map((r: Record<string, any>) => ({
          id: String(r.id),
          name: r.name,
          publisher: r.publisher?.name ?? null,
          image: img(r.image),
          deck: r.deck ?? null,
        })),
      };
    } else if (kind === 'group') {
      if (query.length < 2 || !PREFIX[resource]) return json({ results: [] });
      const url = `${CV}/search/?api_key=${KEY}&format=json&query=${encodeURIComponent(query)}&resources=${resource}&field_list=id,name,count_of_team_members,start_year,publisher,deck&limit=15`;
      const body = await (await fetch(url, { headers: UA })).json();
      out = {
        results: (body.results ?? []).map((r: Record<string, any>) => ({
          id: String(r.id),
          name: r.name,
          members: typeof r.count_of_team_members === 'number' ? r.count_of_team_members : null,
          hint:
            r.start_year ? String(r.start_year)
            : r.publisher?.name ?? (typeof r.deck === 'string' ? r.deck.slice(0, 60) : null),
        })),
      };
    } else if (kind === 'group_members') {
      if (!id || !PREFIX[resource]) return json({ groupName: null, characters: [] });
      const field = MEMBER_FIELD[resource] ?? 'characters';
      const url = `${CV}/${resource}/${PREFIX[resource]}-${id}/?api_key=${KEY}&format=json&field_list=name,${field}`;
      const body = await (await fetch(url, { headers: UA })).json();
      const r = body.results ?? {};
      out = {
        groupName: r.name ?? null,
        characters: (r[field] ?? []).map((c: Record<string, any>) => ({ id: String(c.id), name: c.name })),
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
