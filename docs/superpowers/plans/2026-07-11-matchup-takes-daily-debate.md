# Matchup Takes + Daily Debate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured debate layer (pick-a-side "takes" + real anonymous voting) to matchup pages, unify the daily matchup on a server-curated `daily_debate` table, and surface it on Arena, Explore, the landing page, profile, and the social/OG growth loop.

**Architecture:** New `matchup_takes` / `take_agreements` / `daily_debate` tables behind SECURITY DEFINER RPCs (same pattern as `matchup_votes` / `verdicts`). Anonymous participation uses a client-generated `voter_key` (auth uid when signed in, hashed device id otherwise); authed votes stay in `matchup_votes`, anon votes in a sibling `matchup_votes_anon` table, unioned at read time. All client access goes through `src/lib/db/` + React Query hooks; views stay thin per house rules.

**Tech Stack:** Supabase (Postgres RPCs, RLS, pg_cron), React Query, Expo Router, jest-expo.

## Global Constraints

- Package manager: **yarn** only. Tests: `yarn test:ci` (or `yarn jest <path>` for one file).
- Screens never import `supabase` directly — all DB access via `src/lib/db/`.
- TypeScript, no `any`; `unknown` for caught errors. Functional components; `StyleSheet.create`.
- Fonts: `Flame-Regular` display (never Flame-Bold), `FlameSans-Regular` body, `Nunito_*` UI. Clamped Flame text needs `lineHeight ≥ 1.22× fontSize`.
- Migrations: new file in `supabase/migrations/YYYYMMDDHHMMSS_description.sql`, applied via the Supabase MCP tool, then regenerate `src/types/database.generated.ts` via MCP. **The supabase MCP server needs auth — if unavailable, stop and ask the user to authorize it rather than applying SQL another way.**
- New tables: RLS auto-on — every publicly readable table needs an explicit read policy or clients silently get `[]`.
- Pair keys are normalized `hero_a_id <= hero_b_id` (the `verdicts` / `matchup_votes` convention). Picks are stored as hero **ids**, never 'a'/'b'.
- Commit directly to `main` after each task (house rule: no feature branches).

---

### Task 1: Migration — takes, anon votes, daily debate, take reports

**Files:**
- Create: `supabase/migrations/20260711120000_matchup_takes_daily_debate.sql`
- Regenerate: `src/types/database.generated.ts` (via MCP `generate_typescript_types`)

**Interfaces:**
- Produces RPCs used by Tasks 2–3: `get_matchup_tally_v2(p_a text, p_b text, p_voter_key text) → json`, `cast_matchup_vote_v2(p_a text, p_b text, p_picked text, p_voter_key text) → json`, `post_take(p_a text, p_b text, p_picked text, p_body text) → json`, `toggle_take_agreement(p_take_id uuid, p_voter_key text) → json`, `set_daily_debate(p_date date, p_a text, p_b text, p_hook text) → void` (admin), `resolve_daily_debate() → void`, `pick_daily_debate() → void`.
- Produces tables read by Tasks 2/5/7: `matchup_takes`, `take_agreements`, `matchup_votes_anon`, `daily_debate`.

- [ ] **Step 1: Write the migration file**

