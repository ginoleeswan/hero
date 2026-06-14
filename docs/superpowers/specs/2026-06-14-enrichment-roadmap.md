# DB Enrichment — Roadmap & Parallelization Guide

**Date:** 2026-06-14
**Purpose:** Coordinate four independent enrichment lanes that can be developed in
parallel (separate Claude Code tabs / worktrees). Each lane has its own kickoff
brief and runs its own brainstorming → spec → plan → build cycle.

## The four lanes

| Lane | Brief | Primary source | Ships | Status |
| --- | --- | --- | --- | --- |
| 1. Media | `2026-06-14-tmdb-media-enrichment-design.md` | TMDB | New `films` + `hero_film_appearances` tables, richer `MovieStrip` | **Design approved** |
| 2. LLM narrative | `2026-06-14-llm-narrative-lane-brief.md` | LLM (no new API) | "Did you know", power explainers, themed tags, era summaries | Brief only |
| 3. Deeper factual | `2026-06-14-deeper-factual-lane-brief.md` | Wikidata / Marvel API | Voice actors, canonical dates, awards, cross-media | Brief only |
| 4. Richer relationships | `2026-06-14-richer-relationships-lane-brief.md` | LLM + ComicVine | New relationship kinds (mentor/love-interest/alter-ego) | Brief only |

Lane 1 is fully designed (see its spec). Lanes 2–4 are briefs: a fresh tab should
open the brief, run the brainstorming skill to resolve its open questions, write a
full design spec, then plan.

## Shared-state collision map (READ BEFORE PARALLELIZING)

Lanes are *logically* independent but touch some of the same files. Coordinate
these to avoid painful merges:

- **`src/types/database.generated.ts`** — every lane that adds tables/columns
  regenerates this. It is generated, so resolve conflicts by re-running
  `mcp__supabase__generate_typescript_types` after merging, not by hand-merging.
- **`heroes` table migrations** — Lanes 2 and 3 may add columns to `heroes`.
  Migrations are additive and timestamp-named, so separate files won't collide in
  Postgres, but two lanes adding to the same table on the same day should use
  distinct migration timestamps. Prefer **new side-tables over new `heroes`
  columns** where the data is 1-to-many (facts, tags, external IDs) — this avoids
  contention entirely and fits the existing normalization pattern.
- **`app/character/[id].tsx`** — the highest-risk shared file. Lanes 1, 2, 3, and
  4 all want to render new sections here. Mitigation: each lane renders through its
  **own new section component** (e.g. `FilmsSection`, `DidYouKnowSection`) and adds
  a single import + placement line in `[id].tsx`. Keep all logic out of the screen.
  Merge the one-line placements last.
- **`app.config.ts` `extra`** — Lanes 1 and 3 add API keys. One-line additions;
  trivial to merge but expect a conflict marker on that block.
- **`supabase/functions/`** — each lane adds its own new edge function directory;
  no collision (shared `_shared/` helpers are append-only).
- **Cron schedules** — each lane that adds a drain registers its own cron. Check
  combined API-budget/`api_usage` load if multiple drains run hot at once.

## Recommended sequencing

All four *can* run in parallel, but to minimize `[id].tsx` merge pain:

1. Land **Lane 1 (TMDB)** first — it's designed, and it establishes the
   "new section component + one placement line" pattern the others copy.
2. Run **Lanes 2 and 4** in parallel next (both LLM-driven, no new external API
   plumbing, low collision with each other).
3. **Lane 3** (Wikidata/Marvel) last or anytime — most independent (its own
   sources and tables), but the heaviest new plumbing per source.

## Per-lane working agreement

Each tab should:
- Branch/worktree from `master` (project works directly on `master`; isolate via
  worktree if running truly concurrently).
- Add data as a **new side-table with a public-read RLS policy** unless the field
  is genuinely 1-to-1 with a hero.
- Route all DB access through a new `src/lib/db/*.ts` module (screens never import
  `supabase`).
- Render via a new section component, touching `[id].tsx` in exactly one place.
- Mirror the `enrich-comicvine-batch` drain pattern for any backfill, logging to
  `enrichment_runs` + `api_usage`.
- Regenerate `database.generated.ts` after each migration.
