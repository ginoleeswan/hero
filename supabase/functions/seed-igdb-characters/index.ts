// supabase/functions/seed-igdb-characters/index.ts
// Service-role drain: ingests curated game franchises from IGDB into heroes.
// verify_jwt defaults to true (no config.toml override) — invoke via service role.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { IGDB_ALLOWLIST } from '../_shared/igdb-allowlist.ts';
import { getIgdbToken } from '../_shared/igdb-auth.ts';
import {
  resolveFranchiseGameIds,
  fetchFranchiseCharacters,
  type IgdbClient,
} from '../_shared/igdb-api.ts';
import { dedupDecision, type ExistingRow } from '../_shared/igdb-transform.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

// IGDB allows ~4 req/s; sleep between franchises to stay well under.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let batches = IGDB_ALLOWLIST.length;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.batches === 'number') {
      batches = Math.min(Math.max(1, body.batches), IGDB_ALLOWLIST.length);
    }
  } catch {
    /* no body ok */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let token: string;
  try {
    token = await getIgdbToken(
      Deno.env.get('IGDB_CLIENT_ID') ?? '',
      Deno.env.get('IGDB_CLIENT_SECRET') ?? '',
    );
  } catch (e) {
    return json({ error: `auth: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }
  const client: IgdbClient = { clientId: Deno.env.get('IGDB_CLIENT_ID') ?? '', token };

  const now = new Date().toISOString();
  const results: unknown[] = [];

  // Process franchises not yet 'complete', up to `batches` per invocation.
  const { data: stateRows } = await sb.from('igdb_ingestion_state').select('franchise,status');
  const doneSet = new Set(
    (stateRows ?? []).filter((s) => s.status === 'complete').map((s) => s.franchise),
  );
  const todo = IGDB_ALLOWLIST.filter((e) => !doneSet.has(e.franchise)).slice(0, batches);

  for (const entry of todo) {
    try {
      const { franchiseId, gameIds } = await resolveFranchiseGameIds(client, entry);
      const characters = await fetchFranchiseCharacters(client, gameIds);

      // Load existing rows once per franchise (name + ids needed for dedup).
      const { data: existing } = await sb
        .from('heroes')
        .select('id,name,publisher,comicvine_id,igdb_id');
      const rows = (existing ?? []) as ExistingRow[];

      let inserted = 0;
      let rehomed = 0;
      let skipped = 0;
      for (const c of characters) {
        const d = dedupDecision(c, entry, rows, now);
        if (d.kind === 'skip') {
          skipped++;
          continue;
        }
        if (d.kind === 'insert') {
          const { error } = await sb.from('heroes').insert(d.row);
          if (!error) {
            inserted++;
            rows.push({
              id: d.row.id,
              name: d.row.name,
              publisher: d.row.publisher,
              comicvine_id: null,
              igdb_id: d.row.igdb_id,
            });
          }
        } else {
          // re-home: never overwrite existing art/description.
          const { error } = await sb.from('heroes').update(d.patch).eq('id', d.targetId);
          if (!error) {
            rehomed++;
            const t = rows.find((r) => r.id === d.targetId);
            if (t) t.igdb_id = d.patch.igdb_id;
          }
        }
      }

      const status = characters.length === 0 ? 'empty' : 'complete';
      await sb.from('igdb_ingestion_state').upsert({
        franchise: entry.franchise,
        publisher: entry.publisher,
        igdb_franchise_id: franchiseId,
        status,
        last_synced_at: now,
        inserted,
        rehomed,
        skipped,
      });
      results.push({
        franchise: entry.franchise,
        resolved: characters.length,
        inserted,
        rehomed,
        skipped,
        status,
      });
      await sleep(500);
    } catch (e) {
      results.push({
        franchise: entry.franchise,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return json({ results });
});
