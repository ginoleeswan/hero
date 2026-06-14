# Wikidata Backbone — Phase 3: Appearance Edges + Facts Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For each `resolved` hero, pull its cross-media appearances (film/TV/game, each ID-stamped) and "portrayed by" performers from Wikidata, writing `titles` stubs + `hero_media_appearances` edges (`source='wikidata'`) + `hero_people` rows — so the On-Screen backbone fills with TV and game edges and the Portrayed-by data exists.

**Architecture:** A new `enrich-wikidata-batch` edge function pulls `resolved` heroes (not yet enriched), runs ONE SPARQL query per hero returning (a) works the character is present in that carry a TMDB-movie / TMDB-TV / IGDB id, and (b) performers via cast-member statements qualified by the character. A pure, tested mapper classifies each work into `(source, media_type, external_id, title_id)` by *which* external-id property is present (not the ambiguous P31 type), and shapes performer rows. The function upserts `titles` stubs (`enrich_status='pending'`), inserts edges + `hero_people`, and stamps `wikidata_enriched_at`.

**Tech Stack:** Wikidata SPARQL (free), Deno edge function, Supabase, jest-expo.

**Reference:** Spec `docs/superpowers/specs/2026-06-14-wikidata-media-backbone-design.md`; builds on Phase 1 (tables) + Phase 2 (`wikidata_status='resolved'`, QIDs).

**Validated live (read-only) before writing this plan:**
- Batman (Q2695156) returns **260 work-rows, 125 carrying a TMDB/IGDB id** — 49 games, ~50 films, ~18 TV/animated series.
- **IGDB ids (P5794) are slugs** (`lego-batman-the-videogame`), not numeric → `external_id` is the slug; `id = 'igdb:'||slug`.
- TMDB movie (P4947) and TMDB TV (P4983) are numeric.
- Performers via `?work p:P161 [ ps:P161 ?performer; pq:P453 wd:<QID> ]` returns real actors (Adam West, Kevin Conroy, Michael Keaton, Robert Pattinson…).

**Scope:** appearance edges + performers + (lightweight) awards. Does NOT enrich the new TV/game `titles` (TV enrichment is Phase 4; IGDB is the fast-follow). Game edges persist `enrich_status='pending'` and don't render yet.

---

## File Structure

**Created:**
- `src/lib/wikidata/mapEnrichment.ts` — pure mappers: SPARQL work-row → title/edge; cast-row → hero_people row.
- `__tests__/lib/wikidata/mapEnrichment.test.ts` — mapper tests.
- `supabase/functions/enrich-wikidata-batch/index.ts` — the drain (mirrors the mappers in Deno).

