# Hero DB Enrichment Design

**Date:** 2026-04-04  
**Status:** Approved

## Problem

Every character detail screen open fires 3 sequential external API calls (SuperheroAPI → ComicVine details → ComicVine issue cover). The search tab downloads a 500KB CDN JSON blob on every single visit. The `heroes` Supabase table only stores `id`, `name`, `category`, `image_url`, `publisher` — almost nothing is cached.

## Goal

Pre-populate Supabase with all ~731 heroes and their full data so:
- The search screen queries Supabase instead of downloading a CDN blob
- The character detail screen makes zero external API calls for enriched heroes
- The app works faster and is resilient to third-party API downtime

## Data Sources

| Source | What it provides | Cost |
|---|---|---|
| `cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json` | All 731 heroes — powerstats, biography, appearance, work, connections, two image sizes | 1 HTTP request total |
| ComicVine `/characters` | Summary (deck), first issue ID | 1 request per hero, ~200/hr rate limit |
| ComicVine `/issue/{id}` | First issue cover image URL | 1 request per hero (if issue ID exists) |

## Database Schema

Single migration extending the existing `heroes` table. Flat columns only — no JSONB — so Supabase-generated TypeScript types work directly.

```sql
alter table heroes
  -- images (image_url stays as large/detail image)
  add column image_md_url       text,

  -- powerstats (nullable int — CDN returns null for unknowns)
  add column intelligence       integer,
  add column strength           integer,
  add column speed              integer,
  add column durability         integer,
  add column power              integer,
  add column combat             integer,

  -- biography
  add column full_name          text,
  add column alter_egos         text,
  add column aliases            text[],
  add column place_of_birth     text,
  add column first_appearance   text,
  add column alignment          text,

  -- appearance
  add column gender             text,
  add column race               text,
  add column height_imperial    text,
  add column height_metric      text,
  add column weight_imperial    text,
  add column weight_metric      text,
  add column eye_color          text,
  add column hair_color         text,

  -- work
  add column occupation         text,
  add column base               text,

  -- connections
  add column group_affiliation  text,
  add column relatives          text,

  -- comicvine (phase 2 — nullable until enriched)
  add column summary                text,
  add column first_issue_image_url  text,
  add column comicvine_enriched_at  timestamptz,

  -- enrichment tracking
  add column enriched_at        timestamptz;
```

`category` stays as the app-curated grouping (`popular` / `villain` / `xmen`). `alignment` is separate — it comes from the API and can be `good`, `bad`, or `neutral`.

After the migration, regenerate `src/types/database.generated.ts` via the Supabase MCP tool.

## Enrichment Scripts

### Phase 1 — `scripts/enrich-heroes.ts`

Run with: `bun scripts/enrich-heroes.ts`

1. Fetch `all.json` from the CDN — one request, all 731 heroes
2. Map CDN fields to DB columns (see field mapping below)
3. Upsert into `heroes` in batches of 50 using `onConflict: 'id'`
4. Set `enriched_at = new Date().toISOString()` on each upserted row
5. Log batch progress to stdout

**Resumable:** upsert on conflict means re-running is always safe. Supports `--id <heroId>` flag to re-enrich a single hero — the script still fetches `all.json` but filters the upsert to the matching hero.

**CDN field mapping:**
```
cdnHero.id              → id (cast to string)
cdnHero.name            → name
cdnHero.images.md       → image_md_url
cdnHero.images.lg       → image_url
cdnHero.powerstats.*    → intelligence, strength, speed, durability, power, combat
cdnHero.biography.*     → full_name, alter_egos, aliases, place_of_birth,
                          first_appearance, publisher, alignment
cdnHero.appearance.*    → gender, race, height[0], height[1], weight[0], weight[1],
                          eye_color, hair_color
cdnHero.work.*          → occupation, base
cdnHero.connections.*   → group_affiliation, relatives
```

Powerstats values come as strings from the CDN (`"85"`) or `null`. Parse with `parseInt`, store `null` for unknowns.

### Phase 2 — `scripts/enrich-comicvine.ts`

Run with: `bun scripts/enrich-comicvine.ts`

1. Query Supabase for all heroes where `comicvine_enriched_at IS NULL`
2. For each hero:
   a. Fetch `ComicVine/characters?filter=name:{name}` → summary, firstIssueId
   b. If firstIssueId exists, fetch `ComicVine/issue/4000-{id}` → cover image URL
   c. Update the hero row with `summary`, `first_issue_image_url`, `comicvine_enriched_at = now()`
3. Wait 20 seconds between heroes (stays under 200 requests/hr limit)
4. Log progress — designed to run overnight, fully resumable

## App Changes

### Search screen (`app/(tabs)/search.tsx`)

Replace the CDN fetch + client-side filter with a Supabase query function in `src/lib/db/heroes.ts`:

```ts
export async function searchHeroes(query: string, publisher: PublisherFilter) {
  let q = supabase
    .from('heroes')
    .select('id, name, publisher, image_md_url, image_url')
    .order('name')
    .limit(100);

  if (query.trim()) q = q.ilike('name', `%${query}%`);

  if (publisher === 'Marvel') q = q.ilike('publisher', '%marvel%');
  else if (publisher === 'DC')  q = q.ilike('publisher', '%dc%');
  else if (publisher === 'Other') {
    q = q.not('publisher', 'ilike', '%marvel%')
         .not('publisher', 'ilike', '%dc%');
  }

  const { data, error } = await q;
  if (error) throw error;
  return data;
}
```

The search screen debounces the query (already 150ms) and calls this on every change. No more CDN blob. Results in ~50ms from Supabase. With an empty query and no publisher filter the function returns the first 100 heroes alphabetically — intentional for mobile (showing 731 rows in a FlatList is not useful).

### Character detail screen (`app/character/[id].tsx`)

Add a Supabase-first fetch path. If the hero has `enriched_at` set, build `CharacterData` from the DB row and skip all external API calls. If not enriched, fall back to the existing SuperheroAPI + ComicVine calls (safety net).

Add a helper in `src/lib/db/heroes.ts`:

```ts
export async function getHeroById(id: string): Promise<Hero | null> {
  const { data } = await supabase
    .from('heroes')
    .select('*')
    .eq('id', id)
    .single();
  return data ?? null;
}
```

The detail screen calls `getHeroById` first. If the row has `enriched_at`, map DB columns to `CharacterData` and render immediately. The `comicVineLoading` state is set to `false` immediately if `comicvine_enriched_at` is also set (no skeleton needed).

`CharacterData` type shape is unchanged — the screen doesn't need to know the data source.

## Refresh Strategy

- **Normal heroes:** No automatic refresh. Data is static (power stats, biography, appearance don't change).
- **New heroes added to DB:** Phase 1 script re-run with `--id <newId>` enriches just that hero.
- **ComicVine data:** Phase 2 script can be re-run at any time; it skips already-enriched rows unless `--force` flag is passed.
- **Manual override:** Set `enriched_at = NULL` on any row in Supabase to force re-enrichment on next script run.

## Implementation Order

1. Write and apply DB migration (Supabase MCP)
2. Regenerate `database.generated.ts` (Supabase MCP)
3. Write `scripts/enrich-heroes.ts` and run it
4. Update `src/lib/db/heroes.ts` — add `searchHeroes` and `getHeroById`
5. Update search screen to use `searchHeroes`
6. Update character detail screen to use `getHeroById` with fallback
7. Run Phase 2 ComicVine script overnight
