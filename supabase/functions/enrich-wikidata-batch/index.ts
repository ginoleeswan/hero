// enrich-wikidata-batch: for resolved heroes, fetch cross-media appearances
// (ID-stamped) + performers from Wikidata, write titles stubs + edges +
// hero_people. Mirrors the pure mappers in src/lib/wikidata/mapEnrichment.ts.
// POST body: { limit?: number (1-25, default 10), retry?: boolean, triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;
const WD_SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'hero-app/1.0 (enrichment; contact: admin@hero.app)';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const yearOf = (s: string | null): number | null => {
  if (!s) return null;
  const m = s.match(/(18|19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : null;
};

type Src = 'tmdb' | 'igdb';
type Media = 'film' | 'tv' | 'game';
interface MappedTitle {
  id: string;
  source: Src;
  mediaType: Media;
  externalId: string;
  title: string;
  year: number | null;
}

function mapWorkRow(r: Record<string, { value: string }>): MappedTitle | null {
  const tmdbMovie = r.tmdbMovie?.value ?? null;
  const tmdbTv = r.tmdbTv?.value ?? null;
  const igdb = r.igdb?.value ?? null;
  let source: Src, mediaType: Media, externalId: string;
  if (tmdbMovie) {
    source = 'tmdb';
    mediaType = 'film';
    externalId = tmdbMovie;
  } else if (tmdbTv) {
    source = 'tmdb';
    mediaType = 'tv';
    externalId = tmdbTv;
  } else if (igdb) {
    source = 'igdb';
    mediaType = 'game';
    externalId = igdb;
  } else return null;
  return {
    id: `${source}:${externalId}`,
    source,
    mediaType,
    externalId,
    title: r.workLabel?.value ?? '(untitled)',
    year: yearOf(r.year?.value ?? null),
  };
}

async function sparql(query: string): Promise<Array<Record<string, { value: string }>>> {
  const res = await fetch(`${WD_SPARQL}?query=${encodeURIComponent(query)}&format=json`, {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) return [];
  const body = await res.json();
  return body.results?.bindings ?? [];
}

async function fetchAppearances(qid: string): Promise<MappedTitle[]> {
  const q = `
SELECT ?work ?workLabel ?year ?tmdbMovie ?tmdbTv ?igdb WHERE {
  { ?work wdt:P674 wd:${qid} } UNION { wd:${qid} wdt:P1441 ?work }
  OPTIONAL { ?work wdt:P4947 ?tmdbMovie }
  OPTIONAL { ?work wdt:P4983 ?tmdbTv }
  OPTIONAL { ?work wdt:P5794 ?igdb }
  OPTIONAL { ?work wdt:P577 ?year }
  FILTER (BOUND(?tmdbMovie) || BOUND(?tmdbTv) || BOUND(?igdb))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 500`;
  const rows = await sparql(q);
  const byId = new Map<string, MappedTitle>();
  for (const r of rows) {
    const m = mapWorkRow(r);
    if (m && !byId.has(m.id)) byId.set(m.id, m);
  }
  return [...byId.values()];
}

async function fetchPerformers(
  qid: string,
): Promise<Array<{ name: string; role: 'performer' | 'voice_actor' }>> {
  // Live performers (P161) and voice actors (P725) credited as THIS character
  // (qualifier P453), limited to works we actually track (a TMDB/IGDB id) to cut
  // novelty/parody noise.
  const q = `
SELECT DISTINCT ?performerLabel ?kind WHERE {
  { ?work p:P161 ?st. ?st ps:P161 ?performer. ?st pq:P453 wd:${qid}. BIND("performer" AS ?kind) }
  UNION
  { ?work p:P725 ?st. ?st ps:P725 ?performer. ?st pq:P453 wd:${qid}. BIND("voice_actor" AS ?kind) }
  ?work (wdt:P4947|wdt:P4983|wdt:P5794) [] .
  ?performer rdfs:label ?performerLabel. FILTER(LANG(?performerLabel)="en")
} LIMIT 60`;
  const rows = await sparql(q);
  const performers = new Set<string>();
  const voice = new Set<string>();
  for (const r of rows) {
    const name = r.performerLabel?.value;
    if (!name || /^Q\d+$/.test(name)) continue; // skip entities with no en label
    if (r.kind?.value === 'voice_actor') voice.add(name);
    else performers.add(name);
  }
  const out: Array<{ name: string; role: 'performer' | 'voice_actor' }> = [];
  for (const n of performers) out.push({ name: n, role: 'performer' });
  for (const n of voice) if (!performers.has(n)) out.push({ name: n, role: 'voice_actor' });
  return out;
}

// Character-level facts: aliases, creators, first-appearance year, and external
// links (IMDb / official site). Validated live; characters reliably have site +
// aliases + creators + inception; IMDb is often absent (left null).
async function fetchFacts(qid: string): Promise<{
  aliases: string[];
  creators: string[];
  inceptionYear: number | null;
  imdb: string | null;
  site: string | null;
}> {
  const q = `
SELECT ?aliases ?creators ?inc ?imdb ?site WHERE {
  OPTIONAL { wd:${qid} wdt:P571 ?inc. }
  OPTIONAL { wd:${qid} wdt:P345 ?imdb. }
  OPTIONAL { wd:${qid} wdt:P856 ?site. }
  OPTIONAL { SELECT (GROUP_CONCAT(DISTINCT ?a; SEPARATOR="|") AS ?aliases) WHERE { wd:${qid} skos:altLabel ?a. FILTER(LANG(?a)="en") } }
  OPTIONAL { SELECT (GROUP_CONCAT(DISTINCT ?cl; SEPARATOR="|") AS ?creators) WHERE { wd:${qid} wdt:P170 ?c. ?c rdfs:label ?cl. FILTER(LANG(?cl)="en") } }
} LIMIT 1`;
  const rows = await sparql(q);
  const r = rows[0] ?? {};
  const split = (v: string | undefined) =>
    v
      ? v
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  return {
    aliases: split(r.aliases?.value),
    creators: split(r.creators?.value),
    inceptionYear: yearOf(r.inc?.value ?? null),
    imdb: r.imdb?.value ?? null,
    site: r.site?.value ?? null,
  };
}

const mergeUniq = (existing: string[], extra: string[]): string[] => {
  const seen = new Set(existing.map((s) => s.toLowerCase().trim()));
  const out = [...existing];
  for (const e of extra) {
    const k = e.toLowerCase().trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(e);
    }
  }
  return out;
};

async function runEnrich(
  sb: SB,
  limit: number,
  retry: boolean,
  runId: number | null,
  heroId: string | null,
): Promise<number> {
  // Single-hero mode (Build orchestrator) enriches exactly one resolved hero.
  let q = sb
    .from('heroes')
    .select('id, wikidata_qid, issue_count, creators, aliases')
    .eq('wikidata_status', 'resolved')
    .not('wikidata_qid', 'is', null);
  if (heroId) {
    q = q.eq('id', heroId).limit(1);
  } else {
    q = q.order('issue_count', { ascending: false, nullsFirst: false }).limit(limit);
    if (!retry) q = q.is('wikidata_enriched_at', null);
  }
  const { data: heroes } = await q;
  if (!heroes || heroes.length === 0) return 0;
  // Marquee heroes have huge appearance lists (hundreds of upserts) — stop taking
  // new heroes past a wall-clock budget so the run always finishes and marks
  // itself done, rather than being killed mid-batch and dangling as 'running'.
  const deadline = Date.now() + 25_000;
  let calls = 0;
  for (const h of heroes as Array<{
    id: string;
    wikidata_qid: string;
    issue_count: number | null;
    creators: string[] | null;
    aliases: string[] | null;
  }>) {
    if (Date.now() > deadline) break;
    try {
      calls++;
      const titles = await fetchAppearances(h.wikidata_qid);
      await sleep(200);
      calls++;
      const performers = await fetchPerformers(h.wikidata_qid);
      await sleep(200);
      calls++;
      const facts = await fetchFacts(h.wikidata_qid);

      for (const t of titles) {
        await sb.from('titles').upsert(
          {
            id: t.id,
            source: t.source,
            external_id: t.externalId,
            tmdb_id: t.source === 'tmdb' ? t.externalId : null,
            media_type: t.mediaType,
            title: t.title,
            release_date: t.year ? `${t.year}-01-01` : null,
          },
          { onConflict: 'id', ignoreDuplicates: true },
        );
        await sb.from('hero_media_appearances').upsert(
          {
            hero_id: h.id,
            title_id: t.id,
            media_type: t.mediaType,
            source: 'wikidata',
            rank: h.issue_count,
          },
          { onConflict: 'hero_id,title_id', ignoreDuplicates: true },
        );
      }

      // Idempotent: replace this hero's wikidata-sourced people each run.
      await sb.from('hero_people').delete().eq('hero_id', h.id).eq('source', 'wikidata');
      if (performers.length > 0) {
        await sb.from('hero_people').insert(
          performers.map((p) => ({
            hero_id: h.id,
            person_name: p.name,
            role: p.role,
            title_id: null,
            source: 'wikidata',
          })),
        );
      }
      // Merge Wikidata creators/aliases into the hero arrays (fills CV gaps,
      // improves search), and stamp the enrich time.
      await sb
        .from('heroes')
        .update({
          creators: mergeUniq(h.creators ?? [], facts.creators),
          aliases: mergeUniq(h.aliases ?? [], facts.aliases),
          wikidata_enriched_at: new Date().toISOString(),
        })
        .eq('id', h.id);

      // Scalar facts + external links (idempotent: replace this hero's wikidata facts).
      await sb.from('hero_facts').delete().eq('hero_id', h.id).eq('source', 'wikidata');
      const factRows: Array<{ hero_id: string; key: string; value: string; source: string }> = [
        { hero_id: h.id, key: 'wikidata_qid', value: h.wikidata_qid, source: 'wikidata' },
      ];
      if (facts.inceptionYear)
        factRows.push({
          hero_id: h.id,
          key: 'first_appearance_year',
          value: String(facts.inceptionYear),
          source: 'wikidata',
        });
      if (facts.imdb)
        factRows.push({ hero_id: h.id, key: 'imdb_id', value: facts.imdb, source: 'wikidata' });
      if (facts.site)
        factRows.push({
          hero_id: h.id,
          key: 'official_site',
          value: facts.site,
          source: 'wikidata',
        });
      await sb.from('hero_facts').insert(factRows);

      if (runId != null)
        await sb.from('enrichment_run_heroes').insert({ run_id: runId, hero_id: h.id });
    } catch (err) {
      console.error('[enrich-wikidata-batch] threw', h.id, err);
    }
    await sleep(250);
  }
  return calls;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const startedAt = Date.now();
  let limit = 10,
    retry = false,
    triggeredBy = 'cron',
    heroId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === 'number') limit = Math.min(Math.max(1, body.limit), 25);
    if (body?.retry === true) retry = true;
    if (typeof body?.triggeredBy === 'string') triggeredBy = body.triggeredBy;
    if (typeof body?.heroId === 'string') heroId = body.heroId;
  } catch {
    /* empty body ok */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const { data: runRow } = await sb
    .from('enrichment_runs')
    .insert({
      run_type: 'wikidata_enrich',
      triggered_by: triggeredBy,
      status: 'running',
      started_at: new Date(startedAt).toISOString(),
    })
    .select('id')
    .single();
  const runId = (runRow as { id?: number } | null)?.id ?? null;

  let calls = 0;
  try {
    calls = await runEnrich(sb, limit, retry, runId, heroId);
  } catch (err) {
    if (runId != null) await sb.from('enrichment_runs').update({ status: 'error' }).eq('id', runId);
    return json({ error: String(err) }, 500);
  }
  if (calls > 0)
    await sb.from('api_usage').insert({ api: 'wikidata', endpoint: 'enrich', units: calls });
  if (runId != null)
    await sb
      .from('enrichment_runs')
      .update({
        status: 'done',
        done: calls,
        processed: calls,
        duration_ms: Date.now() - startedAt,
      })
      .eq('id', runId);
  return json({ calls, message: calls === 0 ? 'nothing to do' : 'ok' });
});
