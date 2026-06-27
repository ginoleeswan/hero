# ComicVine Weekly Comics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-renewing "New This Week" comic rail to the Explore "Right Now" band, fed by ComicVine's weekly issue slate, curated to issues featuring a recognizable catalogue character, with a lightweight issue page behind each cover.

**Architecture:** Mirror the existing TMDB freshness stack one-for-one. New `comic_issues` + `comic_issue_appearances` tables (siblings of `titles` + `hero_media_appearances`); a `sync-new-comics` Deno edge function on a `pg_cron` drain (the `enrich-tmdb-batch` + `schedule_tmdb_drain` pattern); a `get_new_comics` SQL RPC read through `src/lib/db/comics.ts` (the `get_trending_titles` + `db/trending.ts` pattern); a `ComicCoverRail` in both `RightNowBand` views; a single-file `app/issue/[id].tsx` route (the `app/title/[id].tsx` pattern).

**Tech Stack:** Expo SDK 56 / React Native / expo-router 4, Supabase Postgres + Deno edge functions, ComicVine REST API, TypeScript, jest-expo.

## Global Constraints

- Package manager: **yarn** only (never npm/bun).
- TypeScript throughout — **no `any`**; use `unknown` for caught errors. (Edge functions under `supabase/functions/**` are exempt from repo ESLint/TS tooling and may use `any`, matching `enrich-tmdb-batch`.)
- Screens never import `supabase` directly — all DB access goes through `src/lib/db/`.
- All styles via `StyleSheet.create` (no inline objects except `StyleSheet.absoluteFill`).
- Fonts: `Flame-Regular` (display/headings), `FlameSans-Regular` (body), `Nunito_*` (UI). **Never `Flame-Bold`.**
- Canvas colour `COLORS.beige` (`#f5ebdc`); dark surfaces use `COLORS.deepNavy` / `SURFACE` tokens.
- Schema changes are new files in `supabase/migrations/YYYYMMDDHHMMSS_*.sql`, applied via the Supabase MCP tool `apply_migration` (not the dashboard).
- **Every new table needs an explicit public-read RLS policy** or anon reads 0 rows and the UI silently empties.
- After any migration, **regenerate `src/types/database.generated.ts`** via the MCP tool `generate_typescript_types` (never edit it by hand).
- ComicVine API: base `https://comicvine.gamespot.com/api`, key from `Deno.env.get('COMICVINE_API_KEY')`, send header `User-Agent: mythique/1.0`, `format=json` on every request.
- `heroes.comicvine_id` is **text**; `heroes.fame_score` is **smallint** (0 default). Match ComicVine numeric character ids by `String(id)`.
- Verification commands: `yarn typecheck`, `yarn test:ci`, `yarn lint`.

---

### Task 1: Storage — `comic_issues` + `comic_issue_appearances`

**Files:**
- Create: `supabase/migrations/20260628120000_comic_issues_tables.sql`
- Modify (regenerate): `src/types/database.generated.ts`

**Interfaces:**
- Produces tables: `public.comic_issues(id text pk, comicvine_id text unique, volume_name text, volume_id integer, issue_number text, cover_url text, store_date date, cover_date date, publisher text, lead_hero_id text, max_fame smallint, synced_at timestamptz)` and `public.comic_issue_appearances(issue_id text, hero_id text, pk(issue_id,hero_id))`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260628120000_comic_issues_tables.sql`:

```sql
-- Comic-issue freshness backbone. Sibling of titles / hero_media_appearances:
-- comic_issues is the ComicVine weekly slate, comic_issue_appearances is the
-- issue↔catalogue-character graph. Populated by the sync-new-comics edge fn;
-- read by get_new_comics. Both are public-read (anon Explore must see them).
create table if not exists public.comic_issues (
  id           text primary key,             -- 'cvi:<comicvine_issue_id>'
  comicvine_id text unique not null,         -- ComicVine issue id (as text)
  volume_name  text,                         -- series name, e.g. "Batman"
  volume_id    integer,                      -- ComicVine volume id (future grouping)
  issue_number text,                         -- ComicVine sends strings ("1", "1.MU")
  cover_url    text,                         -- image.original_url / super / medium
  store_date   date,                         -- on-sale date — the freshness key
  cover_date   date,                         -- masthead date (reused by On This Day)
  publisher    text,                         -- derived from the lead catalogue hero
  lead_hero_id text references public.heroes(id) on delete set null,
  max_fame     smallint,                     -- highest fame_score among its catalogue chars
  synced_at    timestamptz default now()
);

create table if not exists public.comic_issue_appearances (
  issue_id text not null references public.comic_issues(id) on delete cascade,
  hero_id  text not null references public.heroes(id) on delete cascade,
  primary key (issue_id, hero_id)
);

create index if not exists comic_issues_store_date_idx on public.comic_issues (store_date desc);
create index if not exists comic_issue_appearances_hero_idx on public.comic_issue_appearances (hero_id);

alter table public.comic_issues             enable row level security;
alter table public.comic_issue_appearances  enable row level security;
create policy "Public read access" on public.comic_issues
  for select to anon, authenticated using (true);
