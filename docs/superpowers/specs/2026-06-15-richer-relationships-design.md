# Lane 4 — Richer Relationships (Design Spec)

**Date:** 2026-06-15
**Status:** Design — approved in brainstorming, ready for implementation plan.
**Part of:** `2026-06-14-enrichment-roadmap.md`
**Supersedes the open questions in:** `2026-06-14-richer-relationships-lane-brief.md`

## Goal

Extend the existing `hero_relationships` graph beyond `enemy` / `ally` / `teammate`
to capture richer connection kinds — starting with **`love_interest`**, **`mentor`**
(and its inverse **`protege`**), and **`rival`** — extracted by an LLM from each
hero's ComicVine data. Surface these on the character screen in a new
**Connections** section. This lane reuses the existing graph table and its
`get_related_heroes` RPC almost entirely; the new work is an AI extraction pipeline
and one new UI section.

## Decisions (resolved in brainstorming)

| # | Question | Decision |
| --- | --- | --- |
| a | Which kinds first? | `love_interest`, `mentor`, `rival` (+ `protege` as the stored inverse of `mentor`). |
| b | Directionality | Store **both** directed edges explicitly. The pipeline writes `mentor`+`protege` (and the symmetric `love_interest`/`rival` in both directions) in one batch so `get_related_heroes` works unchanged from either hero's perspective. |
| c | Confidence + dedup | Hard threshold **0.7**. Add a nullable `confidence float` column. Skip any pair that already has a curated (non-AI) edge of the same kind. |
| d | Rank ordering | Computed at extraction time, ordered by the *related* hero's `issue_count` desc — same rule as existing kinds. |
| e | UI | New `ConnectionsSection` component, rendered on both `app/character/[id].tsx` (native) and `app/character/[id].web.tsx` (web), below the existing relationships card. |
| f | Model | Claude **Haiku 4.5** (`claude-haiku-4-5`) via the Anthropic REST API (`fetch`) inside the edge function. New `ANTHROPIC_API_KEY` Supabase secret, server-side only. |

## What already exists (build on, don't rebuild)

- **`hero_relationships`** table: `(hero_id, related_id, kind, source, rank,
  cross_universe)`, PK `(hero_id, kind, related_id)`. `kind` is **free-form text**
  (no check constraint), so new kind values insert with no schema change. `source`
  already defaults to `'comicvine'` and supports provenance; AI rows use
  `source = 'ai'`.
- **`get_related_heroes(p_hero_id, p_kind text, ...)`** RPC: accepts any kind
  string and orders by `rank` / `issue_count`. **Works unchanged for new kinds.**
- **`rebuild_hero_relationships()`**: truncates the whole table and rebuilds it
  from raw `heroes` columns. **AI rows must never flow through this** — see the
  hard constraint below.
- **`hero_relatives`** table: the typed family tree with its own `relation_kind`
  enum. **Stays entirely separate** — this lane does not touch it, and the family
  tree remains the home for `father`/`mother`/`spouse`/etc. We are not adding
  `alter_ego` or `successor` in v1, so there is no overlap to reconcile.
- **`src/lib/db/heroes.ts`**: `RelationKind = 'enemy' | 'ally' | 'teammate'`
  (TypeScript-only) and `getRelatedHeroes()`.
- **`src/components/RelatedHeroStrip.tsx`**: `RelatedKind` + `ACCENT` color map +
  the card/chip strip renderer the new section reuses.

## Hard constraints (from the brief + project conventions)

- **LLM API key is a Supabase secret, server-side only.** Never shipped to the client.
- **AI rows bypass `rebuild_hero_relationships()`.** That function currently does a
  blanket `truncate public.hero_relationships;` (verified — line 34 of
  `20260610123000_create_hero_relationships.sql`) and rebuilds only the
  `source = 'comicvine'` rows it derives from raw `heroes` columns. As written it
  would wipe AI rows on every rebuild. **Fix:** change the truncate to
  `DELETE FROM public.hero_relationships WHERE source <> 'ai';` so AI rows persist.
  The pipeline writes directly with `source = 'ai'`. This is the one change to
  existing SQL this lane makes.
- **Screens never import `supabase`** — all DB access via a new
  `src/lib/db/relationships.ts` module.
