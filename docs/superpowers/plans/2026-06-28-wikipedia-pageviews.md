# Wikipedia Trending (pageview spike) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Trending this week" character rail in the Explore Right Now band, ranked by week-over-week Wikipedia pageview spike (who the world is suddenly looking up).

**Architecture:** Mirror the established freshness stack. A `resolve-enwiki-title` edge fn backfills each hero's English-Wikipedia article title from its `wikidata_qid` (one-time drain). A `sync-wiki-pageviews` edge fn on a frequent `pg_cron` hits the free Wikimedia Pageviews API per article, computes this-7-days vs prior-7-days, and stores a spike. A `get_trending_heroes_wiki` RPC (read through `db/trending.ts`) feeds a character rail in both `RightNowBand` views.

**Tech Stack:** Expo SDK 56 / React Native / expo-router 4, Supabase Postgres + Deno edge functions, Wikidata + Wikimedia REST APIs (no key), TypeScript, jest-expo.

## Global Constraints

- Package manager: **yarn** only.
- TypeScript, **no `any`** (use `unknown` for caught errors). Edge functions under `supabase/functions/**` are exempt and may use `any`.
- Screens never import `supabase` directly — DB access via `src/lib/db/`.
- All styles via `StyleSheet.create` (no inline objects except `StyleSheet.absoluteFill` + dynamic theme values).
- Fonts: `Flame-Regular` (display), `FlameSans-Regular` (body), `Nunito_*` (UI). NEVER `Flame-Bold`.
- Migrations: new `supabase/migrations/YYYYMMDDHHMMSS_*.sql` via MCP `apply_migration`; regenerate `src/types/database.generated.ts` via MCP after each.
- New RPCs: `grant execute … to anon, authenticated, service_role`.
- **Wikimedia/Wikidata require a descriptive `User-Agent` header** on every request (e.g. `mythique/1.0 (https://mythique.app)`); requests without one are throttled/blocked.
- `heroes` has `wikidata_qid` (text QID) on ~4,700 rows; `fame_score` is smallint.
- Verification: `yarn typecheck`, `yarn test:ci`, `yarn lint`.

---

### Task 1: Storage — enwiki + pageview columns on `heroes`

**Files:**
- Create: `supabase/migrations/20260628190000_heroes_pageviews.sql`
- Modify (regenerate): `src/types/database.generated.ts`