create policy "Public read access" on public.comic_issue_appearances
  for select to anon, authenticated using (true);
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP tool `apply_migration` with name `comic_issues_tables` and the SQL above.
Expected: success, no error.

- [ ] **Step 3: Verify the tables exist and are empty-readable**

Run via MCP `execute_sql`:
```sql
select count(*) as issues from public.comic_issues;
select count(*) as appearances from public.comic_issue_appearances;
```
Expected: both return `0` with no error (confirms tables + grants).

- [ ] **Step 4: Regenerate generated types**

Use the MCP tool `generate_typescript_types` and write the result into `src/types/database.generated.ts` (whole-file replace). Confirm the file now contains `comic_issues` and `comic_issue_appearances`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260628120000_comic_issues_tables.sql src/types/database.generated.ts
git commit -m "feat(comics): comic_issues + appearances tables (weekly comics engine)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Read RPC — `get_new_comics`

**Files:**
- Create: `supabase/migrations/20260628121000_get_new_comics_rpc.sql`

**Interfaces:**
- Consumes: `comic_issues`, `comic_issue_appearances`, `heroes` (Task 1).
- Produces: `public.get_new_comics(p_days int default 7, p_min_fame int default 25, p_limit int default 12, p_chars_per_issue int default 8)` returning flat rows `(issue_id text, volume_name text, issue_number text, cover_url text, store_date date, publisher text, max_fame smallint, hero_id text, hero_name text, hero_image_url text, hero_portrait_url text)`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260628121000_get_new_comics_rpc.sql`:

```sql
-- "New This Week" reader. Direct analogue of get_trending_titles: pick the most
-- recent issues inside the display window that clear the tunable fame bar, then
-- attach their catalogue characters (lead first). Flat rows; the client groups.
create or replace function public.get_new_comics(
  p_days integer default 7,
  p_min_fame integer default 25,
  p_limit integer default 12,
  p_chars_per_issue integer default 8
)
returns table (
  issue_id text, volume_name text, issue_number text, cover_url text,
  store_date date, publisher text, max_fame smallint,
  hero_id text, hero_name text, hero_image_url text, hero_portrait_url text
)
language sql
stable
as $$
  with recent as (
    select * from public.comic_issues
    where store_date between current_date - p_days and current_date
      and max_fame >= p_min_fame
      and cover_url is not null
    order by store_date desc, max_fame desc
    limit p_limit
  ),
  chars as (
    select r.id as issue_id, r.volume_name, r.issue_number, r.cover_url,
           r.store_date, r.publisher, r.max_fame,
           h.id as hero_id, h.name as hero_name,
           h.image_url as hero_image_url, h.portrait_url as hero_portrait_url,
           row_number() over (
             partition by r.id order by h.fame_score desc nulls last
           ) as crank
    from recent r
    join public.comic_issue_appearances a on a.issue_id = r.id
    join public.heroes h on h.id = a.hero_id
    where (h.portrait_url is not null or h.image_url is not null)
  )
  select issue_id, volume_name, issue_number, cover_url, store_date, publisher, max_fame,
         hero_id, hero_name, hero_image_url, hero_portrait_url
  from chars
  where crank <= p_chars_per_issue
  order by store_date desc, max_fame desc, crank;
$$;
grant execute on function public.get_new_comics(integer, integer, integer, integer)
  to anon, authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

MCP `apply_migration`, name `get_new_comics_rpc`, SQL above. Expected: success.

- [ ] **Step 3: Verify the RPC runs (and gates) with seeded rows**

Run this self-contained seed → assert → cleanup via MCP `execute_sql` (one statement block):
```sql
-- pick a real high-fame hero to satisfy the FK + fame gate
with h as (select id from public.heroes where fame_score >= 40 limit 1)
insert into public.comic_issues (id, comicvine_id, volume_name, issue_number, cover_url, store_date, publisher, lead_hero_id, max_fame)
select 'cvi:test1', 'test1', 'Test Title', '1', 'http://x/cover.jpg', current_date, 'DC', h.id, 40 from h;
insert into public.comic_issue_appearances (issue_id, hero_id)
select 'cvi:test1', id from public.heroes where fame_score >= 40 limit 1;

select issue_id, volume_name, hero_name from public.get_new_comics();      -- expect 1+ row
select issue_id from public.get_new_comics(7, 99);                          -- expect 0 rows (fame gate)

delete from public.comic_issue_appearances where issue_id = 'cvi:test1';
delete from public.comic_issues where id = 'cvi:test1';
```
Expected: first select returns the seeded row, the `p_min_fame=99` call returns nothing, cleanup leaves both tables empty.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260628121000_get_new_comics_rpc.sql
git commit -m "feat(comics): get_new_comics RPC (fame-gated weekly reader)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Client data layer — `src/lib/db/comics.ts`

**Files:**
- Create: `src/lib/db/comics.ts`
- Test: `__tests__/lib/db/comics.test.ts`