```sql
-- Matchup Takes + Daily Debate backbone.
-- Spec: docs/superpowers/specs/2026-07-11-matchup-takes-daily-debate-design.md
--
-- * Anonymous voting: authed votes stay in matchup_votes (per-user history,
--   battle record, community aggregations all keep working). Anonymous votes
--   land in matchup_votes_anon keyed by a client voter_key. The v2 RPCs union
--   the two at read time and route writes by auth.uid(). v1 RPCs stay in place
--   until every client surface is on v2.
-- * Takes: pick-a-side one-liners, auth-only writes, public read of visible
--   rows. Agreements are voter_key-based so anon visitors can agree.
-- * daily_debate: server-curated source of truth for the daily pair.

-- ── Anonymous votes ──────────────────────────────────────────────────────────
create table if not exists public.matchup_votes_anon (
  hero_a_id  text not null,
  hero_b_id  text not null,
  voter_key  text not null,
  picked_id  text not null,
  created_at timestamptz not null default now(),
  primary key (hero_a_id, hero_b_id, voter_key),
  constraint mva_pair_ordered check (hero_a_id <= hero_b_id),
  constraint mva_pick_in_pair check (picked_id in (hero_a_id, hero_b_id)),
  constraint mva_key_len check (char_length(voter_key) between 8 and 128)
);
create index if not exists mva_voter_recent_idx
  on public.matchup_votes_anon (voter_key, created_at desc);
alter table public.matchup_votes_anon enable row level security;
-- No policies: clients touch it only through the SECURITY DEFINER RPCs.

create or replace function public.get_matchup_tally_v2(
  p_a text, p_b text, p_voter_key text
) returns json
language sql security definer set search_path = public stable
as $$
  with norm as (select least(p_a, p_b) as lo, greatest(p_a, p_b) as hi),
  allv as (
    select v.picked_id, v.user_id::text as who, 'auth' as src
      from norm n join public.matchup_votes v
        on v.hero_a_id = n.lo and v.hero_b_id = n.hi
    union all
    select v.picked_id, v.voter_key as who, 'anon' as src
      from norm n join public.matchup_votes_anon v
        on v.hero_a_id = n.lo and v.hero_b_id = n.hi
  )
  select json_build_object(
    'votes_a', count(*) filter (where picked_id = p_a),
    'votes_b', count(*) filter (where picked_id = p_b),
    'total',   count(*),
    'my_pick', coalesce(
      max(picked_id) filter (where src = 'auth' and who = auth.uid()::text),
      max(picked_id) filter (where src = 'anon' and who = p_voter_key))
  ) from allv;
$$;

create or replace function public.cast_matchup_vote_v2(
  p_a text, p_b text, p_picked text, p_voter_key text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lo  text := least(p_a, p_b);
  v_hi  text := greatest(p_a, p_b);
begin
  if p_picked is distinct from p_a and p_picked is distinct from p_b then
    raise exception 'pick must be one of the two heroes';
  end if;
  if v_uid is not null then
    insert into public.matchup_votes (hero_a_id, hero_b_id, user_id, picked_id)
    values (v_lo, v_hi, v_uid, p_picked)
    on conflict (hero_a_id, hero_b_id, user_id)
      do update set picked_id = excluded.picked_id, created_at = now();
  else
    if p_voter_key is null or char_length(p_voter_key) < 8 then
      raise exception 'voter key required';
    end if;
    -- Fun-poll rate limit, not election security: 60 anon votes/hour per key.
    if (select count(*) from public.matchup_votes_anon
        where voter_key = p_voter_key
          and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'rate limited';
    end if;
    insert into public.matchup_votes_anon (hero_a_id, hero_b_id, voter_key, picked_id)
    values (v_lo, v_hi, p_voter_key, p_picked)
    on conflict (hero_a_id, hero_b_id, voter_key)
      do update set picked_id = excluded.picked_id, created_at = now();
  end if;
  return public.get_matchup_tally_v2(p_a, p_b, p_voter_key);
end;
$$;

revoke all on function public.get_matchup_tally_v2(text, text, text) from public;
revoke all on function public.cast_matchup_vote_v2(text, text, text, text) from public;
grant execute on function public.get_matchup_tally_v2(text, text, text)
  to anon, authenticated, service_role;
grant execute on function public.cast_matchup_vote_v2(text, text, text, text)
  to anon, authenticated, service_role;

-- ── Takes ────────────────────────────────────────────────────────────────────
create table if not exists public.matchup_takes (
  id          uuid primary key default gen_random_uuid(),
  hero_a_id   text not null,
  hero_b_id   text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  picked_id   text not null,
  body        text not null,
  agree_count int  not null default 0,
  status      text not null default 'visible',
  created_at  timestamptz not null default now(),
  constraint takes_pair_ordered check (hero_a_id <= hero_b_id),
  constraint takes_pick_in_pair check (picked_id in (hero_a_id, hero_b_id)),
  constraint takes_body_len check (char_length(body) between 3 and 280),
  constraint takes_status_ok check (status in ('visible', 'hidden', 'removed')),
  constraint takes_one_per_user_pair unique (hero_a_id, hero_b_id, user_id)
);
create index if not exists takes_pair_idx
  on public.matchup_takes (hero_a_id, hero_b_id, status, agree_count desc);
create index if not exists takes_user_idx on public.matchup_takes (user_id);
alter table public.matchup_takes enable row level security;

drop policy if exists takes_public_read on public.matchup_takes;
create policy takes_public_read on public.matchup_takes
  for select using (status = 'visible' or user_id = auth.uid());
drop policy if exists takes_own_delete on public.matchup_takes;
create policy takes_own_delete on public.matchup_takes
  for delete to authenticated using (user_id = auth.uid());
-- Inserts only via post_take (validates + rate limits); no client updates.

create or replace function public.post_take(
  p_a text, p_b text, p_picked text, p_body text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_lo   text := least(p_a, p_b);
  v_hi   text := greatest(p_a, p_b);
  v_body text := regexp_replace(trim(p_body), '[ -]', ' ', 'g');
  v_row  public.matchup_takes;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_picked is distinct from p_a and p_picked is distinct from p_b then
    raise exception 'pick must be one of the two heroes';
  end if;
  if char_length(v_body) < 3 or char_length(v_body) > 280 then
    raise exception 'take must be 3-280 characters';
  end if;
  if (select count(*) from public.matchup_takes
      where user_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate limited';
  end if;
  insert into public.matchup_takes (hero_a_id, hero_b_id, user_id, picked_id, body)
  values (v_lo, v_hi, v_uid, p_picked, v_body)
  on conflict (hero_a_id, hero_b_id, user_id)
    do update set picked_id = excluded.picked_id, body = excluded.body,
                  created_at = now(), status = 'visible', agree_count = 0
  returning * into v_row;
  -- Re-posting resets agreements (it is a different take now). On a fresh
  -- insert this deletes zero rows, so it is safe to run unconditionally.
  delete from public.take_agreements where take_id = v_row.id;
  return row_to_json(v_row);
end;
$$;

create table if not exists public.take_agreements (
  take_id    uuid not null references public.matchup_takes (id) on delete cascade,
  voter_key  text not null,
  created_at timestamptz not null default now(),
  primary key (take_id, voter_key),
  constraint ta_key_len check (char_length(voter_key) between 8 and 128)
);
alter table public.take_agreements enable row level security;
-- RPC-only access.

create or replace function public.toggle_take_agreement(
  p_take_id uuid, p_voter_key text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_key text := coalesce(auth.uid()::text, p_voter_key);
  v_on  boolean;
  v_count int;
begin
  if v_key is null or char_length(v_key) < 8 then
    raise exception 'voter key required';
  end if;
  delete from public.take_agreements
    where take_id = p_take_id and voter_key = v_key;
  if not found then
    insert into public.take_agreements (take_id, voter_key)
    values (p_take_id, v_key);
    v_on := true;
  else
    v_on := false;
  end if;
  update public.matchup_takes t
     set agree_count = (select count(*) from public.take_agreements a
                        where a.take_id = t.id)
   where t.id = p_take_id
   returning agree_count into v_count;
  return json_build_object('agreed', v_on, 'agree_count', coalesce(v_count, 0));
end;
$$;

revoke all on function public.post_take(text, text, text, text) from public, anon;
grant execute on function public.post_take(text, text, text, text)
  to authenticated, service_role;
revoke all on function public.toggle_take_agreement(uuid, text) from public;
grant execute on function public.toggle_take_agreement(uuid, text)
  to anon, authenticated, service_role;

-- ── Daily debate ─────────────────────────────────────────────────────────────
create table if not exists public.daily_debate (
  debate_date  date primary key,
  hero_a_id    text not null,
  hero_b_id    text not null,
  hook_text    text,
  final_votes_a int,
  final_votes_b int,
  top_take_id  uuid references public.matchup_takes (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint dd_pair_ordered check (hero_a_id <= hero_b_id)
);
alter table public.daily_debate enable row level security;
drop policy if exists dd_public_read on public.daily_debate;
create policy dd_public_read on public.daily_debate for select using (true);

-- Admin curation (command center). Reuses the admin gate used elsewhere:
-- callers must pass public.is_admin() (already defined by the reports backbone).
create or replace function public.set_daily_debate(
  p_date date, p_a text, p_b text, p_hook text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  insert into public.daily_debate (debate_date, hero_a_id, hero_b_id, hook_text)
  values (p_date, least(p_a, p_b), greatest(p_a, p_b), nullif(trim(p_hook), ''))
  on conflict (debate_date)
    do update set hero_a_id = excluded.hero_a_id, hero_b_id = excluded.hero_b_id,
                  hook_text = excluded.hook_text;
end;
$$;
revoke all on function public.set_daily_debate(date, text, text, text) from public, anon;
grant execute on function public.set_daily_debate(date, text, text, text)
  to authenticated, service_role;

-- Freeze yesterday's split + crown the top take.
create or replace function public.resolve_daily_debate()
returns void
language plpgsql security definer set search_path = public
as $$
declare d public.daily_debate;
begin
  for d in select * from public.daily_debate
           where debate_date < current_date and final_votes_a is null
  loop
    update public.daily_debate dd set
      final_votes_a = (
        select count(*) from (
          select picked_id from public.matchup_votes v
            where v.hero_a_id = d.hero_a_id and v.hero_b_id = d.hero_b_id
          union all
          select picked_id from public.matchup_votes_anon v
            where v.hero_a_id = d.hero_a_id and v.hero_b_id = d.hero_b_id
        ) x where x.picked_id = d.hero_a_id),
      final_votes_b = (
        select count(*) from (
          select picked_id from public.matchup_votes v
            where v.hero_a_id = d.hero_a_id and v.hero_b_id = d.hero_b_id
          union all
          select picked_id from public.matchup_votes_anon v
            where v.hero_a_id = d.hero_a_id and v.hero_b_id = d.hero_b_id
        ) x where x.picked_id = d.hero_b_id),
      top_take_id = (
        select id from public.matchup_takes t
         where t.hero_a_id = d.hero_a_id and t.hero_b_id = d.hero_b_id
           and t.status = 'visible'
         order by t.agree_count desc, t.created_at asc limit 1)
    where dd.debate_date = d.debate_date;
  end loop;
end;
$$;
revoke all on function public.resolve_daily_debate() from public, anon, authenticated;
grant execute on function public.resolve_daily_debate() to service_role;

-- Auto-pick fallback: high-fame enemy pair unused in the last 90 days.
create or replace function public.pick_daily_debate()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.daily_debate (debate_date, hero_a_id, hero_b_id)
  select current_date + 1, least(r.hero_id, r.related_id),
         greatest(r.hero_id, r.related_id)
  from public.hero_relationships r
  join public.heroes a on a.id = r.hero_id
  join public.heroes b on b.id = r.related_id
  where r.kind = 'enemy'
    and a.fame_score >= 60 and b.fame_score >= 60
    and a.portrait_url is not null and b.portrait_url is not null
    and not exists (
      select 1 from public.daily_debate dd
      where dd.debate_date > current_date - 90
        and dd.hero_a_id = least(r.hero_id, r.related_id)
        and dd.hero_b_id = greatest(r.hero_id, r.related_id))
  order by (a.fame_score + b.fame_score) desc, random()
  limit 1
  on conflict (debate_date) do nothing;
end;
$$;
revoke all on function public.pick_daily_debate() from public, anon, authenticated;
grant execute on function public.pick_daily_debate() to service_role;

-- Nightly, just after midnight UTC: freeze yesterday, ensure tomorrow exists.
select cron.schedule('daily-debate-roll', '5 0 * * *',
  $$select public.resolve_daily_debate(); select public.pick_daily_debate();$$);

-- ── Take reports ─────────────────────────────────────────────────────────────
-- Extend the reports backbone with a 'take' target. The reports table stores
-- target_type + a free-text detail; takes reuse image_url as the take id slot
-- is not present — add a dedicated column instead.
alter table public.reports add column if not exists take_id uuid
  references public.matchup_takes (id) on delete cascade;
-- Relax the target_type guard (constraint name from the reports backbone
-- migration; verify with \d reports if it differs).
alter table public.reports drop constraint if exists reports_target_type_ok;
alter table public.reports add constraint reports_target_type_ok
  check (target_type in ('page', 'image', 'ai_portrait', 'take'));
```

