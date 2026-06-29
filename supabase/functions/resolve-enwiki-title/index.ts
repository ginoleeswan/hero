// resolve-enwiki-title: backfill each hero's English-Wikipedia article title from
// its wikidata_qid via the Wikidata wbgetentities API (50 QIDs per call). '' means
// the entity has no enwiki sitelink, so it isn't retried. One-time drain.
//
// POST body: { limit?: number (default 300), triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;
const WD = 'https://www.wikidata.org/w/api.php';
const UA = { 'User-Agent': 'mythique/1.0 (https://mythique.app)' };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function chunk<T>(a: T[], n: number): T[][] {
  const o: T[][] = [];
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
  return o;
}

async function run(sb: SB, limit: number): Promise<{ processed: number; resolved: number; remaining: number }> {
  const { data } = await sb
    .from('heroes')
    .select('id, wikidata_qid')
    .not('wikidata_qid', 'is', null)
    .is('enwiki_title', null)
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  const rows = (data ?? []) as Array<{ id: string; wikidata_qid: string }>;
  if (rows.length === 0) return { processed: 0, resolved: 0, remaining: 0 };

  // qid -> hero ids (a QID could be shared; map to a list).
  const byQid = new Map<string, string[]>();
  for (const r of rows) {
    const list = byQid.get(r.wikidata_qid) ?? [];
    list.push(r.id);
    byQid.set(r.wikidata_qid, list);
  }
  const qids = [...byQid.keys()];

  let resolved = 0;
  for (const batch of chunk(qids, 50)) {
    let body: any;
    try {
      const url = `${WD}?action=wbgetentities&ids=${batch.join('|')}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`;
      body = await (await fetch(url, { headers: UA })).json();
    } catch (_e) {
      continue; // transient; next run retries (enwiki_title still null)
    }
    const entities = body?.entities ?? {};
    for (const qid of batch) {
      const title: string =
        entities?.[qid]?.sitelinks?.enwiki?.title && typeof entities[qid].sitelinks.enwiki.title === 'string'
          ? entities[qid].sitelinks.enwiki.title
          : '';
      for (const heroId of byQid.get(qid) ?? []) {
        await sb.from('heroes').update({ enwiki_title: title }).eq('id', heroId);
      }
      if (title) resolved++;
    }
    await sleep(150);
  }

  const { count } = await sb
    .from('heroes')
    .select('id', { count: 'exact', head: true })
    .not('wikidata_qid', 'is', null)
    .is('enwiki_title', null);
  return { processed: rows.length, resolved, remaining: count ?? 0 };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let limit = 300;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.limit === 'number') limit = Math.min(Math.max(1, b.limit), 600);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  try {
    const out = await run(sb, limit);
    return json({ ...out, triggeredBy });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