**Interfaces:**
- Consumes: `get_new_comics` RPC (Task 2); `supabase` client.
- Produces:
  - `interface NewComicCharacter { id: string; name: string; image_url: string | null; portrait_url: string | null }`
  - `interface NewComic { id: string; volumeName: string | null; issueNumber: string | null; coverUrl: string | null; storeDate: string | null; publisher: string | null; characters: NewComicCharacter[] }`
  - `function groupComicRows(rows: NewComicRow[]): NewComic[]`
  - `async function getNewComics(limit?: number): Promise<NewComic[]>`
  - `async function getIssueById(id: string): Promise<NewComic | null>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/db/comics.test.ts`:

```ts
import { groupComicRows, getNewComics, type NewComicRow } from '../../../src/lib/db/comics';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const row = (issue: string, hero: string, extra: Partial<NewComicRow> = {}): NewComicRow => ({
  issue_id: issue,
  volume_name: 'Batman',
  issue_number: '155',
  cover_url: 'http://x/c.jpg',
  store_date: '2026-06-25',
  publisher: 'DC',
  max_fame: 80,
  hero_id: hero,
  hero_name: hero,
  hero_image_url: null,
  hero_portrait_url: null,
  ...extra,
});

describe('groupComicRows', () => {
  it('groups flat rows into issues, preserving row order for characters', () => {
    const out = groupComicRows([
      row('cvi:1', 'Batman'),
      row('cvi:1', 'Robin'),
      row('cvi:2', 'Storm', { volume_name: 'X-Men', issue_number: '40' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: 'cvi:1',
      volumeName: 'Batman',
      issueNumber: '155',
      coverUrl: 'http://x/c.jpg',
      storeDate: '2026-06-25',
      publisher: 'DC',
      characters: [
        { id: 'Batman', name: 'Batman', image_url: null, portrait_url: null },
        { id: 'Robin', name: 'Robin', image_url: null, portrait_url: null },
      ],
    });
    expect(out[1].id).toBe('cvi:2');
    expect(out[1].characters.map((c) => c.id)).toEqual(['Storm']);
  });

  it('returns [] for no rows', () => {
    expect(groupComicRows([])).toEqual([]);
  });
});

describe('getNewComics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the RPC with the limit and groups the result', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: [row('cvi:1', 'Batman')], error: null });
    const out = await getNewComics(12);
    expect(supabase.rpc).toHaveBeenCalledWith('get_new_comics', { p_limit: 12 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('cvi:1');
  });

  it('degrades to [] on error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getNewComics()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test:ci __tests__/lib/db/comics.test.ts`
Expected: FAIL — cannot find module `../../../src/lib/db/comics`.

- [ ] **Step 3: Implement `src/lib/db/comics.ts`**

```ts
import { supabase } from '../supabase';

// "New This Week" — the ComicVine weekly slate, curated to issues featuring a
// recognizable catalogue character. Sibling of db/trending.ts: the get_new_comics
// RPC does the window + fame gate + character join; the client just groups the
// flat rows (issue fields repeated per character) into issues.

export interface NewComicCharacter {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
}

export interface NewComic {
  id: string; // 'cvi:<comicvine_issue_id>'
  volumeName: string | null;
  issueNumber: string | null;
  coverUrl: string | null;
  storeDate: string | null;
  publisher: string | null;
  characters: NewComicCharacter[];
}

export interface NewComicRow {
  issue_id: string;
  volume_name: string | null;
  issue_number: string | null;
  cover_url: string | null;
  store_date: string | null;
  publisher: string | null;
  max_fame: number | null;
  hero_id: string;
  hero_name: string;
  hero_image_url: string | null;
  hero_portrait_url: string | null;
}

/** Flat RPC rows → grouped issues, preserving the RPC's order (issues by recency
 *  then fame, characters lead-first within each issue). */
export function groupComicRows(rows: NewComicRow[]): NewComic[] {
  const byId = new Map<string, NewComic>();
  for (const r of rows) {
    let c = byId.get(r.issue_id);
    if (!c) {
      c = {
        id: r.issue_id,
        volumeName: r.volume_name,
        issueNumber: r.issue_number,
        coverUrl: r.cover_url,
        storeDate: r.store_date,
        publisher: r.publisher,
        characters: [],
      };
      byId.set(r.issue_id, c);
    }
    c.characters.push({
      id: r.hero_id,
      name: r.hero_name,
      image_url: r.hero_image_url,
      portrait_url: r.hero_portrait_url,
    });
  }
  return [...byId.values()];
}

/** The curated comic issues that shipped this week. Degrades to [] so a DB hiccup
 *  never errors the Explore band. */
export async function getNewComics(limit = 12): Promise<NewComic[]> {
  const { data, error } = await supabase.rpc('get_new_comics', { p_limit: limit });
  if (error) {
    console.warn('[getNewComics] error:', error.message);
    return [];
  }
  return groupComicRows((data ?? []) as NewComicRow[]);
}

interface IssueNestedRow {
  id: string;
  volume_name: string | null;
  issue_number: string | null;
  cover_url: string | null;
  store_date: string | null;
  publisher: string | null;
  lead_hero_id: string | null;
  comic_issue_appearances: { heroes: NewComicCharacter | null }[] | null;
}

/** A single issue by id ('cvi:<n>') for the issue page. Lead character first,
 *  the rest in graph order. Null on error/not found. */
export async function getIssueById(id: string): Promise<NewComic | null> {
  const { data, error } = await supabase
    .from('comic_issues')
    .select(
      'id, volume_name, issue_number, cover_url, store_date, publisher, lead_hero_id, comic_issue_appearances ( heroes ( id, name, image_url, portrait_url ) )',
    )
    .eq('id', id)
    .single();
  if (error || !data) return null;
  const r = data as unknown as IssueNestedRow;
  const chars = (r.comic_issue_appearances ?? [])
    .map((a) => a.heroes)
    .filter((h): h is NewComicCharacter => h !== null);
  // Put the lead hero first (best-effort; detail view, order is non-critical).
  chars.sort((a, b) => (a.id === r.lead_hero_id ? -1 : b.id === r.lead_hero_id ? 1 : 0));
  return {
    id: r.id,
    volumeName: r.volume_name,
    issueNumber: r.issue_number,
    coverUrl: r.cover_url,
    storeDate: r.store_date,
    publisher: r.publisher,
    characters: chars,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test:ci __tests__/lib/db/comics.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `yarn typecheck` (expect no errors).
```bash
git add src/lib/db/comics.ts __tests__/lib/db/comics.test.ts
git commit -m "feat(comics): db/comics.ts read layer (getNewComics, getIssueById)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Ingest — `sync-new-comics` edge function