**Note for the implementer:** before applying, open `supabase/migrations/20260701120000_reports_backbone.sql` and confirm (a) the actual target_type constraint name and definition and (b) that `public.is_admin()` exists with that exact name — adjust the last block and the `set_daily_debate` gate to match reality. Also confirm `hero_relationships.kind` uses `'enemy'` (check the migration that created it; memory of the codebase says `relation_kind` may be the column name). Also remove the two dead `delete from public.take_agreements` statements in `post_take` and replace with the single correct cleanup: `delete from public.take_agreements where take_id = v_row.id;` executed only when the insert hit the conflict branch (use `xmax <> 0` on the returned row or a separate `v_was_update boolean := found` pattern). The committed migration must contain no dead statements.

- [ ] **Step 2: Apply via MCP** — `mcp__supabase__apply_migration` with the file's contents; name `matchup_takes_daily_debate`.

- [ ] **Step 3: Smoke-test the RPCs via MCP `execute_sql`**

```sql
select public.cast_matchup_vote_v2('h_x', 'h_y', 'h_x', 'devkey-12345678');
select public.get_matchup_tally_v2('h_x', 'h_y', 'devkey-12345678');
-- Expect votes_a=1, my_pick='h_x'. Then clean up:
delete from public.matchup_votes_anon where voter_key = 'devkey-12345678';
delete from public.daily_debate where debate_date > current_date; -- keep auto-pick honest later
```

