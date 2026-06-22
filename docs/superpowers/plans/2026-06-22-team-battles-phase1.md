# Team Battles — Phase 1 (Curated Daily Team Battle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an end-to-end curated daily team battle: two featured teams clash on a dedicated page (deck-deal → synergy → CLASH → tug-of-war meter → AI verdict → community vote), launched from the existing `/versus` hub.

**Architecture:** The team layer is a derived, rebuildable mirror of the hero layer — `heroes.teams[]` is the source of truth; `teams`/`team_members` are rebuilt from it set-based in Postgres. A reusable `get_team_synergy(hero_ids[])` RPC computes a transparent synergy breakdown. A pure `src/lib/teamBattle.ts` combines size-neutral averaged composite stats + synergy into a result. A shared `useTeamBattle` hook feeds thin native/web clash views. Voting and verdicts mirror the hardened `matchup_votes`/`verdicts` patterns.

**Tech Stack:** Supabase (Postgres + RLS + SECURITY DEFINER RPCs + edge functions), TypeScript, React Native / Expo Router 4, react-query, react-native-reanimated 4 (native) / CSS (web), jest-expo.

**Spec:** `docs/superpowers/specs/2026-06-22-team-battles-design.md`

## Global Constraints

- Package manager: **yarn** only. Run tests with `yarn test:ci`.
- TypeScript throughout — no `any`; `unknown` for caught errors.
- Screens **never** import `supabase` directly — all DB access via `src/lib/db/`.
- All schema changes are new files in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`, applied via the Supabase MCP tool (`mcp__supabase__apply_migration`), **not** the dashboard.
- After any migration, regenerate `src/types/database.generated.ts` via `mcp__supabase__generate_typescript_types` — never edit it by hand.
- New tables auto-enable RLS; a table without an explicit public-read policy returns 0 rows to anon and RPCs return `[]` silently — always add the read policy.
- Client-facing RPCs: `SECURITY DEFINER`, `set search_path = public`, `revoke all ... from public, anon`, then explicit `grant execute ... to ...`.
- PostgREST caps at 1000 rows — always `.limit()`. `heroes` has 3,000+ rows.
- Fonts: `Flame-Regular` (display), `FlameSans-Regular` (UI body), `Nunito_*` (UI). **Never `Flame-Bold`** (unreadable).
- Styles: `StyleSheet.create`, no inline style objects except `StyleSheet.absoluteFill`.
- Platform pairs (`foo.tsx` / `foo.web.tsx`): both must exist or expo-router throws; shared fetch/state lives in a platform-neutral hook, never duplicated across the pair.
- Reference mockups for exact layout/animation values: `.superpowers/brainstorm/3824-1782115094/content/layouts-animated.html`.
- Palette: `COLORS.navy #293C43`, `COLORS.beige #f5ebdc`, `COLORS.goldAccent #CE9B33`, `COLORS.red #B5302B`, `COLORS.blue #15A1AB`.

---

## File Structure

**Migrations (new):**
- `supabase/migrations/<ts>_create_teams_and_members.sql` — tables, indexes, RLS, `rebuild_teams()`, `get_team_roster()`
- `supabase/migrations/<ts>_team_synergy_rpc.sql` — `get_team_synergy()`
- `supabase/migrations/<ts>_team_verdicts.sql` — verdict cache (mirror of `verdicts`)
- `supabase/migrations/<ts>_team_battle_votes.sql` — votes table + tally/cast RPCs (mirror of `matchup_votes`)
- `supabase/migrations/<ts>_seed_featured_teams.sql` — mark ~16 canonical teams featured + logos

**Source (new):**
- `src/lib/teamBattle.ts` — pure resolution engine
- `src/lib/db/teams.ts` — roster + synergy + vote + daily-pick reads
- `src/lib/api.ts` (modify) — add `generateTeamVerdict`
- `src/lib/db/teamVerdicts.ts` — `getCachedTeamVerdict`
- `supabase/functions/generate-team-verdict/index.ts` — AI verdict for team pairs
- `src/hooks/useTeamBattle.ts` — shared native/web data hook
- `src/components/versus/TeamRosterColumn.tsx`, `TugMeter.tsx` — shared-ish presentational pieces (native)
- `src/components/web/versus/TeamClashStage.tsx` — web stage
- `app/versus/team/[battleId].tsx` + `.web.tsx` — the clash page
- `app/(tabs)/versus.tsx` + `.web.tsx` (modify) — featured team-battle card

**Tests (new):**
- `__tests__/lib/teamBattle.test.ts`
- `__tests__/lib/db/teams.test.ts`
- `__tests__/lib/api.teamVerdict.test.ts`

**Types:** `src/types/index.ts` (modify) — `Team`, `TeamMember` derived from generated types.

---

## Task 1: Teams + members tables, rebuild, roster read

**Files:**
- Create: `supabase/migrations/<ts>_create_teams_and_members.sql`
- Verify via: `mcp__supabase__execute_sql`

**Interfaces:**
- Produces (SQL): table `public.teams(id text pk, name, publisher, logo_url, member_count int, popularity bigint, is_featured bool, updated_at)`; table `public.team_members(team_id, hero_id, rank, pk(team_id,hero_id))`; function `rebuild_teams() returns void`; function `get_team_roster(p_team_id text, p_limit int) returns table(...)`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/<ts>_create_teams_and_members.sql` (use a real UTC timestamp for `<ts>`, e.g. `20260622130000`):

```sql
-- Team catalogue — a derived, rebuildable mirror of the hero layer.
-- heroes.teams[] is the source of truth; teams/team_members are projections of
-- it, rebuilt set-based by rebuild_teams(). Sibling of hero_relationships.
-- teams is UPSERT-stable (never truncated) because team_battle_votes/team_verdicts
-- reference team ids; only logo_url and is_featured are human-curated.

create table if not exists public.teams (
  id           text primary key,             -- stable slug e.g. 'avengers'
  name         text not null,
  publisher    text,
  logo_url     text,
  member_count integer not null default 0,
  popularity   bigint  not null default 0,   -- sum of members' issue_count
  is_featured  boolean not null default false,
  updated_at   timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id text not null references public.teams(id) on delete cascade,
  hero_id text not null references public.heroes(id) on delete cascade,
  rank    integer,
  primary key (team_id, hero_id)
);
create index if not exists team_members_team_idx on public.team_members (team_id, rank);
create index if not exists team_members_hero_idx on public.team_members (hero_id);

alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

drop policy if exists teams_public_read on public.teams;
create policy teams_public_read on public.teams for select using (true);
drop policy if exists team_members_public_read on public.team_members;
create policy team_members_public_read on public.team_members for select using (true);