**Files:**
- Create: `supabase/functions/sync-new-comics/index.ts`

**Interfaces:**
- Consumes: ComicVine `/issues`; `heroes` (comicvine_id, fame_score, publisher); writes `comic_issues` + `comic_issue_appearances` (Task 1).
- Produces: HTTP endpoint `POST /functions/v1/sync-new-comics` body `{ days?: number (default 14), triggeredBy?: string }`, returning `{ fetched, stored, message }`.

- [ ] **Step 1: Write the function**

Create `supabase/functions/sync-new-comics/index.ts` (Deno; `any` permitted here, matching `enrich-tmdb-batch`):

```ts
// supabase/functions/sync-new-comics/index.ts
//
// Weekly comics drain. One phase: fetch ComicVine issues with a store_date in
// the last `days` (default 14 — wider than the 7-day display window so corrected
// store_dates land), keep only issues whose credited characters intersect our
// catalogue, compute the lead (highest fame) + max_fame + publisher, and upsert
// the issue + its catalogue appearances. Idempotent; safe to run daily.
//
// POST body: { days?: number (1-31, default 14), triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

const CV = 'https://comicvine.gamespot.com/api';
const KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const UA = { 'User-Agent': 'mythique/1.0 (weekly comics sync)' };
const ISSUE_FIELDS = 'id,issue_number,store_date,cover_date,image,volume,character_credits';
const MAX_PAGES = 6; // 600 issues — a fortnight is well under this

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const coverUrl = (image: Record<string, string> | null | undefined): string | null =>
  image?.original_url ?? image?.super_url ?? image?.medium_url ?? null;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface CvIssue {
  id: number;
  issue_number: string | null;
  store_date: string | null;
  cover_date: string | null;
  image: Record<string, string> | null;
  volume: { id: number; name: string } | null;
  character_credits: { id: number; name: string }[] | null;
}

// Pull every issue whose store_date falls in [start, end], paging until exhausted.
async function fetchIssues(start: string, end: string): Promise<CvIssue[]> {
  const all: CvIssue[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * 100;
    const url =
      `${CV}/issues/?api_key=${KEY}&format=json&sort=store_date:desc&limit=100&offset=${offset}` +
      `&field_list=${ISSUE_FIELDS}&filter=store_date:${start}|${end}`;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) break;
    const body = await res.json();
    const results = (body.results ?? []) as CvIssue[];
    all.push(...results);
    const total = typeof body.number_of_total_results === 'number' ? body.number_of_total_results : 0;
    if (offset + results.length >= total || results.length === 0) break;
    await sleep(200); // be polite to ComicVine
  }
  return all;
}

// comicvine_id (text) → catalogue hero, for the credited ids we actually saw.
async function loadHeroMap(sb: SB, cvIds: string[]): Promise<Map<string, { id: string; fame: number; publisher: string | null }>> {
  const map = new Map<string, { id: string; fame: number; publisher: string | null }>();
  for (const ids of chunk(cvIds, 300)) {
    const { data } = await sb
      .from('heroes')
      .select('id, comicvine_id, fame_score, publisher')
      .in('comicvine_id', ids);
    for (const h of (data ?? []) as Array<{ id: string; comicvine_id: string; fame_score: number | null; publisher: string | null }>) {
      if (h.comicvine_id) map.set(h.comicvine_id, { id: h.id, fame: h.fame_score ?? 0, publisher: h.publisher });
    }
  }
  return map;
}

async function runSync(sb: SB, days: number): Promise<{ fetched: number; stored: number }> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const issues = (await fetchIssues(isoDate(start), isoDate(end))).filter((i) => i.store_date);
  if (issues.length === 0) return { fetched: 0, stored: 0 };

  // Resolve every credited id once.
  const credited = new Set<string>();
  for (const i of issues) for (const c of i.character_credits ?? []) credited.add(String(c.id));
  const heroMap = await loadHeroMap(sb, [...credited]);

  let stored = 0;
  for (const i of issues) {
    const matches = (i.character_credits ?? [])
      .map((c) => heroMap.get(String(c.id)))
      .filter((h): h is { id: string; fame: number; publisher: string | null } => !!h);
    if (matches.length === 0) continue; // no catalogue character → skip
    const lead = matches.reduce((a, b) => (b.fame > a.fame ? b : a), matches[0]);
    const issueId = `cvi:${i.id}`;

    const { error: upErr } = await sb.from('comic_issues').upsert(
      {
        id: issueId,
        comicvine_id: String(i.id),
        volume_name: i.volume?.name ?? null,
        volume_id: i.volume?.id ?? null,
        issue_number: i.issue_number ?? null,
        cover_url: coverUrl(i.image),
        store_date: i.store_date,
        cover_date: i.cover_date ?? null,
        publisher: lead.publisher,
        lead_hero_id: lead.id,
        max_fame: lead.fame,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (upErr) {
      console.error('[sync-new-comics] issue upsert failed', issueId, upErr.message);
      continue;
    }
    await sb
      .from('comic_issue_appearances')
      .upsert(
        matches.map((m) => ({ issue_id: issueId, hero_id: m.id })),
        { onConflict: 'issue_id,hero_id', ignoreDuplicates: true },
      );
    stored++;
  }
  return { fetched: issues.length, stored };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let days = 14;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.days === 'number') days = Math.min(Math.max(1, b.days), 31);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const { fetched, stored } = await runSync(sb, days);
    if (fetched > 0) await sb.from('api_usage').insert({ api: 'comicvine', endpoint: 'sync-new-comics', units: fetched });
    return json({ fetched, stored, triggeredBy, message: stored === 0 ? 'nothing to do' : 'ok' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
```