- [ ] **Step 4: Regenerate types** — `mcp__supabase__generate_typescript_types` → overwrite `src/types/database.generated.ts`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260711120000_matchup_takes_daily_debate.sql src/types/database.generated.ts
git commit -m "feat(debate): takes + anon votes + daily_debate backbone"
```

---

### Task 2: Client DB layer — voter key, votes v2, takes

**Files:**
- Create: `src/lib/voterKey.ts`
- Create: `src/lib/db/takes.ts`
- Modify: `src/lib/db/matchupVotes.ts` (add v2 wrappers; keep v1 exports untouched)
- Test: `__tests__/lib/db/takes.test.ts`, `__tests__/lib/voterKey.test.ts`

**Interfaces:**
- Consumes: Task 1 RPCs.
- Produces: `getVoterKey(): Promise<string>`; `getMatchupTallyV2(a, b, voterKey): Promise<MatchupTally | null>`; `castMatchupVoteV2(a, b, pickedId, voterKey): Promise<MatchupTally | null>`; from `takes.ts`: `interface Take { id: string; heroAId: string; heroBId: string; userId: string; pickedId: string; body: string; agreeCount: number; createdAt: string; displayName: string | null }`, `getTakes(a: string, b: string): Promise<Take[]>`, `postTake(a: string, b: string, pickedId: string, body: string): Promise<Take | null>`, `deleteTake(id: string): Promise<boolean>`, `toggleAgree(takeId: string, voterKey: string): Promise<{ agreed: boolean; agreeCount: number } | null>`.

- [ ] **Step 1: Write failing tests**

`__tests__/lib/voterKey.test.ts` — mock `@react-native-async-storage/async-storage`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVoterKey, VOTER_KEY_STORAGE_KEY } from '../../src/lib/voterKey';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('getVoterKey', () => {
  beforeEach(() => AsyncStorage.clear());

  it('generates a stable key of at least 8 chars and persists it', async () => {
    const k1 = await getVoterKey();
    expect(k1.length).toBeGreaterThanOrEqual(8);
    const k2 = await getVoterKey();
    expect(k2).toBe(k1);
    expect(await AsyncStorage.getItem(VOTER_KEY_STORAGE_KEY)).toBe(k1);
  });
});
```

`__tests__/lib/db/takes.test.ts` — mock `src/lib/supabase` the same way `__tests__/lib/db/` neighbours do (check an existing test in that directory and copy its mock shape). Cover: `getTakes` maps snake_case rows (including joined profile display name) to the `Take` shape and filters nothing client-side; `postTake` returns null and warns on RPC error; `toggleAgree` passes `p_take_id`/`p_voter_key` and unwraps `{agreed, agree_count}`.

- [ ] **Step 2: Run tests, verify they fail** — `yarn jest __tests__/lib/voterKey.test.ts __tests__/lib/db/takes.test.ts`. Expected: module-not-found failures.

- [ ] **Step 3: Implement**

