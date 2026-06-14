# Wikidata Backbone — Phase 2: Hero→QID Resolution Drain + Admin Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve each hero to its correct Wikidata QID with a conservative, high-precision scorer, storing the outcome on `heroes` (`resolved`/`ambiguous`/`unresolved`), and let an admin set the QID for `ambiguous` marquee heroes from the existing command center.

**Architecture:** A pure, fully-tested scorer (`src/lib/wikidata/score.ts`) decides the resolution tier from a hero's hints (name, aliases, publisher, first-appearance year, creators) and a candidate's Wikidata claims. A new `resolve-wikidata-batch` edge function pulls pending heroes (popularity-ordered), gets candidates from `wbsearchentities`, fetches their claims via SPARQL (filtered to fictional characters), runs a Deno mirror of the scorer, and writes `wikidata_qid`/`wikidata_status`/`wikidata_candidates`. The admin command center gains an "Identity review" panel listing `ambiguous` heroes with a "set QID" action wired through the existing `resolve_hero_qid` RPC.

**Tech Stack:** Wikidata `wbsearchentities` + SPARQL (free, no key), Deno edge function, Supabase, React Native web admin, jest-expo.

**Reference:** Spec `docs/superpowers/specs/2026-06-14-wikidata-media-backbone-design.md`; builds on Phase 1 (`heroes.wikidata_*`, `resolve_hero_qid` RPC already exist).

**Scope note:** This phase only *resolves the QID*. It does **not** fetch appearance edges or facts (that is Phase 3, `enrich-wikidata-batch`). It writes only `heroes.wikidata_*`.

---

## File Structure

**Created:**
- `src/lib/wikidata/score.ts` — pure scorer + tier decision (the tested core).
- `__tests__/lib/wikidata/score.test.ts` — scorer unit tests.
- `supabase/functions/resolve-wikidata-batch/index.ts` — the drain (mirrors the scorer in Deno).

**Modified:**
- `src/lib/db/catalogHealth.ts` — `getAmbiguousHeroes()` query + `resolveHeroQid()` mutation.
- `src/components/admin/health/hooks.ts` — `onResolveQid` handler.
- `src/components/admin/health/domains/OperationsDomain.tsx` — "Identity review" panel.
- `app/admin/health.web.tsx` — pass the new handler/data through (mirror existing wiring).

---

## Task 1: The resolution scorer (pure, TDD)

**Files:**
- Create: `src/lib/wikidata/score.ts`
- Test: `__tests__/lib/wikidata/score.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/wikidata/score.test.ts`:

```ts
import { scoreCandidate, resolveHero, type HeroHints, type QidCandidate } from '../../../src/lib/wikidata/score';

const hero: HeroHints = {
  name: 'Batman',
  aliases: ['Bruce Wayne', 'The Dark Knight'],
  publisher: 'DC Comics',
  firstAppearanceYear: 1939,
  creators: ['Bob Kane', 'Bill Finger'],
};

function cand(over: Partial<QidCandidate>): QidCandidate {
  return {
    qid: 'Q1', label: 'Batman', description: null,
    publisherLabels: [], inceptionYear: null, creatorLabels: [], ...over,
  };
}

describe('scoreCandidate', () => {
  it('rewards exact name + publisher + year + creators', () => {
    const s = scoreCandidate(hero, cand({
      label: 'Batman', publisherLabels: ['DC Comics'], inceptionYear: 1939,
      creatorLabels: ['Bob Kane', 'Bill Finger'],
    }));
    expect(s).toBeGreaterThanOrEqual(1.0);
  });

  it('gives little to a same-name character from another publisher and era', () => {
    const s = scoreCandidate(hero, cand({
      label: 'Batman', publisherLabels: ['Archie Comics'], inceptionYear: 2005, creatorLabels: [],
    }));
    expect(s).toBeLessThan(0.35);
  });

  it('matches an alias when the label is the alter ego', () => {
    const s = scoreCandidate(hero, cand({ label: 'Bruce Wayne', publisherLabels: [] }));
    expect(s).toBeGreaterThanOrEqual(0.1);
  });
});

describe('resolveHero', () => {
  it('resolves a clear winner above threshold with a gap', () => {
    const out = resolveHero(hero, [
      cand({ qid: 'Q1', label: 'Batman', publisherLabels: ['DC Comics'], inceptionYear: 1939, creatorLabels: ['Bob Kane'] }),
      cand({ qid: 'Q2', label: 'Batman', publisherLabels: ['Archie Comics'], inceptionYear: 2010 }),
    ]);
    expect(out.tier).toBe('resolved');
    expect(out.qid).toBe('Q1');
  });

  it('marks ambiguous when two strong candidates are close', () => {
    const out = resolveHero(hero, [
      cand({ qid: 'Q1', label: 'Batman', publisherLabels: ['DC Comics'] }),
      cand({ qid: 'Q2', label: 'Batman', publisherLabels: ['DC Comics'] }),
    ]);
    expect(out.tier).toBe('ambiguous');
    expect(out.qid).toBeNull();
    expect(out.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('marks unresolved when nothing is plausible', () => {
    const out = resolveHero(hero, [cand({ qid: 'Q9', label: 'Unrelated', publisherLabels: ['Other'], inceptionYear: 2020 })]);
    expect(out.tier).toBe('unresolved');
  });

  it('marks unresolved for no candidates', () => {
    expect(resolveHero(hero, []).tier).toBe('unresolved');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest __tests__/lib/wikidata/score.test.ts`