- [ ] **Step 2: Deploy the function**

Use the MCP tool `deploy_edge_function` with name `sync-new-comics` and the file above.
Expected: deploy success; it appears in `list_edge_functions`.

- [ ] **Step 3: Invoke once to seed real data + verify**

Invoke it (a wide window guarantees hits), then check rows landed. Run via terminal:
```bash
curl -s -X POST "$(node -e "console.log(process.env.EXPO_PUBLIC_SUPABASE_URL||'')")/functions/v1/sync-new-comics" \
  -H "Authorization: Bearer $(node -e "console.log(process.env.EXPO_PUBLIC_SUPABASE_KEY||'')")" \
  -H "Content-Type: application/json" -d '{"days":21,"triggeredBy":"manual-verify"}'
```
Expected JSON: `{ "fetched": <n>0, "stored": <m>0, ... }`.
Then via MCP `execute_sql`:
```sql
select count(*) from public.comic_issues;
select volume_name, issue_number, max_fame, store_date from public.get_new_comics(21, 25, 8);
```
Expected: issue count > 0; the RPC returns curated recent issues with their characters.

> If `fetched` > 0 but `stored` = 0, the fame/catalogue intersection is empty for that window — widen `days` or lower the gate temporarily to confirm the path, but do not lower the production default.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-new-comics/index.ts
git commit -m "feat(comics): sync-new-comics edge function (ComicVine weekly ingest)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Schedule — daily `pg_cron` drain

**Files:**
- Create: `supabase/migrations/20260628122000_schedule_new_comics_sync.sql`

**Interfaces:**
- Consumes: deployed `sync-new-comics` function (Task 4).

- [ ] **Step 1: Write the migration**

Copy the exact URL + anon bearer from `supabase/migrations/20260614130000_schedule_tmdb_drain.sql` (same project). Create `supabase/migrations/20260628122000_schedule_new_comics_sync.sql`:

```sql
-- Unattended weekly-comics sync. Comics ship Wednesdays, but run daily at 09:00
-- UTC so corrected store_dates land and the function no-ops on quiet days.
-- Mirrors schedule_tmdb_drain. To PAUSE: select cron.unschedule('sync-new-comics-daily');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-new-comics-daily',
  '0 9 * * *',
  $cron$
  select net.http_post(
    url := 'https://rpvgqfaeiowisdubgxkg.supabase.co/functions/v1/sync-new-comics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdmdxZmFlaW93aXNkdWJneGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDc0MjMsImV4cCI6MjA5MDg4MzQyM30.ViW6O38WDqFN9iXWcQI-ThJjAM0GrU5lEYiqor-rmJM'
    ),
    body := jsonb_build_object('days', 14, 'triggeredBy', 'cron'),
    timeout_milliseconds := 120000
  );
  $cron$
);
```

- [ ] **Step 2: Apply the migration**

MCP `apply_migration`, name `schedule_new_comics_sync`, SQL above. Expected: success.

- [ ] **Step 3: Verify the job is scheduled**

