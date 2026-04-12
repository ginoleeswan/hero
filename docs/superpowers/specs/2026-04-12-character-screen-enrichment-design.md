# Character Screen — Content Enrichment & Section Order

**Date:** 2026-04-12  
**Scope:** Native character screen (`app/character/[id].tsx`) only  
**Goal:** Add missing content, fix section ordering, improve information hierarchy  

---

## What We're Changing

All additions use data already available from SuperheroAPI or the existing ComicVine fetch. No new API integrations needed (except the favourite count which reads from Supabase).

---

## New Additions

### 1. Alignment badge — identity block

**Where:** Identity block, same row as publisher, immediately after name/alias  
**Data source:** `stats.biography.alignment` — already fetched, currently buried in Overview info rows  
**Design:** A small pill/chip, colour-coded by value:
- `"good"` → green background (`COLORS.green` tint)
- `"bad"` → red background (`COLORS.red` tint)
- `"neutral"` → grey background

Render nothing if alignment is null / `-` / unknown.  
Alignment row is **removed** from the Overview section (it moves here).

---

### 2. Favourite count — heart button

**Where:** Heart button in the native header (top-right, via `Stack.Screen headerRight`)  
**Data source:** New function `getHeroFavouriteCount(heroId: string): Promise<number>` to be added to `src/lib/db/favourites.ts`. Queries `user_favourites` counting rows where `hero_id = heroId` (counts how many users have favourited this hero — distinct from the existing `getFavouriteCount` which counts a single user's favourites).  
**Design:** A small count label rendered below or beside the heart icon. Fetch on mount alongside the `isFavourited` call. Show nothing if count is 0 or loading. No skeleton — silent load.

---

### 3. Total power score — Power Stats section

**Where:** Below the 6 circular dials, right-aligned  
**Data source:** Sum of all 6 `powerstats` values (intelligence + strength + speed + durability + power + combat). Max possible = 600.  
**Design:** A single line: `Total: 442 / 600` in `Flame-Regular`, muted navy, right-aligned. Only render if at least one stat is a valid number (i.e. not all `"-"` / `"null"`).

---

### 4. First Appearance — issue metadata below cover

**Where:** First Appearance section, below the existing comic cover image  
**Data source:** `data.firstIssue` — already fetched. Fields: `name`, `coverDate`, `issueNumber`  
**Design:** Below the `comicImage`:
- Issue name in `Flame-Regular` 13px, navy, centred
- Cover date (year only, parsed from `coverDate`) in `FlameSans-Regular` 11px, muted, centred
- Only render fields that are non-null/non-empty

---

### 5. Affiliation tags — Connections section

**Where:** Replaces the `InfoRow` for `group-affiliation` in the Connections section  
**Data source:** `stats.connections['group-affiliation']` — a comma-separated string  
**Design:** Split on `,` and `;`, trim each entry, filter junk values, render as horizontally-wrapping chips. Each chip: `FlameSans-Regular` 11px, navy text, `rgba(42,45,90,0.08)` background, 16px border radius. Max ~8 chips — truncate with a `+N more` chip if needed.

---

### 6. Relatives — structured list

**Where:** Replaces the `InfoRow` for `relatives` in the Connections section  
**Data source:** `stats.connections.relatives` — a semicolon-separated string  
**Design:** Split on `;`, trim each entry, filter junk, render as a vertical list. Each entry on its own line in `FlameSans-Regular` 12px. Label "Relatives" remains as a section label above the list. If only one entry and it fits in a single line, keep as a single `InfoRow`.

---

### 7. Work merged into Connections

Work (occupation + base) currently has its own `Section` component. With only 2 rows it feels sparse. These two `InfoRow`s move into the Connections section, above affiliations. The standalone Work section is removed.

---

## Section Order (native screen, top to bottom)

| # | Section | Change |
|---|---------|--------|
| 1 | Hero image | Unchanged — parallax, zoom, gradient fade |
| 2 | Identity block | + alignment badge, + favourite count on heart |
| 3 | Summary | Unchanged |
| 4 | Power Stats | + total score below dials |
| 5 | Abilities | Unchanged |
| 6 | First Appearance | **Moved up from #8** + issue title + year below cover |
| 7 | Overview | Alignment row removed (moved to identity block) |
| 8 | Appearance | Unchanged |
| 9 | Connections | Affiliation chips + relatives list + Work rows merged in |

The old standalone **Work** section is removed.  
The old **First Appearance** position (between Overview and Appearance) is replaced by its new position at #6.

---

## Files to Modify

| File | What changes |
|------|-------------|
| `app/character/[id].tsx` | All layout changes live here |
| `src/lib/db/favourites.ts` | Add `getHeroFavouriteCount(heroId)` function |

No new components needed — all additions are inline within the existing screen structure.

---

## Out of Scope

- Web character screen (`[id].web.tsx`) — separate effort
- Related/similar heroes — requires new API work, deferred
- Any visual style changes (fonts, colours, card treatment) — layout polish only
- Compare strip — unchanged

---

## Constraints

- All data already available — no new API endpoints or Supabase migrations
- Junk value filtering must use the existing `JUNK_VALUES` set pattern
- Alignment badge renders nothing for unknown/null alignment — no fallback needed
- Favourite count loads silently, no skeleton, no error state shown to user
