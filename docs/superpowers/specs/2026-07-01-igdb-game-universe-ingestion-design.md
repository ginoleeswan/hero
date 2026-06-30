# IGDB Game-Universe Ingestion — Design

**Date:** 2026-07-01
**Status:** Approved (design)
**Topic:** Add IGDB as a dedicated game-universe character source, plus franchise as a first-class browse dimension.

## Problem

The catalogue (~34k heroes) is filled entirely through ComicVine — 100% of every existing
game universe's rows (Nintendo, Capcom, Sega, NetherRealm, CD Projekt Red, Star Wars) carry a
`comicvine_id`. ComicVine indexes game characters only *incidentally*, so coverage is rich where
comic adaptations exist and absent/messy where they don't.

As a result, several of the most-wanted game universes are missing entirely (Final Fantasy /
Square Enix, League of Legends / Riot, Overwatch / Blizzard, Genshin Impact, Persona) or exist
only as a single iconic character stranded under a developer-name "publisher" with no franchise
grouping (Lara Croft → "Crystal Dynamics", Master Chief → "Bungie", Kratos → "Santa Monica
Studio", Solid Snake → "Konami").

IGDB (Twitch/Amazon's game database, free API via Twitch OAuth) is purpose-built for games and
has a proper `companies` / `franchises` / `collections` / `characters` taxonomy. It is the right
source to fill these gaps and to populate the currently-empty `franchise` column that the app's
two-tier universe model was designed around (owner/studio badge + franchise sub-group).

## Key constraint that shapes the design

ComicVine characters expose `count_of_issue_appearances`, a built-in popularity signal the
existing seeder sweeps by. **IGDB characters have no equivalent popularity metric.** Characters
link to *games*; games link to *franchises*. You cannot "pull the top N most popular IGDB
characters." You must either pick franchises deliberately or accept an unsorted firehose of
obscure indie-game characters that all land at `fame_score` 0 and never surface.

## Decisions (locked)

1. **Seeding = curated franchise allowlist now; rating-gated sweep is a documented future
   Phase 2 (not built).**
2. **Fame:** hand-rate marquee `fame_tier` at insert time; set `wikidata_status='pending'` on
   all rows so the existing Wikidata drain + `recompute_fame_scores()` lift the long tail
   automatically.
3. **Dedup = enrich + re-home.** When an IGDB character matches an existing hero, attach
   `igdb_id` and re-home `publisher`/`franchise` to the curated values; never overwrite existing
   art/description. A collision guard prevents wrongly merging same-name-different-character
   cases.
4. **Free-only.** `image_url` = IGDB `mug_shot`; do NOT auto-run portrait generation or AI stats.
   Art/stats upgrades are a later, explicitly-budgeted pass.
5. **Franchise becomes a first-class browse dimension:** add `/franchise/[slug]` pages (reusing
   the existing source-aware screen) and a two-tier character eyebrow. Folded into this spec
   because it is the payoff that makes the new `franchise` data visible.

## Phase-1 allowlist (21 franchises / 11 universes)

| Universe (`publisher`) | Franchises |
| --- | --- |
| Square Enix | Final Fantasy, Kingdom Hearts, NieR, Tomb Raider |
| Riot Games | League of Legends, Valorant |
| Blizzard Entertainment | Overwatch, Warcraft, Diablo |
| CD Projekt | The Witcher, Cyberpunk |
| HoYoverse | Genshin Impact |
| Atlus | Persona |
| Bandai Namco | Tekken |
| Xbox Game Studios | Halo |
| PlayStation Studios | God of War |
| Konami | Metal Gear |
| Bethesda | The Elder Scrolls, Fallout |
| Electronic Arts | Mass Effect |

Fast-follow candidates (not Phase 1): Five Nights at Freddy's, Elden Ring / Dark Souls
(FromSoftware), The Last of Us, Assassin's Creed, plus franchise top-ups of existing
ComicVine-sourced universes (Resident Evil/Capcom, Fire Emblem/Nintendo).

**Adding a franchise later is one line in the allowlist module.**

## Schema (one migration)

- `heroes.igdb_id text` + partial-unique index `WHERE igdb_id IS NOT NULL`.
- `heroes.igdb_status text` — symmetry with `comicvine_status`; values `pending` / `enriched` /
  `empty`; gates a possible future enrich drain. Default `NULL`.
- `igdb_ingestion_state` table, keyed by franchise slug:
  `{ franchise text, publisher text, igdb_franchise_id int, status text, last_synced_at
  timestamptz, inserted int, rehomed int, skipped int }`. Progress + auditability; mirrors
  `cv_ingestion_state`. Admin-only — no public RLS read policy (the app never reads it).
- Regenerate `src/types/database.generated.ts` after applying (`generate_typescript_types`).

## Components

### Allowlist module — `supabase/functions/_shared/igdb-allowlist.ts`
Single source of truth. Each entry: franchise name → `{ publisher, marqueeTiers:
Record<charName, tier>, igdbFranchiseId?: number }`. `marqueeTiers` carries the hand-rated
`fame_tier` for headliners (e.g. `'Cloud Strife': 4`, `'Sephiroth': 4`); everyone else defaults
to 0. `igdbFranchiseId` is an optional explicit override for ambiguous franchise names.

### Twitch token helper — `supabase/functions/_shared/igdb-auth.ts`
Exchanges `IGDB_CLIENT_ID` + `IGDB_CLIENT_SECRET` (Twitch app credentials) for a bearer token,
cached for the function's lifetime. New Supabase function secrets; documented in `.env.example`.

### Transform / decision module — `supabase/functions/_shared/igdb-transform.ts`
Pure, unit-testable functions, kept in ONE place to avoid the ComicVine dual-path drift
([[project_comicvine_dual_enrich_paths]]):
- IGDB character → hero row (id `igdb-<id>`, name, summary from `description`, `image_url` from
  `mug_shot.image_id`, `fame_tier` from marquee map, `wikidata_status='pending'`,
  `enriched_at=now`, `ai_stats_status=NULL`).
- `mugShotUrl(imageId)` → `https://images.igdb.com/igdb/image/upload/t_720p/<id>.jpg`.
- `dedupDecision(igdbChar, existingRows)` → `skip | rehome | insert` (see below).

### Edge function — `seed-igdb-characters`
`verify_jwt: true` — **service-role only, not public** (the existing seeders are
`verify_jwt:false` public DB-writers, which the codebase flags as a security smell; we do not
repeat it). Invoked via the Supabase MCP / service role.

Per franchise not yet `complete`:
1. Resolve franchise: query IGDB `/franchises` (fallback `/collections`) by name → franchise id
   + game ids. Ambiguous name → pick the highest game-count candidate, or use
   `igdbFranchiseId` override; log discarded candidates.
2. Get characters: `/characters where games = (gameIds)` with fields
   `name, akas, description, gender, species, mug_shot.image_id, games`; paginate (limit 500).
3. For each character, apply `dedupDecision` and upsert.
4. Update `igdb_ingestion_state` for the franchise.

Accepts `{ batches }` (franchises per invocation) for incremental runs. Throttled to IGDB's
4 req/s (≤8 concurrent). Returns a per-franchise summary `{ franchise, resolved, inserted,
rehomed, skipped }`.

## Dedup / re-home logic

For each IGDB character:
1. `igdb_id` already present in DB → **skip** (idempotent re-runs).
2. Else normalized-name match (`lower`, strip non-alphanumeric) against existing rows:
   - **Safe re-home** — match is unambiguous AND not a comic character (i.e. NOT a row that has
     a `comicvine_id` under a comic publisher such as DC/Marvel): set `igdb_id`, `publisher`,
     `franchise`, `igdb_status='enriched'`; `COALESCE` `image_url`/`summary` only where currently
     null; set `wikidata_status='pending'` only if currently unresolved. Never overwrite a
     non-null `portrait_url`/`description`.
   - **Name collision across franchises** (e.g. League's *Jinx* vs DC's *Jinx*; *Tracer* /
     *Genji* / *Ellie* clashes observed in the data) — these are genuinely *different
     characters* → **insert a new row**, never merge. A collision is correct, not a conflict.
3. No match → **insert** new row per the transform.

## Data flow

```
allowlist (code)
  → seed-igdb-characters  (Twitch token → IGDB franchise resolve → /characters)
    → upsert heroes        (insert new / re-home existing)
                            fame_tier set, wikidata_status='pending'
  → recompute_fame_scores()                       (immediate, marquee surfaces)
  → enrich-wikidata-batch  (existing cron)         → sitelinks for the tail
  → refresh_fame           (existing weekly cron)  → tail surfaces
  → app: universe + franchise pages render from publisher/franchise columns
```

## No new cron

Seeding is a manual, run-until-complete drain invoked via MCP/service role, exactly like
`seed-comicvine-characters`. The tail rides the existing `enrich-wikidata-batch` and weekly
`refresh_fame` crons. **Zero new crons** — folds into existing infrastructure per the
enrichment-landscape principle ([[project_enrichment_landscape]]).

## App integration

The `/universe/[slug]` and `/category/[slug]` routes already share one source-aware screen
(`app/category/[slug].tsx`, whose header comment already anticipates "publisher/studio/
franchise"). Universe pages resolve via the `PUBLISHER_BRANDS` registry; categories via a fixed
slug set.

1. **ComicVine read-through guard.** The on-view ComicVine cache-fill gates on field-nullness
   ([[project_comicvine_readthrough_coupling]]). An `igdb-` row has null ComicVine fields and
   would wrongly trigger a failing ComicVine fetch. Guard: skip read-through for rows that have
   an `igdb_id` (or, more generally, non-`cv-`/non-numeric ids with no `comicvine_id`).
2. **`/franchise/[slug]` route.** Thin re-export of the shared screen (native + `.web`), plus a
   `useFranchiseHeroes` query that filters on the `franchise` column. Franchise slug resolution
   added to the shared screen as a third source type alongside universe and category. Only render
   where `franchise` is populated; otherwise the universe page is the home.
3. **Two-tier eyebrow.** Replace the universe-only eyebrow with `universe (owner badge) ›
   franchise (sub-group)`, both tappable (badge → `/universe/[slug]`, franchise text →
   `/franchise/[slug]`). Rules:
   - Collapse to universe-only when `franchise` is null (no regression for comics — Batman still
     reads `DC Comics`).
   - Collapse to a single label when `franchise == publisher` (no `Pokémon › Pokémon`). As part
     of this, clear `franchise` on the existing Pokémon rows (publisher=`Pokémon` stands alone as
     a universe).
   - Owner badge stays the logo; franchise is a text chip. Franchise-specific logos are a later
     `PUBLISHER_BRANDS`-style addition (non-blocking).
4. **Brand badges (fast-follow, non-blocking).** Add `PUBLISHER_BRANDS` entries (logos/colours)
   for the new universes (Square Enix, Riot Games, Blizzard, HoYoverse, Atlus, Bandai Namco, Xbox
   Game Studios, PlayStation Studios, Bethesda, Electronic Arts). Without them a universe renders
   as plain styled text (same state as the new Pokémon universe).

## Error handling

- Twitch token failure → abort the run with a clear error.
- IGDB `429` / rate-limit → backoff and retry; respect 4 req/s.
- Franchise resolves to 0 characters → mark `igdb_ingestion_state.status='empty'`, log, continue.
  A franchise that yields ~nothing is dropped from the effective allowlist.
- Ambiguous franchise name → highest game-count candidate or `igdbFranchiseId` override; log
  discarded candidates.
- Re-home never overwrites non-null `portrait_url`/`description`/`summary`.
- Idempotent: re-runs skip on `igdb_id`, so a partial/failed run is safe to re-invoke.

## Testing (per CLAUDE.md — pure logic only, mocked fetch)

Unit tests in `__tests__/` mirroring source:
- `dedupDecision`: collision guard (comic *Jinx* not re-homed; same-character re-homes;
  cross-franchise same-name inserts new).
- character → hero-row transform (field mapping, marquee-tier lookup, `ai_stats_status=NULL`).
- `mugShotUrl` construction.
- Twitch token fetch (mocked).
- franchise-candidate selection (highest game-count; override respected).

No live edge-function E2E; no screen/navigation rendering tests (per repo testing conventions).

## Out of scope (explicit)

- Rating-gated long-tail sweep (future Phase 2).
- Portrait generation and AI stats for IGDB rows (later budgeted pass).
- Franchise-specific brand logos.
- Fast-follow franchises and ComicVine-universe franchise top-ups.