**Interfaces:**
- Produces columns `heroes.enwiki_title text`, `pageviews_week integer`, `pageviews_prev integer`, `pageviews_spike numeric`, `pageviews_at timestamptz`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260628190000_heroes_pageviews.sql`:

```sql
-- Wikipedia attention signal. enwiki_title is backfilled from wikidata_qid
-- ('' sentinel = no English article, so it isn't retried). The pageview columns
-- are refreshed by the sync-wiki-pageviews drain; spike = (week+1)/(prev+1) drives
-- the "trending this week" ranking.
alter table public.heroes add column if not exists enwiki_title text;
alter table public.heroes add column if not exists pageviews_week integer;
alter table public.heroes add column if not exists pageviews_prev integer;
alter table public.heroes add column if not exists pageviews_spike numeric;
alter table public.heroes add column if not exists pageviews_at timestamptz;
create index if not exists heroes_pageviews_spike_idx
  on public.heroes (pageviews_spike desc) where pageviews_week is not null;
```

- [ ] **Step 2: Apply + verify**

MCP `apply_migration`, name `heroes_pageviews`, SQL above. Then MCP `execute_sql`:
```sql
select count(*) filter (where wikidata_qid is not null) as qid_heroes,
       count(*) filter (where enwiki_title is not null) as resolved
from public.heroes;
```
Expected: `qid_heroes` ≈ 4700, `resolved` = 0.

- [ ] **Step 3: Regenerate types**

MCP `generate_typescript_types` → write into `src/types/database.generated.ts`. Confirm `enwiki_title` + `pageviews_spike` appear under the `heroes` row type.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260628190000_heroes_pageviews.sql src/types/database.generated.ts
git commit -m "feat(wiki): enwiki_title + pageview columns on heroes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Backfill — `resolve-enwiki-title` edge function

**Files:**
- Create: `supabase/functions/resolve-enwiki-title/index.ts`

**Interfaces:**
- Consumes: `heroes` (id, wikidata_qid, enwiki_title); Wikidata `wbgetentities`.
- Produces: `POST /functions/v1/resolve-enwiki-title` body `{ limit?: number (default 300), triggeredBy? }` → `{ processed, resolved, remaining }`. Sets `heroes.enwiki_title` (article title, or `''` when no enwiki sitelink).

- [ ] **Step 1: Write the function**

Create `supabase/functions/resolve-enwiki-title/index.ts`:

```ts
// resolve-enwiki-title: backfill each hero's English-Wikipedia article title from
// its wikidata_qid via the Wikidata wbgetentities API (50 QIDs per call). '' means
// the entity has no enwiki sitelink, so it isn't retried. One-time drain.
//
// POST body: { limit?: number (default 300), triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;
const WD = 'https://www.wikidata.org/w/api.php';
const UA = { 'User-Agent': 'mythique/1.0 (https://mythique.app)' };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function chunk<T>(a: T[], n: number): T[][] {
  const o: T[][] = [];
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
  return o;
}

async function run(sb: SB, limit: number): Promise<{ processed: number; resolved: number; remaining: number }> {
  const { data } = await sb
    .from('heroes')
    .select('id, wikidata_qid')
    .not('wikidata_qid', 'is', null)
    .is('enwiki_title', null)
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  const rows = (data ?? []) as Array<{ id: string; wikidata_qid: string }>;
  if (rows.length === 0) return { processed: 0, resolved: 0, remaining: 0 };

  // qid -> hero ids (a QID could be shared; map to a list).
  const byQid = new Map<string, string[]>();
  for (const r of rows) {
    const list = byQid.get(r.wikidata_qid) ?? [];
    list.push(r.id);
    byQid.set(r.wikidata_qid, list);
  }
  const qids = [...byQid.keys()];

  let resolved = 0;
  for (const batch of chunk(qids, 50)) {
    let body: any;
    try {
      const url = `${WD}?action=wbgetentities&ids=${batch.join('|')}&props=sitelinks&sitefilter=enwiki&format=json&origin=*`;
      body = await (await fetch(url, { headers: UA })).json();
    } catch (_e) {
      continue; // transient; next run retries (enwiki_title still null)
    }
    const entities = body?.entities ?? {};
    for (const qid of batch) {
      const title: string =
        entities?.[qid]?.sitelinks?.enwiki?.title && typeof entities[qid].sitelinks.enwiki.title === 'string'
          ? entities[qid].sitelinks.enwiki.title
          : '';
      for (const heroId of byQid.get(qid) ?? []) {
        await sb.from('heroes').update({ enwiki_title: title }).eq('id', heroId);
      }
      if (title) resolved++;
    }
    await sleep(150);
  }

  const { count } = await sb
    .from('heroes')
    .select('id', { count: 'exact', head: true })
    .not('wikidata_qid', 'is', null)
    .is('enwiki_title', null);
  return { processed: rows.length, resolved, remaining: count ?? 0 };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let limit = 300;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.limit === 'number') limit = Math.min(Math.max(1, b.limit), 600);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  try {
    const out = await run(sb, limit);
    return json({ ...out, triggeredBy });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
```

- [ ] **Step 2: Deploy**

MCP `deploy_edge_function`, name `resolve-enwiki-title`, `verify_jwt: true`, the file above. Expected: deploy success.

- [ ] **Step 3: Invoke once + verify titles land**

```bash
URL=$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"'); KEY=$(grep -E '^EXPO_PUBLIC_SUPABASE_KEY=' .env.local | cut -d= -f2- | tr -d '"')
curl -s -X POST "$URL/functions/v1/resolve-enwiki-title" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"limit":300,"triggeredBy":"manual-verify"}'
```
Expected JSON: `{ "processed": >0, "resolved": >0, "remaining": <N>, ... }`.
Then MCP `execute_sql`:
```sql
select name, enwiki_title from public.heroes
where enwiki_title is not null and enwiki_title <> '' order by fame_score desc limit 8;
```
Expected: famous heroes mapped to plausible article titles (e.g. Batman → "Batman", Superman → "Superman").

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/resolve-enwiki-title/index.ts
git commit -m "feat(wiki): resolve-enwiki-title backfill edge function

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Ingest — `sync-wiki-pageviews` edge function

**Files:**
- Create: `supabase/functions/sync-wiki-pageviews/index.ts`

**Interfaces:**
- Consumes: `heroes` (id, enwiki_title); Wikimedia Pageviews REST API. Writes `pageviews_week`, `pageviews_prev`, `pageviews_spike`, `pageviews_at`.
- Produces: `POST /functions/v1/sync-wiki-pageviews` body `{ limit?: number (default 60), triggeredBy? }` → `{ processed }`.

- [ ] **Step 1: Write the function**

Create `supabase/functions/sync-wiki-pageviews/index.ts`:

```ts
// sync-wiki-pageviews: refresh each hero's last-7 vs prior-7 Wikipedia pageviews
// and a spike ratio, from the free Wikimedia Pageviews REST API. Processes the
// stalest rows first; cron cycles all heroes daily. The pageviews API lags ~1-2
// days, so the window ends today-2.
//
// POST body: { limit?: number (default 60), triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;
const WM = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents';
const UA = { 'User-Agent': 'mythique/1.0 (https://mythique.app)' };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let limit = 60;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.limit === 'number') limit = Math.min(Math.max(1, b.limit), 120);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }
  const sb: SB = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  // Window: 14 days ending today-2. Build the expected calendar dates.
  const end = new Date(Date.now() - 2 * 86_400_000);
  const start = new Date(end.getTime() - 13 * 86_400_000);
  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) dates.push(ymd(d));
  const weekDates = new Set(dates.slice(7)); // most recent 7
  const prevDates = new Set(dates.slice(0, 7)); // the 7 before

  const { data } = await sb
    .from('heroes')
    .select('id, enwiki_title')
    .not('enwiki_title', 'is', null)
    .neq('enwiki_title', '')
    .order('pageviews_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  const rows = (data ?? []) as Array<{ id: string; enwiki_title: string }>;

  let processed = 0;
  for (const r of rows) {
    let week = 0;
    let prev = 0;
    try {
      const article = encodeURIComponent(r.enwiki_title.replace(/ /g, '_'));
      const url = `${WM}/${article}/daily/${ymd(start)}/${ymd(end)}`;
      const res = await fetch(url, { headers: UA });
      if (res.ok) {
        const body = await res.json();
        for (const it of (body.items ?? []) as Array<{ timestamp: string; views: number }>) {
          const day = it.timestamp.slice(0, 8); // YYYYMMDD
          if (weekDates.has(day)) week += it.views ?? 0;
          else if (prevDates.has(day)) prev += it.views ?? 0;
        }
      }
      // 404 / no data → leave week=prev=0 (stored, so it's marked done for the cycle).
    } catch (_e) {
      /* transient; store zeros, retried next cycle */
    }
    const spike = (week + 1) / (prev + 1);
    await sb
      .from('heroes')
      .update({
        pageviews_week: week,
        pageviews_prev: prev,
        pageviews_spike: spike,
        pageviews_at: new Date().toISOString(),
      })
      .eq('id', r.id);
    processed++;
    await sleep(120);
  }

  if (processed > 0) await sb.from('api_usage').insert({ api: 'wikimedia', endpoint: 'pageviews', units: processed });
  return json({ processed, triggeredBy });
});
```

- [ ] **Step 2: Deploy**

MCP `deploy_edge_function`, name `sync-wiki-pageviews`, `verify_jwt: true`, the file above. Expected: deploy success.

- [ ] **Step 3: Invoke once + verify spikes compute**

(Run Task 2's invoke a few times first so there are resolved `enwiki_title`s.)
```bash
URL=$(grep -E '^EXPO_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"'); KEY=$(grep -E '^EXPO_PUBLIC_SUPABASE_KEY=' .env.local | cut -d= -f2- | tr -d '"')
curl -s -X POST "$URL/functions/v1/sync-wiki-pageviews" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"limit":40,"triggeredBy":"manual-verify"}'
```
Expected JSON: `{ "processed": 40, ... }`.
Then MCP `execute_sql`:
```sql
select name, pageviews_week, pageviews_prev, round(pageviews_spike, 2) as spike
from public.heroes where pageviews_at is not null and pageviews_week >= 1000
order by pageviews_spike desc limit 10;
```
Expected: famous heroes with real weekly view counts and a spike ratio.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-wiki-pageviews/index.ts
git commit -m "feat(wiki): sync-wiki-pageviews drain (week-over-week spike)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Read RPC — `get_trending_heroes_wiki`

**Files:**
- Create: `supabase/migrations/20260628191000_get_trending_heroes_wiki.sql`

**Interfaces:**
- Produces `get_trending_heroes_wiki(p_limit int default 12, p_min_week int default 1000)` returning `(id text, name text, image_url text, portrait_url text, pageviews_week integer, pageviews_spike numeric)`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260628191000_get_trending_heroes_wiki.sql`:

