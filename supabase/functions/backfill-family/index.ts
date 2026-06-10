// supabase/functions/backfill-family/index.ts
// Resumable batch backfill for the `hero_relatives` table.
// Parses heroes.relatives → classifies tier/relation → resolves each member's
// name/alias against our roster → writes normalized rows (delete+insert per hero).
//
// Modes (POST body):
//   {}                 → only heroes with NO hero_relatives rows yet (additive)
//   { refresh: true }  → rebuild regardless
//   { limit }          → batch size (1–100, default 60)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseRelatives, classifyRole } from '../_shared/family.ts';

type SB = ReturnType<typeof createClient>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

// Resolve candidate names → { lowercased name → hero id } via chunked .in() lookups.
async function resolveRoster(supabase: SB, candidates: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(candidates.filter(Boolean)));
  for (let i = 0; i < unique.length; i += 140) {
    const { data } = await supabase
      .from('heroes')
      .select('id, name')
      .in('name', unique.slice(i, i + 140));
    for (const h of (data ?? []) as { id: string; name: string }[]) {
      map.set(h.name.toLowerCase(), h.id);
    }
  }
  return map;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number; refresh?: boolean };
    const limit = Math.min(Math.max(Number(body.limit) || 60, 1), 100);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Candidate heroes: have a relatives string, popularity-ordered.
    const { data: heroData, error } = await supabase
      .from('heroes')
      .select('id, name, relatives')
      .not('relatives', 'is', null)
      .neq('relatives', '')
      .neq('relatives', '-')
      .order('issue_count', { ascending: false, nullsFirst: false })
      .limit(body.refresh ? limit : 500);
    if (error) return json({ error: error.message }, 500);

    let heroes = (heroData ?? []) as { id: string; name: string; relatives: string }[];

    // Additive mode: skip heroes that already have rows.
    if (!body.refresh) {
      const ids = heroes.map((h) => h.id);
      const done = new Set<string>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase
          .from('hero_relatives')
          .select('hero_id')
          .in('hero_id', ids.slice(i, i + 200));
        for (const r of (data ?? []) as { hero_id: string }[]) done.add(r.hero_id);
      }
      heroes = heroes.filter((h) => !done.has(h.id)).slice(0, limit);
    }

    let updated = 0;
    let rowsWritten = 0;

    for (const h of heroes) {
      const parsed = parseRelatives(h.relatives);
      if (parsed.length === 0) {
        await supabase.from('hero_relatives').delete().eq('hero_id', h.id);
        continue;
      }
      const roster = await resolveRoster(
        supabase,
        parsed.flatMap((p) => [p.name, ...(p.alias ? [p.alias] : [])]),
      );
      const rows = parsed.map((p) => {
        const c = classifyRole(p.role);
        const linked =
          roster.get(p.name.toLowerCase()) ??
          (p.alias ? roster.get(p.alias.toLowerCase()) : undefined) ??
          null;
        return {
          hero_id: h.id,
          name: p.name,
          alias: p.alias,
          role: p.role,
          relation: c.relation,
          tier: c.tier,
          modifiers: c.modifiers,
          status: c.status,
          related_hero_id: linked,
          position: p.position,
        };
      });
      await supabase.from('hero_relatives').delete().eq('hero_id', h.id);
      const { error: insErr } = await supabase.from('hero_relatives').insert(rows);
      if (insErr) return json({ error: insErr.message, hero: h.name }, 500);
      updated++;
      rowsWritten += rows.length;
    }

    return json({ updated, rowsWritten, remaining: heroes.length === limit });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
