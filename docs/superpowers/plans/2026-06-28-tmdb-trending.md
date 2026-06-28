# TMDB Trending on Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily-renewing "Trending on Screen" poster rail in the Explore Right Now band, driven by TMDB's `/trending/all/day` feed mapped onto the catalogue titles we already sync.

**Architecture:** Mirror the existing TMDB/comics freshness stack: a `sync-tmdb-trending` edge function on a daily `pg_cron` stamps a `trending_rank` on matched `titles` rows; a `get_trending_on_screen` RPC (sibling of `get_trending_titles`) reads them through `db/trending.ts`; the existing `TitlePosterRail` renders the rail in both `RightNowBand` views.

**Tech Stack:** Expo SDK 56 / React Native / expo-router 4, Supabase Postgres + Deno edge functions, TMDB REST API, TypeScript, jest-expo.

## Global Constraints

- Package manager: **yarn** only.
- TypeScript, **no `any`** (use `unknown` for caught errors). Edge functions under `supabase/functions/**` are exempt from repo ESLint/TS tooling and may use `any` (matches `enrich-tmdb-batch`).
- Screens never import `supabase` directly — DB access goes through `src/lib/db/`.
- All styles via `StyleSheet.create` (no inline objects except `StyleSheet.absoluteFill` and dynamic theme values).
- Fonts: `Flame-Regular` (display), `FlameSans-Regular` (body), `Nunito_*` (UI). NEVER `Flame-Bold`.
- Schema changes are new files in `supabase/migrations/YYYYMMDDHHMMSS_*.sql`, applied via the Supabase MCP `apply_migration`; regenerate `src/types/database.generated.ts` via MCP `generate_typescript_types` after each (never edit by hand).
- New RPCs: `grant execute … to anon, authenticated, service_role`.
- TMDB: base `https://api.themoviedb.org/3`, key from `Deno.env.get('TMDB_API_KEY')`. `titles.external_id` is the bare TMDB id (text); `titles.source = 'tmdb'`; `titles.media_type` is `'film'` | `'tv'` | `'game'` (TMDB `movie` → `film`).
- Verification: `yarn typecheck`, `yarn test:ci`, `yarn lint`.

---

### Task 1: Storage — `trending_rank` / `trending_at` on `titles`

**Files:**
- Create: `supabase/migrations/20260628180000_titles_trending_rank.sql`
- Modify (regenerate): `src/types/database.generated.ts`

