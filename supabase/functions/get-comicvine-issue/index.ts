// get-comicvine-issue: read-through for a single ComicVine issue. Lets the
// /issue/[id] page render ANY issue (a character's debut, a gallery cover) — not
// just the curated weekly slate. Fetches the issue detail, maps credited
// characters to catalogue heroes, and upserts the issue + appearances into
// comic_issues so repeat views are instant (and historical store_dates keep it
// out of the "new this week" window). Idempotent.
//
// POST body: { id: 'cvi:<n>' | '<n>' }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CV = 'https://comicvine.gamespot.com/api';
const KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const UA = { 'User-Agent': 'mythique/1.0 (issue read-through)' };
const FIELDS = 'id,name,issue_number,store_date,cover_date,image,volume,description,character_credits';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const coverUrl = (image: Record<string, string> | null | undefined): string | null =>
  image?.original_url ?? image?.super_url ?? image?.medium_url ?? null;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function cleanHtml(html: unknown): string | null {
  if (typeof html !== 'string' || !html) return null;
  let t = html.replace(/<[^>]+>/g, ' ');
  t = t
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > 1200) t = `${t.slice(0, 1197).trimEnd()}…`;
  return t || null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let raw = '';
  try {
    const b = await req.json();
    raw = String(b?.id ?? '');
  } catch {
    /* no body */
  }
  const cvId = raw.replace(/^cvi:/, '').trim();
  if (!/^\d+$/.test(cvId)) return json({ error: 'bad id' }, 400);
  const issueId = `cvi:${cvId}`;

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const res = await fetch(`${CV}/issue/4000-${cvId}/?api_key=${KEY}&format=json&field_list=${FIELDS}`, {
      headers: UA,
    });
    if (!res.ok) return json({ error: `http ${res.status}` }, 502);
    const body = await res.json();
    if (body?.status_code === 107) return json({ error: 'rate_limited' }, 429);
    const r = body.results;
    if (!r || typeof r !== 'object') return json({ error: 'not_found' }, 404);

    const creditIds = ((r.character_credits ?? []) as Array<{ id: number }>).map((c) => String(c.id));
    const heroByCv = new Map<string, { id: string; fame: number; publisher: string | null }>();
    for (const ids of chunk(creditIds, 300)) {
      const { data } = await sb
        .from('heroes')
        .select('id, comicvine_id, fame_score, publisher')
        .in('comicvine_id', ids);
      for (const h of (data ?? []) as Array<{ id: string; comicvine_id: string; fame_score: number | null; publisher: string | null }>) {
        if (h.comicvine_id) heroByCv.set(h.comicvine_id, { id: h.id, fame: h.fame_score ?? 0, publisher: h.publisher });
      }
    }
    const matches = creditIds
      .map((cid) => heroByCv.get(cid))
      .filter((h): h is { id: string; fame: number; publisher: string | null } => !!h);
    const lead = matches.length ? matches.reduce((a, b) => (b.fame > a.fame ? b : a), matches[0]) : null;

    const { error: upErr } = await sb.from('comic_issues').upsert(
      {
        id: issueId,
        comicvine_id: cvId,
        volume_name: r.volume?.name ?? null,
        volume_id: r.volume?.id ?? null,
        issue_number: r.issue_number != null ? String(r.issue_number) : null,
        cover_url: coverUrl(r.image),
        store_date: r.store_date ?? null,
        cover_date: r.cover_date ?? null,
        publisher: lead?.publisher ?? null,
        lead_hero_id: lead?.id ?? null,
        max_fame: lead?.fame ?? null,
        description: cleanHtml(r.description) ?? '',
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (upErr) return json({ error: upErr.message }, 500);
    if (matches.length) {
      await sb
        .from('comic_issue_appearances')
        .upsert(matches.map((m) => ({ issue_id: issueId, hero_id: m.id })), {
          onConflict: 'issue_id,hero_id',
          ignoreDuplicates: true,
        });
    }
    await sb.from('api_usage').insert({ api: 'comicvine', endpoint: 'get-comicvine-issue', units: 1 });
    return json({ ok: true, id: issueId });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
