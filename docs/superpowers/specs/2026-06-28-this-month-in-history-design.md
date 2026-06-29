# This Month in History — anniversary freshness engine

**Date:** 2026-06-28
**Status:** Design approved — ready for implementation plan.
**Roadmap:** Engine #4 (final) of the freshness-engines set. See
`project_freshness_engines` and the engine #1–3 specs in this directory.

## Goal

A "**This Month in History**" rail in the Explore _Right Now_ band: the vintage
debut covers of recognizable characters who first appeared in the **current
calendar month**, each captioned with its anniversary ("88 years"). Tapping a
cover opens that character's page.

## Why this framing (the data forced it)

The roadmap called this "On This Day" (exact date). The catalogue can't support
that: classic American comic cover dates are **month-precision**, and ComicVine
stamps them to a synthetic day (Spider-Man's debut is stored `1962-08-31`,
Captain America's `1941-03-01` — month-end / month-start placeholders). So
exact month+day matching surfaces almost nothing recognizable — on 2026-06-28 it
returned one obscure manga character (Marron) and a cluster of Pokémon.

Matching by **month** is the honest granularity and it's rich: June yields 41
debuts at `fame_score ≥ 30`, led by Superman (Action Comics #1, 1938, fame 100),
Lois Lane, Rocket Raccoon, Freddy Krueger, Simba, Poison Ivy, Krillin, Ra's al
Ghul. Across all twelve months the famous-debut count (fame ≥ 30) ranges
**23–104**, so a fame ≥ 30 floor guarantees a full rail every month of the year.

## Data source

Already in the database — no ingestion needed. `heroes.first_issue_data` is a
JSONB blob with the debut issue's `coverDate` (camelCase, `YYYY-MM-DD`),
`imageUrl` (the debut cover), `seriesName`, and `issueNumber`. **14,556** heroes
carry a parseable `coverDate` and a cover image.

This is why engine #4 is the simplest of the four: it is **calendar-driven**, not
API-driven. It renews when the month rolls over (like the daily hero), so it
needs **no edge function, no `pg_cron`, no external request, no new column**. The
date itself is the self-renewing signal.

## Architecture

```
heroes.first_issue_data->>'coverDate'   (existing; 14,556 rows w/ date + cover)
  → get_debuts_this_month() RPC          (filter: debut month = current month,
                                          fame_score ≥ floor, has cover)
  → getDebutsThisMonth() read layer      (maps rows, computes "years ago")
  → MonthInHistoryRail                   (cover-led rail; both Right Now bands)
```

## Components

### 1. RPC — `get_debuts_this_month`

New migration `supabase/migrations/<ts>_get_debuts_this_month.sql`.

```sql
create or replace function public.get_debuts_this_month(
  p_limit integer default 14,
  p_min_fame integer default 30
)
returns table (
  id text, name text, image_url text, portrait_url text,
  debut_cover_url text, debut_year integer, fame_score smallint
)
language sql
stable
as $$
  select
    h.id, h.name, h.image_url, h.portrait_url,
    h.first_issue_data->>'imageUrl' as debut_cover_url,
    extract(year from (h.first_issue_data->>'coverDate')::date)::integer as debut_year,
    h.fame_score
  from public.heroes h
  where h.first_issue_data->>'coverDate' ~ '^\d{4}-\d{2}-\d{2}'
    and extract(month from (h.first_issue_data->>'coverDate')::date)
        = extract(month from current_date)
    and coalesce(h.fame_score, 0) >= p_min_fame
    and (h.first_issue_data->>'imageUrl') is not null
  order by h.fame_score desc nulls last
  limit p_limit;
$$;
grant execute on function public.get_debuts_this_month(integer, integer)
  to anon, authenticated, service_role;
```

- `current_date` is evaluated per-call, so the result rolls over automatically on
  the first of each month — no scheduled job.
- `debut_year` is returned (not "years ago") so the "years ago" value is computed
  against the live calendar year in the read layer and stays correct without a
  data refresh.
- A 14k-row scan with a JSONB extract is trivial at this cadence; no functional
  index or generated column (YAGNI — revisit only if profiling shows a problem).

### 2. Read layer — `getDebutsThisMonth`

New module `src/lib/db/anniversaries.ts` (a distinct concern from `trending.ts`,
which is already large; this is calendar history, not trending).

```ts
export interface DebutHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  /** The debut issue's cover art. */
  debut_cover_url: string | null;
  /** Year the character first appeared (e.g. 1938). */
  year: number;
  /** Years since the debut, against the current calendar year (e.g. 88). */
  yearsAgo: number;
}

export async function getDebutsThisMonth(limit = 14): Promise<DebutHero[]>;
```

- Calls `supabase.rpc('get_debuts_this_month', { p_limit: limit })`.
- Maps each row to `DebutHero`; `yearsAgo = new Date().getFullYear() - year`.
- Degrades to `[]` on RPC error (logs a warning), matching the other Explore
  reads so a DB hiccup never throws inside the band.

### 3. Rail — `MonthInHistoryRail`

New `src/components/home/MonthInHistoryRail.tsx`, RN-Web-safe (renders on both
platforms, like `WikiTrendingRail`).

- Props: `{ debuts: DebutHero[]; onHeroPress: (id: string) => void }`.
- Returns `null` when `debuts` is empty.
- Header: eyebrow "**This Month**" + title "**Debuts in {month}**", where
  `{month}` is the current month name (`toLocaleString('en-US', { month: 'long' })`).
- Each card: a **portrait-orientation** debut cover via `<HeroImage>` (falls back
  to the monogram when `debut_cover_url` is null), the hero name (one line), and a
  caption `{year} · {yearsAgo} yrs`. Tap → `onHeroPress(id)` → character page.
- Fonts per house rules: `Flame-Regular` display / `Nunito_*` UI — never
  `Flame-Bold`. Palette from `COLORS`.

### 4. Wiring

- `src/hooks/useExploreData.ts`: import `getDebutsThisMonth` + `DebutHero`; add
  `debutsThisMonth: DebutHero[]` to `ExploreData` + `INITIAL`; fetch
  `getDebutsThisMonth(14)` in the mount effect.
- `src/components/home/RightNowBand.tsx` (native) and
  `src/components/web/home/RightNowBand.tsx` (web): add a `debuts: DebutHero[]`
  prop, include `debuts.length > 0` in `hasAny`, render `<MonthInHistoryRail>`
  after `<WikiTrendingRail>`. Native bridges its item-shaped `onHeroPress` as
  `(id) => onHeroPress({ id })`; web passes its `(id: string)` handler directly.
- `app/(tabs)/explore.tsx`: thread `debutsThisMonth` through the `useExploreData`
  destructure, the `FeedRow` `rightnow` variant, the `rows` memo
  (condition + pushed object + deps), and the `case 'rightnow'` render.
- `app/(tabs)/explore.web.tsx`: pass `debuts={homeData.debutsThisMonth ?? []}` to
  `<RightNowBand>`.

## Error handling

- Read layer returns `[]` on any RPC error.
- Rail renders `null` when empty; the band's `hasAny` already gates the whole
  section, so an empty engine never leaves a stray header.
- Per-card cover fallback: `HeroImage` renders its deterministic monogram when
  `debut_cover_url` is null (no broken-image state).

## Testing

Unit-test the read layer only (no edge fn / cron / navigation to test):
`__tests__/lib/db/anniversaries.test.ts` —

1. Calls `get_debuts_this_month` with `{ p_limit }` and maps a row to `DebutHero`,
   asserting `yearsAgo === currentYear − debut_year` (compute the expected value
   from `new Date().getFullYear()` so the test doesn't rot).
2. Degrades to `[]` when the RPC returns an error.

## Out of scope (YAGNI)

- Exact-day "On This Day" matching (data can't support it — see above).
- Milestone-only (25th/50th/75th) filtering — every month already fills; a
  round-number emphasis can be layered on later if desired.
- Film/TV release anniversaries from `titles.release_date` — a possible future
  second source; this engine ships debuts-only.
- Any new column, index, edge function, or cron.

## Security / RLS

Reads the existing `heroes` table (already has a public-read policy); the new RPC
carries the standard `anon, authenticated, service_role` execute grant. No new
table, so no new RLS policy is required (cf. `project_supabase_new_table_rls`).
