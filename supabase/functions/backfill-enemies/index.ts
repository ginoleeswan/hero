// supabase/functions/backfill-enemies/index.ts
// Resumable batch backfill for the `enemies` / `friends` columns.
//
// ComicVine returns character_enemies ALPHABETICALLY, so a flat slice keeps only
// early-alphabet names and drops famous late-alphabet foes (Wolverine→Sabretooth).
// Fix: pull the full list, resolve it against our own roster (chunked to dodge
// URL limits), and store the real-hero foes FIRST (popularity-ordered) followed
// by the rest — so the iconic foes are always present regardless of where they
// fall A–Z. The app then resolves + orders by popularity for display.
//
// Modes (POST body):
//   {}                → fill heroes that have NO enemies yet (additive, safe)
//   { capped: true }  → refresh heroes still on the stale =20 alphabetical cap
//   { refresh: true } → refresh the top heroes regardless
//   { limit }         → batch size (1–100, default 60)
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

// Extract a name list from a ComicVine relation array (cap bounds array size).
const names = (arr: unknown, cap: number): string[] =>
  Array.isArray(arr)
    ? Array.from(
        new Set(
          arr
            .map((e) =>
              e && typeof (e as Record<string, unknown>).name === 'string'
                ? ((e as Record<string, unknown>).name as string)
                : null,
            )
            .filter((n): n is string => n !== null),
        ),
      ).slice(0, cap)
    : [];

// Resolve which names are heroes in our roster, ordered by popularity, then
// store those first followed by any unresolved names (for the text-chip fallback).
async function prioritise(supabase: SB, raw: string[]): Promise<string[]> {
  if (raw.length === 0) return [];
  const matched: { name: string; issue_count: number | null }[] = [];
  for (let i = 0; i < raw.length; i += 140) {
    const { data } = await supabase
      .from('heroes')
      .select('name, issue_count')
      .in('name', raw.slice(i, i + 140));
    if (data) matched.push(...(data as { name: string; issue_count: number | null }[]));
  }
  matched.sort((a, b) => (b.issue_count ?? 0) - (a.issue_count ?? 0));
  const ordered = matched.map((m) => m.name);
  const seen = new Set(ordered);
  return [...ordered, ...raw.filter((n) => !seen.has(n))].slice(0, 100);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = (await req.json().catch(() => ({}))) as {
      limit?: number;
      refresh?: boolean;
      capped?: boolean;
    };
    const limit = Math.min(Math.max(Number(body.limit) || 60, 1), 100);
    const { refresh, capped } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let q = supabase
      .from('heroes')
      .select('id, name, comicvine_id, enemies')
      .not('comicvine_id', 'is', null)
      .not('issue_count', 'is', null)
      .order('issue_count', { ascending: false })
      .limit(capped ? 500 : limit);
    if (!refresh && !capped) q = q.is('enemies', null);
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);

    let heroes = (data ?? []) as {
      id: string;
      name: string;
      comicvine_id: string;
      enemies: string[] | null;
    }[];
    if (capped) {
      heroes = heroes
        .filter((h) => Array.isArray(h.enemies) && h.enemies.length === 20)
        .slice(0, limit);
    }

    let updated = 0;
    let failed = 0;
    const samples: { name: string; enemies: number }[] = [];

    for (const h of heroes) {
      try {
        const params = new URLSearchParams({
          api_key: COMICVINE_API_KEY,
          format: 'json',
          field_list: 'character_enemies,character_friends',
        });
        const res = await fetch(`${COMICVINE_BASE}/character/4005-${h.comicvine_id}/?${params}`);
        if (!res.ok) {
          failed++;
          await sleep(350);
          continue;
        }
        const d = (await res.json()).results ?? {};
        const enemies = await prioritise(supabase, names(d.character_enemies, 600));
        const friends = await prioritise(supabase, names(d.character_friends, 600));
        await supabase.from('heroes').update({ enemies, friends }).eq('id', h.id);
        updated++;
        if (samples.length < 6) samples.push({ name: h.name, enemies: enemies.length });
        await sleep(350); // stay under ComicVine's burst limit
      } catch (_e) {
        failed++;
        await sleep(350);
      }
    }

    // Refreshed the raw arrays — rebuild the derived relationship graph so the
    // pickers / character page see the new foes/allies/teammates immediately.
    let graphRebuilt = false;
    if (updated > 0) {
      const { error: rebuildErr } = await supabase.rpc('rebuild_hero_relationships');
      graphRebuilt = !rebuildErr;
    }

    return json({
      mode: capped ? 'capped' : refresh ? 'refresh' : 'fill',
      requested: heroes.length,
      updated,
      failed,
      graphRebuilt,
      samples,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