-- Slugify a team name → stable id. Lowercase, alnum→'-', collapse repeats, trim.
create or replace function public.slugify_team(p_name text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
$$;

-- Rebuild the whole team catalogue from heroes.teams[]. Idempotent.
-- Upserts teams (preserving curated logo_url + is_featured), regenerates members.
create or replace function public.rebuild_teams()
returns void language plpgsql
set search_path = public
as $$
begin
  -- 1. Upsert team rows from distinct, non-empty team names.
  with exploded as (
    select trim(t) as name, h.publisher, h.issue_count
    from public.heroes h
    cross join lateral unnest(h.teams) as t
    where h.teams is not null and length(trim(t)) > 1
  ),
  agg as (
    select slugify_team(name) as id,
           min(name) as name,
           mode() within group (order by publisher) as publisher,
           count(*) as member_count,
           coalesce(sum(issue_count), 0)::bigint as popularity
    from exploded
    where slugify_team(name) <> ''
    group by slugify_team(name)
  )
  insert into public.teams (id, name, publisher, member_count, popularity, updated_at)
  select id, name, publisher, member_count, popularity, now() from agg
  on conflict (id) do update set
    name = excluded.name,
    publisher = excluded.publisher,
    member_count = excluded.member_count,
    popularity = excluded.popularity,
    updated_at = now();
  -- (logo_url and is_featured are intentionally NOT overwritten.)

  -- 2. Regenerate member edges, ranked by hero popularity, bounded to 40.
  truncate public.team_members;
  insert into public.team_members (team_id, hero_id, rank)
  select team_id, hero_id, rank from (
    select slugify_team(trim(t)) as team_id, h.id as hero_id,
           row_number() over (partition by slugify_team(trim(t))
                              order by h.issue_count desc nulls last) as rank
    from public.heroes h
    cross join lateral unnest(h.teams) as t
    where h.teams is not null and length(trim(t)) > 1 and slugify_team(trim(t)) <> ''
  ) ranked
  where rank <= 40;
end;
$$;

-- Read a team's roster joined to hero stats, ranked.
create or replace function public.get_team_roster(p_team_id text, p_limit integer default 5)
returns table (
  id text, name text, image_url text, portrait_url text, publisher text,
  intelligence int, strength int, speed int, durability int, power int, combat int,
  rank integer
)
language sql stable
set search_path = public
as $$
  select h.id, h.name, h.image_url, h.portrait_url, h.publisher,
         h.intelligence, h.strength, h.speed, h.durability, h.power, h.combat,
         m.rank
  from public.team_members m
  join public.heroes h on h.id = m.hero_id
  where m.team_id = p_team_id
  order by m.rank asc nulls last
  limit p_limit;
$$;

grant execute on function public.rebuild_teams()                     to service_role;
grant execute on function public.slugify_team(text)                  to anon, authenticated, service_role;
grant execute on function public.get_team_roster(text, integer)      to anon, authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with name `create_teams_and_members` and the SQL above.

- [ ] **Step 3: Run the rebuild and verify**

Use `mcp__supabase__execute_sql`:

```sql
select public.rebuild_teams();
select id, name, member_count, popularity from public.teams order by popularity desc limit 5;
```
Expected: ≥5 rows; recognizable teams (e.g. `avengers`, `x-men`, `justice-league`) near the top with member_count > 1.

- [ ] **Step 4: Verify roster read**

```sql
select id, name, intelligence, strength, rank from public.get_team_roster('avengers', 5);
```
Expected: up to 5 Avengers with stat columns, ordered by rank. (If `avengers` slug absent, pick a slug from Step 3's output.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): teams + team_members derived from heroes.teams[]"
```

---

## Task 2: `get_team_synergy` RPC

**Files:**
- Create: `supabase/migrations/<ts>_team_synergy_rpc.sql`
- Verify via: `mcp__supabase__execute_sql`

**Interfaces:**
- Produces (SQL): `get_team_synergy(p_hero_ids text[]) returns json` with shape `{ teammate_links:{count,max,pct}, shared_affiliation:{team,coverage,pct}, role_balance:{archetypes,pct}, total_pct }`. `pct` values are 0..1; `total_pct` capped at 0.25; 0 for a roster of < 2.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/<ts>_team_synergy_rpc.sql`:

```sql
-- Transparent synergy for ANY roster (curated or drafted). Three components,
-- each a bounded fraction; the breakdown doubles as the UI explanation.
-- Weights are named constants here so they tune in one place.
create or replace function public.get_team_synergy(p_hero_ids text[])
returns json language plpgsql stable security definer
set search_path = public
as $$
declare
  W_LINKS constant numeric := 0.12;  -- full teammate-link weight
  W_AFFIL constant numeric := 0.06;  -- full shared-affiliation weight
  W_ROLE  constant numeric := 0.04;  -- full role-balance weight
  CAP     constant numeric := 0.25;
  n              int;
  max_pairs      int;
  link_count     int := 0;
  links_pct      numeric := 0;
  affil_team     text := null;
  affil_coverage int := 0;
  affil_pct      numeric := 0;
  archetypes     int := 0;
  role_pct       numeric := 0;
  total          numeric := 0;
begin
  n := coalesce(array_length(p_hero_ids, 1), 0);
  if n < 2 then
    return json_build_object(
      'teammate_links', json_build_object('count', 0, 'max', 0, 'pct', 0),
      'shared_affiliation', json_build_object('team', null, 'coverage', 0, 'pct', 0),
      'role_balance', json_build_object('archetypes', case when n = 1 then 1 else 0 end, 'pct', 0),
      'total_pct', 0
    );
  end if;
  max_pairs := n * (n - 1) / 2;

  -- teammate links: distinct unordered pairs in the set with a teammate edge.
  select count(*) into link_count
  from (
    select distinct least(r.hero_id, r.related_id) a, greatest(r.hero_id, r.related_id) b
    from public.hero_relationships r
    where r.kind = 'teammate'
      and r.hero_id = any(p_hero_ids)
      and r.related_id = any(p_hero_ids)
  ) pairs;
  links_pct := W_LINKS * (link_count::numeric / max_pairs);

  -- shared affiliation: the team in heroes.teams[] covering the most members.
  select trim(t), count(*) into affil_team, affil_coverage
  from public.heroes h
  cross join lateral unnest(h.teams) as t
  where h.id = any(p_hero_ids) and length(trim(t)) > 1
  group by trim(t)
  order by count(*) desc
  limit 1;
  affil_coverage := coalesce(affil_coverage, 0);
  affil_pct := case when affil_coverage >= 2 then W_AFFIL * (affil_coverage::numeric / n) else 0 end;

  -- role balance: distinct dominant-stat archetypes across the roster.
  select count(distinct dom) into archetypes
  from (
    select (select k from (values
      ('intelligence', h.intelligence),('strength', h.strength),('speed', h.speed),
      ('durability', h.durability),('power', h.power),('combat', h.combat)
    ) as s(k, v) order by v desc nulls last limit 1) as dom
    from public.heroes h where h.id = any(p_hero_ids)
  ) doms;
  role_pct := W_ROLE * (archetypes::numeric / n);

  total := least(CAP, links_pct + affil_pct + role_pct);

  return json_build_object(
    'teammate_links', json_build_object('count', link_count, 'max', max_pairs, 'pct', round(links_pct, 4)),
    'shared_affiliation', json_build_object('team', affil_team, 'coverage', affil_coverage, 'pct', round(affil_pct, 4)),
    'role_balance', json_build_object('archetypes', archetypes, 'pct', round(role_pct, 4)),
    'total_pct', round(total, 4)
  );
end;
$$;

revoke all on function public.get_team_synergy(text[]) from public;
grant execute on function public.get_team_synergy(text[]) to anon, authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

`mcp__supabase__apply_migration`, name `team_synergy_rpc`.

- [ ] **Step 3: Verify with a real roster**

```sql
select public.get_team_synergy(array(select hero_id from public.get_team_roster('avengers', 4)));
```
Expected: a json object; `total_pct` between 0 and 0.25; `teammate_links.max` = 6 (4 choose 2); `shared_affiliation.coverage` ≥ 2.

- [ ] **Step 4: Verify the solo case**

```sql
select public.get_team_synergy(array['<any-single-hero-id>']);
```
Expected: `total_pct` = 0, `teammate_links.count` = 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): get_team_synergy RPC (teammate links + affiliation + role balance)"
```

---

## Task 3: `team_verdicts` cache table

**Files:**
- Create: `supabase/migrations/<ts>_team_verdicts.sql`

**Interfaces:**
- Produces (SQL): table `public.team_verdicts(team_a_id text, team_b_id text, verdict text, created_at, pk(team_a_id,team_b_id))`, public read, anon insert. Normalized `team_a_id <= team_b_id`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/<ts>_team_verdicts.sql`:

```sql
-- AI verdict cache for team pairs. Mirror of public.verdicts; normalized key
-- (team_a_id <= team_b_id) so A-vs-B and B-vs-A share one row.
create table if not exists public.team_verdicts (
  team_a_id  text not null,
  team_b_id  text not null,
  verdict    text not null,
  created_at timestamptz not null default now(),
  primary key (team_a_id, team_b_id),
  constraint team_verdicts_pair_ordered check (team_a_id <= team_b_id)
);

alter table public.team_verdicts enable row level security;
drop policy if exists team_verdicts_select on public.team_verdicts;
create policy team_verdicts_select on public.team_verdicts for select using (true);
drop policy if exists team_verdicts_insert on public.team_verdicts;
create policy team_verdicts_insert on public.team_verdicts for insert with check (true);
```

- [ ] **Step 2: Apply the migration**

`mcp__supabase__apply_migration`, name `team_verdicts`.

- [ ] **Step 3: Verify**

```sql
insert into public.team_verdicts(team_a_id, team_b_id, verdict) values ('avengers','justice-league','test');
select verdict from public.team_verdicts where team_a_id='avengers' and team_b_id='justice-league';
delete from public.team_verdicts where verdict='test';
```
Expected: returns `test`, then the delete cleans up.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): team_verdicts cache (mirror of verdicts)"
```

---

## Task 4: `team_battle_votes` + tally/cast RPCs

**Files:**
- Create: `supabase/migrations/<ts>_team_battle_votes.sql`

**Interfaces:**
- Produces (SQL): table `public.team_battle_votes(team_a_id, team_b_id, user_id, picked_team_id, created_at, pk(team_a_id,team_b_id,user_id))`; `get_team_battle_tally(p_a, p_b) returns json` (`{votes_a,votes_b,total,my_pick}`); `cast_team_battle_vote(p_a, p_b, p_picked) returns json`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/<ts>_team_battle_votes.sql`:

```sql
-- "Which team wins?" votes. Verbatim mirror of matchup_votes, keyed on team ids.
create table if not exists public.team_battle_votes (
  team_a_id      text not null,
  team_b_id      text not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  picked_team_id text not null,
  created_at     timestamptz not null default now(),
  primary key (team_a_id, team_b_id, user_id),
  constraint team_battle_votes_pair_ordered check (team_a_id <= team_b_id),
  constraint team_battle_votes_pick_in_pair check (picked_team_id in (team_a_id, team_b_id))
);
create index if not exists team_battle_votes_user_idx on public.team_battle_votes (user_id);

alter table public.team_battle_votes enable row level security;
drop policy if exists team_battle_votes_own_select on public.team_battle_votes;
create policy team_battle_votes_own_select on public.team_battle_votes
  for select to authenticated using (user_id = auth.uid());
drop policy if exists team_battle_votes_own_write on public.team_battle_votes;
create policy team_battle_votes_own_write on public.team_battle_votes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.get_team_battle_tally(p_a text, p_b text)
returns json language sql security definer set search_path = public stable as $$
  with norm as (select least(p_a, p_b) lo, greatest(p_a, p_b) hi)
  select json_build_object(
    'votes_a', count(*) filter (where v.picked_team_id = p_a),
    'votes_b', count(*) filter (where v.picked_team_id = p_b),
    'total',   count(v.picked_team_id),
    'my_pick', max(v.picked_team_id) filter (where v.user_id = auth.uid())
  )
  from norm n
  left join public.team_battle_votes v on v.team_a_id = n.lo and v.team_b_id = n.hi;
$$;

create or replace function public.cast_team_battle_vote(p_a text, p_b text, p_picked text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_lo text := least(p_a, p_b);
  v_hi text := greatest(p_a, p_b);
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_picked is distinct from p_a and p_picked is distinct from p_b then
    raise exception 'pick must be one of the two teams';
  end if;
  insert into public.team_battle_votes (team_a_id, team_b_id, user_id, picked_team_id, created_at)
  values (v_lo, v_hi, v_uid, p_picked, now())
  on conflict (team_a_id, team_b_id, user_id)
  do update set picked_team_id = excluded.picked_team_id, created_at = now();
  return public.get_team_battle_tally(p_a, p_b);
end;
$$;

revoke all on function public.get_team_battle_tally(text, text)        from public, anon;
revoke all on function public.cast_team_battle_vote(text, text, text)  from public, anon;
grant execute on function public.get_team_battle_tally(text, text)       to authenticated, service_role;
grant execute on function public.cast_team_battle_vote(text, text, text) to authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

`mcp__supabase__apply_migration`, name `team_battle_votes`.

- [ ] **Step 3: Verify the tally read (anon-safe shape)**

```sql
select public.get_team_battle_tally('avengers','justice-league');
```
Expected: `{"votes_a":0,"votes_b":0,"total":0,"my_pick":null}`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): team_battle_votes + tally/cast RPCs (mirror of matchup_votes)"
```

---

## Task 5: Seed featured teams + regenerate types

**Files:**
- Create: `supabase/migrations/<ts>_seed_featured_teams.sql`
- Modify: `src/types/database.generated.ts` (regenerated), `src/types/index.ts`

**Interfaces:**
- Produces (TS): `export type Team = Tables<'teams'>;` and `export type TeamMember = Tables<'team_members'>;` in `src/types/index.ts`.

- [ ] **Step 1: Inspect which slugs exist**

`mcp__supabase__execute_sql`:
```sql
select id, name, member_count, popularity from public.teams
where id in ('avengers','x-men','justice-league','teen-titans','fantastic-four',
             'guardians-of-the-galaxy','suicide-squad','the-defenders','x-force',
             'justice-league-of-america','injustice-league','sinister-six',
             'inhumans','eternals','thunderbolts','young-avengers','new-mutants',
             'legion-of-super-heroes','birds-of-prey','watchmen')
order by popularity desc;
```
Note which slugs are present (member_count ≥ 3). Use those in Step 2.

- [ ] **Step 2: Write the seed migration**

Create `supabase/migrations/<ts>_seed_featured_teams.sql` — mark the slugs that exist (from Step 1) featured. Include only present slugs:

```sql
-- Curate the daily-battle pool. is_featured gates which teams the deterministic
-- daily pick can draw from. logo_url left null for now (UI falls back to a
-- monogram); a later pass attaches art. Re-runnable.
update public.teams set is_featured = true
where id in (
  'avengers','x-men','justice-league','teen-titans','fantastic-four',
  'guardians-of-the-galaxy','suicide-squad','the-defenders',
  'inhumans','eternals','thunderbolts','new-mutants','birds-of-prey'
) and member_count >= 3;
```

- [ ] **Step 3: Apply and verify**

Apply via `mcp__supabase__apply_migration` (name `seed_featured_teams`), then:
```sql
select count(*) from public.teams where is_featured;
```
Expected: ≥ 6 featured teams. (If fewer, broaden the slug list using Step 1's output and re-apply.)

- [ ] **Step 4: Regenerate generated types**

Run `mcp__supabase__generate_typescript_types` and overwrite `src/types/database.generated.ts` with the result.

- [ ] **Step 5: Add app types**

In `src/types/index.ts`, add near the other `Tables<>` derivations:

```ts
export type Team = Tables<'teams'>;
export type TeamMember = Tables<'team_members'>;
```

- [ ] **Step 6: Typecheck + commit**

```bash
yarn tsc --noEmit
git add supabase/migrations src/types/database.generated.ts src/types/index.ts
git commit -m "feat(db): seed featured teams; regenerate types; add Team app types"
```
Expected: `tsc` exits 0.

---

## Task 6: Pure resolution engine `src/lib/teamBattle.ts`

**Files:**
- Create: `src/lib/teamBattle.ts`
- Test: `__tests__/lib/teamBattle.test.ts`

**Interfaces:**
- Consumes: `StatResult` shape from `src/lib/compare.ts` (`{ key, label, color, valueA, valueB, winner }`).
- Produces (TS):
  ```ts
  export interface SynergyBreakdown {
    teammate_links: { count: number; max: number; pct: number };
    shared_affiliation: { team: string | null; coverage: number; pct: number };
    role_balance: { archetypes: number; pct: number };
    total_pct: number;
  }
  export interface RosterHero { id: string; name: string;
    portrait_url?: string|null; image_url?: string|null;
    intelligence: number|null; strength: number|null; speed: number|null;
    durability: number|null; power: number|null; combat: number|null; }
  export interface TeamSide {
    team: { id: string; name: string; publisher: string|null; logo_url: string|null } | null;
    roster: RosterHero[]; synergy: SynergyBreakdown; }
  export interface TeamStatResult { key: string; label: string; color: string;
    avgA: number; avgB: number; winner: 'A'|'B'|'tie'; }
  export interface TeamBattleResult {
    stats: TeamStatResult[]; powerA: number; powerB: number;
    splitA: number; splitB: number; winsA: number; winsB: number; verdict: string; }
  export function resolveTeamBattle(a: TeamSide, b: TeamSide): TeamBattleResult;
  ```

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/teamBattle.test.ts`:

```ts
import { resolveTeamBattle, type TeamSide, type SynergyBreakdown } from '../../src/lib/teamBattle';

const noSyn: SynergyBreakdown = {
  teammate_links: { count: 0, max: 0, pct: 0 },
  shared_affiliation: { team: null, coverage: 0, pct: 0 },
  role_balance: { archetypes: 0, pct: 0 },
  total_pct: 0,
};
const hero = (id: string, s: number) => ({
  id, name: id, intelligence: s, strength: s, speed: s, durability: s, power: s, combat: s,
});
const side = (ids: [string, number][], total_pct = 0): TeamSide => ({
  team: { id: 'x', name: 'X', publisher: null, logo_url: null },
  roster: ids.map(([id, s]) => hero(id, s)),
  synergy: { ...noSyn, total_pct },
});

describe('resolveTeamBattle', () => {
  it('returns 6 stat rows', () => {
    const r = resolveTeamBattle(side([['a', 80]]), side([['b', 60]]));
    expect(r.stats).toHaveLength(6);
  });

  it('averages stats — a 3-roster of 60s does not beat a solo 80 on raw stats', () => {
    const r = resolveTeamBattle(side([['s', 80]]), side([['a', 60], ['b', 60], ['c', 60]]));
    expect(r.stats[0].winner).toBe('A'); // 80 avg vs 60 avg
    expect(r.winsA).toBe(6);
  });

  it('synergy boost can flip a close raw-stat deficit', () => {
    const r = resolveTeamBattle(side([['a', 70]], 0), side([['b', 72]], 0.2));
    expect(r.splitB).toBeGreaterThan(r.splitA); // B's 20% synergy overcomes the 2pt gap
  });

  it('split sums to ~100', () => {
    const r = resolveTeamBattle(side([['a', 70]], 0.1), side([['b', 50]], 0));
    expect(r.splitA + r.splitB).toBe(100);
  });

  it('treats null stats as 0', () => {
    const a: TeamSide = { team: null, roster: [{ id: 'a', name: 'a',
      intelligence: null, strength: null, speed: null, durability: null, power: null, combat: null }],
      synergy: noSyn };
    const r = resolveTeamBattle(a, side([['b', 10]]));
    expect(r.winsB).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:ci __tests__/lib/teamBattle.test.ts`
Expected: FAIL — cannot find module `../../src/lib/teamBattle`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/teamBattle.ts`:

```ts
import { COLORS } from '../constants/colors';

export interface SynergyBreakdown {
  teammate_links: { count: number; max: number; pct: number };
  shared_affiliation: { team: string | null; coverage: number; pct: number };
  role_balance: { archetypes: number; pct: number };
  total_pct: number;
}
export interface RosterHero {
  id: string; name: string;
  intelligence: number | null; strength: number | null; speed: number | null;
  durability: number | null; power: number | null; combat: number | null;
}
export interface TeamSide {
  team: { id: string; name: string; publisher: string | null; logo_url: string | null } | null;
  roster: RosterHero[];
  synergy: SynergyBreakdown;
}
export interface TeamStatResult {
  key: string; label: string; color: string; avgA: number; avgB: number; winner: 'A' | 'B' | 'tie';
}
export interface TeamBattleResult {
  stats: TeamStatResult[]; powerA: number; powerB: number;
  splitA: number; splitB: number; winsA: number; winsB: number; verdict: string;
}

const STAT_CONFIG = [
  { key: 'intelligence', label: 'Intelligence', color: COLORS.blue },
  { key: 'strength', label: 'Strength', color: COLORS.red },
  { key: 'speed', label: 'Speed', color: COLORS.yellow },
  { key: 'durability', label: 'Durability', color: COLORS.green },
  { key: 'power', label: 'Power', color: COLORS.orange },
  { key: 'combat', label: 'Combat', color: COLORS.brown },
] as const;

function avg(roster: RosterHero[], key: keyof RosterHero): number {
  if (roster.length === 0) return 0;
  const sum = roster.reduce((acc, h) => acc + (Number(h[key]) || 0), 0);
  return Math.round(sum / roster.length);
}

/** Size-neutral averaged composite + synergy boost → per-stat winners and the
 *  power split (the tug-of-war meter). Pure; no DB. */
export function resolveTeamBattle(a: TeamSide, b: TeamSide): TeamBattleResult {
  const stats: TeamStatResult[] = STAT_CONFIG.map(({ key, label, color }) => {
    const avgA = avg(a.roster, key as keyof RosterHero);
    const avgB = avg(b.roster, key as keyof RosterHero);
    const winner: 'A' | 'B' | 'tie' = avgA > avgB ? 'A' : avgB > avgA ? 'B' : 'tie';
    return { key, label, color, avgA, avgB, winner };
  });

  const winsA = stats.filter((s) => s.winner === 'A').length;
  const winsB = stats.filter((s) => s.winner === 'B').length;

  const baseA = stats.reduce((acc, s) => acc + s.avgA, 0);
  const baseB = stats.reduce((acc, s) => acc + s.avgB, 0);
  const powerA = baseA * (1 + a.synergy.total_pct);
  const powerB = baseB * (1 + b.synergy.total_pct);

  const tot = powerA + powerB;
  const splitA = tot > 0 ? Math.round((powerA / tot) * 100) : 50;
  const splitB = 100 - splitA;

  const nameA = a.team?.name ?? 'Team A';
  const nameB = b.team?.name ?? 'Team B';
  const verdict =
    splitA > splitB
      ? `${nameA} take it — synergy and stats favour them.`
      : splitB > splitA
        ? `${nameB} take it — synergy and stats favour them.`
        : `${nameA} and ${nameB} are dead even.`;

  return { stats, powerA, powerB, splitA, splitB, winsA, winsB, verdict };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:ci __tests__/lib/teamBattle.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/teamBattle.ts __tests__/lib/teamBattle.test.ts
git commit -m "feat(versus): pure team-battle resolution engine + tests"
```

---

## Task 7: DB read layer `src/lib/db/teams.ts`

**Files:**
- Create: `src/lib/db/teams.ts`
- Test: `__tests__/lib/db/teams.test.ts`

**Interfaces:**
- Consumes: `supabase` from `../supabase`; `SynergyBreakdown`, `RosterHero` from `../teamBattle`.
- Produces (TS):
  ```ts
  export interface FeaturedTeam { id: string; name: string; publisher: string|null; logo_url: string|null; popularity: number; }
  export interface TodaysTeamBattle { teamA: FeaturedTeam; teamB: FeaturedTeam; }
  export function pickDailyTeamPair(teams: FeaturedTeam[], seed?: number): TodaysTeamBattle | null;
  export function getFeaturedTeams(): Promise<FeaturedTeam[]>;
  export function getTodaysTeamBattle(): Promise<TodaysTeamBattle | null>;
  export function getTeamRoster(teamId: string, limit?: number): Promise<RosterHero[]>;
  export function getTeamSynergy(heroIds: string[]): Promise<SynergyBreakdown>;
  export function getTeamBattleTally(a: string, b: string): Promise<{ votesA: number; votesB: number; total: number; myPick: string|null } | null>;
  export function castTeamBattleVote(a: string, b: string, picked: string): Promise<{ votesA: number; votesB: number; total: number; myPick: string|null } | null>;
  ```

- [ ] **Step 1: Write the failing test (pure daily-pick logic)**

Create `__tests__/lib/db/teams.test.ts`:

```ts
import { pickDailyTeamPair, type FeaturedTeam } from '../../../src/lib/db/teams';

const teams: FeaturedTeam[] = ['avengers', 'x-men', 'justice-league', 'teen-titans'].map(
  (id, i) => ({ id, name: id, publisher: null, logo_url: null, popularity: 100 - i }),
);

describe('pickDailyTeamPair', () => {
  it('returns null with fewer than 2 teams', () => {
    expect(pickDailyTeamPair([teams[0]])).toBeNull();
  });

  it('is deterministic for a given seed', () => {
    const a = pickDailyTeamPair(teams, 20260622);
    const b = pickDailyTeamPair(teams, 20260622);
    expect(a).toEqual(b);
  });

  it('never pairs a team with itself', () => {
    for (let s = 0; s < 50; s++) {
      const pair = pickDailyTeamPair(teams, 20260600 + s);
      expect(pair!.teamA.id).not.toEqual(pair!.teamB.id);
    }
  });

  it('changes the pair across consecutive days', () => {
    const d1 = pickDailyTeamPair(teams, 20260622);
    const d2 = pickDailyTeamPair(teams, 20260623);
    expect([d1!.teamA.id, d1!.teamB.id]).not.toEqual([d2!.teamA.id, d2!.teamB.id]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:ci __tests__/lib/db/teams.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

Create `src/lib/db/teams.ts`:

```ts
import { supabase } from '../supabase';
import type { SynergyBreakdown, RosterHero } from '../teamBattle';

export interface FeaturedTeam {
  id: string; name: string; publisher: string | null; logo_url: string | null; popularity: number;
}
export interface TodaysTeamBattle { teamA: FeaturedTeam; teamB: FeaturedTeam; }
export interface TeamTally { votesA: number; votesB: number; total: number; myPick: string | null; }

// Same daily-seed convention as src/lib/matchup.ts: same pair all day, new tomorrow.
function dailySeed(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Deterministically pick two distinct featured teams for a day. Pure + tested. */
export function pickDailyTeamPair(teams: FeaturedTeam[], seed = dailySeed()): TodaysTeamBattle | null {
  if (teams.length < 2) return null;
  const iA = seed % teams.length;
  let iB = (seed * 7 + 3) % teams.length;
  if (iB === iA) iB = (iB + 1) % teams.length;
  return { teamA: teams[iA], teamB: teams[iB] };
}

export async function getFeaturedTeams(): Promise<FeaturedTeam[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, publisher, logo_url, popularity')
    .eq('is_featured', true)
    .order('popularity', { ascending: false, nullsFirst: false })
    .limit(40);
  if (error) {
    console.warn('[getFeaturedTeams] error:', error.message);
    return [];
  }
  return (data ?? []) as FeaturedTeam[];
}

export async function getTodaysTeamBattle(): Promise<TodaysTeamBattle | null> {
  const teams = await getFeaturedTeams();
  return pickDailyTeamPair(teams);
}

export async function getTeamRoster(teamId: string, limit = 5): Promise<RosterHero[]> {
  const { data, error } = await supabase.rpc('get_team_roster', { p_team_id: teamId, p_limit: limit });
  if (error) {
    console.warn('[getTeamRoster] error:', error.message);
    return [];
  }
  return (data ?? []) as RosterHero[];
}

const EMPTY_SYNERGY: SynergyBreakdown = {
  teammate_links: { count: 0, max: 0, pct: 0 },
  shared_affiliation: { team: null, coverage: 0, pct: 0 },
  role_balance: { archetypes: 0, pct: 0 },
  total_pct: 0,
};

export async function getTeamSynergy(heroIds: string[]): Promise<SynergyBreakdown> {
  if (heroIds.length < 2) return EMPTY_SYNERGY;
  const { data, error } = await supabase.rpc('get_team_synergy', { p_hero_ids: heroIds });
  if (error || !data) {
    console.warn('[getTeamSynergy] error:', error?.message);
    return EMPTY_SYNERGY;
  }
  return data as unknown as SynergyBreakdown;
}

function toTally(data: unknown): TeamTally {
  const d = (data ?? {}) as { votes_a?: number; votes_b?: number; total?: number; my_pick?: string | null };
  return { votesA: d.votes_a ?? 0, votesB: d.votes_b ?? 0, total: d.total ?? 0, myPick: d.my_pick ?? null };
}

export async function getTeamBattleTally(a: string, b: string): Promise<TeamTally | null> {
  const { data, error } = await supabase.rpc('get_team_battle_tally', { p_a: a, p_b: b });
  if (error) {
    console.warn('[getTeamBattleTally] error:', error.message);
    return null;
  }
  return toTally(data);
}

export async function castTeamBattleVote(a: string, b: string, picked: string): Promise<TeamTally | null> {
  const { data, error } = await supabase.rpc('cast_team_battle_vote', { p_a: a, p_b: b, p_picked: picked });
  if (error) {
    console.warn('[castTeamBattleVote] error:', error.message);
    return null;
  }
  return toTally(data);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:ci __tests__/lib/db/teams.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
yarn tsc --noEmit
git add src/lib/db/teams.ts __tests__/lib/db/teams.test.ts
git commit -m "feat(versus): teams DB read layer + deterministic daily pair + tests"
```

---

## Task 8: Team verdict — edge function + client cache

**Files:**
- Create: `supabase/functions/generate-team-verdict/index.ts`
- Create: `src/lib/db/teamVerdicts.ts`
- Modify: `src/lib/api.ts` (add `generateTeamVerdict`)
- Test: `__tests__/lib/api.teamVerdict.test.ts`

**Interfaces:**
- Consumes: `supabase` (db + functions.invoke).
- Produces (TS):
  ```ts
  // src/lib/db/teamVerdicts.ts
  export function getCachedTeamVerdict(teamAId: string, teamBId: string): Promise<string | null>;
  // src/lib/api.ts
  export interface TeamVerdictInput { teamAId: string; teamBId: string; teamA: string; teamB: string; splitA: number; splitB: number; }
  export function generateTeamVerdict(input: TeamVerdictInput): Promise<string>;
  ```

- [ ] **Step 1: Write the failing test (fallback when the function errors)**

Create `__tests__/lib/api.teamVerdict.test.ts`:

```ts
const invokeMock = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invokeMock(...a) } },
}));

import { generateTeamVerdict } from '../../src/lib/api';

describe('generateTeamVerdict', () => {
  beforeEach(() => invokeMock.mockReset());

  it('returns the function verdict when present', async () => {
    invokeMock.mockResolvedValue({ data: { verdict: 'Avengers edge it.' }, error: null });
    const v = await generateTeamVerdict({ teamAId: 'avengers', teamBId: 'justice-league',
      teamA: 'Avengers', teamB: 'Justice League', splitA: 60, splitB: 40 });
    expect(v).toBe('Avengers edge it.');
  });

  it('falls back to a deterministic line when the function errors', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const v = await generateTeamVerdict({ teamAId: 'avengers', teamBId: 'justice-league',
      teamA: 'Avengers', teamB: 'Justice League', splitA: 60, splitB: 40 });
    expect(v).toContain('Avengers');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:ci __tests__/lib/api.teamVerdict.test.ts`
Expected: FAIL — `generateTeamVerdict` is not exported.

- [ ] **Step 3: Add `generateTeamVerdict` to `src/lib/api.ts`**

Append to `src/lib/api.ts`:

```ts
// --- Team battle verdicts ---------------------------------------------------
export interface TeamVerdictInput {
  teamAId: string; teamBId: string; teamA: string; teamB: string; splitA: number; splitB: number;
}

function teamVerdictFallback(input: TeamVerdictInput): string {
  const { teamA, teamB, splitA, splitB } = input;
  if (splitA === splitB) return `${teamA} and ${teamB} are dead even.`;
  const winner = splitA > splitB ? teamA : teamB;
  return `${winner} take it — synergy and stats favour them.`;
}

export async function generateTeamVerdict(input: TeamVerdictInput): Promise<string> {
  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke<{ verdict?: string }>('generate-team-verdict', { body: input }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 9000)),
    ]);
    if (error || !data) return teamVerdictFallback(input);
    return data.verdict?.trim() || teamVerdictFallback(input);
  } catch {
    return teamVerdictFallback(input);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test:ci __tests__/lib/api.teamVerdict.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the client cache reader**

Create `src/lib/db/teamVerdicts.ts`:

```ts
import { supabase } from '../supabase';

function normalizeKey(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

/** Read the cached AI verdict for a team pair. Null on miss/error. */
export async function getCachedTeamVerdict(teamAId: string, teamBId: string): Promise<string | null> {
  const [a, b] = normalizeKey(teamAId, teamBId);
  const { data } = await supabase
    .from('team_verdicts')
    .select('verdict')
    .eq('team_a_id', a)
    .eq('team_b_id', b)
    .maybeSingle();
  return data?.verdict ?? null;
}
```

- [ ] **Step 6: Write the edge function**

Create `supabase/functions/generate-team-verdict/index.ts` (mirrors `generate-verdict`; read-through cache + write to `team_verdicts`):

```ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_KEY = Deno.env.get('GOOGLE_AI_STUDIO_API_KEY') ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Req { teamAId: string; teamBId: string; teamA: string; teamB: string; splitA: number; splitB: number; }
const norm = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a]);

function fallback(b: Req): string {
  if (b.splitA === b.splitB) return `${b.teamA} and ${b.teamB} are dead even.`;
  return `${b.splitA > b.splitB ? b.teamA : b.teamB} take it — synergy and stats favour them.`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
  try {
    const body: Req = await req.json();
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const [keyA, keyB] = norm(body.teamAId, body.teamBId);

    const { data: cached } = await sb.from('team_verdicts').select('verdict')
      .eq('team_a_id', keyA).eq('team_b_id', keyB).maybeSingle();
    if (cached?.verdict) return json({ verdict: cached.verdict });

    let verdict = fallback(body);
    if (GEMINI_KEY) {
      const prompt = `Two superhero teams clash. ${body.teamA} vs ${body.teamB}. ` +
        `Combined power favours ${body.splitA >= body.splitB ? body.teamA : body.teamB} ` +
        `(${Math.max(body.splitA, body.splitB)}%). In one punchy sentence (<=20 words), call the winner and why.`;
      try {
        const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) verdict = text;
        }
      } catch { /* keep fallback */ }
    }
    await sb.from('team_verdicts').insert({ team_a_id: keyA, team_b_id: keyB, verdict });
    return json({ verdict });
  } catch {
    return json({ verdict: '' }, 200);
  }
});
```

- [ ] **Step 7: Deploy the edge function**

Use `mcp__supabase__deploy_edge_function` with slug `generate-team-verdict` and the file contents above.

- [ ] **Step 8: Typecheck + commit**

```bash
yarn tsc --noEmit
git add src/lib/api.ts src/lib/db/teamVerdicts.ts supabase/functions/generate-team-verdict __tests__/lib/api.teamVerdict.test.ts
git commit -m "feat(versus): team verdict edge function + client cache + tests"
```
Expected: `tsc` exits 0; tests pass.

---

## Task 9: Shared data hook `src/hooks/useTeamBattle.ts`

**Files:**
- Create: `src/hooks/useTeamBattle.ts`

**Interfaces:**
- Consumes: `getTodaysTeamBattle`, `getTeamRoster`, `getTeamSynergy`, `getTeamBattleTally`, `castTeamBattleVote` from `../lib/db/teams`; `getCachedTeamVerdict` from `../lib/db/teamVerdicts`; `generateTeamVerdict` from `../lib/api`; `resolveTeamBattle`, `TeamSide` from `../lib/teamBattle`.
- Produces (TS):
  ```ts
  export interface UseTeamBattle {
    loading: boolean;
    sideA: TeamSide | null; sideB: TeamSide | null;
    result: TeamBattleResult | null;
    tally: { votesA: number; votesB: number; total: number; myPick: string | null } | null;
    vote: (teamId: string) => Promise<void>;
  }
  export function useTeamBattle(battleId?: string): UseTeamBattle;
  ```
- `battleId` format: `"<teamA>-vs-<teamB>"`. When omitted, resolves today's battle.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useTeamBattle.ts`:

```ts
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTodaysTeamBattle, getTeamRoster, getTeamSynergy,
  getTeamBattleTally, castTeamBattleVote, getFeaturedTeams,
  type FeaturedTeam, type TeamTally,
} from '../lib/db/teams';
import { getCachedTeamVerdict } from '../lib/db/teamVerdicts';
import { generateTeamVerdict } from '../lib/api';
import { resolveTeamBattle, type TeamSide, type TeamBattleResult } from '../lib/teamBattle';

export interface UseTeamBattle {
  loading: boolean;
  sideA: TeamSide | null; sideB: TeamSide | null;
  result: TeamBattleResult | null;
  tally: TeamTally | null;
  vote: (teamId: string) => Promise<void>;
}

async function buildSide(team: FeaturedTeam): Promise<TeamSide> {
  const roster = await getTeamRoster(team.id, 5);
  const synergy = await getTeamSynergy(roster.map((h) => h.id));
  return { team: { id: team.id, name: team.name, publisher: team.publisher, logo_url: team.logo_url }, roster, synergy };
}

// "avengers-vs-justice-league" → ["avengers","justice-league"]
function parseBattleId(id: string): [string, string] | null {
  const i = id.indexOf('-vs-');
  if (i < 0) return null;
  return [id.slice(0, i), id.slice(i + 4)];
}

export function useTeamBattle(battleId?: string): UseTeamBattle {
  const qc = useQueryClient();

  const battleQ = useQuery({
    queryKey: ['teamBattle', battleId ?? 'today'],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      let aId: string, bId: string, aName: string, bName: string;
      if (battleId && parseBattleId(battleId)) {
        const teams = await getFeaturedTeams();
        const [pa, pb] = parseBattleId(battleId)!;
        const ta = teams.find((t) => t.id === pa);
        const tb = teams.find((t) => t.id === pb);
        if (!ta || !tb) return null;
        const [sa, sb] = [await buildSide(ta), await buildSide(tb)];
        const result = resolveTeamBattle(sa, sb);
        return { sideA: sa, sideB: sb, result, aId: ta.id, bId: tb.id, aName: ta.name, bName: tb.name };
      }
      const today = await getTodaysTeamBattle();
      if (!today) return null;
      const [sa, sb] = [await buildSide(today.teamA), await buildSide(today.teamB)];
      const result = resolveTeamBattle(sa, sb);
      return { sideA: sa, sideB: sb, result, aId: today.teamA.id, bId: today.teamB.id,
               aName: today.teamA.name, bName: today.teamB.name };
    },
  });

  const b = battleQ.data ?? null;

  // Verdict: cache first, generate on miss. Overrides the deterministic line.
  const verdictQ = useQuery({
    queryKey: ['teamVerdict', b?.aId, b?.bId],
    enabled: !!b,
    staleTime: Infinity,
    queryFn: async () => {
      if (!b) return null;
      const cached = await getCachedTeamVerdict(b.aId, b.bId);
      if (cached) return cached;
      return generateTeamVerdict({
        teamAId: b.aId, teamBId: b.bId, teamA: b.aName, teamB: b.bName,
        splitA: b.result.splitA, splitB: b.result.splitB,
      });
    },
  });

  const tallyQ = useQuery({
    queryKey: ['teamTally', b?.aId, b?.bId],
    enabled: !!b,
    queryFn: () => (b ? getTeamBattleTally(b.aId, b.bId) : Promise.resolve(null)),
  });

  const vote = useCallback(
    async (teamId: string) => {
      if (!b) return;
      const fresh = await castTeamBattleVote(b.aId, b.bId, teamId);
      if (fresh) qc.setQueryData(['teamTally', b.aId, b.bId], fresh);
    },
    [b, qc],
  );

  const result = b
    ? { ...b.result, verdict: verdictQ.data ?? b.result.verdict }
    : null;

  return {
    loading: battleQ.isPending,
    sideA: b?.sideA ?? null,
    sideB: b?.sideB ?? null,
    result,
    tally: tallyQ.data ?? null,
    vote,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTeamBattle.ts
git commit -m "feat(versus): useTeamBattle shared data hook"
```

---

## Task 10: Native clash page `app/versus/team/[battleId].tsx`

**Files:**
- Create: `src/components/versus/TugMeter.tsx`
- Create: `src/components/versus/TeamRosterColumn.tsx`
- Create: `app/versus/team/[battleId].tsx`

**Interfaces:**
- Consumes: `useTeamBattle` from `../../../src/hooks/useTeamBattle`; `TeamSide`, `TeamBattleResult` types.
- Produces: a route at `/versus/team/[battleId]`. `TugMeter({ splitA, splitB, labelA, labelB })`; `TeamRosterColumn({ side, align })`.

Reference `.superpowers/brainstorm/3824-1782115094/content/layouts-animated.html` for exact layout/animation values (deck-deal stagger, CLASH flash, meter charge). Honor reduced-motion by rendering the resting composition directly.

- [ ] **Step 1: Build `TugMeter`**

Create `src/components/versus/TugMeter.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface Props { splitA: number; splitB: number; labelA: string; labelB: string; }

/** The tug-of-war meter — a single bar split toward the stronger team. */
export function TugMeter({ splitA, splitB, labelA, labelB }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.cap}>
        <Text style={[styles.capTxt, { color: COLORS.red }]}>{labelA}</Text>
        <Text style={[styles.capTxt, { color: COLORS.blue }]}>{labelB}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fillA, { width: `${splitA}%` }]} />
        <Text style={[styles.pct, styles.pctL]}>{splitA}%</Text>
        <Text style={[styles.pct, styles.pctR]}>{splitB}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  cap: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  capTxt: { fontFamily: 'Nunito_700Bold', fontSize: 12, letterSpacing: 0.6 },
  track: {
    height: 28, borderRadius: 14, backgroundColor: COLORS.blue, overflow: 'hidden',
    justifyContent: 'center',
  },
  fillA: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.red },
  pct: { position: 'absolute', fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  pctL: { left: 10 },
  pctR: { right: 10 },
});
```

- [ ] **Step 2: Build `TeamRosterColumn`**

Create `src/components/versus/TeamRosterColumn.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import type { TeamSide } from '../../lib/teamBattle';

interface Props { side: TeamSide; align: 'left' | 'right'; }

/** A vertical stack of holo hero cards for one team. */
export function TeamRosterColumn({ side }: Props) {
  return (
    <View style={styles.col}>
      {side.roster.map((h) => (
        <View key={h.id} style={styles.card}>
          {/* portrait_url is null-safe; expo-image renders a blank box if absent */}
          <Image source={{ uri: h.portrait_url ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.plate}>
            <Text style={styles.name} numberOfLines={1}>{h.name}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1, gap: 12 },
  card: {
    width: '100%', aspectRatio: 7 / 9, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#241a36',
  },
  plate: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.6)' },
  name: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: '#fff' },
});
```

Note: `TeamRosterColumn` imports `portrait_url`, so extend `RosterHero` in `src/lib/teamBattle.ts` to include `portrait_url: string | null` and `image_url: string | null`, and add them to the `get_team_roster` select in Task 1 (already selected). Update the `RosterHero` interface accordingly and re-run `yarn test:ci __tests__/lib/teamBattle.test.ts` (the test heroes omit these — make them optional with `?`).

- [ ] **Step 3: Build the screen**

Create `app/versus/team/[battleId].tsx`:

```tsx
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../../src/constants/colors';
import { useTeamBattle } from '../../../src/hooks/useTeamBattle';
import { useAuth } from '../../../src/hooks/useAuth';
import { TeamRosterColumn } from '../../../src/components/versus/TeamRosterColumn';
import { TugMeter } from '../../../src/components/versus/TugMeter';

export default function TeamClashScreen() {
  const { battleId } = useLocalSearchParams<{ battleId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { loading, sideA, sideB, result, tally, vote } = useTeamBattle(battleId);

  const onVote = async (teamId: string) => {
    if (!user) { router.push('/(auth)/login'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await vote(teamId);
  };

  if (loading || !sideA || !sideB || !result) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={COLORS.goldAccent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}>
        <Text style={styles.title}>{sideA.team?.name} vs {sideB.team?.name}</Text>

        <View style={styles.arena}>
          <TeamRosterColumn side={sideA} align="left" />
          <View style={styles.spine}>
            <Text style={styles.vs}>VS</Text>
            <Text style={styles.syn}>+{Math.round(sideA.synergy.total_pct * 100)}%</Text>
            <Text style={styles.syn}>+{Math.round(sideB.synergy.total_pct * 100)}%</Text>
          </View>
          <TeamRosterColumn side={sideB} align="right" />
        </View>

        <View style={styles.foot}>
          <TugMeter splitA={result.splitA} splitB={result.splitB}
            labelA={sideA.team?.name ?? 'A'} labelB={sideB.team?.name ?? 'B'} />
          <Text style={styles.verdict}>{result.verdict}</Text>
          <View style={styles.votes}>
            <Pressable style={[styles.voteBtn, { backgroundColor: COLORS.red }]} onPress={() => onVote(sideA.team!.id)}>
              <Text style={styles.voteTxt}>Vote {sideA.team?.name}</Text>
            </Pressable>
            <Pressable style={[styles.voteBtn, { backgroundColor: COLORS.blue }]} onPress={() => onVote(sideB.team!.id)}>
              <Text style={styles.voteTxt}>Vote {sideB.team?.name}</Text>
            </Pressable>
          </View>
          {tally && tally.total > 0 && (
            <Text style={styles.tally}>{tally.votesA} – {tally.votesB} ({tally.total} votes)</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#181323' },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige, textAlign: 'center', marginBottom: 18, paddingHorizontal: 16 },
  arena: { flexDirection: 'row', paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  spine: { width: 46, alignItems: 'center', gap: 8 },
  vs: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.goldAccent },
  syn: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: COLORS.goldAccent },
  foot: { paddingHorizontal: 20, paddingTop: 24 },
  verdict: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.goldAccent, textAlign: 'center', marginTop: 12 },
  votes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  voteBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  voteTxt: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  tally: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: 'rgba(245,235,220,0.7)', textAlign: 'center', marginTop: 10 },
});
```

- [ ] **Step 4: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0. (If `RosterHero` is missing `portrait_url`, add it per Step 2's note.)

- [ ] **Step 5: Manual verification**

Run `yarn start`, open on a device/simulator, navigate to `/versus/team/avengers-vs-justice-league`. Confirm: two rosters render with portraits, the meter shows a non-50/50 split, a verdict line appears, and tapping a vote button (while signed in) updates the tally; while signed out it routes to login.

- [ ] **Step 6: Commit**

```bash
git add src/components/versus/TugMeter.tsx src/components/versus/TeamRosterColumn.tsx app/versus/team/[battleId].tsx src/lib/teamBattle.ts __tests__/lib/teamBattle.test.ts
git commit -m "feat(versus): native team clash page (rosters + meter + vote)"
```

---

## Task 11: Web clash page `app/versus/team/[battleId].web.tsx`

**Files:**
- Create: `app/versus/team/[battleId].web.tsx`
- Create: `src/components/web/versus/TeamClashStage.tsx`

**Interfaces:**
- Consumes: `useTeamBattle`; reuses `TugMeter` (it's RN-primitive, renders on web).
- Produces: the web route (must exist alongside the native file or expo-router throws).

Mirror the desktop mockup composition (3-up split + composite breakdown panel). Keep it a thin view over `useTeamBattle` — no fetch logic here.

- [ ] **Step 1: Build the web stage**

Create `src/components/web/versus/TeamClashStage.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { TugMeter } from '../../versus/TugMeter';
import type { TeamSide, TeamBattleResult } from '../../../lib/teamBattle';

interface Props {
  sideA: TeamSide; sideB: TeamSide; result: TeamBattleResult;
  onVote: (teamId: string) => void;
  tally: { votesA: number; votesB: number; total: number } | null;
}

function Roster({ side, align }: { side: TeamSide; align: 'flex-start' | 'flex-end' }) {
  return (
    <View style={[styles.row, { justifyContent: align }]}>
      {side.roster.map((h) => (
        <View key={h.id} style={styles.card}>
          <Image source={{ uri: h.portrait_url ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      ))}
    </View>
  );
}

export function TeamClashStage({ sideA, sideB, result, onVote, tally }: Props) {
  return (
    <View style={styles.stage}>
      <View style={styles.teamL}>
        <Text style={[styles.tname, { color: COLORS.red }]}>{sideA.team?.name}</Text>
        <Roster side={sideA} align="flex-start" />
      </View>
      <View style={styles.center}>
        <Text style={styles.clash}>CLASH</Text>
        <TugMeter splitA={result.splitA} splitB={result.splitB}
          labelA={sideA.team?.name ?? 'A'} labelB={sideB.team?.name ?? 'B'} />
        <View style={styles.synRow}>
          <Text style={[styles.syn, { color: COLORS.red }]}>+{Math.round(sideA.synergy.total_pct * 100)}%</Text>
          <Text style={[styles.syn, { color: COLORS.blue }]}>+{Math.round(sideB.synergy.total_pct * 100)}%</Text>
        </View>
        <Text style={styles.verdict}>{result.verdict}</Text>
        <View style={styles.votes}>
          <Pressable style={[styles.voteBtn, { backgroundColor: COLORS.red }]} onPress={() => onVote(sideA.team!.id)}>
            <Text style={styles.voteTxt}>Vote {sideA.team?.name}</Text></Pressable>
          <Pressable style={[styles.voteBtn, { backgroundColor: COLORS.blue }]} onPress={() => onVote(sideB.team!.id)}>
            <Text style={styles.voteTxt}>Vote {sideB.team?.name}</Text></Pressable>
        </View>
        {tally && tally.total > 0 && <Text style={styles.tally}>{tally.votesA} – {tally.votesB}</Text>}
      </View>
      <View style={styles.teamR}>
        <Text style={[styles.tname, { color: COLORS.blue, textAlign: 'right' }]}>{sideB.team?.name}</Text>
        <Roster side={sideB} align="flex-end" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flexDirection: 'row', gap: 30, alignItems: 'center', paddingVertical: 40, paddingHorizontal: 40,
    backgroundColor: '#181323' },
  teamL: { flex: 1 }, teamR: { flex: 1 },
  center: { width: 300, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  card: { width: 84, aspectRatio: 7 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#241a36' },
  tname: { fontFamily: 'Nunito_700Bold', fontSize: 14, marginBottom: 8 },
  clash: { fontFamily: 'Flame-Regular', fontSize: 30, color: COLORS.goldAccent, marginBottom: 16 },
  synRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 },
  syn: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  verdict: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.goldAccent, marginTop: 16, textAlign: 'center' },
  votes: { flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' },
  voteBtn: { flex: 1, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  voteTxt: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },
  tally: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: 'rgba(245,235,220,0.7)', marginTop: 10 },
});
```

- [ ] **Step 2: Build the web route**

Create `app/versus/team/[battleId].web.tsx`:

```tsx
import { ScrollView, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../../src/constants/colors';
import { useTeamBattle } from '../../../src/hooks/useTeamBattle';
import { useAuth } from '../../../src/hooks/useAuth';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { SURFACE } from '../../../src/constants/colors';
import { TeamClashStage } from '../../../src/components/web/versus/TeamClashStage';

export default function TeamClashWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const { battleId } = useLocalSearchParams<{ battleId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { loading, sideA, sideB, result, tally, vote } = useTeamBattle(battleId);

  const onVote = (teamId: string) => {
    if (!user) { router.push('/(auth)/login'); return; }
    void vote(teamId);
  };

  if (loading || !sideA || !sideB || !result) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.goldAccent} /></View>;
  }

  return (
    <ScrollView style={styles.root}>
      <TeamClashStage sideA={sideA} sideB={sideB} result={result} onVote={onVote} tally={tally} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#181323' },
  center: { flex: 1, minHeight: 400, alignItems: 'center', justifyContent: 'center', backgroundColor: '#181323' },
});
```

- [ ] **Step 3: Typecheck + manual web check**

Run `yarn tsc --noEmit` (expect 0), then verify on web per the user's device-screenshot workflow (they'll check iOS Safari). Confirm the 3-up split renders with rosters, meter, verdict, and vote buttons.

- [ ] **Step 4: Commit**

```bash
git add app/versus/team/[battleId].web.tsx src/components/web/versus/TeamClashStage.tsx
git commit -m "feat(versus): web team clash page (3-up stage)"
```

---

## Task 12: Featured team-battle card on the hub

**Files:**
- Modify: `app/(tabs)/versus.tsx`
- Modify: `app/(tabs)/versus.web.tsx`

**Interfaces:**
- Consumes: `getTodaysTeamBattle` from `src/lib/db/teams` (via a small addition to `useVersusHub`, or a local `useQuery`).

- [ ] **Step 1: Extend `useVersusHub` with today's team battle**

In `src/hooks/useVersusHub.ts`, add a query and return value:

```ts
import { getTodaysTeamBattle, type TodaysTeamBattle } from '../lib/db/teams';
// ...inside useVersusHub, add:
  const teamBattleQ = useQuery<TodaysTeamBattle | null>({
    queryKey: ['versus', 'todaysTeamBattle'],
    queryFn: getTodaysTeamBattle,
    staleTime: 1000 * 60 * 60,
  });
// ...and in the returned object add:
    teamBattle: teamBattleQ.data ?? null,
```

- [ ] **Step 2: Add the card to the native hub**

In `app/(tabs)/versus.tsx`, read `teamBattle` from `useVersusHub()` and render a pressable card (place it just below the "Today's Showdown" block). Use the existing card styling idiom in that file; the press routes to the clash page:

```tsx
// near the other destructured hub values:
const { matchup, rivalries, iconicPool, loading, teamBattle } = useVersusHub();
// ...in the JSX, after the showdown section:
{teamBattle && (
  <Pressable
    style={styles.teamCard}
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/versus/team/${teamBattle.teamA.id}-vs-${teamBattle.teamB.id}`);
    }}
  >
    <Text style={styles.teamEyebrow}>★ Team Battle ★</Text>
    <Text style={styles.teamTitle} numberOfLines={1}>
      {teamBattle.teamA.name} vs {teamBattle.teamB.name}
    </Text>
    <Text style={styles.teamCta}>Tap to see the clash →</Text>
  </Pressable>
)}
```

Add matching styles to that file's `StyleSheet.create` (mirror the eyebrow/title idiom already present):

```ts
teamCard: { marginHorizontal: 16, marginTop: 16, padding: 18, borderRadius: 18, backgroundColor: 'rgba(206,155,51,0.12)', borderWidth: 1, borderColor: 'rgba(206,155,51,0.4)' },
teamEyebrow: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 2, color: COLORS.goldAccent, textTransform: 'uppercase', marginBottom: 6 },
teamTitle: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.beige },
teamCta: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.8)', marginTop: 6 },
```

- [ ] **Step 3: Add the card to the web hub**

In `app/(tabs)/versus.web.tsx`, read `teamBattle` from `useVersusHub()` and render an equivalent pressable (use `withViewTransition` like the existing `openArena` does for navigation):

```tsx
const { matchup, rivalries, iconicPool, loading, teamBattle } = useVersusHub();
// ...in the JSX, near the showdown stage:
{teamBattle && (
  <Pressable
    style={styles.teamCard}
    onPress={() =>
      withViewTransition(() =>
        router.push(`/versus/team/${teamBattle.teamA.id}-vs-${teamBattle.teamB.id}` as Parameters<typeof router.push>[0]),
      )
    }
  >
    <Text style={styles.teamEyebrow}>★ Team Battle ★</Text>
    <Text style={styles.teamTitle}>{teamBattle.teamA.name} vs {teamBattle.teamB.name}</Text>
  </Pressable>
)}
```

Add the same style keys to that file's stylesheet (copy the four style rules from Step 2).

- [ ] **Step 4: Typecheck + verify**

Run `yarn tsc --noEmit` (expect 0). Launch the app; confirm the hub shows a "Team Battle" card and tapping it opens the clash page on both native and web.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVersusHub.ts app/(tabs)/versus.tsx app/(tabs)/versus.web.tsx
git commit -m "feat(versus): featured team-battle card on the Arena hub"
```