```sql
-- "Trending this week" reader: heroes ranked by pageview spike, above a noise
-- floor, with art (so the rail's cards render).
create or replace function public.get_trending_heroes_wiki(
  p_limit integer default 12,
  p_min_week integer default 1000
)
returns table (
  id text, name text, image_url text, portrait_url text,
  pageviews_week integer, pageviews_spike numeric
)
language sql
stable
as $$
  select id, name, image_url, portrait_url, pageviews_week, pageviews_spike
  from public.heroes
  where pageviews_week >= p_min_week
    and pageviews_spike is not null
    and (portrait_url is not null or image_url is not null)
  order by pageviews_spike desc
  limit p_limit;
$$;
grant execute on function public.get_trending_heroes_wiki(integer, integer)
  to anon, authenticated, service_role;
```

- [ ] **Step 2: Apply + verify**

MCP `apply_migration`, name `get_trending_heroes_wiki`, SQL above. Then MCP `execute_sql`:
```sql
select name, pageviews_week, round(pageviews_spike,2) as spike from public.get_trending_heroes_wiki(12, 1000);
```
Expected: spike-ranked heroes (or `[]` if the drain hasn't populated enough yet — no error).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260628191000_get_trending_heroes_wiki.sql
git commit -m "feat(wiki): get_trending_heroes_wiki RPC

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Client read — `getTrendingHeroesWiki`

**Files:**
- Modify: `src/lib/db/trending.ts`
- Test: `__tests__/lib/db/trendingWiki.test.ts`

**Interfaces:**
- Produces:
  - `interface WikiTrendingHero { id: string; name: string; image_url: string | null; portrait_url: string | null; week: number; spikePct: number }`
  - `getTrendingHeroesWiki(limit?: number): Promise<WikiTrendingHero[]>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/db/trendingWiki.test.ts`:

```ts
import { getTrendingHeroesWiki } from '../../../src/lib/db/trending';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

describe('getTrendingHeroesWiki', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the RPC and maps spike ratio to a percentage', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: [
        { id: '69', name: 'Batman', image_url: null, portrait_url: 'p.jpg', pageviews_week: 50000, pageviews_spike: 2.8 },
      ],
      error: null,
    });
    const out = await getTrendingHeroesWiki(12);
    expect(supabase.rpc).toHaveBeenCalledWith('get_trending_heroes_wiki', { p_limit: 12 });
    expect(out).toEqual([
      { id: '69', name: 'Batman', image_url: null, portrait_url: 'p.jpg', week: 50000, spikePct: 180 },
    ]);
  });

  it('degrades to [] on error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getTrendingHeroesWiki()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:ci __tests__/lib/db/trendingWiki.test.ts`
Expected: FAIL — `getTrendingHeroesWiki` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/db/trending.ts`:

```ts
export interface WikiTrendingHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  /** Pageviews in the most recent 7 days. */
  week: number;
  /** Week-over-week growth as a percentage (spike ratio 2.8 → 180). */
  spikePct: number;
}