`src/lib/voterKey.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const VOTER_KEY_STORAGE_KEY = 'mythique.voterKey';

let cached: string | null = null;

/** Stable anonymous participant id for votes/agreements. Not a security
 *  boundary — a dedup key for a fun poll. auth users are keyed server-side
 *  by uid; this key is only consulted when logged out. */
export async function getVoterKey(): Promise<string> {
  if (cached) return cached;
  const existing = await AsyncStorage.getItem(VOTER_KEY_STORAGE_KEY).catch(() => null);
  if (existing && existing.length >= 8) {
    cached = existing;
    return existing;
  }
  const fresh = `vk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  cached = fresh;
  AsyncStorage.setItem(VOTER_KEY_STORAGE_KEY, fresh).catch(() => {});
  return fresh;
}
```

`src/lib/db/matchupVotes.ts` — append (reusing the existing `toTally` helper):

```ts
/** v2: tally including anonymous votes; my_pick resolves via uid or voter key. */
export async function getMatchupTallyV2(
  a: string,
  b: string,
  voterKey: string,
): Promise<MatchupTally | null> {
  const { data, error } = await supabase.rpc('get_matchup_tally_v2', {
    p_a: a,
    p_b: b,
    p_voter_key: voterKey,
  });
  if (error) {
    console.warn('[getMatchupTallyV2] error:', error.message);
    return null;
  }
  return toTally(data);
}

/** v2: cast/switch a vote, signed-in or anonymous. Returns the fresh tally. */
export async function castMatchupVoteV2(
  a: string,
  b: string,
  pickedId: string,
  voterKey: string,
): Promise<MatchupTally | null> {
  const { data, error } = await supabase.rpc('cast_matchup_vote_v2', {
    p_a: a,
    p_b: b,
    p_picked: pickedId,
    p_voter_key: voterKey,
  });
  if (error) {
    console.warn('[castMatchupVoteV2] error:', error.message);
    return null;
  }
  return toTally(data);
}
```

`src/lib/db/takes.ts`:

```ts
import { supabase } from '../supabase';

// Structured matchup takes: pick-a-side one-liners. Reads are plain selects
// (public RLS on visible rows); writes go through SECURITY DEFINER RPCs.

export interface Take {
  id: string;
  heroAId: string;
  heroBId: string;
  userId: string;
  pickedId: string;
  body: string;
  agreeCount: number;
  createdAt: string;
  displayName: string | null;
}

interface TakeRow {
  id: string;
  hero_a_id: string;
  hero_b_id: string;
  user_id: string;
  picked_id: string;
  body: string;
  agree_count: number;
  created_at: string;
  profiles: { display_name: string | null } | null;
}

function toTake(r: TakeRow): Take {
  return {
    id: r.id,
    heroAId: r.hero_a_id,
    heroBId: r.hero_b_id,
    userId: r.user_id,
    pickedId: r.picked_id,
    body: r.body,
    agreeCount: r.agree_count,
    createdAt: r.created_at,
    displayName: r.profiles?.display_name ?? null,
  };
}