Expected: FAIL — cannot find module `score`.

- [ ] **Step 3: Implement the scorer**

Create `src/lib/wikidata/score.ts`:

```ts
export interface HeroHints {
  name: string;
  aliases: string[];
  publisher: string | null;
  firstAppearanceYear: number | null;
  creators: string[];
}

export interface QidCandidate {
  qid: string;
  label: string;
  description: string | null;
  publisherLabels: string[];
  inceptionYear: number | null;
  creatorLabels: string[];
}

export interface ScoredCandidate {
  qid: string;
  score: number;
}

export type ResolutionTier = 'resolved' | 'ambiguous' | 'unresolved';

export interface ResolutionOutcome {
  tier: ResolutionTier;
  qid: string | null;
  candidates: ScoredCandidate[];
}

// Tuned for precision: a clear winner needs a strong score AND separation from
// the runner-up; weak-but-plausible goes to manual review; the rest are dropped.
export const STRONG = 0.6;
export const GAP = 0.25;
export const WEAK = 0.35;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokenSet = (s: string) => new Set(norm(s).split(' ').filter(Boolean));
const surname = (s: string) => norm(s).split(' ').filter(Boolean).pop() ?? '';
const GENERIC_PUB = new Set(['comics', 'entertainment', 'group', 'inc', 'the']);

function publisherMatch(heroPub: string | null, labels: string[]): boolean {
  if (!heroPub) return false;
  const ht = [...tokenSet(heroPub)].filter((t) => !GENERIC_PUB.has(t));
  if (ht.length === 0) return false;
  return labels.some((l) => {
    const lt = tokenSet(l);
    return ht.some((t) => lt.has(t));
  });
}

function creatorOverlap(heroCreators: string[], candCreators: string[]): boolean {
  if (heroCreators.length === 0 || candCreators.length === 0) return false;
  const hs = new Set(heroCreators.map(surname).filter(Boolean));
  return candCreators.some((c) => hs.has(surname(c)));
}

export function scoreCandidate(hero: HeroHints, c: QidCandidate): number {
  let score = 0;
  if (norm(c.label) === norm(hero.name)) score += 0.2;
  else if (hero.aliases.some((a) => norm(a) === norm(c.label))) score += 0.1;

  if (publisherMatch(hero.publisher, c.publisherLabels)) score += 0.4;
  else if (c.description && publisherMatch(hero.publisher, [c.description])) score += 0.15;

  if (hero.firstAppearanceYear != null && c.inceptionYear != null) {
    const d = Math.abs(hero.firstAppearanceYear - c.inceptionYear);
    if (d <= 2) score += 0.2;
    else if (d <= 5) score += 0.1;
  }

  if (creatorOverlap(hero.creators, c.creatorLabels)) score += 0.25;
  return score;
}

export function resolveHero(hero: HeroHints, candidates: QidCandidate[]): ResolutionOutcome {
  if (candidates.length === 0) return { tier: 'unresolved', qid: null, candidates: [] };
  const scored: ScoredCandidate[] = candidates
    .map((c) => ({ qid: c.qid, score: scoreCandidate(hero, c) }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];
  const gapOk = !second || top.score - second.score >= GAP;
  const topCandidates = scored.slice(0, 3);
  if (top.score >= STRONG && gapOk) return { tier: 'resolved', qid: top.qid, candidates: topCandidates };
  if (top.score >= WEAK) return { tier: 'ambiguous', qid: null, candidates: topCandidates };
  return { tier: 'unresolved', qid: null, candidates: topCandidates };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn jest __tests__/lib/wikidata/score.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wikidata/score.ts __tests__/lib/wikidata/score.test.ts
git commit -m "feat(wikidata): hero->QID resolution scorer (Lane 3 phase 2)"
```

