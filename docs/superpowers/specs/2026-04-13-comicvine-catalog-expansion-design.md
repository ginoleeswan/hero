# ComicVine Catalog Expansion — Design Spec

**Date:** 2026-04-13  
**Status:** Approved  
**Scope:** Expand the hero catalog from 731 SuperheroAPI characters to ~5,000 characters sourced from ComicVine, with AI-generated powerstats via Gemini 2.5 Flash-Lite for characters not covered by SuperheroAPI.

---

## Background

The app currently seeds its character database from SuperheroAPI (731 heroes) and enriches each with ComicVine biographical data (description, powers, enemies, etc.) via a name-match lookup. This means:

- The catalog is capped at 731 characters
- Biography pages link to hundreds of ComicVine characters (enemies, allies, supporting cast) that don't exist in the app
- ComicVine enrichment re-queries by name on every visit rather than using a stable ID

This spec flips the model: **ComicVine becomes the primary character source**; SuperheroAPI becomes an optional enrichment layer for numeric stats; Gemini 2.5 Flash-Lite fills gaps with AI-estimated stats.

---

## What ComicVine Provides (confirmed)

| Field | Available |
|---|---|
| Character ID (stable) | ✓ `4005-{id}` |
| Name, aliases | ✓ |
| Deck (one-line summary) | ✓ |
| Full HTML biography | ✓ |
| Powers (tag list) | ✓ |
| Origin type | ✓ |
| Issue count | ✓ (used as popularity/quality filter) |
| Publisher | ✓ |
| Image (multiple sizes) | ✓ icon, thumb, small, medium, super, original |
| Enemies, allies, teams | ✓ |
| Numeric powerstats (0–100) | ✗ — unique to SuperheroAPI |

---

## Architecture

### Data model after expansion

```
Character in DB
├── Core identity      — from ComicVine (name, comicvine_id, summary, image, publisher)
├── Biography          — from ComicVine (description HTML, powers, origin, enemies, teams)
├── Numeric stats      — from SuperheroAPI if available (stats_source = 'superheroapi')
│                        OR from Gemini if generated   (stats_source = 'ai')
│                        OR absent                     (stats_source = NULL)
└── Enrichment flags   — comicvine_enriched_at, ai_stats_status
```

### Stats provenance

| `stats_source` | Meaning |
|---|---|
| `'superheroapi'` | Verified numeric stats from SuperheroAPI. Shown as-is. |
| `'ai'` | Gemini-estimated stats. Shown with "AI estimated" badge. |
| `NULL` | No stats yet. Generation triggered on first character view. |

---

## Phase 1 — DB Schema Changes

### New columns on `heroes`

```sql
-- Stable ComicVine character ID (numeric portion only, e.g. "1699" from "4005-1699")
ALTER TABLE heroes ADD COLUMN comicvine_id text UNIQUE;

-- Stats provenance
ALTER TABLE heroes ADD COLUMN stats_source text
  CHECK (stats_source IN ('superheroapi', 'ai'));

-- AI generation queue state
ALTER TABLE heroes ADD COLUMN ai_stats_status text
  CHECK (ai_stats_status IN ('pending', 'done', 'failed'));
```

### New table — ingestion state

```sql
CREATE TABLE cv_ingestion_state (
  id             integer PRIMARY KEY DEFAULT 1,  -- singleton row
  last_offset    integer NOT NULL DEFAULT 0,
  total_ingested integer NOT NULL DEFAULT 0,
  target         integer NOT NULL DEFAULT 5000,
  status         text    NOT NULL DEFAULT 'idle'
                   CHECK (status IN ('idle', 'running', 'complete', 'error')),
  last_run_at    timestamptz,
  error          text
);
INSERT INTO cv_ingestion_state DEFAULT VALUES;
```

### Backfill for existing 731 heroes

```sql
-- Mark heroes that already have powerstats as SuperheroAPI-sourced
UPDATE heroes
SET stats_source = 'superheroapi'
WHERE intelligence IS NOT NULL
  AND strength IS NOT NULL;
```

The `get-comicvine-hero` edge function is updated to also write `comicvine_id` when it resolves a character match, so future enrichment calls store the stable ID.

---

## Phase 2 — Ingestion Pipeline

### New edge function: `seed-comicvine-characters`

Called manually or via Supabase cron. Each invocation processes one batch of 100 characters. Multiple invocations build the catalog progressively, resuming from the last offset.

**Per invocation:**

1. Read `last_offset` and `target` from `cv_ingestion_state`
2. If `total_ingested >= target` or `status = 'complete'`, return early
3. Fetch 100 characters from ComicVine API:
   ```
   GET /api/characters/
     ?sort=count_of_issue_appearances:desc
     &offset={last_offset}
     &limit=100
     &field_list=id,name,deck,publisher,image,count_of_issue_appearances
   ```
4. For each character:
   - **Skip** if `comicvine_id` already exists in DB (already seeded)
   - **Merge** if name matches an existing hero row: write `comicvine_id` to the existing row, skip insert
   - **Insert** new hero row:
     ```
     name, comicvine_id, summary (deck), image_url (medium_url),
     publisher, issue_count, ai_stats_status = 'pending'
     ```
5. Update `cv_ingestion_state`: increment `last_offset` by 100, update `total_ingested`
6. If `total_ingested >= target`, set `status = 'complete'`

**Deduplication logic (name merge):**  
Normalise both names to lowercase, strip punctuation. If normalised match found, treat as same character — write `comicvine_id` to the existing row rather than inserting a duplicate.