- **TypeScript, no `any`** — caught errors typed `unknown`.
- New tables/columns get a public-read RLS policy (the table already has one; the
  new column inherits it).

## Architecture

```
                ┌─────────────────────────────────────────────────────┐
                │  edge function: enrich-relationships-ai             │
  pg_cron  ───▶ │  (drain, mirrors enrich-comicvine-batch)            │
                │                                                     │
                │  1. SELECT heroes WHERE relationships_ai_status     │
                │     IS NULL/'pending', ORDER BY issue_count DESC    │
                │     LIMIT batch                                     │
                │  2. For each hero: build prompt from CV             │
                │     description/summary/deck + known related names  │
                │  3. fetch() Anthropic Messages API (Haiku 4.5,      │
                │     structured output: typed edges + confidence)    │
                │  4. Filter confidence >= 0.7; resolve related names │
                │     → hero ids; skip pairs with a curated edge      │
                │  5. Compute rank by related hero's issue_count desc │
                │  6. Upsert BOTH directed edges, source='ai'         │
                │  7. Set heroes.relationships_ai_status = 'done'     │
                │  8. Log to enrichment_runs + api_usage              │
                └─────────────────────────────────────────────────────┘
                                       │ writes
                                       ▼
                          hero_relationships (+ confidence col)
                                       │ get_related_heroes RPC
                                       ▼
            src/lib/db/relationships.ts  →  ConnectionsSection
                                       │  (one import + placement line each)
                                       ▼
              app/character/[id].tsx   and   app/character/[id].web.tsx
```

## Components

### 1. Migration: `confidence` column + status column + rebuild guard

A single new migration `supabase/migrations/<ts>_relationships_ai.sql`:

- `ALTER TABLE hero_relationships ADD COLUMN confidence real;` (nullable; curated
  rows stay `NULL`, AI rows carry their score).
- `ALTER TABLE heroes ADD COLUMN relationships_ai_status text;` (NULL = not yet
  processed; mirrors the `comicvine_status` pattern — values `'done'`, `'failed'`,
  `'pending'`).
- Modify `rebuild_hero_relationships()` so its delete is
  `DELETE FROM hero_relationships WHERE source <> 'ai'` instead of `TRUNCATE`
  (verify the current body first; adjust to match).

No check constraint on `kind` — the lane brief floated one, but since the column
is free-form and only this lane writes these values, a constraint adds merge
contention (per the collision map) for no safety we need. **Decision: no
check-constraint migration.**

After applying, regenerate `database.generated.ts`.

### 2. Edge function: `supabase/functions/enrich-relationships-ai/index.ts`

Mirrors `enrich-comicvine-batch` structure exactly:

- **Status gate** on `heroes.relationships_ai_status` (popularity-ordered by
  `issue_count` desc, resumable, batch-limited, cancel support).
- **Prompt**: feed the model the hero's name, ComicVine `description`/`deck`/summary,
  and the list of already-known related hero names (so it links to real characters,
  not invented ones). Ask for typed edges of the three kinds with a 0–1 confidence.
- **LLM call**: `fetch('https://api.anthropic.com/v1/messages')` with
  `model: 'claude-haiku-4-5'`, `ANTHROPIC_API_KEY` from `Deno.env`. Same fetch-based
  pattern as `generate-verdict`'s Gemini call. Use structured output
  (`output_config.format` json_schema) for a clean typed array; parse with
  `JSON.parse` (never raw string-match). Adaptive thinking is unnecessary for this
  extraction — omit `thinking`.
- **Post-processing**: drop edges with `confidence < 0.7`; resolve related names to
  hero ids (reuse the name→hero resolution the relationships rebuild already uses);
  skip any `(hero_id, kind, related_id)` that already exists with `source <> 'ai'`;
  compute `rank` ordering by the related hero's `issue_count` desc.
- **Write**: upsert both directed edges per relationship (`mentor`→`protege`
  inverse; `love_interest`/`rival` symmetric) with `source = 'ai'` and the
  confidence score, in one batch per hero.
- **Logging**: `enrichment_runs` + `api_usage`, same shape as the ComicVine drain.
- **Outcome** type `'done' | 'failed' | 'retry'`, set `relationships_ai_status`
  accordingly.

