# Smarter Search — Phase 3: Teams (DEFERRED)

**Date:** 2026-06-27
**Status:** Deferred — design notes only, NOT scheduled for implementation
**Depends on:** Phase 1 + Phase 2

## Why this is deferred

Teams have **no first-class searchable entity** in the current data model. They
exist only as:

1. `hero_relationships.is_teammate` edges between two heroes, and
2. some `heroes` rows that are *themselves* groups (e.g. "Avengers", "X-Men")
   but are not flagged as such — they're indistinguishable from individual
   characters in the `heroes` table.

So "search for teams" has no clean source to query. Before this can be built, a
**data-model decision** is required. That decision is its own brainstorm.

## Decision needed (the brainstorm input)

Pick one:

**Option A — Flag team-heroes.** Add `heroes.is_team boolean` (or an `entity_kind`
enum: `character | team | location`). Backfill via a heuristic (name in a known
team list, ComicVine "team" object type, or member-count from relationships).
Then search filters/sections on the flag. *Pro:* teams reuse the whole hero
pipeline (cards, routes, ranking). *Con:* needs a migration + a backfill job and
a reliable classifier.

**Option B — Derive teams from relationships.** Build a `teams` view/materialized
view that groups `is_teammate` edges into clusters. *Pro:* no new column. *Con:*
clustering is fuzzy, has no stable identity/route, and many real teams aren't
fully edge-connected.

**Recommendation:** Option A — it gives teams a stable identity and a route, and
folds into `useUnifiedSearch` as a fourth section exactly like titles did.

## Scope when un-deferred

1. Migration + backfill for the team flag (Option A).
2. Regenerate `database.generated.ts`.
3. `searchTeams(q)` in `src/lib/db/heroes/` (filtered hero query on the flag).
4. A fourth "Teams" section in `useUnifiedSearch` and both surfaces.

## Status

Do not implement until the data-model decision above is made and its own spec +
plan exist. Phase 1 and Phase 2 are independent of this and ship without it.