---

## Task 13: Full suite + advisors green

**Files:** none (verification task)

- [ ] **Step 1: Run the whole test suite**

Run: `yarn test:ci`
Expected: all tests pass (including the three new files).

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Check Supabase advisors**

Use `mcp__supabase__get_advisors` with type `security`, then type `performance`. Expected: no new ERROR-level advisories for `teams`, `team_members`, `team_verdicts`, `team_battle_votes`, or the new functions. If any RPC is flagged for a mutable `search_path`, confirm each has `set search_path = public` (they do) and resolve any genuinely new findings.

- [ ] **Step 4: Final commit (if advisors prompted a fix)**

```bash
git add -A
git commit -m "chore(versus): resolve advisor findings for team battle schema"
```

---

## Self-Review Notes (coverage map)

- Spec §"The DB design" → Tasks 1–5 (teams/members/rebuild/roster, synergy, verdicts, votes, seed+types).
- Spec §"resolution engine" → Task 6 (`resolveTeamBattle`, size-neutral averaging, synergy boost, asymmetric/solo handling).
- Spec §"Data + view layer" → Tasks 7–9 (`db/teams.ts`, verdict client, `useTeamBattle`).
- Spec §"Routing & reuse" + "signature UX" → Tasks 10–12 (native + web clash page, hub card). Full deck-deal animation polish references the approved mockup; the resting composition + meter charge are implemented, with reduced-motion honored.
- Spec §"Failure behavior" → degrade-to-empty in every `db/teams.ts` reader, synergy→0 on error, verdict fallback (Task 8), anon vote routed to login (Tasks 10–11).
- Spec §"Testing" → Tasks 6–8 unit tests; Task 13 suite gate.
- Out of scope (builder, saved teams, profile record) correctly deferred to Phase 2.