**Interfaces:**
- Produces columns `titles.trending_rank smallint` (1..N today, else null) and `titles.trending_at timestamptz`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260628180000_titles_trending_rank.sql`:

```sql
-- Daily TMDB "trending now" rank, stamped on the titles we already sync. A title
-- is in the trending set while trending_rank is non-null; the sync rewrites it
-- each day (the rank = position in TMDB's /trending/all/day list).
alter table public.titles add column if not exists trending_rank smallint;
alter table public.titles add column if not exists trending_at timestamptz;
create index if not exists titles_trending_rank_idx
  on public.titles (trending_rank) where trending_rank is not null;
```

- [ ] **Step 2: Apply the migration**

MCP `apply_migration`, name `titles_trending_rank`, SQL above. Expected: success.

- [ ] **Step 3: Verify the columns exist**

MCP `execute_sql`:
```sql
select count(*) filter (where trending_rank is not null) as trending_now from public.titles;
```
Expected: `0`, no error.

- [ ] **Step 4: Regenerate types**

MCP `generate_typescript_types`; write the result into `src/types/database.generated.ts`. Confirm `trending_rank` appears under the `titles` row type.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260628180000_titles_trending_rank.sql src/types/database.generated.ts
git commit -m "feat(trending): titles.trending_rank + trending_at (TMDB trending engine)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Ingest — `sync-tmdb-trending` edge function

**Files:**
- Create: `supabase/functions/sync-tmdb-trending/index.ts`

**Interfaces:**
- Consumes: TMDB `/trending/all/day`; `titles` (external_id, source, media_type). Writes `titles.trending_rank` / `trending_at`.
- Produces: `POST /functions/v1/sync-tmdb-trending` body `{ pages?: number (1-2, default 2), triggeredBy?: string }` → `{ fetched, matched }`.

- [ ] **Step 1: Write the function**

Create `supabase/functions/sync-tmdb-trending/index.ts`:

```ts
// supabase/functions/sync-tmdb-trending/index.ts
//
// Daily TMDB trending. Fetch /trending/all/day (films + TV), map each to a title
// we already have by its TMDB id, and stamp trending_rank (its position in the
// list) + trending_at. Every run first clears yesterday's marks, so a title only
// shows while it's trending today. Mirrors enrich-tmdb-batch's shape.
//
// POST body: { pages?: number (1-2, default 2), triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY') ?? '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });

interface TrendingResult {
  id: number;
  media_type: string; // 'movie' | 'tv' | 'person'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let pages = 2;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.pages === 'number') pages = Math.min(Math.max(1, b.pages), 2);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    // Collect trending film/tv ids in order across pages.
    const ordered: Array<{ externalId: string; mediaType: 'film' | 'tv' }> = [];
    for (let p = 1; p <= pages; p++) {
      const res = await fetch(`${TMDB_BASE}/trending/all/day?api_key=${TMDB_API_KEY}&page=${p}`);
      if (!res.ok) break;
      const body = await res.json();
      for (const r of (body.results ?? []) as TrendingResult[]) {
        if (r.media_type === 'movie') ordered.push({ externalId: String(r.id), mediaType: 'film' });
        else if (r.media_type === 'tv') ordered.push({ externalId: String(r.id), mediaType: 'tv' });
      }
    }

    // Clear yesterday's marks, then stamp the matched titles in trending order.
    await sb.from('titles').update({ trending_rank: null }).not('trending_rank', 'is', null);

    let matched = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < ordered.length; i++) {
      const { externalId, mediaType } = ordered[i];
      const { data } = await sb
        .from('titles')
        .update({ trending_rank: i + 1, trending_at: now })
        .eq('source', 'tmdb')
        .eq('external_id', externalId)
        .eq('media_type', mediaType)
        .select('id');
      if (data && data.length > 0) matched++;
    }

    if (ordered.length > 0)
      await sb.from('api_usage').insert({ api: 'tmdb', endpoint: 'trending', units: pages });
    return json({ fetched: ordered.length, matched, triggeredBy });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
```

- [ ] **Step 2: Deploy the function**

MCP `deploy_edge_function`, name `sync-tmdb-trending`, `verify_jwt: true`, the file above. Expected: deploy success.

- [ ] **Step 3: Invoke once + verify marks landed**

```bash
curl -s -X POST "$(node -e "console.log(process.env.EXPO_PUBLIC_SUPABASE_URL||require('dotenv').config({path:'.env.local'})&&process.env.EXPO_PUBLIC_SUPABASE_URL)" 2>/dev/null)/functions/v1/sync-tmdb-trending" \
  -H "Authorization: Bearer $(grep -E '^EXPO_PUBLIC_SUPABASE_KEY=' .env.local | cut -d= -f2-)" \
  -H "Content-Type: application/json" -d '{"pages":2,"triggeredBy":"manual-verify"}'
```
Expected JSON: `{ "fetched": <n>0, "matched": <m>=0, ... }` (matched is the trending∩catalogue count; may be small).
Then MCP `execute_sql`:
```sql
select trending_rank, title, media_type from public.titles
where trending_rank is not null order by trending_rank limit 15;
```
Expected: the matched trending titles ordered by rank.

> If `matched` is 0, that day's TMDB trending list simply had no titles in our catalogue — re-run on another day to confirm the path, or temporarily verify the match query against a known catalogue title's `external_id`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-tmdb-trending/index.ts
git commit -m "feat(trending): sync-tmdb-trending edge function

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Read RPC — `get_trending_on_screen`

**Files:**
- Create: `supabase/migrations/20260628181000_get_trending_on_screen.sql`

**Interfaces:**
- Consumes: `titles` (trending_rank + media fields), `hero_media_appearances`, `heroes`.
- Produces: `get_trending_on_screen(p_limit int default 12, p_chars_per_title int default 10)` returning flat rows `(title_id text, title text, media_type text, release_date date, backdrop_url text, poster_url text, trailer_key text, provider text, hero_id text, hero_name text, hero_image_url text, hero_portrait_url text)`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260628181000_get_trending_on_screen.sql`:

```sql
-- "Trending on Screen" reader. Sibling of get_trending_titles, but ordered by the
-- daily TMDB trending_rank and carrying trailer_key for the play affordance. Only
-- titles that have a catalogue character with art are returned.
create or replace function public.get_trending_on_screen(
  p_limit integer default 12,
  p_chars_per_title integer default 10
)
returns table (
  title_id text, title text, media_type text, release_date date,
  backdrop_url text, poster_url text, trailer_key text, provider text,
  hero_id text, hero_name text, hero_image_url text, hero_portrait_url text
)
language sql
stable
as $$
  with ranked as (
    select t.id, t.title, t.media_type, t.release_date, t.backdrop_url, t.poster_url,
           t.trailer_key,
           (t.watch_providers::jsonb #>> '{US,flatrate,0,provider_name}') as provider,
           t.trending_rank
    from public.titles t
    where t.trending_rank is not null
      and t.media_type in ('film', 'tv')
      and exists (
        select 1 from public.hero_media_appearances a
        join public.heroes h on h.id = a.hero_id
        where a.title_id = t.id and (h.portrait_url is not null or h.image_url is not null)
      )
    order by t.trending_rank asc
    limit p_limit
  ),
  chars as (
    select r.id as title_id, r.title, r.media_type, r.release_date, r.backdrop_url, r.poster_url,
           r.trailer_key, r.provider, r.trending_rank,
           h.id as hero_id, h.name as hero_name,
           h.image_url as hero_image_url, h.portrait_url as hero_portrait_url,
           row_number() over (
             partition by r.id order by h.fame_score desc nulls last, a.rank asc nulls last
           ) as crank
    from ranked r
    join public.hero_media_appearances a on a.title_id = r.id
    join public.heroes h on h.id = a.hero_id
    where (h.portrait_url is not null or h.image_url is not null)
  )
  select title_id, title, media_type, release_date, backdrop_url, poster_url, trailer_key, provider,
         hero_id, hero_name, hero_image_url, hero_portrait_url
  from chars
  where crank <= p_chars_per_title
  order by trending_rank, crank;
$$;
grant execute on function public.get_trending_on_screen(integer, integer)
  to anon, authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

MCP `apply_migration`, name `get_trending_on_screen`, SQL above. Expected: success.

- [ ] **Step 3: Verify the RPC runs**

MCP `execute_sql`:
```sql
select title, media_type, trailer_key is not null as has_trailer, hero_name
from public.get_trending_on_screen(12, 3) limit 12;
```
Expected: rows for today's trending catalogue titles (or `[]` if none trending today — no error either way).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260628181000_get_trending_on_screen.sql
git commit -m "feat(trending): get_trending_on_screen RPC

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Client read — `getTrendingOnScreen` in `db/trending.ts`

**Files:**
- Modify: `src/lib/db/trending.ts`
- Test: `__tests__/lib/db/trendingOnScreen.test.ts`

**Interfaces:**
- Consumes: `get_trending_on_screen` RPC; the existing `TrendingTitle` type.
- Produces: `getTrendingOnScreen(limit?: number): Promise<TrendingTitle[]>` where `TrendingTitle` gains an optional `trailer_key: string | null`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/db/trendingOnScreen.test.ts`:

```ts
import { getTrendingOnScreen } from '../../../src/lib/db/trending';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const row = (titleId: string, hero: string) => ({
  title_id: titleId,
  title: 'Superman',
  media_type: 'film',
  release_date: '2025-07-11',
  backdrop_url: 'b.jpg',
  poster_url: 'p.jpg',
  trailer_key: 'abc123',
  provider: null,
  hero_id: hero,
  hero_name: hero,
  hero_image_url: null,
  hero_portrait_url: null,
});

describe('getTrendingOnScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the RPC with the limit and groups rows into titles', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [row('tmdb:1', 'Superman'), row('tmdb:1', 'Lois Lane')],
      error: null,
    });
    const out = await getTrendingOnScreen(12);
    expect(supabase.rpc).toHaveBeenCalledWith('get_trending_on_screen', { p_limit: 12 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tmdb:1');
    expect(out[0].trailer_key).toBe('abc123');
    expect(out[0].characters.map((c) => c.id)).toEqual(['Superman', 'Lois Lane']);
  });

  it('degrades to [] on error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getTrendingOnScreen()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:ci __tests__/lib/db/trendingOnScreen.test.ts`
Expected: FAIL — `getTrendingOnScreen` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/db/trending.ts`, add `trailer_key` to the `TrendingTitle` interface (after `overview`):

```ts
  /** YouTube trailer key — present on trending-on-screen rows for a ▶ affordance. */
  trailer_key: string | null;
```

Then append:

```ts
interface TrendingOnScreenRow {
  title_id: string;
  title: string;
  media_type: string | null;
  release_date: string | null;
  backdrop_url: string | null;
  poster_url: string | null;
  trailer_key: string | null;
  provider: string | null;
  hero_id: string;
  hero_name: string;
  hero_image_url: string | null;
  hero_portrait_url: string | null;
}

/** TMDB's daily-trending titles that have catalogue characters, ordered by
 *  trending rank. Degrades to [] so a DB hiccup never errors the Explore band. */
export async function getTrendingOnScreen(limit = 12): Promise<TrendingTitle[]> {
  const { data, error } = await supabase.rpc('get_trending_on_screen', { p_limit: limit } as never);
  if (error) {
    console.warn('[getTrendingOnScreen] error:', error.message);
    return [];
  }
  const byId = new Map<string, TrendingTitle>();
  for (const r of (data ?? []) as unknown as TrendingOnScreenRow[]) {
    let t = byId.get(r.title_id);
    if (!t) {
      t = {
        id: r.title_id,
        title: r.title,
        media_type: r.media_type,
        release_date: r.release_date,
        backdrop_url: r.backdrop_url,
        poster_url: r.poster_url,
        provider: r.provider,
        overview: null,
        trailer_key: r.trailer_key,
        characters: [],
      };
      byId.set(r.title_id, t);
    }
    t.characters.push({
      id: r.hero_id,
      name: r.hero_name,
      image_url: r.hero_image_url,
      portrait_url: r.hero_portrait_url,
    });
  }
  return [...byId.values()];
}
```

> Note: every existing place that builds a `TrendingTitle` (the `getTrendingTitles` parser) must now set `trailer_key`. In `getTrendingTitles`'s object literal, add `trailer_key: null,` alongside `overview`. `yarn typecheck` (Step 5) will flag it if missed.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci __tests__/lib/db/trendingOnScreen.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `yarn typecheck` (fix the `getTrendingTitles` literal if it complains about the missing `trailer_key`).
```bash
git add src/lib/db/trending.ts __tests__/lib/db/trendingOnScreen.test.ts
git commit -m "feat(trending): getTrendingOnScreen read layer (+ trailer_key on TrendingTitle)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Schedule — daily `pg_cron`

**Files:**
- Create: `supabase/migrations/20260628182000_schedule_tmdb_trending.sql`

- [ ] **Step 1: Write the migration**

Copy the exact `url` + anon `Bearer` token from `supabase/migrations/20260614130000_schedule_tmdb_drain.sql` (same project). Create `supabase/migrations/20260628182000_schedule_tmdb_trending.sql`:

```sql
-- Daily TMDB trending refresh at 08:00 UTC. Mirrors schedule_tmdb_drain.
-- To PAUSE: select cron.unschedule('sync-tmdb-trending-daily');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-tmdb-trending-daily',
  '0 8 * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/sync-tmdb-trending',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_JWT_FROM_schedule_tmdb_drain.sql>'
    ),
    body := jsonb_build_object('pages', 2, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);
```

- [ ] **Step 2: Apply + verify**

MCP `apply_migration`, name `schedule_tmdb_trending`, SQL above. Then MCP `execute_sql`:
```sql
select jobname, schedule, active from cron.job where jobname = 'sync-tmdb-trending-daily';
```
Expected: one row, `schedule = '0 8 * * *'`, `active = true`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260628182000_schedule_tmdb_trending.sql
git commit -m "feat(trending): schedule daily sync-tmdb-trending

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Native rail + Explore wiring

**Files:**
- Modify: `src/hooks/useExploreData.ts`
- Modify: `src/components/home/RightNowBand.tsx`
- Modify: `app/(tabs)/explore.tsx`

**Interfaces:**
- Consumes: `getTrendingOnScreen` (Task 4), `TrendingTitle`, `TitlePosterRail` (existing).
- Produces: `ExploreData` gains `trendingOnScreen: TrendingTitle[]`; `RightNowBandProps` gains `trendingOnScreen: TrendingTitle[]`.

- [ ] **Step 1: Wire `useExploreData`**

In `src/hooks/useExploreData.ts`:
1. Import: add `getTrendingOnScreen` to the existing `../lib/db/trending` import line.
2. `ExploreData` interface — add `trendingOnScreen: TrendingTitle[];` (near `onScreen`).
3. `INITIAL` — add `trendingOnScreen: [],`.
4. In the mount `useEffect`, beside the other trending fetches:
```ts
    getTrendingOnScreen(12)
      .then(set('trendingOnScreen'))
      .catch(() => {});
```

- [ ] **Step 2: Render the rail in native `RightNowBand`**

In `src/components/home/RightNowBand.tsx`:
1. Add `trendingOnScreen: TrendingTitle[];` to `RightNowBandProps`; destructure it.
2. Add `trendingOnScreen.length > 0` to the `hasAny` guard.
3. Render a `TitlePosterRail` immediately **above** the existing "On Screen Now" rail:
```tsx
      {trendingOnScreen.length > 0 ? (
        <TitlePosterRail
          label="Trending Today"
          title="Trending on Screen"
          titles={trendingOnScreen}
          onTitlePress={onTitlePress}
        />
      ) : null}
```

- [ ] **Step 3: Wire the native Explore screen**

In `app/(tabs)/explore.tsx`:
1. Add `trendingOnScreen` to the `useExploreData()` destructure.
2. Extend the `FeedRow` `rightnow` variant with `trendingOnScreen: TrendingTitle[];`.
3. In the `rows` useMemo, add it to the condition + the pushed `rightnow` object: `trendingOnScreen,`.
4. In the `case 'rightnow'` render, pass `trendingOnScreen={item.trendingOnScreen}` to `<RightNowBand>`.
5. Add `trendingOnScreen` to the `rows` useMemo deps array.

- [ ] **Step 4: Typecheck + lint + commit**

Run: `yarn typecheck` then `yarn lint src/components/home/RightNowBand.tsx src/hooks/useExploreData.ts "app/(tabs)/explore.tsx"`. Expected: 0 errors.
```bash
git add src/hooks/useExploreData.ts src/components/home/RightNowBand.tsx "app/(tabs)/explore.tsx"
git commit -m "feat(trending): native Trending on Screen rail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Web rail + Explore wiring

**Files:**
- Modify: `src/components/web/home/RightNowBand.tsx`
- Modify: `app/(tabs)/explore.web.tsx`

**Interfaces:**
- Consumes: `TrendingTitle`, the web `RightNowBand`'s inline `PosterRail`.

- [ ] **Step 1: Web `RightNowBand`**

In `src/components/web/home/RightNowBand.tsx`:
1. Add `trendingOnScreen: TrendingTitle[];` to the web `RightNowBandProps`; destructure it; include `trendingOnScreen.length > 0` in the band's `hasAny` guard.
2. Render the web `PosterRail` (the inline one this file already defines for "On Screen Now") a second time, **above** the existing one, with the trending titles:
```tsx
      {trendingOnScreen.length > 0 ? (
        <PosterRail label="Trending Today" title="Trending on Screen" titles={trendingOnScreen} onTitlePress={onTitlePress} />
      ) : null}
```
(Match the exact prop names the existing `<PosterRail .../>` call uses in this file.)

- [ ] **Step 2: Wire web Explore**

In `app/(tabs)/explore.web.tsx`: destructure `trendingOnScreen` from `useExploreData()` and pass `trendingOnScreen={trendingOnScreen}` to the `<RightNowBand …>` call (beside `onScreen`).

- [ ] **Step 3: Typecheck + full test + commit**

Run: `yarn typecheck`, then `yarn lint src/components/web/home/RightNowBand.tsx "app/(tabs)/explore.web.tsx"`, then `yarn test:ci`.
Expected: typecheck/lint clean; all suites pass (incl. `trendingOnScreen.test.ts`).
```bash
git add src/components/web/home/RightNowBand.tsx "app/(tabs)/explore.web.tsx"
git commit -m "feat(trending): web Trending on Screen rail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Visual handoff (user-driven)**

User verifies web from device screenshots — do not run a local server. Hand off: "Trending on Screen rail sits above On Screen Now in the Right Now band; populated once `sync-tmdb-trending` has run and that day's TMDB trending list intersects the catalogue."

---

## Self-Review

**Spec coverage:**
- `/trending/all/day` daily source, films+tv only, person dropped → Task 2. ✓
- `trending_rank` + `trending_at` columns, daily rewrite → Tasks 1, 2. ✓
- Gate to catalogue-character titles → Task 3 RPC `exists` clause. ✓
- Trailer affordance via stored `trailer_key` → Task 3 returns it, Task 4 threads it (rail badge is a thin follow-up; data is in place). ✓
- Daily `pg_cron` → Task 5. ✓
- Rail in both Right Now bands via `TitlePosterRail` → Tasks 6, 7. ✓
- Hidden when empty → `length > 0` guards. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code; the one delegated detail (Task 7 web inline rail) is bounded by an in-file analogue with explicit anchors. The cron migration's bearer is "copy from schedule_tmdb_drain.sql" rather than re-pasting the committed secret.

**Type consistency:** `TrendingTitle` gains `trailer_key` in Task 4 and is consumed unchanged in Tasks 6–7. `getTrendingOnScreen(limit?)` signature matches across Task 4 (producer) and Task 6 (consumer). RPC return columns (Task 3) map one-for-one to `TrendingOnScreenRow` (Task 4).