---

## Task 2: `resolve-wikidata-batch` edge function

Mirrors the `enrich-tmdb-batch` drain shape (resumable, popularity-ordered, logs to `enrichment_runs` + `api_usage`). Two Wikidata calls per hero: `wbsearchentities` for candidate QIDs, then one SPARQL query to fetch claims for those QIDs filtered to fictional characters. The scorer is mirrored inline in Deno (same pattern as the TMDB matcher mirror).

**Files:**
- Create: `supabase/functions/resolve-wikidata-batch/index.ts`

- [ ] **Step 1: Write the function**

Create `supabase/functions/resolve-wikidata-batch/index.ts`:

```ts
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
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── scorer mirror of src/lib/wikidata/score.ts ──────────────────────────────
interface HeroHints { name: string; aliases: string[]; publisher: string | null; firstAppearanceYear: number | null; creators: string[]; }
interface QidCandidate { qid: string; label: string; description: string | null; publisherLabels: string[]; inceptionYear: number | null; creatorLabels: string[]; }
const STRONG = 0.6, GAP = 0.25, WEAK = 0.35;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokenSet = (s: string) => new Set(norm(s).split(' ').filter(Boolean));
const surname = (s: string) => norm(s).split(' ').filter(Boolean).pop() ?? '';
const GENERIC_PUB = new Set(['comics', 'entertainment', 'group', 'inc', 'the']);
function publisherMatch(heroPub: string | null, labels: string[]): boolean {
  if (!heroPub) return false;
  const ht = [...tokenSet(heroPub)].filter((t) => !GENERIC_PUB.has(t));
  if (ht.length === 0) return false;
  return labels.some((l) => { const lt = tokenSet(l); return ht.some((t) => lt.has(t)); });
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
    if (d <= 2) s += 0.2; else if (d <= 5) s += 0.1;
  }
  if (creatorOverlap(hero.creators, c.creatorLabels)) s += 0.25;
  return s;
}
function resolveHero(hero: HeroHints, cands: QidCandidate[]) {
  if (cands.length === 0) return { tier: 'unresolved' as const, qid: null, candidates: [] as { qid: string; score: number }[] };
  const scored = cands.map((c) => ({ qid: c.qid, score: scoreCandidate(hero, c) })).sort((a, b) => b.score - a.score);
  const top = scored[0], second = scored[1];
  const gapOk = !second || top.score - second.score >= GAP;
  const topN = scored.slice(0, 3);
  if (top.score >= STRONG && gapOk) return { tier: 'resolved' as const, qid: top.qid, candidates: topN };
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
// characters. Aggregates multi-valued publisher/creator labels with GROUP_CONCAT.
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
  OPTIONAL { ?item wdt:P123 ?pub. ?pub rdfs:label ?pubLabel. FILTER(LANG(?pubLabel)="en") }
  OPTIONAL { ?item wdt:P1080 ?uni. ?uni rdfs:label ?pubLabel2. FILTER(LANG(?pubLabel2)="en") }
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
  id: string; name: string; aliases: string[] | null; publisher: string | null;
  first_appearance: string | null; creators: string[] | null;
}

async function runResolve(sb: SB, limit: number, retryUnresolved: boolean): Promise<number> {
  const statuses = retryUnresolved ? ['pending', 'unresolved'] : ['pending'];
  const { data: heroes } = await sb
    .from('heroes')
    .select('id, name, aliases, publisher, first_appearance, creators')
    .in('wikidata_status', statuses)
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (!heroes || heroes.length === 0) return 0;
  let calls = 0;
  for (const h of heroes as HeroRow[]) {
    try {
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
      const outcome = resolveHero(hero, cands);
      await sb.from('heroes').update({
        wikidata_status: outcome.tier,
        wikidata_qid: outcome.qid,
        wikidata_candidates: outcome.candidates.length > 0 ? outcome.candidates : null,
      }).eq('id', h.id);
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
  let limit = 10, retryUnresolved = false, triggeredBy = 'cron';
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === 'number') limit = Math.min(Math.max(1, body.limit), 25);
    if (body?.retryUnresolved === true) retryUnresolved = true;
    if (typeof body?.triggeredBy === 'string') triggeredBy = body.triggeredBy;
  } catch { /* empty body ok */ }

  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const { data: runRow } = await sb.from('enrichment_runs').insert({
    run_type: 'wikidata_resolve', triggered_by: triggeredBy, status: 'running',
    started_at: new Date(startedAt).toISOString(),
  }).select('id').single();
  const runId = (runRow as { id?: number } | null)?.id ?? null;

  let calls = 0;
  try {
    calls = await runResolve(sb, limit, retryUnresolved);
  } catch (err) {
    if (runId != null) await sb.from('enrichment_runs').update({ status: 'error' }).eq('id', runId);
    return json({ error: String(err) }, 500);
  }

  if (calls > 0) await sb.from('api_usage').insert({ api: 'wikidata', endpoint: 'resolve', units: calls });
  if (runId != null) await sb.from('enrichment_runs').update({
    status: 'done', done: calls, processed: calls, duration_ms: Date.now() - startedAt,
  }).eq('id', runId);

  return json({ calls, message: calls === 0 ? 'nothing to do' : 'ok' });
});
```