**Rate limiting:**  
ComicVine allows ~200 requests/minute. Each invocation makes 1 list request + up to 0 detail requests (detail is deferred to the existing enrichment flow). Safe to call the seeding function multiple times in rapid succession.

**Resumability:**  
If a batch fails mid-way, `last_offset` has not been updated yet (update is written at the end). Re-invoking picks up from the same offset. At worst, one batch is partially re-processed — deduplication on `comicvine_id` prevents duplicate inserts.

---

## Phase 3 — AI Stat Generation

### New edge function: `generate-hero-stats`

Called lazily when a character page loads and `intelligence IS NULL` and `ai_stats_status = 'pending'`.

**Input:** `{ heroId: string }`

**Flow:**

1. Fetch from DB: `name`, `powers`, `summary`, `origin`, `description` (first 800 chars, HTML stripped)
2. If `ai_stats_status` is already `'done'` or `'failed'`, return current stats (idempotency guard)
3. Build Gemini prompt (see below)
4. Call `gemini-2.5-flash-lite` via Google AI SDK with `responseMimeType: 'application/json'`
5. Parse and validate response — all 6 values must be integers 0–100
6. On success: write stats to hero row, set `stats_source = 'ai'`, `ai_stats_status = 'done'`
7. On failure: set `ai_stats_status = 'failed'`, return null (UI hides stats section)

**Prompt:**

```
You are a comic book analyst. Based only on the character data below,
estimate their combat stats on a scale of 0–100.

Character: {name}
Origin: {origin}
Powers: {comma-separated power list}
Summary: {summary}
Description: {first 800 chars of description, HTML stripped}

Reference anchors:
- Average human: strength 10, speed 10, durability 20, intelligence 50, power 5, combat 30
- Peak human (Batman, Captain America): strength 30, speed 35, durability 40, combat 85
- Street-level superhuman (Spider-Man): strength 55, speed 60, durability 50
- Cosmic-level (Superman, Thor): strength 100, speed 95, durability 100, power 95
- Intelligence 100 = Reed Richards, Lex Luthor level

Return ONLY valid JSON with these exact keys, no explanation:
{"intelligence":0,"strength":0,"speed":0,"durability":0,"power":0,"combat":0}
```

**Cost estimate:**
- ~600 input tokens + ~60 output tokens per character
- 5,000 characters × $0.10/1M input + $0.40/1M output = **~$0.42 total**
- Free tier (available on Gemini API) covers this entirely if generation is lazy/spread over time

---

## Phase 4 — Biography Link Interception

With `comicvine_id` stored on every character, links in biography pages can resolve to internal routes.

### New DB helper

```ts
// src/lib/db/heroes.ts
export async function getHeroByComicvineId(cvId: string): Promise<Hero | null>
```

Single query: `SELECT * FROM heroes WHERE comicvine_id = $1 LIMIT 1`

### Click handler in biography page

A `useEffect` attaches a click listener to the rendered HTML content div.

```
On <a> click:
  href matches /slug/4005-{id}/  →  character link
    query heroes WHERE comicvine_id = id
    found  →  router.push('/character/{heroId}')
    not found  →  open 'https://comicvine.gamespot.com{href}' in new tab
  href matches /slug/4020-{id}/  →  location link  →  open externally
  href matches any other /slug/XXXX-{id}/  →  open externally
```

### Visual treatment

Character links that resolve to an in-app hero get a subtle visual upgrade: `color: COLORS.navy` instead of orange, with a small arrow icon — distinguishing internal navigation from external ComicVine links. Implemented via a CSS class injected into matching `<a>` tags during `preprocessHtml`.

---

## Phase 5 — UI Changes

### Character detail page (web + native)

**Stats section behaviour by `stats_source`:**

| Value | Behaviour |
|---|---|
| `'superheroapi'` | Renders exactly as today. No badge. |
| `'ai'` | Renders stats. Small "AI estimated" pill beside "Power Stats" title. |
| `NULL` + `ai_stats_status = 'pending'` | Fires `generate-hero-stats` on mount. Shows stat bar skeletons. Renders when resolved. |
| `NULL` + `ai_stats_status = 'failed'` | Hides stats section entirely. No error shown to user. |

**"AI estimated" pill:**  
A small grey pill (`AI` label) next to the Power Stats card title. Tapping/hovering shows a tooltip: "Stats estimated by AI based on this character's powers and biography."

### Comparison feature

- Requires both characters to have stats (either source) to proceed
- If selected character has no stats: show inline message "Stats unavailable for {name}" and disable the compare flow for that pairing

### Search

No changes required. `searchHeroes` queries by name/full_name — works on the expanded catalog automatically once characters are inserted. Performance note: ensure `name` and `full_name` columns have indexes (verify during implementation).

---

## Implementation Phases & Order

```
Phase 1  DB Schema       — migration file, backfill SQL
Phase 2  Ingestion       — seed-comicvine-characters edge function
Phase 3  AI Stats        — generate-hero-stats edge function
         Update          — get-comicvine-hero writes comicvine_id
Phase 4  Link intercept  — getHeroByComicvineId + biography click handler
Phase 5  UI              — AI badge, stats loading state, compare guard
```

Each phase is independently deployable. Phases 2–3 can run in parallel after Phase 1.

---

## What Doesn't Change

- The existing 731 heroes and all their data — no destructive changes
- The `heroImageSource` priority chain — CV images stored in `image_url` for new characters, existing characters untouched
- The `get-comicvine-hero` enrichment flow — still runs for characters that need full biographical detail (description, enemies, teams). Only adds `comicvine_id` write.
- Native app character screens — stat source badge is web-only initially
