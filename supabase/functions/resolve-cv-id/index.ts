// supabase/functions/resolve-cv-id/index.ts
//
// READ-ONLY ComicVine id resolver. For a list of heroes whose stored
// comicvine_id is suspect (famous character pointing at a minor namesake), it
// name-searches ComicVine and returns ranked candidates — WITHOUT writing
// anything. The caller eyeballs the before→after, then applies the chosen id
// separately. Matching mirrors enrich-comicvine-batch: exact (case-insensitive)
// name, falling back to the name before a "(" disambiguator, ranked by
// count_of_issue_appearances (the canonical character has the most).
//
// POST { heroes: [{ id, name, query? }], startIndex?, sleepMs? } ->
//   { results: [{ id, name, query, candidates: [{cvId,name,publisher,issues}] }],
//     nextIndex, remaining, rateLimited }
// On a ComicVine 107 throttle it stops and returns nextIndex so the caller can
// resume from where it left off.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

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

interface HeroIn {
  id: string;
  name: string;
  query?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  let heroes: HeroIn[] = [];
  let startIndex = 0;
  let sleepMs = 1500;
  try {
    const body = await req.json();
    if (Array.isArray(body?.heroes)) heroes = body.heroes;
    if (typeof body?.startIndex === 'number') startIndex = Math.max(0, Math.floor(body.startIndex));
    if (typeof body?.sleepMs === 'number') sleepMs = Math.min(Math.max(500, body.sleepMs), 5000);
  } catch {
    return json({ error: 'POST { heroes: [{id,name,query?}] }' }, 400);
  }

  const base = (n: string) => n.split('(')[0].trim().toLowerCase();
  const results: Array<{
    id: string;
    name: string;
    query: string;
    candidates: Array<{ cvId: string; name: string; publisher: string | null; issues: number }>;
  }> = [];

  let i = startIndex;
  let rateLimited = false;

  for (; i < heroes.length; i++) {
    const hero = heroes[i];
    const q = (hero.query ?? hero.name).trim();
    const res = await fetch(
      `${COMICVINE_BASE}/characters/?${cvParams({
        filter: `name:${q}`,
        field_list: 'id,name,publisher,count_of_issue_appearances',
        limit: '40',
      })}`,
    );
    if (res.status === 420 || res.status === 429 || res.status >= 500) {
      rateLimited = true;
      break;
    }
    const body = await res.json().catch(() => ({}));
    if (body?.status_code === 107) {
      rateLimited = true;
      break;
    }
    const wanted = q.toLowerCase();
    const named = ((body?.results ?? []) as Array<Record<string, unknown>>).filter(
      (c) => typeof c.name === 'string',
    );
    const exact = named.filter((c) => (c.name as string).trim().toLowerCase() === wanted);
    const pool = exact.length > 0 ? exact : named.filter((c) => base(c.name as string) === wanted);
    const ranked = pool
      .map((c) => ({
        cvId: String(c.id),
        name: c.name as string,
        publisher: (c.publisher as { name?: string } | null)?.name ?? null,
        issues: (c.count_of_issue_appearances as number) ?? 0,
      }))
      .sort((a, b) => b.issues - a.issues)
      .slice(0, 5);

    results.push({ id: hero.id, name: hero.name, query: q, candidates: ranked });
    await sleep(sleepMs);
  }

  return json({
    results,
    nextIndex: i,
    remaining: Math.max(0, heroes.length - i),
    rateLimited,
  });
});