MCP `execute_sql`:
```sql
select jobname, schedule, active from cron.job where jobname = 'sync-new-comics-daily';
```
Expected: one row, `schedule = '0 9 * * *'`, `active = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260628122000_schedule_new_comics_sync.sql
git commit -m "feat(comics): schedule daily sync-new-comics drain

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Issue page — `app/issue/[id].tsx`

**Files:**
- Create: `app/issue/[id].tsx`

**Interfaces:**
- Consumes: `getIssueById` (Task 3), `NewComic`/`NewComicCharacter` types; `HeroImage`, `useScreenChrome`, `NotFoundView`, `COLORS`/`SURFACE`.
- Produces: route `/issue/[id]` (single file, web + native via `isWeb`, mirroring `app/title/[id].tsx`).

- [ ] **Step 1: Write the screen**

Create `app/issue/[id].tsx`:

```tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getIssueById, type NewComic } from '../../src/lib/db/comics';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { NotFoundView } from '../../src/components/NotFoundView';

function onSaleLabel(storeDate: string | null): string | null {
  if (!storeDate) return null;
  const d = new Date(storeDate);
  if (Number.isNaN(d.getTime())) return null;
  return `On sale ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function IssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const [issue, setIssue] = useState<NewComic | null | undefined>(undefined); // undefined = loading

  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  useEffect(() => {
    if (!id) {
      setIssue(null);
      return;
    }
    let active = true;
    getIssueById(id).then((i) => {
      if (active) setIssue(i);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (issue === undefined) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  if (issue === null) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <NotFoundView
          stamp="Missing"
          stampColor={COLORS.red}
          icon="book-outline"
          headline="Issue not found"
          subline="We don't have this issue in the archive yet."
          actions={[{ label: 'Go back', primary: true, onPress: () => router.back() }]}
        />
      </View>
    );
  }

  const title = `${issue.volumeName ?? 'Untitled'}${issue.issueNumber ? ` #${issue.issueNumber}` : ''}`;
  const meta = [onSaleLabel(issue.storeDate), issue.publisher].filter(Boolean).join('  ·  ');

  const body = (
    <View style={styles.body}>
      {issue.coverUrl ? (
        <Image source={{ uri: issue.coverUrl }} contentFit="cover" style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverFallback]} />
      )}
      <Text style={styles.kicker}>New This Week</Text>
      <Text style={styles.title}>{title}</Text>
      {!!meta && <Text style={styles.meta}>{meta}</Text>}

      {issue.characters.length > 0 && (
        <View style={styles.chars}>
          <Text style={styles.charsLabel}>Featuring</Text>
          <View style={styles.chips}>
            {issue.characters.map((c) => (
              <Pressable
                key={c.id}
                style={styles.chip}
                onPress={() => router.push(`/character/${c.id}`)}
              >
                <View style={styles.avatar}>
                  <HeroImage
                    id={c.id}
                    name={c.name}
                    imageUrl={c.image_url}
                    portraitUrl={c.portrait_url}
                    grid
                    contentFit="cover"
                    contentPosition={{ top: '20%', left: '50%' }}
                    style={StyleSheet.absoluteFill as object}
                    recyclingKey={c.id}
                  />
                </View>
                <Text style={styles.chipName} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  if (isWeb) {
    return (
      <View style={styles.webPage}>
        <Stack.Screen options={{ headerShown: false }} />
        {body}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  webPage: { width: '100%', backgroundColor: COLORS.beige, paddingBottom: 40 },
  loading: { flex: 1, backgroundColor: COLORS.beige, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { alignItems: 'center' },
  body: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20, gap: 8 },
  cover: {
    width: 200,
    height: 304, // ~2:3 comic cover
    borderRadius: 12,
    borderCurve: 'continuous',
    alignSelf: 'center',
    marginBottom: 14,
    backgroundColor: COLORS.navy,
  },
  coverFallback: { backgroundColor: COLORS.navy },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
    textAlign: 'center',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.navy, textAlign: 'center', lineHeight: 30 },
  meta: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.grey, textAlign: 'center', marginTop: 2 },
  chars: { marginTop: 22 },
  charsLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  chip: { width: 64, alignItems: 'center', gap: 5 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e8ddd0',
    backgroundColor: COLORS.navy,
  },
  chipName: { fontFamily: 'FlameSans-Regular', fontSize: 11, color: COLORS.navy, textAlign: 'center' },
});
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: no errors. (If `COLORS.grey` or `COLORS.red` is missing, substitute the nearest existing token from `src/constants/colors.ts` — read it to confirm available keys.)

- [ ] **Step 3: Lint**

Run: `yarn lint app/issue/[id].tsx`
Expected: no errors (warnings tolerated per the repo's errors-only gate).

- [ ] **Step 4: Commit**

```bash
git add "app/issue/[id].tsx"
git commit -m "feat(comics): lightweight /issue/[id] page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Native rail + wiring

**Files:**
- Create: `src/components/home/ComicCoverRail.tsx`
- Modify: `src/components/home/RightNowBand.tsx`
- Modify: `app/(tabs)/explore.tsx`

**Interfaces:**
- Consumes: `NewComic` (Task 3), `getNewComics` (already exported), `useExploreData` (Task — wired here).
- Produces: `RightNowBandProps` gains `newComics: NewComic[]` and `onIssuePress: (issueId: string) => void`. `ExploreData` gains `newComics: NewComic[]`.

- [ ] **Step 1: Wire `newComics` into `useExploreData`**

In `src/hooks/useExploreData.ts`:
1. Add to the `trending` import block: `getNewComics, type NewComic` from `../lib/db/trending`? No — import from `../lib/db/comics`. Add a new import line:
```ts
import { getNewComics, type NewComic } from '../lib/db/comics';
```
2. Add to the `ExploreData` interface (near `campaigns`): `newComics: NewComic[];`
3. Add to `INITIAL`: `newComics: [],`
4. In the mount `useEffect`, alongside the other trending fetches, add:
```ts
    getNewComics(12)
      .then(set('newComics'))
      .catch(() => {});
```

- [ ] **Step 2: Build `ComicCoverRail` (native)**

Create `src/components/home/ComicCoverRail.tsx`:

```tsx
// src/components/home/ComicCoverRail.tsx — a calm horizontal rail of this week's
// comic covers for the "New This Week" section of the Right Now band. Sibling of
// TitlePosterRail; taps open the lightweight issue page.
import { View, Text, FlatList, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import type { NewComic } from '../../lib/db/comics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = Math.round(SCREEN_WIDTH * 0.34);
const CARD_H = Math.round(CARD_W * 1.5);

function onSaleDay(storeDate: string | null): string | null {
  if (!storeDate) return null;
  const d = new Date(storeDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ComicCoverRail({
  comics,
  onIssuePress,
}: {
  comics: NewComic[];
  onIssuePress: (issueId: string) => void;
}) {
  if (comics.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.label}>This Week</Text>
        <Text style={s.title}>New Comics</Text>
      </View>
      <FlatList
        horizontal
        data={comics}
        keyExtractor={(c) => c.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
        initialNumToRender={4}
        renderItem={({ item }) => {
          const day = onSaleDay(item.storeDate);
          return (
            <Pressable style={s.card} onPress={() => onIssuePress(item.id)}>
              {item.coverUrl ? (
                <Image source={{ uri: item.coverUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, s.fallback]} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(11,24,32,0.92)']}
                locations={[0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              {!!day && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{day}</Text>
                </View>
              )}
              <Text style={s.name} numberOfLines={2}>
                {item.volumeName}
                {item.issueNumber ? ` #${item.issueNumber}` : ''}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 6 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },
  strip: { gap: 10, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  fallback: { backgroundColor: COLORS.navy },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.orange,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#fff',
  },
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.beige,
    lineHeight: 13,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});
