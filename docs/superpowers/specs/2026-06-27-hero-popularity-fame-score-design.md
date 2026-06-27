# Hero Popularity / Fame Score — Design

**Date:** 2026-06-27
**Status:** Draft for review

## Problem

"Popularity" is a load-bearing heuristic across the app — it drives the home
spotlight, category ranking ("Most Iconic"), related-list ordering
(enemies/allies/rivals), and discovery rows. Today it collapses onto a **single
proxy: `issue_count`** (total comic-book appearances), ordered descending almost
everywhere (`src/lib/db/heroes/feed.ts`, `categories.ts`, `core.ts`).

This is wrong for the stated goal. We want **mainstream recognizability** — how
widely the general public would recognize a character — and `issue_count`:

1. **Conflates longevity with fame.** A 60-year C-list mainstay outranks a
   younger but hugely recognizable character (Harley Quinn, Miles Morales).
2. **Is comics-only by construction.** It cannot rank cross-medium icons, which
   is why screen/anime/game characters are special-cased everywhere
   (`getFranchiseIcons`, `getHeroesByMediaTag`, the `franchise` column). The
   constant workarounds are the tell that `issue_count` is the wrong single axis.
3. **Mislabels "Most Iconic"** as literally "Ranked by total comic book
   appearances" (`categories.ts:107`) — that's *most-published*, not *most-iconic*.

Additional inconsistencies to fix opportunistically:
- The stored `category = 'popular'` bucket is ordered **alphabetically**
  (`categories.ts:141`), so the "popular" category isn't ranked by anything.

## Goal

A single, stored, **mainstream-weighted `fame_score` (0–100)** on every hero,
derived from multiple signals, with **no nulls** (whole catalog rankable), that
degrades gracefully and is **re-tunable and auditable** without re-running
expensive backfills. Replace `issue_count` ordering with `fame_score` ordering at
the consumption sites, phased.

## Catalog reality (measured 2026-06-27)

CLAUDE.md says "3,000+ heroes" — **stale**. Actual:

| Metric | Count |
| --- | --- |
| Total heroes | **33,989** |
| `wikidata_qid` populated | 4,720 |
| `portrait_url` populated | 2,743 |
| `summary` populated | 9,931 |
| `movie_count >= 2` | 1,393 |
| `issue_count >= 200` | 1,254 |
| `franchise` populated | 91 |
| **Rating candidate pool** (`movie_count>=2 OR issue_count>=200 OR franchise NOTNULL`) | **2,075** |