- [ ] **Step 2: Deploy the function**

Use the MCP tool `mcp__supabase__deploy_edge_function` to deploy `resolve-wikidata-batch` (verify_jwt: false, matching the other drains).
Expected: deploy succeeds.

- [ ] **Step 3: Smoke-test on a tiny batch and inspect outcomes**

Invoke the function once with a small limit (via the Supabase functions invoke, or temporarily call it from the admin). Then inspect with `mcp__supabase__execute_sql`:

```sql
select wikidata_status, count(*) from heroes group by wikidata_status order by 2 desc;
```

Expected: after one small run, a handful of heroes move from `pending` to `resolved`/`ambiguous`/`unresolved`. Spot-check 3 `resolved` rows against Wikidata by hand:

```sql
select id, name, publisher, wikidata_qid, wikidata_status from heroes
where wikidata_status='resolved' order by issue_count desc nulls last limit 5;
```

Expected: the QIDs point at the correct character (e.g. Batman → Q2695156). If precision looks poor, tune `STRONG`/`WEAK`/`GAP` in BOTH `src/lib/wikidata/score.ts` and the edge mirror, re-run the tests, redeploy.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/resolve-wikidata-batch/index.ts
git commit -m "feat(edge): resolve-wikidata-batch hero->QID drain (Lane 3 phase 2)"
```

---

## Task 3: Admin data layer — ambiguous heroes + resolve mutation

**Files:**
- Modify: `src/lib/db/catalogHealth.ts`

- [ ] **Step 1: Add the query + mutation**

Append to `src/lib/db/catalogHealth.ts` (mirrors the existing `reenrichHero`/`searchHeroesAdmin` style):

```ts
export interface AmbiguousHero {
  id: string;
  name: string;
  publisher: string | null;
  imageUrl: string | null;
  candidates: { qid: string; score: number }[];
}