```

- [ ] **Step 3: Render it in the native `RightNowBand`**

In `src/components/home/RightNowBand.tsx`:
1. Add imports: `import { ComicCoverRail } from './ComicCoverRail';` and `import type { NewComic } from '../../lib/db/comics';`
2. Extend `RightNowBandProps`: add `newComics: NewComic[];` and `onIssuePress: (issueId: string) => void;`
3. Update `hasAny` to include `newComics.length > 0`.
4. Destructure `newComics` and `onIssuePress` in the component signature.
5. Render the rail right after `<TitlePosterRail .../>`:
```tsx
      <ComicCoverRail comics={newComics} onIssuePress={onIssuePress} />
```

- [ ] **Step 4: Wire the native Explore screen**

In `app/(tabs)/explore.tsx`:
1. Add import: `import type { NewComic } from '../../src/lib/db/comics';` (the fetch lives in the hook; the screen only needs the type).
2. Add `newComics` to the `useExploreData()` destructure (line ~111-140 block).
3. Extend the `FeedRow` `rightnow` variant (lines 84-91) with `newComics: NewComic[];` after `personalized`.
4. In the `rows` useMemo, add `newComics` to the condition and the pushed object:
```ts
    if (
      campaigns[0] ||
      onScreen.length > 0 ||
      comingSoon.length > 0 ||
      streaming.length > 0 ||
      trendingForUser.length > 0 ||
      newComics.length > 0
    ) {
      out.push({
        type: 'rightnow',
        campaign: campaigns[0] ?? null,
        onScreen,
        comingSoon,
        streaming,
        personalized: trendingForUser,
        newComics,
      });
    }
```
5. Add a handler beside `handleTitlePress` (line ~187):
```ts
  const handleIssuePress = useCallback(
    (issueId: string) => {
      Haptics.selectionAsync();
      router.push(`/issue/${issueId}`);
    },
    [router],
  );
```
6. In the `case 'rightnow'` render block (line ~403), add the two props:
```tsx
              newComics={item.newComics}
              onIssuePress={handleIssuePress}
```

- [ ] **Step 5: Typecheck + lint**

Run: `yarn typecheck` then `yarn lint src/components/home/ComicCoverRail.tsx src/components/home/RightNowBand.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/ComicCoverRail.tsx src/components/home/RightNowBand.tsx src/hooks/useExploreData.ts "app/(tabs)/explore.tsx"
git commit -m "feat(comics): native New This Week rail in Right Now band

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Web rail + wiring