**Modified (Task 4, the admin trigger — mirror Phase 2's button):**
- `supabase/migrations/<ts>_admin_run_wikidata_enrich.sql` — `admin_run_wikidata_enrich` RPC.
- `src/lib/db/catalogHealth.ts`, `src/components/admin/health/hooks.ts`, `src/components/admin/health/domains/OperationsDomain.tsx`, `app/admin/health.web.tsx` — "Enrich 10" button on the Identity review panel.
- `src/types/database.generated.ts` — regenerated.

---

## Task 1: Pure enrichment mappers (TDD)

**Files:**
- Create: `src/lib/wikidata/mapEnrichment.ts`
- Test: `__tests__/lib/wikidata/mapEnrichment.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/wikidata/mapEnrichment.test.ts`:

```ts
import { mapWorkRow, type WorkRow, type MappedTitle } from '../../../src/lib/wikidata/mapEnrichment';

describe('mapWorkRow', () => {
  it('classifies a TMDB movie work as a film title', () => {
    const r: WorkRow = { workLabel: 'The Dark Knight', year: '2008', tmdbMovie: '155', tmdbTv: null, igdb: null };
    expect(mapWorkRow(r)).toEqual<MappedTitle>({
      id: 'tmdb:155', source: 'tmdb', mediaType: 'film', externalId: '155',
      title: 'The Dark Knight', year: 2008,
    });
  });

  it('classifies a TMDB TV work as a tv title', () => {
    const r: WorkRow = { workLabel: 'The Brave and the Bold', year: null, tmdbMovie: null, tmdbTv: '15804', igdb: null };
    expect(mapWorkRow(r)?.mediaType).toBe('tv');
    expect(mapWorkRow(r)?.id).toBe('tmdb:15804');
  });

  it('classifies an IGDB slug work as a game title', () => {
    const r: WorkRow = { workLabel: 'Lego Batman', year: null, tmdbMovie: null, tmdbTv: null, igdb: 'lego-batman-the-videogame' };
    expect(mapWorkRow(r)).toMatchObject({ id: 'igdb:lego-batman-the-videogame', source: 'igdb', mediaType: 'game' });
  });

  it('prefers movie over tv over game when several ids are present', () => {
    const r: WorkRow = { workLabel: 'X', year: null, tmdbMovie: '1', tmdbTv: '2', igdb: 's' };
    expect(mapWorkRow(r)?.mediaType).toBe('film');
  });

  it('returns null when no external id is present', () => {
    expect(mapWorkRow({ workLabel: 'X', year: '2000', tmdbMovie: null, tmdbTv: null, igdb: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest __tests__/lib/wikidata/mapEnrichment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mapper**

Create `src/lib/wikidata/mapEnrichment.ts`:

```ts
import type { MediaType, TitleSource } from '../db/titles';

export interface WorkRow {
  workLabel: string;
  year: string | null;
  tmdbMovie: string | null;
  tmdbTv: string | null;
  igdb: string | null;
}

export interface MappedTitle {
  id: string;
  source: TitleSource;
  mediaType: MediaType;
  externalId: string;
  title: string;
  year: number | null;
}

const yearOf = (s: string | null): number | null => {
  if (!s) return null;
  const m = s.match(/(18|19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : null;
};

/**
 * Classify a Wikidata work by WHICH external-id property it carries (robust;
 * the work's P31 "instance of" is ambiguous). Precedence: movie > tv > game.
 */
export function mapWorkRow(r: WorkRow): MappedTitle | null {
  let source: TitleSource;
  let mediaType: MediaType;
  let externalId: string;
  if (r.tmdbMovie) { source = 'tmdb'; mediaType = 'film'; externalId = r.tmdbMovie; }
  else if (r.tmdbTv) { source = 'tmdb'; mediaType = 'tv'; externalId = r.tmdbTv; }
  else if (r.igdb) { source = 'igdb'; mediaType = 'game'; externalId = r.igdb; }
  else return null;
  return {
    id: `${source}:${externalId}`,
    source,
    mediaType,
    externalId,
    title: r.workLabel,
    year: yearOf(r.year),
  };
}

export type PerformerRole = 'performer' | 'voice_actor';

export interface MappedPerson {
  personName: string;
  role: PerformerRole;
}

/** A cast row → hero_people shape. `isVoice` comes from the statement source
 *  (voice-actor property vs. plain cast member). */
export function mapPersonRow(performerName: string, isVoice: boolean): MappedPerson {
  return { personName: performerName, role: isVoice ? 'voice_actor' : 'performer' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn jest __tests__/lib/wikidata/mapEnrichment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wikidata/mapEnrichment.ts __tests__/lib/wikidata/mapEnrichment.test.ts
git commit -m "feat(wikidata): enrichment mappers (work->title, cast->person)"
```

---

## Task 2: `enrich-wikidata-batch` edge function

**Files:**
- Create: `supabase/functions/enrich-wikidata-batch/index.ts`

- [ ] **Step 1: Write the function**

Create `supabase/functions/enrich-wikidata-batch/index.ts`:

```ts
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
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const yearOf = (s: string | null): number | null => {
  if (!s) return null; const m = s.match(/(18|19|20)\d{2}/); return m ? parseInt(m[0], 10) : null;
};

type Src = 'tmdb' | 'igdb';
type Media = 'film' | 'tv' | 'game';
interface MappedTitle { id: string; source: Src; mediaType: Media; externalId: string; title: string; year: number | null; }

function mapWorkRow(r: Record<string, { value: string }>): MappedTitle | null {
  const tmdbMovie = r.tmdbMovie?.value ?? null;
  const tmdbTv = r.tmdbTv?.value ?? null;
  const igdb = r.igdb?.value ?? null;
  let source: Src, mediaType: Media, externalId: string;
  if (tmdbMovie) { source = 'tmdb'; mediaType = 'film'; externalId = tmdbMovie; }
  else if (tmdbTv) { source = 'tmdb'; mediaType = 'tv'; externalId = tmdbTv; }
  else if (igdb) { source = 'igdb'; mediaType = 'game'; externalId = igdb; }
  else return null;
  return {
    id: `${source}:${externalId}`, source, mediaType, externalId,
    title: r.workLabel?.value ?? '(untitled)', year: yearOf(r.year?.value ?? null),
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

async function fetchPerformers(qid: string): Promise<Array<{ name: string; role: 'performer' | 'voice_actor' }>> {
  const q = `
SELECT DISTINCT ?performerLabel ?isVoice WHERE {
  ?work p:P161 ?st. ?st ps:P161 ?performer. ?st pq:P453 wd:${qid}.
  BIND(EXISTS { ?work p:P725 [ pq:P453 wd:${qid} ] } AS ?isVoice)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 40`;
  const rows = await sparql(q);
  const out = new Map<string, { name: string; role: 'performer' | 'voice_actor' }>();
  for (const r of rows) {
    const name = r.performerLabel?.value;
    if (!name) continue;
    const role = r.isVoice?.value === 'true' ? 'voice_actor' : 'performer';
    if (!out.has(name)) out.set(name, { name, role });
  }
  return [...out.values()];
}

async function runEnrich(sb: SB, limit: number, retry: boolean): Promise<number> {
  let q = sb.from('heroes').select('id, wikidata_qid, issue_count')
    .eq('wikidata_status', 'resolved').not('wikidata_qid', 'is', null)
    .order('issue_count', { ascending: false, nullsFirst: false }).limit(limit);
  if (!retry) q = q.is('wikidata_enriched_at', null);
  const { data: heroes } = await q;
  if (!heroes || heroes.length === 0) return 0;
  let calls = 0;
  for (const h of heroes as Array<{ id: string; wikidata_qid: string; issue_count: number | null }>) {
    try {
      calls++;
      const titles = await fetchAppearances(h.wikidata_qid);
      await sleep(200);
      calls++;
      const performers = await fetchPerformers(h.wikidata_qid);

      for (const t of titles) {
        await sb.from('titles').upsert({
          id: t.id, source: t.source, external_id: t.externalId,
          tmdb_id: t.source === 'tmdb' ? t.externalId : null,
          media_type: t.mediaType, title: t.title,
          release_date: t.year ? `${t.year}-01-01` : null,
        }, { onConflict: 'id', ignoreDuplicates: true });
        await sb.from('hero_media_appearances').upsert({
          hero_id: h.id, title_id: t.id, media_type: t.mediaType,
          source: 'wikidata', rank: h.issue_count,
        }, { onConflict: 'hero_id,title_id', ignoreDuplicates: true });
      }
      if (performers.length > 0) {
        await sb.from('hero_people').upsert(
          performers.map((p) => ({ hero_id: h.id, person_name: p.name, role: p.role, title_id: '', source: 'wikidata' })),
          { onConflict: 'hero_id,person_name,role,title_id', ignoreDuplicates: true },
        );
      }
      await sb.from('heroes').update({ wikidata_enriched_at: new Date().toISOString() }).eq('id', h.id);
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
  let limit = 10, retry = false, triggeredBy = 'cron';
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === 'number') limit = Math.min(Math.max(1, body.limit), 25);
    if (body?.retry === true) retry = true;
    if (typeof body?.triggeredBy === 'string') triggeredBy = body.triggeredBy;
  } catch { /* empty body ok */ }

  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const { data: runRow } = await sb.from('enrichment_runs').insert({
    run_type: 'wikidata_enrich', triggered_by: triggeredBy, status: 'running',
    started_at: new Date(startedAt).toISOString(),
  }).select('id').single();
  const runId = (runRow as { id?: number } | null)?.id ?? null;

  let calls = 0;
  try { calls = await runEnrich(sb, limit, retry); }
  catch (err) {
    if (runId != null) await sb.from('enrichment_runs').update({ status: 'error' }).eq('id', runId);
    return json({ error: String(err) }, 500);
  }
  if (calls > 0) await sb.from('api_usage').insert({ api: 'wikidata', endpoint: 'enrich', units: calls });
  if (runId != null) await sb.from('enrichment_runs').update({
    status: 'done', done: calls, processed: calls, duration_ms: Date.now() - startedAt,
  }).eq('id', runId);
  return json({ calls, message: calls === 0 ? 'nothing to do' : 'ok' });
});
```

Note: `hero_people.title_id` is part of the PK and NOT NULL, so performer rows not tied to a specific title use the empty string `''` as a sentinel (the FK is `references titles(id) on delete set null`, but `''` is never a real title id — acceptable because the column is nullable in the table; if the FK rejects `''`, change the migration in Phase 1 review to make `title_id` nullable with a partial unique index. Verify on first run — see Task 3 Step 3).

- [ ] **Step 2: Deploy**

Use `mcp__supabase__deploy_edge_function` to deploy `enrich-wikidata-batch` (verify_jwt: false).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/enrich-wikidata-batch/index.ts
git commit -m "feat(edge): enrich-wikidata-batch appearance edges + performers"
```

---

## Task 3: Smoke test + verify (live)

- [ ] **Step 1: Resolve a few more marquee heroes first (so there's enrich input)**

The Phase 2 smoke run resolved 7 heroes. Trigger a couple more resolve batches (admin "Resolve 15" or function invoke) so ~30+ heroes are `resolved`.

- [ ] **Step 2: Run one enrich batch and inspect**

Invoke `enrich-wikidata-batch` with `{ "limit": 5 }`. Then:

```sql
select media_type, source, count(*) from hero_media_appearances group by 1,2 order by 1,2;
select count(*) as tv_titles from titles where media_type='tv';
select count(*) as game_titles from titles where media_type='game';
select hero_id, count(*) from hero_people group by 1 limit 5;
```

Expected: new `(film,wikidata)`, `(tv,wikidata)`, `(game,wikidata)` edges appear; tv/game `titles` stubs created (`enrich_status='pending'`); `hero_people` populated for the enriched heroes. Spot-check Batman: `select title from titles where id in (select title_id from hero_media_appearances where hero_id = (select id from heroes where name='Batman') and source='wikidata') and media_type='tv';` → expect real animated series.

- [ ] **Step 3: Verify the `hero_people.title_id=''` sentinel inserted OK**

If Step 2 logged FK errors on `hero_people`, the `''` sentinel was rejected. Fix: a tiny migration making `title_id` nullable + adjust the PK to a unique index treating NULL distinctly, then change the edge function to write `title_id: null`. (Validate before assuming — the column may already accept `''` since `titles` has no `''` row only if FK is enforced; `hero_people.title_id` FK references `titles(id)`, so `''` WILL fail. Plan to switch to a nullable column.)

**Pre-emptive fix (apply as migration `<ts>_hero_people_nullable_title.sql`):**

```sql
alter table public.hero_people drop constraint hero_people_pkey;
alter table public.hero_people alter column title_id drop not null;
create unique index hero_people_uniq on public.hero_people
  (hero_id, person_name, role, coalesce(title_id, ''));
```

Then change the edge function upsert to `title_id: null` and `onConflict` to the index columns, redeploy, regenerate types.

---

## Task 4: Admin "Enrich" trigger (mirror Phase 2's Resolve button)

**Files:** new migration `admin_run_wikidata_enrich`; `catalogHealth.ts`; `hooks.ts`; `OperationsDomain.tsx`; `health.web.tsx`; regenerate types.

- [ ] **Step 1: RPC migration** (mirror `admin_run_wikidata_resolve`, posting to `/functions/v1/enrich-wikidata-batch`). Apply via `mcp__supabase__apply_migration`, regenerate types.

- [ ] **Step 2: `runWikidataEnrich(limit=10)` in `catalogHealth.ts`** (mirror `runWikidataResolve`).

- [ ] **Step 3: `onRunEnrich` handler in `hooks.ts`** (mirror `onRunResolve`; invalidate `['ambiguousHeroes']` is irrelevant here — invalidate `['enrichmentRuns']`).

- [ ] **Step 4: Second button on the Identity review panel** in `OperationsDomain.tsx` (an "Enrich 10" button beside "Resolve 15"; wrap the two in a small row). Thread `onRunEnrich` through `health.web.tsx`.

- [ ] **Step 5: Typecheck + commit**

```bash
yarn tsc --noEmit  # only pre-existing unrelated errors
git add -A && git commit -m "feat(admin): trigger wikidata enrich drain from command center"
```

---

## Task 5: Verification

- [ ] **Step 1:** `yarn tsc --noEmit` → only the known pre-existing unrelated errors.
- [ ] **Step 2:** `yarn test:ci` → all pass incl. `mapEnrichment.test.ts`.
- [ ] **Step 3 (live):** counts of `hero_media_appearances` by `(media_type, source)` show growing wikidata edges; `hero_people` populated; spot-check 3 heroes' TV titles by hand.

---

## Self-Review Notes

- **Spec coverage:** appearance edges from Wikidata's ID-stamped works (Task 1–2), performers → `hero_people` for the future Portrayed-by section (Task 2), admin trigger (Task 4). Game edges stored `pending` (IGDB fast-follow). TV/film `titles` left `pending` for the TMDB drain (existing film drain enriches new film stubs immediately; TV enrichment is Phase 4).
- **Validated:** the two SPARQL queries were run read-only against live Wikidata before writing this plan (Batman: 125 id-bearing works; real performers).
- **Known risk (flagged, with pre-emptive fix):** `hero_people.title_id` is NOT NULL + FK; performer rows aren't tied to a specific title. Task 3 Step 3 makes `title_id` nullable with a `coalesce` unique index. Do this in Task 2 up front if preferred.
- **Idempotency:** all writes are `upsert ... ignoreDuplicates`; `wikidata_enriched_at` gates re-processing (clear it / pass `retry:true` to re-run), avoiding the ComicVine read-through coupling mistake (gate on the timestamp, not field-nullness, since edges are multi-row).
```