/** Heroes the resolver flagged as ambiguous, marquee-first (by issue_count). */
export async function getAmbiguousHeroes(limit = 25): Promise<AmbiguousHero[]> {
  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, publisher, image_md_url, wikidata_candidates')
    .eq('wikidata_status', 'ambiguous')
    .order('issue_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Array<{
    id: string; name: string; publisher: string | null; image_md_url: string | null;
    wikidata_candidates: { qid: string; score: number }[] | null;
  }>).map((r) => ({
    id: r.id,
    name: r.name,
    publisher: r.publisher,
    imageUrl: r.image_md_url,
    candidates: r.wikidata_candidates ?? [],
  }));
}

/** Set a hero's QID by hand (flips status to 'resolved'). */
export async function resolveHeroQid(heroId: string, qid: string): Promise<void> {
  const { error } = await supabase.rpc('resolve_hero_qid', { p_hero_id: heroId, p_qid: qid });
  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit 2>&1 | grep catalogHealth || echo OK`
Expected: OK (no errors in catalogHealth.ts).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/catalogHealth.ts
git commit -m "feat(admin): ambiguous-hero query + resolveHeroQid mutation"
```

---

## Task 4: Admin UI — Identity review panel

Wire a handler in the admin hook and add an "Identity review" panel to Operations, reusing the "Hero console" panel layout (per-row card with a small action button + busy state).

**Files:**
- Modify: `src/components/admin/health/hooks.ts`, `src/components/admin/health/domains/OperationsDomain.tsx`, `app/admin/health.web.tsx`

- [ ] **Step 1: Add the React Query hook for ambiguous heroes**

In `src/components/admin/health/hooks.ts`, add an import for `getAmbiguousHeroes` and `resolveHeroQid` (alongside the existing `reenrichHero` import) and add a query near the other admin queries:

```ts
import { getAmbiguousHeroes, resolveHeroQid } from '../../../lib/db/catalogHealth';
```

```ts
// inside the data-fetching hook, alongside the other useQuery calls:
const ambiguousQuery = useQuery({
  queryKey: ['ambiguousHeroes'],
  queryFn: () => getAmbiguousHeroes(25),
  staleTime: 30_000,
});
```

Expose `ambiguous: ambiguousQuery.data ?? []` from that hook's return object (mirror how `gaps`/`runs` are exposed).

- [ ] **Step 2: Add the `onResolveQid` handler**

In the mutations hook (where `onReenrich` lives), add:

```ts
const onResolveQid = async (id: string, qid: string, name: string) => {
  setBusy(`resolveqid-${id}`);
  try {
    await resolveHeroQid(id, qid);
    flash(`Set ${name} → ${qid}`, 'success');
    queryClient.invalidateQueries({ queryKey: ['ambiguousHeroes'] });
  } catch (e) {
    flash(`Set QID failed: ${(e as Error).message}`, 'error');
  } finally {
    setBusy(null);
  }
};
```

Add `onResolveQid` to that hook's returned object (next to `onReenrich`).

- [ ] **Step 3: Render the panel in OperationsDomain**

In `src/components/admin/health/domains/OperationsDomain.tsx`, extend the props type with:

```ts
  ambiguous: import('../../../../lib/db/catalogHealth').AmbiguousHero[];
  onResolveQid: (id: string, qid: string, name: string) => void;
```

Add a new `<Panel>` after the "Hero console" panel:

```tsx
<Panel title="Identity review" hint="Pick the correct Wikidata QID for ambiguous heroes">
  {ambiguous.length === 0 ? (
    <Text style={styles.hcEmpty}>No heroes awaiting review.</Text>
  ) : (
    ambiguous.map((h) => (
      <View key={h.id} style={styles.hcRow}>
        <View style={styles.hcMeta}>
          <Text style={styles.hcName} numberOfLines={1}>{h.name}</Text>
          <Text style={styles.hcSub} numberOfLines={1}>{h.publisher ?? '—'}</Text>
        </View>
        <View style={styles.idrCandidates}>
          {h.candidates.map((c) => {
            const busyThis = busy === `resolveqid-${h.id}`;
            return (
              <Pressable
                key={c.qid}
                onPress={() => onResolveQid(h.id, c.qid, h.name)}
                disabled={!!busy}
                style={[styles.idrChip, !!busy && styles.actDim]}
              >
                <Text style={styles.idrChipText}>
                  {busyThis ? '…' : `${c.qid} · ${c.score.toFixed(2)}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ))
  )}