**Files:**
- Modify: `src/components/web/home/RightNowBand.tsx`
- Modify: `app/(tabs)/explore.web.tsx`

**Interfaces:**
- Consumes: `NewComic` (Task 3); the web `RightNowBand` already owns an inline `PosterRail` (line ~316) — add an inline `ComicCoverRail` beside it (web file owns its rails inline; do not import the native component).
- Produces: web `RightNowBandProps` gains `newComics: NewComic[]` + `onIssuePress`.

> The web RightNowBand and `explore.web.tsx` are large view files (excluded from routine reads). Use these anchors; mirror the existing `onScreen` / `onTitlePress` plumbing exactly, substituting `newComics` / `onIssuePress`.

- [ ] **Step 1: Add the inline web rail + prop**

In `src/components/web/home/RightNowBand.tsx`:
1. Add `import type { NewComic } from '../../../lib/db/comics';` near the `trending` import.
2. Extend the web `RightNowBandProps` (the interface around line 27 with `onScreen/comingSoon/streaming`): add `newComics: NewComic[];` and `onIssuePress: (issueId: string) => void;`
3. Add an inline `ComicCoverRail` function modelled on the existing `PosterRail` (line ~316) — a horizontal scroller of ~2:3 cover cards using the web scroll-snap pattern already in `PosterRail`, each card a `Pressable`/anchor calling `onIssuePress(comic.id)`. Header label "This Week" / title "New Comics" (reuse `PosterRail`'s header styles). Card shows the cover image, an on-sale-day badge, and `volumeName #issueNumber`.
4. Destructure `newComics` + `onIssuePress` in the component and render `<ComicCoverRail comics={newComics} onIssuePress={onIssuePress} />` immediately after the existing `<PosterRail .../>` call. Include `newComics.length > 0` in the band's `hasAny` guard.

- [ ] **Step 2: Wire the web Explore screen**

In `app/(tabs)/explore.web.tsx`:
1. Destructure `newComics` from `useExploreData()` (it now returns it after Task 7 Step 1).
2. Add a handler beside the title handler (the one at line ~1137 doing `router.push('/title/${id}')`):
```ts
  const handleIssuePress = (issueId: string) =>
    router.push(`/issue/${issueId}` as Parameters<typeof router.push>[0]);
```
3. Pass both new props to `<RightNowBand>` (the call at line ~1202):
```tsx
            newComics={newComics}
            onIssuePress={handleIssuePress}
```

- [ ] **Step 3: Typecheck + lint**

Run: `yarn typecheck` then `yarn lint src/components/web/home/RightNowBand.tsx`
Expected: no errors.

- [ ] **Step 4: Full test + commit**

Run: `yarn test:ci`
Expected: all suites pass (the new `comics.test.ts` included).
```bash
git add src/components/web/home/RightNowBand.tsx "app/(tabs)/explore.web.tsx"
git commit -m "feat(comics): web New This Week rail in Right Now band

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Final visual check (user-driven)**

The user verifies web UI from their own device screenshots (iOS Safari) — do **not** spin up a local server or browser automation. Hand off: "Native + web 'New This Week' rail is wired; pull to refresh Explore — the rail appears below 'On Screen Now', and tapping a cover opens `/issue/[id]`."

---

## Self-Review

**Spec coverage:**
- Curation rule (catalogue + fame-gated, tunable `p_min_fame`) → Task 2 RPC + Task 4 ingest gate. ✓
- `comic_issues` + `comic_issue_appearances` with public-read RLS → Task 1. ✓
- `sync-new-comics` edge fn + daily `pg_cron` drain → Tasks 4, 5. ✓
- 14-day ingest lookback vs 7-day display window → Task 4 (`days` default 14) + Task 2 (`p_days` default 7). ✓
- `get_new_comics` RPC + `db/comics.ts` grouping → Tasks 2, 3. ✓
- `ComicCoverRail` in both Right Now bands → Tasks 7, 8. ✓
- `/issue/[id]` lightweight page with character chips → Task 6. ✓
- Failure modes (CV down, empty week, missing cover, dup ingest, null store_date) → handled in Task 4 (skip/continue, idempotent upsert) + Task 2 (`cover_url is not null`, length gate) + UI `length === 0` guards. ✓
- Regenerate generated types after migration → Task 1 Step 4. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. The one delegated detail (web inline rail, Task 8 Step 1) is bounded by an existing in-file analogue (`PosterRail`) with explicit anchors — acceptable because the web view file is intentionally excluded from reads and mirrors a proven sibling.

**Type consistency:** `NewComic` / `NewComicCharacter` / `NewComicRow` defined in Task 3 and consumed unchanged in Tasks 6–8. `getNewComics` / `getIssueById` / `groupComicRows` signatures match across producer (Task 3) and consumers. RPC return columns (Task 2) match `NewComicRow` fields (Task 3) one-for-one. `RightNowBandProps` additions (`newComics`, `onIssuePress`) are identical across native (Task 7) and web (Task 8).
```