interface WikiTrendingRow {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  pageviews_week: number | null;
  pageviews_spike: number | string | null;
}

/** Characters whose Wikipedia pageviews spiked this week. Degrades to [] so a DB
 *  hiccup never errors the Explore band. */
export async function getTrendingHeroesWiki(limit = 12): Promise<WikiTrendingHero[]> {
  const { data, error } = await supabase.rpc('get_trending_heroes_wiki', { p_limit: limit } as never);
  if (error) {
    console.warn('[getTrendingHeroesWiki] error:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as WikiTrendingRow[]).map((r) => {
    const spike = typeof r.pageviews_spike === 'string' ? parseFloat(r.pageviews_spike) : (r.pageviews_spike ?? 1);
    return {
      id: r.id,
      name: r.name,
      image_url: r.image_url,
      portrait_url: r.portrait_url,
      week: r.pageviews_week ?? 0,
      spikePct: Math.max(0, Math.round((spike - 1) * 100)),
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci __tests__/lib/db/trendingWiki.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `yarn typecheck`.
```bash
git add src/lib/db/trending.ts __tests__/lib/db/trendingWiki.test.ts
git commit -m "feat(wiki): getTrendingHeroesWiki read layer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Schedule — backfill + pageviews `pg_cron`

**Files:**
- Create: `supabase/migrations/20260628192000_schedule_wiki.sql`

- [ ] **Step 1: Write the migration**

Copy the exact `url` + anon `Bearer` token from `supabase/migrations/20260614130000_schedule_tmdb_drain.sql`. Create `supabase/migrations/20260628192000_schedule_wiki.sql`:

```sql
-- Two jobs: drain the one-time enwiki-title backfill every 5 min (a cheap no-op
-- once complete), and refresh pageviews every 10 min so all heroes cycle daily.
-- To PAUSE: select cron.unschedule('resolve-enwiki-title-drain'); / ('sync-wiki-pageviews-cycle');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'resolve-enwiki-title-drain',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/resolve-enwiki-title',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_JWT_FROM_schedule_tmdb_drain.sql>'),
    body := jsonb_build_object('limit', 300, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);

select cron.schedule(
  'sync-wiki-pageviews-cycle',
  '*/10 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/sync-wiki-pageviews',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_JWT_FROM_schedule_tmdb_drain.sql>'),
    body := jsonb_build_object('limit', 60, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);
```

- [ ] **Step 2: Apply + verify**

MCP `apply_migration`, name `schedule_wiki`, SQL above. Then MCP `execute_sql`:
```sql
select jobname, schedule, active from cron.job
where jobname in ('resolve-enwiki-title-drain','sync-wiki-pageviews-cycle') order by jobname;
```
Expected: two active rows with the right schedules.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260628192000_schedule_wiki.sql
git commit -m "feat(wiki): schedule enwiki backfill + pageviews drains

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Rails + Explore wiring (native + web)

**Files:**
- Create: `src/components/home/WikiTrendingRail.tsx`
- Modify: `src/hooks/useExploreData.ts`
- Modify: `src/components/home/RightNowBand.tsx`
- Modify: `app/(tabs)/explore.tsx`
- Modify: `src/components/web/home/RightNowBand.tsx`
- Modify: `app/(tabs)/explore.web.tsx`

**Interfaces:**
- Consumes: `getTrendingHeroesWiki`, `WikiTrendingHero` (Task 5); `HeroImage`.
- Produces: `ExploreData` + both `RightNowBandProps` gain `wikiTrending: WikiTrendingHero[]`.

- [ ] **Step 1: Build `WikiTrendingRail` (native; reused on web)**

Create `src/components/home/WikiTrendingRail.tsx`:

```tsx
// A horizontal rail of characters trending on Wikipedia this week — circular
// portrait + name + a ▲ +N% spike chip. Renders on both platforms (RN-Web safe).
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { WikiTrendingHero } from '../../lib/db/trending';

export function WikiTrendingRail({
  heroes,
  onHeroPress,
}: {
  heroes: WikiTrendingHero[];
  onHeroPress: (id: string) => void;
}) {
  if (heroes.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.label}>This Week</Text>
        <Text style={s.title}>Trending Now</Text>
      </View>
      <FlatList
        horizontal
        data={heroes}
        keyExtractor={(h) => h.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
        initialNumToRender={6}
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => onHeroPress(item.id)}>
            <View style={s.avatar}>
              <HeroImage
                id={item.id}
                name={item.name}
                imageUrl={item.image_url}
                portraitUrl={item.portrait_url}
                grid
                contentFit="cover"
                contentPosition="top"
                style={StyleSheet.absoluteFill as object}
                recyclingKey={item.id}
              />
            </View>
            {item.spikePct > 0 ? (
              <View style={s.chip}>
                <Ionicons name="trending-up" size={10} color="#fff" />
                <Text style={s.chipText}>{item.spikePct}%</Text>
              </View>
            ) : null}
            <Text style={s.name} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 8 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },
  strip: { gap: 14, paddingHorizontal: 16, paddingBottom: 4 },
  card: { width: 76, alignItems: 'center', gap: 6 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: COLORS.navy,
  },
  chip: {
    position: 'absolute',
    top: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: COLORS.orange,
  },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff' },
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.beige,
    textAlign: 'center',
    marginTop: 2,
  },
});
```

- [ ] **Step 2: Wire `useExploreData`**

In `src/hooks/useExploreData.ts`:
1. Import: add `getTrendingHeroesWiki, type WikiTrendingHero` to the `../lib/db/trending` import.
2. `ExploreData` interface — add `wikiTrending: WikiTrendingHero[];`.
3. `INITIAL` — add `wikiTrending: [],`.
4. In the mount `useEffect`:
```ts
    getTrendingHeroesWiki(14)
      .then(set('wikiTrending'))
      .catch(() => {});
```

- [ ] **Step 3: Native `RightNowBand` + Explore**

In `src/components/home/RightNowBand.tsx`: import `WikiTrendingRail` + `type WikiTrendingHero`; add `wikiTrending: WikiTrendingHero[]` to props; include `wikiTrending.length > 0` in `hasAny`; render `<WikiTrendingRail heroes={wikiTrending} onHeroPress={(id) => onHeroPress({ id })} />` after the comic `ComicCoverRail` (note: `onHeroPress` takes the `{ id, … }` item shape — pass `{ id }`).

In `app/(tabs)/explore.tsx`: add `wikiTrending` to the `useExploreData()` destructure; add `wikiTrending: WikiTrendingHero[]` to the `FeedRow` `rightnow` variant; add it to the `rows` useMemo condition + pushed object + deps; pass `wikiTrending={item.wikiTrending}` in the `case 'rightnow'` render.

- [ ] **Step 4: Web `RightNowBand` + Explore**

In `src/components/web/home/RightNowBand.tsx`: import `WikiTrendingRail`; add `wikiTrending` to props + `hasAny`; render `<WikiTrendingRail heroes={wikiTrending} onHeroPress={onHeroPress} />` (the web band's `onHeroPress` takes an id string — confirm its signature and pass accordingly).

In `app/(tabs)/explore.web.tsx`: destructure `wikiTrending` and pass it to `<RightNowBand …>`.

- [ ] **Step 5: Typecheck + lint + full test + commit**

Run: `yarn typecheck`; `yarn lint src/components/home/WikiTrendingRail.tsx src/components/home/RightNowBand.tsx src/components/web/home/RightNowBand.tsx src/hooks/useExploreData.ts "app/(tabs)/explore.tsx" "app/(tabs)/explore.web.tsx"`; `yarn test:ci`.
Expected: typecheck/lint clean; all suites pass.
```bash
git add src/components/home/WikiTrendingRail.tsx src/hooks/useExploreData.ts src/components/home/RightNowBand.tsx "app/(tabs)/explore.tsx" src/components/web/home/RightNowBand.tsx "app/(tabs)/explore.web.tsx"
git commit -m "feat(wiki): Trending this week rail (native + web)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6: Visual handoff (user-driven)**

User verifies web from device screenshots. Hand off: "Trending this week rail appears in the Right Now band once the pageviews drain has populated spikes (give the backfill + first cycle ~an hour)."

---

## Self-Review

**Spec coverage:**
- enwiki_title backfill from QID (50/batch, '' sentinel) → Task 2. ✓
- Daily pageviews drain, this-7 vs prior-7, window ends today−2, spike=(week+1)/(prev+1) → Task 3. ✓
- Noise floor ≥1000 → Tasks 4 (RPC default) + verification queries. ✓
- Spike ranking (not absolute) → Task 4 `order by pageviews_spike desc`. ✓
- Columns on heroes → Task 1. ✓
- RPC + read layer + ▲% cue → Tasks 4, 5, 7. ✓
- Rail in both Right Now bands → Task 7. ✓
- User-Agent on every Wikimedia/Wikidata call → Tasks 2, 3 (`UA`). ✓
- Two crons (backfill + cycle) → Task 6. ✓
- Hidden when empty / degrade to [] → `length>0` guards + `getTrendingHeroesWiki` error path. ✓

**Placeholder scan:** No TBD/TODO; full code in every code step. The cron bearer is "copy from schedule_tmdb_drain.sql" (avoid re-committing the secret); Task 7 Steps 3–4's `onHeroPress` signatures are flagged to confirm against the existing band props (native takes an item object, web takes an id) — bounded, not vague.

**Type consistency:** `WikiTrendingHero` defined in Task 5, consumed unchanged in Task 7 (`WikiTrendingRail`, the hook, both bands). `getTrendingHeroesWiki(limit?)` signature matches Task 5 (producer) ↔ Task 7 (consumer). RPC columns (Task 4) map one-for-one to `WikiTrendingRow` (Task 5). `spikePct = round((spike-1)*100)` is consistent between Task 5 impl and its test (2.8 → 180).