</Panel>
```

Add styles to the `StyleSheet.create` in that file:

```ts
idrCandidates: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
idrChip: { backgroundColor: COLORS.navy + '12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
idrChipText: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: COLORS.navy },
```

(Reuse the existing `hcRow`/`hcMeta`/`hcName`/`hcSub`/`hcEmpty`/`actDim` styles already in this file — verify their names by reading the file; if a name differs, match the existing one.)

- [ ] **Step 4: Thread props through `app/admin/health.web.tsx`**

In `app/admin/health.web.tsx`, pull `ambiguous` from the data hook and `onResolveQid` from the mutations hook (the same lines that already destructure `gaps`/`onReenrich`), and pass both into `<OperationsDomain ... ambiguous={ambiguous} onResolveQid={onResolveQid} />`.

- [ ] **Step 5: Typecheck**

Run: `yarn tsc --noEmit 2>&1 | grep -E "OperationsDomain|hooks.ts|health.web" || echo OK`
Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/health/hooks.ts src/components/admin/health/domains/OperationsDomain.tsx app/admin/health.web.tsx
git commit -m "feat(admin): Identity review panel for ambiguous QIDs (Lane 3 phase 2)"
```

---

## Task 5: Verification

- [ ] **Step 1: Typecheck (only the 13 pre-existing unrelated errors remain)**

Run: `yarn tsc --noEmit 2>&1 | grep "error TS" | grep -v "absoluteFillObject\|splash does not exist\|profile\|/compare/\|ClashPortraits\|HeroPeek\|OpponentCard\|ChangePasswordModal\|EditDisplayNameModal\|app.config.ts" || echo "NO NEW ERRORS"`
Expected: `NO NEW ERRORS`.

- [ ] **Step 2: Full test suite**

Run: `yarn test:ci`
Expected: all pass, including `__tests__/lib/wikidata/score.test.ts`.

- [ ] **Step 3: Outcome sanity (live)**

Run a few resolve batches (admin or function invoke), then:

```sql
select wikidata_status, count(*) from heroes group by wikidata_status;
```

Expected: the `pending` count shrinks; `resolved` dominates `ambiguous`+`unresolved` for marquee heroes (precision-first). Spot-check 5 resolved QIDs by hand on wikidata.org.

---

## Self-Review Notes

- **Spec coverage:** entity resolution with publisher/first-appearance/creator/alias signals (Task 1), conservative tiers + not-retried-forever via status gating (Tasks 1–2), `wikidata_candidates` stored for review (Task 2), command-center manual review through `resolve_hero_qid` (Tasks 3–4), popularity-ordered drain logging to `enrichment_runs`/`api_usage` (Task 2). Out of phase: appearance edges/facts (Phase 3), cron registration (can be added when precision is trusted — intentionally manual-trigger first).
- **Type consistency:** `HeroHints`/`QidCandidate`/`ScoredCandidate`/`ResolutionOutcome`/`scoreCandidate`/`resolveHero`/`STRONG`/`GAP`/`WEAK` defined in Task 1 and mirrored verbatim in Task 2's Deno function. `AmbiguousHero`/`getAmbiguousHeroes`/`resolveHeroQid` defined in Task 3, consumed in Task 4.
- **Precision risk:** the SPARQL fictional-character filter (`wdt:P31/wdt:P279* wd:Q95074`) and publisher properties (P123/P1080) are the one externally-uncertain piece; Task 2 Step 3 validates against live Wikidata and tunes thresholds before trusting the drain. The scorer being pure + tested means threshold changes are safe and verifiable.
```