function normalizeKey(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

/** Visible takes for a pair, best-agreed first. Empty array on error. */
export async function getTakes(a: string, b: string): Promise<Take[]> {
  const [lo, hi] = normalizeKey(a, b);
  const { data, error } = await supabase
    .from('matchup_takes')
    .select('*, profiles(display_name)')
    .eq('hero_a_id', lo)
    .eq('hero_b_id', hi)
    .order('agree_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('[getTakes] error:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as TakeRow[]).map(toTake);
}

/** Post (or replace) the caller's take. Auth required; null on error. */
export async function postTake(
  a: string,
  b: string,
  pickedId: string,
  body: string,
): Promise<Take | null> {
  const { data, error } = await supabase.rpc('post_take', {
    p_a: a,
    p_b: b,
    p_picked: pickedId,
    p_body: body,
  });
  if (error) {
    console.warn('[postTake] error:', error.message);
    return null;
  }
  return toTake({ ...(data as unknown as TakeRow), profiles: null });
}

/** Delete the caller's own take (RLS-enforced). */
export async function deleteTake(id: string): Promise<boolean> {
  const { error } = await supabase.from('matchup_takes').delete().eq('id', id);
  if (error) {
    console.warn('[deleteTake] error:', error.message);
    return false;
  }
  return true;
}

/** Toggle agreement on a take. Works anon (voter key) and signed-in. */
export async function toggleAgree(
  takeId: string,
  voterKey: string,
): Promise<{ agreed: boolean; agreeCount: number } | null> {
  const { data, error } = await supabase.rpc('toggle_take_agreement', {
    p_take_id: takeId,
    p_voter_key: voterKey,
  });
  if (error) {
    console.warn('[toggleAgree] error:', error.message);
    return null;
  }
  const d = (data ?? {}) as { agreed?: boolean; agree_count?: number };
  return { agreed: d.agreed ?? false, agreeCount: d.agree_count ?? 0 };
}
```

Adjust the `profiles(display_name)` join to the actual profiles table/column (check `src/lib/db/profiles.ts` for the real names before writing). If the FK from `matchup_takes.user_id` to `profiles` doesn't exist for PostgREST embedding, fetch display names with a second `in()` query inside `getTakes` instead — do whichever the schema supports, keeping the `Take` interface unchanged.

- [ ] **Step 4: Run tests, verify pass** — `yarn jest __tests__/lib/voterKey.test.ts __tests__/lib/db/takes.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/voterKey.ts src/lib/db/takes.ts src/lib/db/matchupVotes.ts __tests__/lib/voterKey.test.ts __tests__/lib/db/takes.test.ts
git commit -m "feat(debate): client db layer — voter key, v2 vote wrappers, takes"
```

---

### Task 3: Real anonymous voting in useMatchupVote

**Files:**
- Modify: `src/hooks/useMatchupVote.ts`
- Test: `__tests__/hooks/useMatchupVote.test.ts` (create; mirror mock style of existing hook tests in `__tests__/hooks/`)

**Interfaces:**
- Consumes: `getVoterKey`, `getMatchupTallyV2`, `castMatchupVoteV2` (Task 2).
- Produces: `MatchupVoteState` unchanged in shape — every existing consumer (`TodaysMatchup`, Compare arena) keeps working with zero view changes. Behavior change only: anon votes now persist server-side and `tally` includes them.

- [ ] **Step 1: Write failing tests** — mock `../lib/db/matchupVotes`, `../lib/voterKey` (return `'vk_test_12345678'`), `./useAuth` (logged out), AsyncStorage. Cases: (a) logged-out `castVote('a')` calls `castMatchupVoteV2(heroA, heroB, heroA, 'vk_test_12345678')` and sets tally from its response; (b) initial load calls `getMatchupTallyV2` with the voter key and surfaces `myPick`; (c) a second `castVote` is a no-op (pickedId already set).

- [ ] **Step 2: Run, verify fail** — `yarn jest __tests__/hooks/useMatchupVote.test.ts`. Expected: FAIL (hook still calls v1 functions).

- [ ] **Step 3: Rewire the hook** — replace `getMatchupTally`/`castMatchupVote` with the v2 pair. Load path: `const vk = await getVoterKey()` first, then `getMatchupTallyV2(heroAId, heroBId, vk)`; keep the AsyncStorage local-reveal fallback exactly as-is (it now only covers the offline/RPC-error case). Cast path: always persist (drop the `if (user)` gate) —

```ts
const castVote = useCallback(
  (side: MatchupSide) => {
    if (pickedId) return;
    const picked = side === 'a' ? heroAId : heroBId;
    setPickedId(picked);
    AsyncStorage.setItem(key, side).catch(() => {});
    trackEvent('matchup_vote', { authed: !!user });
    getVoterKey()
      .then((vk) => castMatchupVoteV2(heroAId, heroBId, picked, vk))
      .then((t) => t && setTally(t))
      .catch(() => {});
  },
  [pickedId, user, key, heroAId, heroBId],
);
```

Update the file-top comment block: the cold-launch rule is now "anonymous votes are real votes."

- [ ] **Step 4: Run tests + full suite** — `yarn jest __tests__/hooks/useMatchupVote.test.ts` then `yarn test:ci`. Expected: PASS (fix any consumer test relying on v1 mocks).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMatchupVote.ts __tests__/hooks/useMatchupVote.test.ts
git commit -m "feat(debate): anonymous votes persist to the crowd tally"
```

---

### Task 4: Takes UI on the matchup page

**Files:**
- Create: `src/hooks/useMatchupTakes.ts`
- Create: `src/components/takes/TakesSection.tsx` (shared web+native)
- Modify: `src/lib/query/keys.ts` (add `takes` key)
- Modify: `app/compare/[hero]/[opponent].tsx` and `app/compare/[hero]/[opponent].web.tsx` (render `<TakesSection heroA={...} heroB={...} />` below the verdict/vote block)
- Modify: `src/lib/db/reports.ts` + `src/components/report/ReportSheet.tsx` (add `take` context with reasons `offensive | spam | other`; `submitReport` gains optional `takeId` passed as `p_take_id` — requires a matching `submit_report` overload; add it to the Task 1 migration if not already done: new optional parameter `p_take_id uuid default null` written to `reports.take_id`, target_type `'take'`)
- Test: `__tests__/hooks/useMatchupTakes.test.ts`

**Interfaces:**
- Consumes: `getTakes/postTake/deleteTake/toggleAgree` (Task 2), `getVoterKey`, `useAuth`, `queryKeys`.
- Produces: `useMatchupTakes(heroAId: string, heroBId: string): { takes: Take[]; loading: boolean; myTake: Take | null; submit: (pickedId: string, body: string) => Promise<boolean>; remove: (id: string) => Promise<void>; agree: (id: string) => void; agreedIds: Set<string> }` and `<TakesSection heroA={MatchupHero-like {id,name}} heroB={...} />`.

- [ ] **Step 1: Add the query key** — in `src/lib/query/keys.ts` `queryKeys`, add:

```ts
takes: (a: string, b: string) =>
  ['heroes', 'takes', a <= b ? a : b, a <= b ? b : a] as const,
```

- [ ] **Step 2: Write failing hook tests** — wrap in a `QueryClientProvider` (copy the wrapper pattern from an existing `src/lib/query` test in `__tests__/lib/query/`). Cases: sorted takes exposed; `submit` requires auth (returns false, does not call `postTake` when `useAuth` mock has no user); `agree` optimistically bumps `agreeCount` and flips membership in `agreedIds`, rolls back if `toggleAgree` resolves null.

- [ ] **Step 3: Run, verify fail** — `yarn jest __tests__/hooks/useMatchupTakes.test.ts`.

- [ ] **Step 4: Implement the hook** — React Query `useQuery({ queryKey: queryKeys.takes(a, b), queryFn: () => getTakes(a, b) })`; `submit` posts then `queryClient.invalidateQueries({ queryKey: queryKeys.takes(a, b) })`; `agree` does an optimistic `setQueryData` bump + fire-and-forget RPC with rollback on null; `agreedIds` persisted in component state only (server enforces the real toggle). `myTake` = the take whose `userId === user?.id`.

- [ ] **Step 5: Implement TakesSection** — one shared component, `StyleSheet.create`, COLORS palette, `FlameSans-Regular` body / `Nunito` UI / `Flame-Regular` section heading (lineHeight ≥ 1.22× if clamped). Structure: heading row ("The Debate" + take count), take cards (side badge with hero name tinted by side, body, byline `displayName ?? 'Anonymous hero'`, agree pill with count, overflow → report (opens `ReportSheet` context `take`) or delete when own), composer at the bottom: two side-pick chips (default to the viewer's vote from `useMatchupVote` if cast), a 280-char input with live counter, submit. Logged-out tap on the composer routes `router.push('/(auth)/login')`. Empty state: side chips + "No takes yet — have the first word." Keep it clean/minimal (house brand rule); no decorative empty tiles.

- [ ] **Step 6: Wire into both compare screens** — render below the existing verdict/vote UI in `app/compare/[hero]/[opponent].tsx` AND `.web.tsx` (both files must be touched — known drift trap). Pass the two resolved hero `{id, name}` objects the screens already hold.

- [ ] **Step 7: Run tests + typecheck** — `yarn jest __tests__/hooks/useMatchupTakes.test.ts && yarn test:ci && yarn tsc --noEmit`. Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useMatchupTakes.ts src/components/takes/ src/lib/query/keys.ts 'app/compare/[hero]/[opponent].tsx' 'app/compare/[hero]/[opponent].web.tsx' src/lib/db/reports.ts src/components/report/ReportSheet.tsx __tests__/hooks/useMatchupTakes.test.ts
git commit -m "feat(debate): takes section on the matchup page"
```

---

### Task 5: Daily debate — server pair everywhere + Arena + yesterday strip

**Files:**
- Create: `src/lib/db/dailyDebate.ts`
- Modify: `src/lib/matchup.ts` (server row first, seeded pool as fallback)
- Modify: `src/hooks/useVersusHub.ts` + Arena views (`src/components/versus/`, `src/components/web/versus/`) — "Today's Debate" card + yesterday-result strip
- Modify: command center Publish/Overview lane — "tomorrow's debate" picker calling `set_daily_debate`
- Test: `__tests__/lib/db/dailyDebate.test.ts`, extend `__tests__/lib/matchup.test.ts` (create if absent)

**Interfaces:**
- Consumes: `daily_debate` table, `set_daily_debate` RPC (Task 1); `getTodaysMatchupFromPool` (existing).
- Produces: `getDailyDebate(date: string): Promise<{ heroAId: string; heroBId: string; hookText: string | null } | null>`; `getYesterdayResult(): Promise<{ heroAId: string; heroBId: string; finalVotesA: number; finalVotesB: number; topTake: { body: string; displayName: string | null } | null } | null>`; `getTodaysMatchup`/`getTodaysMatchupFromPool` signatures unchanged (consumers untouched).

- [ ] **Step 1: Write failing tests** — `dailyDebate.test.ts`: row mapping + null on error/no row. `matchup.test.ts`: when `getDailyDebate` resolves a pair, `getTodaysMatchupFromPool` returns those two heroes (fetched by id when not in the pool) instead of the seeded pick; when it resolves null, the seeded behavior is byte-identical to today (assert the same pair a fixed seed produced before the change).

- [ ] **Step 2: Run, verify fail.**

- [ ] **Step 3: Implement** — `dailyDebate.ts` is a thin select on `daily_debate` (public read policy exists); yesterday's result joins `matchup_takes` + profile name for `top_take_id`. In `matchup.ts`, at the top of `getTodaysMatchupFromPool`: `const dd = await getDailyDebate(todayIso())`; if present, resolve heroes from the pool by id or via `getHeroesByIds` from `src/lib/db/heroes` (check the barrel for the actual by-ids fetcher name before writing), then proceed through the existing compare/verdict path unchanged; if absent, fall through to the seed.

- [ ] **Step 4: Arena + yesterday strip** — in `useVersusHub`, add `yesterday` from `getYesterdayResult()` (React Query, key `['explore','debateYesterday']` added to `exploreKeys`). Views: Today's Debate card already effectively exists as the daily matchup surface — retitle/kicker to "Today's Debate", add hook_text line when present and a "N takes — join the debate" link into `/compare/[a]/[b]`. Below it, a one-line result strip: "Team {winner} won {pctA}/{pctB}" + top take quote + "Your side won/lost" when the viewer's stored pick (AsyncStorage `matchupVoteKey`) matches. Both `.tsx` and `.web.tsx` versus views.

- [ ] **Step 5: Command center picker** — smallest possible control in the Publish (or Overview) lane: hero A/B search inputs (reuse the existing admin hero-search component if one exists in `src/components/admin/` — check first), optional hook line, date defaulting to tomorrow, calling `set_daily_debate`. Admin-gated UI already exists around it.

- [ ] **Step 6: Run all tests + typecheck** — `yarn test:ci && yarn tsc --noEmit`. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/dailyDebate.ts src/lib/matchup.ts src/hooks/useVersusHub.ts src/components/versus src/components/web/versus src/lib/query/keys.ts __tests__/lib/db/dailyDebate.test.ts __tests__/lib/matchup.test.ts
git commit -m "feat(debate): server-curated daily debate wired through explore/arena"
```

(Include the command-center files touched in Step 5 in the add list.)

---

### Task 6: Landing page Daily Debate teaser

**Files:**
- Modify: `src/components/landing/LandingPage.dom.tsx`

**Interfaces:**
- Consumes: `useMatchupVote` (unchanged shape), `getTodaysMatchup` (Task 5 keeps signature), existing landing section patterns.

- [ ] **Step 1: Add one section** below the Summoning hero: both portraits (use the same image component pattern the landing already uses — it is a DOM component, so plain `<img>` may be in play; match whatever `LandingPage.dom.tsx` does for hero art today), split bar from the live tally, hook line, single CTA button "Cast your vote" → `/compare/[a]/[b]`. No voting inline — teaser only, per spec. Degrade: if the daily debate query fails, render the seeded pair; never render an empty section.

- [ ] **Step 2: Verify on the web root** — the user verifies via device screenshots (house rule: don't spin up a local server yourself; build/typecheck, then ask them to check `/`). Run `yarn tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/LandingPage.dom.tsx
git commit -m "feat(debate): daily debate teaser on the landing page"
```

---

### Task 7: Profile — My takes + debate record

**Files:**
- Modify: `src/hooks/useProfileData.ts` (or `useProfile.ts` — whichever already aggregates profile sections; read both first)
- Create: `src/components/profile/MyTakes.tsx` (or the pattern the profile screens use for sections — mirror an existing section component)
- Modify: profile screen(s) `app/(tabs)/profile.tsx` (+ `.web.tsx` if present)
- Test: extend the existing profile hook test if one exists; otherwise `__tests__/hooks/useProfileData.test.ts` addition for the takes mapping only

**Interfaces:**
- Consumes: `matchup_takes` own-rows read (RLS `user_id = auth.uid()` path in the Task 1 read policy), `getBattleRecord` (existing).

- [ ] **Step 1: Data** — add `getMyTakes(): Promise<Take[]>` to `src/lib/db/takes.ts` (select where `user_id = auth.uid()` via `.eq('user_id', userId)` passed in, ordered by `created_at desc`, includes hero names via a second heroes-by-ids fetch for the pair labels). Test the mapping.

- [ ] **Step 2: UI** — "My takes" section: each row shows "{HeroA} vs {HeroB}" label, the take body, agree count, and a delete affordance (`deleteTake`). Above it, reuse the existing `getBattleRecord` numbers (already built: total votes, agree-with-crowd %, streak) under a "Debate record" heading. No new tables, no badges (spec non-goal).

- [ ] **Step 3: Run tests + typecheck, commit**

```bash
git add src/lib/db/takes.ts src/components/profile src/hooks app/(tabs)/profile.tsx __tests__
git commit -m "feat(debate): my takes + debate record on profile"
```

---

### Task 8: Growth loop — OG debate card + Social Studio generator

**Files:**
- Modify: `api/og.tsx` (new `type=debate` card: both portraits, split bar, top take, wordmark; `api/` must stay RN-free — plain satori/JSX like the existing cards)
- Create: `scripts/social/daily-debate.mjs` (one asset/day: renders the debate card + caption "Who wins? Vote now — link in bio" with the matchup URL; registers output through the same `publish-posts.mjs` flow as the other organic generators — copy the structure of `organic-pack.mjs`'s post-registration, including the service-role key handling from `lib.mjs`)
- Modify: `scripts/social/studio.mjs` if generators are menu-registered there (check before editing)

**Interfaces:**
- Consumes: `daily_debate` + tally RPCs via service role; existing og card renderer helpers in `api/_lib`.

- [ ] **Step 1: OG card** — follow an existing card branch in `api/og.tsx` (the VS card is the closest sibling); parameters: `a`, `b` hero ids; server-fetches names/portraits/tally/top-take. Keep the venue/codex brand language, organic lane (portraits allowed).
- [ ] **Step 2: Generator** — `node scripts/social/daily-debate.mjs` produces the day's asset + registers a post row (unposted) so it appears in the command-center Publish tab queue.
- [ ] **Step 3: Verify** — run the generator once against today's debate; confirm the asset file renders (open it) and a `social_posts` row exists. Re-run `scripts/fetch-og-site.mjs` ONLY if the base og.png snapshot design changed (it didn't — skip unless the shared frame was touched).
- [ ] **Step 4: Commit**

```bash
git add api/og.tsx scripts/social/daily-debate.mjs scripts/social/studio.mjs
git commit -m "feat(debate): og debate card + daily social generator"
```

---

## Deferred (explicitly out of this plan)

- Bot-page/SEO rendering of debate pages (spec phase 2 — separate plan).
- Replies on takes, notifications, leaderboards (spec non-goals).
- Retiring the v1 vote RPCs (do a cleanup migration once all surfaces are confirmed on v2 for a release cycle).

## Self-Review Notes

- Spec coverage: anon voting (T1–T3), takes UI + moderation entry (T1, T4), daily debate unification incl. cron fallback + resolution (T1, T5), Explore card upgrade (T5 — `TodaysMatchup` inherits the server pair via `matchup.ts` with zero view churn; the "read the debate" link rides the Arena/Explore card edit in T5), landing teaser (T6), profile persistence (T7), OG/social loop (T8). Streak tie-in: already covered — `get_my_battle_record` computes a vote streak today (T7 surfaces it).
- The Task 1 SQL has one blocking verification note (constraint/function/column names to confirm against the reports backbone migration and `hero_relationships` schema before applying) — explicit and scoped, not a placeholder.
- Type consistency: `Take`, `MatchupTally`, v2 wrapper signatures, and `queryKeys.takes` are used with identical names across Tasks 2–7.