Admin-gated and cron-registered the same way the existing paid AI functions are
(see recent `feat(admin): configurable crons + in-app AI portrait runner`).

### 3. DB module: `src/lib/db/relationships.ts`

- Re-exports / wraps `getRelatedHeroes()` for the new kinds, or adds a
  `getConnections(heroId)` helper that fetches `love_interest` / `mentor` /
  `protege` / `rival` strips in the popularity order. Returns the same
  `RelatedHeroCard[]` shape the strip already consumes.
- Screens import only from here.

### 4. Type extension: `src/lib/db/heroes.ts`

- Extend `RelationKind` to
  `'enemy' | 'ally' | 'teammate' | 'love_interest' | 'mentor' | 'protege' | 'rival'`.

### 5. UI: `ConnectionsSection` + `RelatedHeroStrip` extension

- Extend `RelatedKind` and the `ACCENT` map in `RelatedHeroStrip.tsx` with:
  `love_interest` → rose, `mentor` → gold, `protege` → amber, `rival` → orange.
  (Pull exact hex from `COLORS`; add palette entries if missing.)
- New `src/components/ConnectionsSection.tsx`: renders the available strips
  (skipping empties via the existing `names.length === 0` guard) under a
  "Connections" header. Reuses `RelatedHeroStrip` per kind. No new layout logic.
- `app/character/[id].tsx` and `app/character/[id].web.tsx` each get **one import
  + one placement line**, below the existing enemies/allies relationships card.

## Data flow

1. Cron fires `enrich-relationships-ai` → drains a popularity-ordered batch of
   heroes whose `relationships_ai_status` is unset.
2. Per hero: prompt Haiku 4.5 → typed edges + confidence → filter/resolve/dedup →
   upsert both directions into `hero_relationships` (`source='ai'`).
3. Character screen calls `getConnections(heroId)` → `get_related_heroes` RPC per
   kind → `ConnectionsSection` renders strips ordered by `issue_count`.

## Error handling

- LLM call failure / non-200 / malformed JSON → mark hero `'failed'`, log to
  `enrichment_runs`, continue the batch (don't abort the drain). `'failed'` rows
  can be re-queued by resetting status, same as the ComicVine drain.
- A related name the model returns that doesn't resolve to a hero id is dropped
  silently (no chip fallback for AI edges — we only store resolved, navigable
  edges; unresolved names are noise from the model).
- Confidence below 0.7 → dropped, not stored.
- Existing curated edge of the same kind → AI edge skipped (curated wins).
- `rebuild_hero_relationships()` re-run → AI rows survive (delete-with-WHERE guard).

## Testing

Per project convention (`CLAUDE.md`): unit-test pure logic with mocked
Supabase/fetch; no screen-render tests.

- `__tests__/lib/db/relationships.test.ts` — `getConnections` shapes the RPC
  result correctly per kind, applies popularity order, handles empty kinds.
- Edge-function pure helpers (confidence filter, dedup-against-curated,
  both-direction edge construction, rank computation) extracted as testable
  functions and unit-tested with fixtures. The `fetch`/Anthropic call is mocked.
- No live LLM calls in tests.

## Out of scope (v1)

- `alter_ego` / `identity`, `successor`, `creator_of` / `created_by`, `team_leader`
  — deferred. The pipeline and UI are built so adding a kind later is: extend the
  prompt + `RelationKind` + `ACCENT` + the `getConnections` kind list. No schema change.
- A dedicated relationships screen — the Connections section on the character page
  is the only surface in v1.
- Touching `hero_relatives` / the family tree.

## Collision notes (per roadmap)

- `database.generated.ts` — regenerate after the migration; resolve conflicts by
  re-running the generator, not hand-merging.
- `hero_relationships` — additive rows + one nullable column; the one existing-SQL
  change is the rebuild delete guard. Coordinate with any other lane touching that
  function (none currently).
- `[id].tsx` / `[id].web.tsx` — one import + one placement line each, merged last.
- AI spend — shares the budget with Lane 2 (LLM narrative). Both log to `api_usage`;
  check combined drain load. Haiku 4.5 at $1/$5 per MTok keeps per-hero cost low.