(Action item: update CLAUDE.md's row-count claim as part of this work.)

## What "fame" means here (decided)

- **Audience:** mainstream recognizability (general public), not comic-canon depth.
- **Signal philosophy:** a human/LLM recognizability judgment is the *backbone*
  (it embodies public knowledge and covers the whole catalog); hard deterministic
  signals **ground and refine** it so the score is auditable and reacts to data.
- **The recognizability tier is rated by Claude in a Claude Code session — NOT a
  Gemini/edge-function call.** No API cost, no cost-guard, no function to
  maintain. It is a one-time (re-runnable) human-in-the-loop backfill.

## Architecture — captured signals + versioned scoring function

Rejected alternatives:
- **Live composite at query time** — can't index/order on 34k rows; the rated
  signal can't be live. Rejected.
- **Single baked `fame_score` float** — opaque; can't re-tune weights without
  re-rating/re-fetching; can't audit *why* a hero ranks where it does. Rejected.
- **Chosen: store each raw signal in its own column; compute `fame_score` as a
  pure, versioned SQL function of those columns.** Re-tunable instantly,
  auditable, mirrors how `powerstats_total` is already a derived rollup.

### 1. New columns on `heroes`

| Column | Type | Source |
| --- | --- | --- |
| `fame_tier` | `smallint` (0–4) | **Rated by Claude** in-session for the candidate pool; defaults to 0 for the tail |
| `fame_rated_at` | `timestamptz null` | set when a tier is hand-assigned (provenance) |
| `fame_rated_by` | `text null` | e.g. `'claude-opus-4-8'` / version marker (provenance) |
| `wikidata_sitelinks` | `int null` | # of Wikipedia language editions; backfilled via `enrich-wikidata-batch` |
| `fame_score` | `smallint null` | **derived output**, 0–100, indexed for ordering |
| `fame_score_version` | `smallint null` | scoring-function version that produced the score |

Reuse existing `movie_count`, `issue_count`, `powerstats_total`.

`fame_tier` defaults to `0` (not null) so the tail is always rankable. Index:
`create index on heroes (fame_score desc nulls last)`.

### 2. Recognizability tier (0–4) — the backbone

Coarse tiers (robust; fine-grained numbers from a model are noisy/irreproducible):

| Tier | Meaning | Examples |
| --- | --- | --- |
| 4 | Household name (non-fans recognize) | Spider-Man, Batman, Goku |
| 3 | Well-known to general audiences | Harley Quinn, Deadpool, Venom |
| 2 | Known to genre/comics fans | Nightcrawler, Blue Beetle |
| 1 | Deep-cut, comics-only | most long-tail mainstays |
| 0 | Obscure / unidentifiable | bulk of the ComicVine import |

**Rating workflow (in Claude Code session):**
1. Pull candidate pool in batches via the Supabase tools — select
   `id, name, publisher, aliases, first_appearance, issue_count, movie_count,
   franchise` for rows matching
   `movie_count >= 2 OR issue_count >= 200 OR franchise IS NOT NULL`
   (~2,075 rows; ~150/batch → ~15 batches).
2. Claude assigns each a `fame_tier` 0–4 from its own knowledge; the
   `publisher + aliases + first_appearance` fields disambiguate name collisions
   (e.g. which "Phoenix").
3. Write tiers back via an admin RPC `admin_set_fame_tiers(jsonb)` (array of
   `{id, tier}`), setting `fame_rated_at = now()`, `fame_rated_by`.
4. Everyone **outside** the pool keeps `fame_tier = 0`.

Re-runnable: a later session can re-rate or extend the pool; provenance columns
make stale ratings findable (`fame_rated_at < threshold`).

### 3. Wikidata sitelink backfill (hard mainstream signal)

Extend `enrich-wikidata-batch` (currently fetches appearances/performers/facts)
to also read the entity's `sitelinks` count from the Wikidata API and write
`wikidata_sitelinks`. Covers the 4,720 QID-resolved heroes. No schema change to
the function's selection logic beyond adding the field.

### 4. Scoring function — `compute_fame_score(...)`

Pure Postgres function (immutable on its inputs), invoked by a batch RPC
`recompute_fame_scores()` (and optionally a row trigger later). Blend:

- **Tier sets the band:**
  `0 → [0,15]`, `1 → [15,35]`, `2 → [35,55]`, `3 → [55,80]`, `4 → [80,100]`.
- **Hard signals position within/across the band:** normalized, log-compressed,
  **winsorized** (clamp top ~1% so Spider-Man doesn't flatten the scale):
  - `log1p(wikidata_sitelinks)` — mainstream reach (verifiable)
  - `log1p(movie_count)` — screen presence + recency
  - `log1p(issue_count)` — comics depth (supporting; primary tiebreaker in the tail)
  Their normalized weighted sum interpolates the hero's position inside the band.
- **Bounded cross-band correction:** if hard signals strongly contradict the tier
  (e.g. tier 1 but high sitelinks), allow a **±1 band** nudge — guards against
  rating misses without letting one signal run away.
- Output clamped to `[0,100]`, written with the current `fame_score_version`.

Normalization constants (winsor caps, percentile bounds) live as named constants
in the migration so re-tuning = bump `fame_score_version` + re-run
`recompute_fame_scores()` (cheap; no re-rating, no API calls).

### 5. Recency stays separate

`fame_score` is the **stable baseline**. The existing TMDB `trending` layer
(`get_trending_heroes`, `on_screen`/`coming_soon`/`streaming`) remains the live,
time-varying overlay. We do **not** fold volatile trending into the stored score.
Read-time surfaces (e.g. spotlight) may blend baseline + trending as today.

## Consumption — phased cutover

Each call site is a one-line `.order()` change behind the `src/lib/db/` layer.

1. **Phase 1:** "Most Iconic" category → order by `fame_score`; relabel its
   description from "Ranked by total comic book appearances" to honest copy.
   Fix `'popular'` category's alphabetical order → `fame_score`.
2. **Phase 2:** feed rows (`feed.ts`), related-list ordering (rivals/allies/
   enemies), spotlight candidate pools.
3. **Phase 3:** any remaining `issue_count`-ordered surfaces; keep `issue_count`
   only where it is semantically correct (e.g. an explicit "longest-running"
   view, if any).

`issue_count` ordering remains the fallback wherever `fame_score` is somehow null
(belt-and-suspenders; with `fame_tier` defaulting to 0 there should be none).

## Backfill / rollout order

1. Migration: add columns + index + `admin_set_fame_tiers` + `compute_fame_score`
   + `recompute_fame_scores`. Regenerate `database.generated.ts`.
2. Widen `enrich-wikidata-batch` to populate `wikidata_sitelinks`; run it.
3. Claude rates the ~2,075-hero candidate pool in batches → `admin_set_fame_tiers`.
4. Run `recompute_fame_scores()`.
5. Flip consumers (Phase 1 → 2 → 3), verifying each.
6. Update CLAUDE.md row-count claim.

Steps 2–4 are independently re-runnable; step 4 re-runs on every weight change.

## Testing

- **Unit (Jest, mocked Supabase):** the normalization/blend logic if any of it
  lands in TS; otherwise assert the `src/lib/db/` query builders order by
  `fame_score`.
- **SQL sanity checks (post-backfill, ad hoc):** known-famous heroes land in
  expected bands (Spider-Man tier 4 → score ≥ 80; a random obscure import → < 15);
  no `fame_score` is null; distribution isn't degenerate (not all clustered).
- Do **not** test rendering of full screens (per repo testing policy).

## Open risks

- **Rating 2,075 by hand is real effort** (~15 batches) and somewhat subjective at
  the tier 2/3 boundary. Mitigation: coarse tiers are forgiving; hard signals
  refine within; re-runnable.
- **New heroes added after the rating pass** default to tier 0 until a re-rate.
  Acceptable: deterministic signals still order them; periodic re-rate of
  `fame_rated_at IS NULL AND <in candidate pool>` closes the gap.
- **Winsor/normalization tuning** may need a couple of iterations to look right;
  cheap because re-scoring is decoupled from re-rating.
