// resolve-wikidata-batch: resolve heroes to Wikidata QIDs (popularity-ordered).
// Per hero: wbsearchentities -> candidate QIDs; one SPARQL VALUES query fetches
// claims for those QIDs filtered to fictional characters; a mirror of
// src/lib/wikidata/score.ts decides resolved/ambiguous/unresolved.
// POST body: { limit?: number (1-25, default 10), retryUnresolved?: boolean,
//              triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

const WD_API = 'https://www.wikidata.org/w/api.php';
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

// ── scorer mirror of src/lib/wikidata/score.ts ──────────────────────────────
interface HeroHints {
  name: string;
  aliases: string[];
  publisher: string | null;
  firstAppearanceYear: number | null;
  creators: string[];
}
interface QidCandidate {
  qid: string;
  label: string;
  description: string | null;
  publisherLabels: string[];
  inceptionYear: number | null;
  creatorLabels: string[];
}
const STRONG = 0.6,
  GAP = 0.25,
  WEAK = 0.35;
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const tokenSet = (s: string) => new Set(norm(s).split(' ').filter(Boolean));
const surname = (s: string) => norm(s).split(' ').filter(Boolean).pop() ?? '';
const GENERIC_PUB = new Set(['comics', 'entertainment', 'group', 'inc', 'the']);
// Wikidata's P1080 returns the fictional UNIVERSE ("Prime Earth", "Earth-616")
// rather than the publisher, so map common universes to their publisher token —
// the main reason marquee DC/Marvel characters went unresolved. (norm() form.)
const UNIVERSE_PUBLISHER: Record<string, string> = {
  'prime earth': 'dc',
  'new earth': 'dc',
  'dc universe': 'dc',
  'earth two': 'dc',
  'earth one': 'dc',
  'earth 0': 'dc',
  'dc extended universe': 'dc',
  arrowverse: 'dc',
  'marvel universe': 'marvel',
  'earth 616': 'marvel',
  'earth 1610': 'marvel',
  'ultimate marvel': 'marvel',
  'marvel cinematic universe': 'marvel',
};
function publisherMatch(heroPub: string | null, labels: string[]): boolean {
  if (!heroPub) return false;
  const ht = [...tokenSet(heroPub)].filter((t) => !GENERIC_PUB.has(t));
  if (ht.length === 0) return false;
  return labels.some((l) => {
    const mapped = UNIVERSE_PUBLISHER[norm(l)];
    if (mapped && ht.includes(mapped)) return true;
    const lt = tokenSet(l);
    return ht.some((t) => lt.has(t));
  });
}
function creatorOverlap(h: string[], c: string[]): boolean {
  if (h.length === 0 || c.length === 0) return false;
  const hs = new Set(h.map(surname).filter(Boolean));
  return c.some((x) => hs.has(surname(x)));
}
function scoreCandidate(hero: HeroHints, c: QidCandidate): number {
  let s = 0;
  if (norm(c.label) === norm(hero.name)) s += 0.2;
  else if (hero.aliases.some((a) => norm(a) === norm(c.label))) s += 0.1;
  if (publisherMatch(hero.publisher, c.publisherLabels)) s += 0.4;
  else if (c.description && publisherMatch(hero.publisher, [c.description])) s += 0.15;
  if (hero.firstAppearanceYear != null && c.inceptionYear != null) {
    const d = Math.abs(hero.firstAppearanceYear - c.inceptionYear);
    if (d <= 2) s += 0.2;
    else if (d <= 5) s += 0.1;
  }
  if (creatorOverlap(hero.creators, c.creatorLabels)) s += 0.25;
  return s;
}
function resolveHero(hero: HeroHints, cands: QidCandidate[]) {
  if (cands.length === 0)
    return {
      tier: 'unresolved' as const,
      qid: null,
      candidates: [] as { qid: string; score: number }[],
    };
  const scored = cands
    .map((c) => ({ qid: c.qid, score: scoreCandidate(hero, c) }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0],
    second = scored[1];
  const gapOk = !second || top.score - second.score >= GAP;
  const topN = scored.slice(0, 3);
  if (top.score >= STRONG && gapOk)
    return { tier: 'resolved' as const, qid: top.qid, candidates: topN };
  if (top.score >= WEAK) return { tier: 'ambiguous' as const, qid: null, candidates: topN };
  return { tier: 'unresolved' as const, qid: null, candidates: topN };
}

// ── helpers ─────────────────────────────────────────────────────────────────
const firstYear = (s: string | null): number | null => {
  if (!s) return null;
  const m = s.match(/(18|19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : null;
};

async function searchCandidates(name: string): Promise<string[]> {
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=8&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const body = await res.json();
  return ((body.search ?? []) as Array<{ id: string }>).map((x) => x.id);
}

// One SPARQL query fetches claims for the candidate QIDs, keeping only fictional
// characters. Publisher is P123 (publisher) OR P1080 (from narrative universe);
// labels are aggregated with GROUP_CONCAT. Validated live against marquee chars.
async function fetchClaims(qids: string[]): Promise<QidCandidate[]> {
  if (qids.length === 0) return [];
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const sparql = `
SELECT ?item ?itemLabel ?desc
  (GROUP_CONCAT(DISTINCT ?pubLabel; SEPARATOR="|") AS ?pubs)
  (GROUP_CONCAT(DISTINCT ?creatorLabel; SEPARATOR="|") AS ?creators)
  (SAMPLE(?inception) AS ?inc)
WHERE {
  VALUES ?item { ${values} }
  ?item wdt:P31/wdt:P279* wd:Q95074 .
  OPTIONAL { ?item (wdt:P123|wdt:P1080) ?pub. ?pub rdfs:label ?pubLabel. FILTER(LANG(?pubLabel)="en") }
  OPTIONAL { ?item wdt:P170 ?cr. ?cr rdfs:label ?creatorLabel. FILTER(LANG(?creatorLabel)="en") }
  OPTIONAL { ?item wdt:P571 ?inception. }
  OPTIONAL { ?item schema:description ?desc. FILTER(LANG(?desc)="en") }
  ?item rdfs:label ?itemLabel. FILTER(LANG(?itemLabel)="en")
}
GROUP BY ?item ?itemLabel ?desc`;
  const res = await fetch(`${WD_SPARQL}?query=${encodeURIComponent(sparql)}&format=json`, {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) return [];
  const body = await res.json();
  const rows = body.results?.bindings ?? [];
  return rows.map((r: Record<string, { value: string }>) => {
    const qid = r.item.value.split('/').pop() as string;
    const pubs = r.pubs?.value ? r.pubs.value.split('|').filter(Boolean) : [];
    const creators = r.creators?.value ? r.creators.value.split('|').filter(Boolean) : [];
    return {
      qid,
      label: r.itemLabel?.value ?? '',
      description: r.desc?.value ?? null,
      publisherLabels: pubs,
      inceptionYear: firstYear(r.inc?.value ?? null),
      creatorLabels: creators,
    } as QidCandidate;
  });
}

interface HeroRow {
  id: string;
  name: string;
  aliases: string[] | null;
  publisher: string | null;
  first_appearance: string | null;
  creators: string[] | null;
  comicvine_id: string | null;
}

// Deterministic match: Wikidata stores the Comic Vine ID as P5905, formatted
// "4005-<id>" for characters. One SPARQL query maps a whole batch of our
// comicvine_ids straight to QIDs — far higher precision than fuzzy name scoring,
// so we try this first and only fall back to scoring for the unmatched.
async function fetchByComicvineIds(cvIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (cvIds.length === 0) return map;
  const values = [...new Set(cvIds)].map((id) => `"4005-${id}"`).join(' ');
  const sparql = `SELECT ?item ?cv WHERE { VALUES ?cv { ${values} } ?item wdt:P5905 ?cv. }`;
  const res = await fetch(`${WD_SPARQL}?query=${encodeURIComponent(sparql)}&format=json`, {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) return map;
  const rows = (await res.json()).results?.bindings ?? [];
  for (const r of rows as Record<string, { value: string }>[]) {
    const cv = r.cv?.value;
    const qid = r.item?.value?.split('/').pop();
    if (cv && qid && !map.has(cv)) map.set(cv, qid);
  }
  return map;
}

// Deterministic full sweep: walk the entire unresolved-with-comicvine_id set in
// id order (cursor = afterId), resolve everything that has a P5905 link, and
// leave the rest untouched. Popularity order is irrelevant here and would only
// re-pick the same unmatched heroes every call (a clog), so we paginate by id.
// One SPARQL covers a whole page (sub-chunked at 250 ids). Returns a cursor so
// the caller can loop until the page comes back short.
async function sweepDeterministic(
  sb: SB,
  afterId: string,
  pageSize: number,
): Promise<{ lastId: string; scanned: number; matched: number; calls: number }> {
  const { data } = await sb
    .from('heroes')
    .select('id, comicvine_id')
    .eq('wikidata_status', 'unresolved')
    .not('comicvine_id', 'is', null)
    .gt('id', afterId)
    .order('id', { ascending: true })
    .limit(pageSize);
  const rows = (data as { id: string; comicvine_id: string }[] | null) ?? [];
  if (rows.length === 0) return { lastId: afterId, scanned: 0, matched: 0, calls: 0 };

  // Bulk P5905 lookup in sub-chunks (URL length safety on the SPARQL VALUES set).
  const map = new Map<string, string>();
  let calls = 0;
  for (let i = 0; i < rows.length; i += 250) {
    const ids = rows.slice(i, i + 250).map((r) => r.comicvine_id);
    const part = await fetchByComicvineIds(ids);
    calls++;
    for (const [k, v] of part) map.set(k, v);
    if (i + 250 < rows.length) await sleep(150);
  }

  let matched = 0;
  for (const r of rows) {
    const qid = map.get(`4005-${r.comicvine_id}`);
    if (!qid) continue;
    await sb
      .from('heroes')
      .update({
        wikidata_status: 'resolved',
        wikidata_qid: qid,
        wikidata_candidates: [{ qid, score: 1 }],
      })
      .eq('id', r.id);
    matched++;
  }
  return { lastId: rows[rows.length - 1].id, scanned: rows.length, matched, calls };
}

async function runResolve(
  sb: SB,
  limit: number,
  retryUnresolved: boolean,
  runId: number | null,
  heroId: string | null,
): Promise<number> {
  // Single-hero mode (used by the Build orchestrator) processes exactly one hero
  // regardless of status; batch mode drains the pending queue popularity-first.
  let heroes: HeroRow[] | null;
  if (heroId) {
    const { data } = await sb
      .from('heroes')
      .select('id, name, aliases, publisher, first_appearance, creators, comicvine_id')
      .eq('id', heroId)
      .limit(1);
    heroes = data as HeroRow[] | null;
  } else {
    const statuses = retryUnresolved ? ['pending', 'unresolved'] : ['pending'];
    const { data } = await sb
      .from('heroes')
      .select('id, name, aliases, publisher, first_appearance, creators, comicvine_id')
      .in('wikidata_status', statuses)
      .order('issue_count', { ascending: false, nullsFirst: false })
      .limit(limit);
    heroes = data as HeroRow[] | null;
  }
  if (!heroes || heroes.length === 0) return 0;
  let calls = 0;
  // Deterministic pass: one SPARQL maps the batch's comicvine_ids → QIDs via P5905.
  const cvByKey = await fetchByComicvineIds(
    (heroes as HeroRow[]).map((h) => h.comicvine_id).filter((x): x is string => !!x),
  );
  if (cvByKey.size > 0) calls++;
  for (const h of heroes as HeroRow[]) {
    try {
      const directQid = h.comicvine_id ? cvByKey.get(`4005-${h.comicvine_id}`) : undefined;
      let outcome: ReturnType<typeof resolveHero>;
      if (directQid) {
        // Exact ComicVine→Wikidata link — resolved with full confidence, no scoring.
        outcome = { tier: 'resolved' as const, qid: directQid, candidates: [{ qid: directQid, score: 1 }] };
      } else {
        calls++;
        const qids = await searchCandidates(h.name);
        await sleep(150);
        calls++;
        const cands = await fetchClaims(qids);
        const hero: HeroHints = {
          name: h.name,
          aliases: h.aliases ?? [],
          publisher: h.publisher,
          firstAppearanceYear: firstYear(h.first_appearance),
          creators: h.creators ?? [],
        };
        outcome = resolveHero(hero, cands);
      }
      await sb
        .from('heroes')
        .update({
          wikidata_status: outcome.tier,
          wikidata_qid: outcome.qid,
          wikidata_candidates: outcome.candidates.length > 0 ? outcome.candidates : null,
        })
        .eq('id', h.id);
      if (runId != null)
        await sb.from('enrichment_run_heroes').insert({ run_id: runId, hero_id: h.id });
    } catch (err) {
      console.error('[resolve-wikidata-batch] threw', h.id, err); // leave pending
    }
    await sleep(200); // be polite to Wikidata
  }
  return calls;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const startedAt = Date.now();
  let limit = 10,
    retryUnresolved = false,
    triggeredBy = 'cron',
    heroId: string | null = null;
  let deterministicSweep = false,
    afterId = '',
    pageSize = 500;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === 'number') limit = Math.min(Math.max(1, body.limit), 25);
    if (body?.retryUnresolved === true) retryUnresolved = true;
    if (typeof body?.triggeredBy === 'string') triggeredBy = body.triggeredBy;
    if (typeof body?.heroId === 'string') heroId = body.heroId;
    if (body?.deterministicSweep === true) deterministicSweep = true;
    if (typeof body?.afterId === 'string') afterId = body.afterId;
    if (typeof body?.pageSize === 'number') pageSize = Math.min(Math.max(50, body.pageSize), 1000);
  } catch {
    /* empty body ok */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Deterministic sweep is self-contained (no per-hero scoring, no run row).
  if (deterministicSweep) {
    try {
      const r = await sweepDeterministic(sb, afterId, pageSize);
      if (r.calls > 0)
        await sb.from('api_usage').insert({ api: 'wikidata', endpoint: 'sweep', units: r.calls });
      return json({ ...r, done: r.scanned < pageSize });
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  }
  const { data: runRow } = await sb
    .from('enrichment_runs')
    .insert({
      run_type: 'wikidata_resolve',
      triggered_by: triggeredBy,
      status: 'running',
      started_at: new Date(startedAt).toISOString(),
    })
    .select('id')
    .single();
  const runId = (runRow as { id?: number } | null)?.id ?? null;

  let calls = 0;
  try {
    calls = await runResolve(sb, limit, retryUnresolved, runId, heroId);
  } catch (err) {
    if (runId != null) await sb.from('enrichment_runs').update({ status: 'error' }).eq('id', runId);
    return json({ error: String(err) }, 500);
  }

  if (calls > 0)
    await sb.from('api_usage').insert({ api: 'wikidata', endpoint: 'resolve', units: calls });
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
