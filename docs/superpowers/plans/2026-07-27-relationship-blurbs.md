# Relationship Blurbs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take written relationship blurbs on the universe focus card from 36 to
roughly 3,000, and stop 1,468 characters from rendering an empty universe page.

**Architecture:** Four infrastructure migrations followed by a repeating
authoring loop. The schema gains a three-value `status` so a decline is a
recordable outcome; a view exposes the remaining work so authoring sessions are
resumable with no bookkeeping; the `get_hero_neighborhood` RPC gains a bounded
reverse-edge candidate source and a blurb-status filter.

**Tech Stack:** Postgres (Supabase), applied via `mcp__supabase__apply_migration`.
TypeScript + jest-expo for the pure-function tests.

## Global Constraints

- **Package manager is yarn.** Never npm or bun.
- **Every schema change is a new file** in `supabase/migrations/` named
  `YYYYMMDDHHMMSS_description.sql`, applied via `mcp__supabase__apply_migration`,
  never by hand in the dashboard.
- **Regenerate `src/types/database.generated.ts`** after every migration via
  `mcp__supabase__generate_typescript_types`. Never edit it by hand.
- **Blurb writing contract** (verbatim from the spec): 125–220 characters; one or
  two sentences; **names both characters** so it reads correctly from either
  character's page; one concrete checkable fact; present tense for standing
  facts, past tense only for a specific event; no "iconic", "legendary", "epic",
  "fan-favourite"; not a plot summary; `author = 'claude'`, `verified = false`.
- **The decline rule is load-bearing.** If there is no specific true fact to
  state, record `no_relationship` or `nothing_to_say`. Never write a sentence
  that merely sounds right. Declining is a success state.
- **Never `git add -A`.** Other sessions commit into this repo mid-turn. Stage
  only the exact paths named in each task.
- Commit directly to `main`. No feature branches.

---

### Task 1: Schema — three outcomes, and commit the table's DDL

`hero_relationship_blurbs` exists in the database but has **no migration file** —
it was applied via MCP and never committed, so the repo cannot describe its own
schema. This task closes that gap and adds the status column in one idempotent
migration.

**Files:**
- Create: `supabase/migrations/20260727160000_relationship_blurb_status.sql`
- Modify: `src/types/database.generated.ts` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: nothing.
- Produces: `public.hero_relationship_blurbs` with columns
  `hero_a text, hero_b text, blurb text NULL, author text, verified boolean,
  updated_at timestamptz, status text NOT NULL, note text`.
  `status` is one of `'written' | 'no_relationship' | 'nothing_to_say'`.

- [ ] **Step 1: Confirm the pre-existing constraints still match the spec**

Run via `mcp__supabase__execute_sql`:

```sql
select conname, pg_get_constraintdef(oid) as def
from pg_constraint where conrelid = 'public.hero_relationship_blurbs'::regclass
order by conname;
```

Expected: `hero_relationship_blurbs_pkey PRIMARY KEY (hero_a, hero_b)`,
`hero_relationship_blurbs_ordered CHECK (hero_a < hero_b)`,
`hero_relationship_blurbs_len CHECK (char_length(blurb) >= 20 AND char_length(blurb) <= 320)`,
and two FKs to `heroes(id)` with `ON DELETE CASCADE`.

If `hero_relationship_blurbs_len` is absent or has different bounds, stop and
report — Step 2 depends on its exact behaviour.

- [ ] **Step 2: Write the migration**

Note on the `_len` check: it is deliberately left alone. `char_length(null)` is
null, and a CHECK constraint rejects only on `false`, so skip rows with a null
blurb pass it unmodified. Do not drop or rewrite that constraint.

```sql
-- Relationship blurbs: record declines, not just successes.
--
-- The focus card on /social-web/[id] shows a written note on what two
-- characters actually are to each other, falling back to a templated line from
-- describeRelationship(). There are 36 written notes and ~3,000 candidate pairs.
--
-- The queue that feeds that work is drawn from hero_relationships, which derives
-- entirely from ComicVine's free-text enemies/friends/teams arrays. A meaningful
-- share of high-fame pairs in it are not relationships at all (measured: rank
-- 2000 of the fame-ranked list is Peacemaker/Optimus Prime). So "I looked at this
-- pair and there is nothing true to say" MUST be recordable, or the queue never
-- drains and the same junk resurfaces every session.
--
-- Three outcomes:
--   'written'         — a true, specific note. Renders on the card.
--   'no_relationship' — the edge is a ComicVine artifact; these two aren't tied.
--   'nothing_to_say'  — real connection, nothing to add beyond the fallback.
--
-- The 'no_relationship' rows accumulate into a curated denylist of bad edges.
-- They are recorded here but NOT yet consumed: feeding them back into
-- rebuild_hero_relationships() changes every page at once and is a separate call.

-- The table predates this file (applied via MCP, never committed). Stated here
-- so the repo describes its own schema; a no-op on the live database.
create table if not exists public.hero_relationship_blurbs (
  hero_a text not null references public.heroes(id) on delete cascade,
  hero_b text not null references public.heroes(id) on delete cascade,
  blurb text,
  author text,
  verified boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (hero_a, hero_b),
  constraint hero_relationship_blurbs_ordered check (hero_a < hero_b),
  constraint hero_relationship_blurbs_len
    check (char_length(blurb) >= 20 and char_length(blurb) <= 320)
);

alter table public.hero_relationship_blurbs
  alter column blurb drop not null;

alter table public.hero_relationship_blurbs
  add column if not exists status text not null default 'written',
  add column if not exists note text;

-- Separate statement: adding the column and constraining it in one ALTER would
-- validate the check before the default lands on existing rows.
alter table public.hero_relationship_blurbs
  drop constraint if exists hero_relationship_blurbs_status;

alter table public.hero_relationship_blurbs
  add constraint hero_relationship_blurbs_status
    check (status in ('written', 'no_relationship', 'nothing_to_say'));

-- A written row without text is the one state that would render a blank line.
alter table public.hero_relationship_blurbs
  drop constraint if exists hero_relationship_blurbs_written_has_text;

alter table public.hero_relationship_blurbs
  add constraint hero_relationship_blurbs_written_has_text
    check (status <> 'written' or blurb is not null);

-- The authoring queue reads this on every batch to skip recorded pairs.
create index if not exists hero_relationship_blurbs_status_idx
  on public.hero_relationship_blurbs (status);
```

- [ ] **Step 3: Apply the migration**

Use `mcp__supabase__apply_migration` with name
`relationship_blurb_status` and the SQL above.

- [ ] **Step 4: Verify the existing 36 rows survived and are marked written**

```sql
select status, count(*), count(blurb) as with_text,
       min(char_length(blurb)) as min_len, max(char_length(blurb)) as max_len
from public.hero_relationship_blurbs group by status;
```

Expected: exactly one row — `written | 36 | 36`, with `min_len` ≥ 125 and
`max_len` ≤ 320.

- [ ] **Step 5: Verify a skip row is insertable and a bad row is rejected**

Run these as **two separate statements** — the second is expected to error, and
in one batch that would abort the transaction before you see which constraint
fired. Real hero ids are used deliberately so the CHECK is what rejects the row,
not a foreign key.

```sql
-- 1. A decline with no text must be ACCEPTED.
begin;
insert into public.hero_relationship_blurbs (hero_a, hero_b, blurb, author, status)
select least(a.id, b.id), greatest(a.id, b.id), null, 'claude', 'no_relationship'
from public.heroes a, public.heroes b
where a.name = 'Batman' and a.fame_score >= 90 and b.name = 'Green Arrow'
limit 1
on conflict (hero_a, hero_b) do update set status = 'no_relationship', blurb = null;
select status, blurb from public.hero_relationship_blurbs
where status = 'no_relationship';
rollback;
```

Expected: one row returned, `blurb` null. Proves a decline is storable.

```sql
-- 2. A 'written' row with no text must be REJECTED.
begin;
insert into public.hero_relationship_blurbs (hero_a, hero_b, blurb, author, status)
select least(a.id, b.id), greatest(a.id, b.id), null, 'claude', 'written'
from public.heroes a, public.heroes b
where a.name = 'Batman' and a.fame_score >= 90 and b.name = 'Green Arrow'
limit 1
on conflict (hero_a, hero_b) do update set status = 'written', blurb = null;
rollback;
```

Expected: **error** naming `hero_relationship_blurbs_written_has_text`. If this
succeeds instead, the constraint did not apply — stop and report. Both `rollback`
statements discard the test rows.

- [ ] **Step 6: Regenerate types**

Call `mcp__supabase__generate_typescript_types` and write the result to
`src/types/database.generated.ts`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260727160000_relationship_blurb_status.sql src/types/database.generated.ts
git commit -m "feat(db): let a relationship blurb record a decline, not just a success

The queue feeding blurb authoring is drawn from ComicVine's free-text
arrays, so a real share of high-fame pairs are not relationships at all.
Without a way to record 'nothing true to say here', the queue never
drains and the same junk resurfaces every session.

Also states the table's DDL in a migration for the first time — it was
applied via MCP and never committed, so the repo could not describe it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The authoring queue view

**Files:**
- Create: `supabase/migrations/20260727161000_relationship_blurb_queue.sql`

**Interfaces:**
- Consumes: `hero_relationship_blurbs.status` from Task 1.
- Produces: view `public.hero_relationship_blurb_queue` with columns
  `hero_a text, hero_b text, name_a text, name_b text, fame_a int, fame_b int,
  publisher text, kind text, fame_total int`. `hero_a < hero_b` always, matching
  the blurbs table's ordering constraint. `kind` is `'family' | 'enemy' | 'ally'`.

- [ ] **Step 1: Write the migration**

```sql
-- The remaining blurb-authoring work, as a view.
--
-- A view, not a frozen list, so authoring is resumable with no bookkeeping: it
-- excludes every pair already recorded in hero_relationship_blurbs (ANY status,
-- including declines), so a later session just reads it and continues.
--
-- Three filters, each measured 2026-07-27:
--
--   Non-teammate only. Teammate edges exist BECAUSE the two share a named
--   roster, so describeRelationship() already emits something true and specific
--   ("Served alongside Storm in the X-Men"). A blurb there mostly restates it.
--   Excluding them drops 2,388 pairs at this fame gate.
--
--   Both fame >= 60. Yields 3,833 non-teammate pairs; >= 50 would add 254 and
--   >= 40 would add 4,813, at falling quality.
--
--   Same publisher. Removes 775 pairs that are overwhelmingly name-collision
--   artifacts — the Peacemaker/Optimus Prime class. Leaves 3,058.
--
-- The view SELECTS candidates; it does not CERTIFY them. Same-publisher junk
-- survives it (Rocket Raccoon/Venom, both Marvel, not allies in any sense).
-- That residue is what the decline path in hero_relationship_blurbs.status is
-- for. Expect a real decline rate and do not treat it as failure.
--
-- No ORDER BY here: ordering belongs to the consuming query. Read it with
--   select * from public.hero_relationship_blurb_queue
--   order by fame_total desc, name_a limit 100;
create or replace view public.hero_relationship_blurb_queue as
with e as (
  select least(r.hero_id, r.related_id) as a,
         greatest(r.hero_id, r.related_id) as b,
         min(case r.kind when 'enemy' then 1 when 'ally' then 2 else 3 end) as kind_ord
  from public.hero_relationships r
  where r.source is distinct from 'curated'
  group by 1, 2
),
f as (
  select least(hero_id, related_hero_id) as a,
         greatest(hero_id, related_hero_id) as b,
         0 as kind_ord
  from public.hero_relatives
  where related_hero_id is not null
  group by 1, 2
),
u as (
  -- min(): a pair that is both kin and ally is kin, which is the more specific
  -- fact and the better thing to write about.
  select a, b, min(kind_ord) as kind_ord
  from (select * from e union all select * from f) z
  group by 1, 2
)
select
  u.a as hero_a,
  u.b as hero_b,
  ha.name as name_a,
  hb.name as name_b,
  ha.fame_score as fame_a,
  hb.fame_score as fame_b,
  ha.publisher as publisher,
  case u.kind_ord when 0 then 'family' when 1 then 'enemy' else 'ally' end as kind,
  ha.fame_score + hb.fame_score as fame_total
from u
join public.heroes ha on ha.id = u.a
join public.heroes hb on hb.id = u.b
where u.kind_ord < 3
  and least(ha.fame_score, hb.fame_score) >= 60
  and ha.publisher is not distinct from hb.publisher
  and not exists (
    select 1 from public.hero_relationship_blurbs bl
    where bl.hero_a = u.a and bl.hero_b = u.b
  );

-- Deliberately NOT granted to anon or authenticated. This is an authoring tool
-- read through the service role, not app data. Granting it would expose a
-- 3,000-row scan on a hot table to the public API for no product reason.
revoke all on public.hero_relationship_blurb_queue from anon, authenticated;
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with name `relationship_blurb_queue`.

- [ ] **Step 3: Verify the size and the shape of both ends**

```sql
select count(*) as remaining from public.hero_relationship_blurb_queue;

(select 'top' as end, name_a, name_b, kind, fame_total
 from public.hero_relationship_blurb_queue order by fame_total desc, name_a limit 5)
union all
(select 'tail', name_a, name_b, kind, fame_total
 from public.hero_relationship_blurb_queue order by fame_total asc, name_a limit 5);
```

Expected: `remaining` between 3,000 and 3,058 (the 36 written pairs are excluded,
but only those that would otherwise have qualified). The `top` rows are marquee
same-publisher pairs. The `tail` rows will look obscure — that is expected and is
what the decline path handles.

- [ ] **Step 4: Verify the view never emits a pair already recorded**

```sql
select count(*) as leaked
from public.hero_relationship_blurb_queue q
join public.hero_relationship_blurbs bl
  on bl.hero_a = q.hero_a and bl.hero_b = q.hero_b;
```

Expected: `0`. This is the property that makes authoring resumable; if it is
non-zero the loop will re-offer finished pairs forever.

- [ ] **Step 5: Verify pair ordering matches the blurbs table constraint**

```sql
select count(*) as misordered
from public.hero_relationship_blurb_queue where hero_a >= hero_b;
```

Expected: `0`. A misordered row would fail the `hero_a < hero_b` check on insert.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260727161000_relationship_blurb_queue.sql
git commit -m "feat(db): expose the remaining blurb work as a resumable queue

Non-teammate, both fame >= 60, same publisher, minus everything already
recorded. ~3,000 pairs. Because it excludes declines too, an authoring
session just reads the view and continues with no bookkeeping.

Not granted to anon: this is an authoring tool, not app data.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `get_hero_neighborhood` — bounded reverse edges, and the status filter

The RPC builds its candidate set from **outgoing edges only**
(`where r.hero_id = p_hero_id`), so a character nobody's arrays point out from
renders an empty universe page even when many characters point at them. 1,468
heroes are in that state, including Dracula (70 incoming), Harry Potter (10) and
Sherlock Holmes (5).

A naive union is not acceptable. Measured on Batman with `explain analyze`:
2,792 candidates → **2,928 ms**, against a 3s anon `statement_timeout`. Bounding
the reverse pull to the top 150 by rank gives 241 candidates → **10 ms**.

**Files:**
- Create: `supabase/migrations/20260727162000_neighborhood_reverse_edges.sql`

**Interfaces:**
- Consumes: `hero_relationship_blurbs.status` from Task 1.
- Produces: `public.get_hero_neighborhood(p_hero_id text, p_limit integer)`
  returning the same `json` shape as before —
  `{ nodes: NeighborNode[], edges: NeighborEdge[] }`. No caller changes.

- [ ] **Step 1: Capture the current Batman node set, before any change**

This is the regression baseline. Run it and **save the output** — Step 5 compares
against it.

```sql
select string_agg(id, ',' order by id) as node_ids
from json_to_recordset(
  (select public.get_hero_neighborhood(
     (select id from public.heroes where name = 'Batman' and fame_score >= 90 limit 1), 24)->'nodes')
) as x(id text);
```

- [ ] **Step 2: Write the migration**

Only four things change from the current definition: the `cand` CTE gains a
bounded reverse source and an `is_out` flag; `per_kind` and `neighbours` sort by
`is_out desc` first; and the blurb join gains a status filter. Everything else is
carried over verbatim.

```sql
-- Universe pages were blank for anyone whose own arrays were empty.
--
-- get_hero_neighborhood built candidates from OUTGOING edges only, so a
-- character nobody points out from got an empty page even when many characters
-- pointed AT them. Measured 2026-07-27: 1,468 heroes have zero outgoing edges
-- but at least one incoming edge or kin link. Dracula had 70 characters naming
-- him an enemy and rendered nothing. Harry Potter 10. Sherlock Holmes 5.
--
-- Why the reverse pull is BOUNDED. The naive union is a page-killer:
--
--   Batman, outgoing only          135 candidates      (today)
--   Batman, naive union          2,792 candidates      2,928 ms
--   Batman, + top-150 reverse      241 candidates         10 ms
--
-- Anon statement_timeout is 3s, so the naive version times out the highest
-- traffic universe page in the app. The cost is one heroes_pkey lookup per
-- candidate at ~1ms under the free-tier IO ceiling, so the fix is to score
-- fewer candidates, not to index harder.
--
-- `rank` is the subject's position in the OTHER character's list, so rank 1
-- means the subject is that character's top enemy. Ordering the reverse pull by
-- it is a genuine relevance signal, not an arbitrary cut.
--
-- Why outgoing WINS. A character's own stated cast outranks people who merely
-- name them, so is_out sorts first in both the per-kind window and the final
-- order. Batman has 135 outgoing candidates for 24 slots, so his page is
-- unchanged; Dracula has none, so his fills entirely from reverse edges.
create or replace function public.get_hero_neighborhood(p_hero_id text, p_limit integer default 24)
 returns json
 language sql
 stable
as $function$
  with subj as (
    select id, publisher from public.heroes where id = p_hero_id
  ),
  fam_all as (
    select r.hero_id as a, r.related_hero_id as b, r.relation::text as relation
    from public.hero_relatives r where r.related_hero_id is not null
    union
    select r.related_hero_id as a, r.hero_id as b,
           case r.relation::text
             when 'parent' then 'child'
             when 'child' then 'parent'
             when 'grandparent' then 'grandchild'
             when 'grandchild' then 'grandparent'
             when 'aunt_uncle' then 'niece_nephew'
             when 'niece_nephew' then 'aunt_uncle'
             when 'ancestor' then 'descendant'
             else r.relation::text
           end
    from public.hero_relatives r where r.related_hero_id is not null
  ),
  cand as (
    select id,
           min(kind_ord) as kind_ord,
           -- Prefer the outgoing rank when the pair is mutual, so an existing
           -- page's ordering is untouched by the new reverse source.
           coalesce(min(best_rank) filter (where is_out = 1), min(best_rank)) as best_rank,
           max(is_out) as is_out
    from (
      select r.related_id as id,
             case r.kind when 'enemy' then 1 when 'ally' then 2 else 3 end as kind_ord,
             r.rank as best_rank,
             1 as is_out
      from public.hero_relationships r
      where r.hero_id = p_hero_id
        and r.source is distinct from 'curated'
      union all
      -- Bounded. See the header: unbounded this is 2,928ms on Batman.
      select * from (
        select r.hero_id as id,
               case r.kind when 'enemy' then 1 when 'ally' then 2 else 3 end as kind_ord,
               r.rank as best_rank,
               0 as is_out
        from public.hero_relationships r
        where r.related_id = p_hero_id
          and r.source is distinct from 'curated'
        order by r.rank asc
        limit 150
      ) rev
      union all
      select f.b as id, 0 as kind_ord, 0 as best_rank, 1 as is_out
      from fam_all f where f.a = p_hero_id
    ) u
    where id <> p_hero_id
    group by id
  ),
  scored as (
    select c.id, c.kind_ord, c.best_rank, c.is_out, h.fame_score,
           (h.publisher is not distinct from s.publisher) as same_universe
    from cand c
    join public.heroes h on h.id = c.id
    cross join subj s
  ),
  per_kind as (
    select *,
      row_number() over (
        partition by kind_ord
        order by is_out desc, same_universe desc, fame_score desc nulls last, best_rank asc nulls last
      ) as k_rn
    from scored
  ),
  neighbours as (
    select id
    from per_kind
    order by is_out desc,
             (k_rn > greatest(3, p_limit / 3)),
             same_universe desc,
             k_rn,
             fame_score desc nulls last
    limit p_limit
  ),
  node_ids as (
    select p_hero_id as id
    union
    select id from neighbours
  ),
  node_rows as (
    select h.id, h.name, h.avatar_url, h.portrait_url, h.image_md_url, h.image_url,
           h.portrait_blurhash,
           h.alignment, h.publisher, h.fame_score, h.teams,
           h.intelligence, h.strength, h.speed, h.durability, h.power, h.combat,
           h.powerstats_total,
           (h.id = p_hero_id) as is_subject
    from public.heroes h
    join node_ids n on n.id = h.id
  ),
  pair_edges as (
    select distinct
      least(r.hero_id, r.related_id) as a,
      greatest(r.hero_id, r.related_id) as b,
      r.kind,
      null::text as relation
    from public.hero_relationships r
    where r.hero_id in (select id from node_ids)
      and r.related_id in (select id from node_ids)
      and r.hero_id <> r.related_id
      and r.source is distinct from 'curated'
    union
    select distinct f.a, f.b, 'family', f.relation
    from fam_all f
    where f.a in (select id from node_ids)
      and f.b in (select id from node_ids)
      and f.a <> f.b
  ),
  ranked as (
    select
      case when kind = 'family' then a else least(a, b) end as a,
      case when kind = 'family' then b else greatest(a, b) end as b,
      kind, relation,
      row_number() over (
        partition by least(a, b), greatest(a, b)
        order by case kind
                   when 'family' then 0 when 'enemy' then 1
                   when 'ally' then 2 when 'teammate' then 3 else 4 end,
                 (a is distinct from p_hero_id)
      ) as rn
    from pair_edges
  ),
  edge_rows as (
    select r.a as "from", r.b as "to", r.kind, r.relation,
           case when p_hero_id in (r.a, r.b) then bl.blurb end as blurb
    from ranked r
    -- status filter: a decline row carries a null blurb, and must yield null so
    -- the card falls back to describeRelationship() rather than showing nothing.
    left join public.hero_relationship_blurbs bl
      on bl.hero_a = least(r.a, r.b) and bl.hero_b = greatest(r.a, r.b)
     and bl.status = 'written'
    where r.rn = 1
  )
  select json_build_object(
    'nodes', coalesce((select json_agg(row_to_json(node_rows)) from node_rows), '[]'::json),
    'edges', coalesce((select json_agg(row_to_json(edge_rows)) from edge_rows), '[]'::json)
  );
$function$;
```

- [ ] **Step 3: Apply the migration**

Use `mcp__supabase__apply_migration` with name `neighborhood_reverse_edges`.

- [ ] **Step 4: Verify the previously-blank pages now fill**

```sql
select h.name,
       json_array_length(public.get_hero_neighborhood(h.id, 24)->'nodes') as nodes
from public.heroes h
where h.name in ('Dracula', 'Harry Potter', 'Sherlock Holmes', 'James Bond')
  and h.fame_score >= 60
order by nodes desc;
```

Expected: Dracula > 20, Harry Potter ≈ 11, Sherlock Holmes ≈ 6, James Bond = 2.
Each count includes the subject itself. All must be > 1; before this change every
one of them was exactly 1.

- [ ] **Step 5: Verify Batman's page is byte-identical to the baseline**

Re-run the exact query from Step 1 and diff against the saved output.

Expected: **identical string**. Batman has 135 outgoing candidates for 24 slots
and `is_out desc` sorts first, so no reverse candidate can displace one. If this
differs, the `is_out` ordering or the `best_rank` coalesce is wrong — stop and
report rather than accepting the new set.

- [ ] **Step 6: Verify the timing budget**

```sql
explain (analyze, buffers)
select public.get_hero_neighborhood(
  (select id from public.heroes where name = 'Batman' and fame_score >= 90 limit 1), 24);
```

Expected: `Execution Time` under 200 ms. The isolated candidate query measured
10 ms; the full RPC adds node and edge assembly. Anything above 1s means the
reverse bound is not being applied — check that the `limit 150` subquery was not
flattened by the planner.

- [ ] **Step 7: Verify a decline row does not blank the card's line**

```sql
begin;
insert into public.hero_relationship_blurbs (hero_a, hero_b, blurb, author, status)
select least(a.id, b.id), greatest(a.id, b.id), null, 'claude', 'no_relationship'
from public.heroes a, public.heroes b
where a.name = 'Batman' and b.name = 'Nightwing' and a.fame_score >= 90
limit 1
on conflict (hero_a, hero_b) do update set status = 'no_relationship', blurb = null;

select count(*) filter (where (e->>'blurb') is not null) as blurbs_present
from json_array_elements(
  public.get_hero_neighborhood(
    (select id from public.heroes where name = 'Batman' and fame_score >= 90 limit 1), 24)->'edges') e
where e->>'to' = (select id from public.heroes where name = 'Nightwing' limit 1)
   or e->>'from' = (select id from public.heroes where name = 'Nightwing' limit 1);
rollback;
```

Expected: `0`. The Batman/Nightwing pair currently HAS a written blurb, so this
proves the status filter actually suppresses it when flipped to a decline. The
`rollback` restores the real row — confirm afterwards with
`select status from public.hero_relationship_blurbs bl join public.heroes a on a.id = bl.hero_a join public.heroes b on b.id = bl.hero_b where a.name = 'Batman' and b.name = 'Nightwing';`
returning `written`.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260727162000_neighborhood_reverse_edges.sql
git commit -m "fix(universe): a character nobody points out from had a blank page

get_hero_neighborhood built candidates from outgoing edges only, so
Dracula rendered nothing while 70 characters named him an enemy. 1,468
heroes were in that state.

The reverse pull is bounded to top-150-by-rank deliberately: the naive
union scores 2,792 candidates on Batman at 2,928ms, against a 3s anon
timeout. Bounded, it is 241 candidates at 10ms. Outgoing edges sort
first, so Batman's page is unchanged and Dracula's fills from reverse.

Also filters the blurb join to status='written' so a recorded decline
falls back to the templated line instead of blanking it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Unit-test the fallback path

`subjectBlurb()` has no test today. It is the function that decides whether the
card shows a written note or the templated line, so the decline path's
correctness rests on it returning null rather than undefined.

**Files:**
- Modify: `__tests__/lib/heroes/neighborhood.test.ts`

**Interfaces:**
- Consumes: `subjectBlurb`, `subjectKind` from
  `src/lib/db/heroes/neighborhood.ts`. No production code changes in this task.

- [ ] **Step 1: Write the failing tests**

First **extend the existing import** at the top of
`__tests__/lib/heroes/neighborhood.test.ts` — do not add a second `import`
statement from the same module, which trips `import/no-duplicates`:

```typescript
import { subjectBlurb, subjectKind } from '../../../src/lib/db/heroes/neighborhood';
```

Then append the new describe block to the end of the file:

```typescript
// A pair the RPC declined carries no blurb on its edge, and the focus card
// renders `blurb ?? summary`. So this must be null, not undefined — otherwise a
// declined pair would show an empty line instead of the templated fallback.
describe('subjectBlurb', () => {
  const withBlurb = [
    { from: 'A', to: 'B', kind: 'enemy' as const, blurb: 'A and B have history.' },
    { from: 'C', to: 'A', kind: 'ally' as const },
  ];

  it('returns the note on a subject-incident edge, either direction', () => {
    expect(subjectBlurb(withBlurb, 'A', 'B')).toBe('A and B have history.');
  });

  it('returns null for an edge the author declined', () => {
    expect(subjectBlurb(withBlurb, 'A', 'C')).toBeNull();
  });

  it('returns null when the two are not directly connected', () => {
    expect(subjectBlurb(withBlurb, 'B', 'C')).toBeNull();
  });

  it('returns null for the subject itself', () => {
    expect(subjectBlurb(withBlurb, 'A', 'A')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
yarn test:ci __tests__/lib/heroes/neighborhood.test.ts
```

Expected: PASS. `subjectBlurb` already coalesces to null via `?? null`, so these
tests document and lock existing behaviour rather than driving a change. **If any
fail, that is a real bug in the decline path** — fix `subjectBlurb` before
continuing, because Task 5 depends on declines degrading gracefully.

- [ ] **Step 3: Commit**

```bash
git add __tests__/lib/heroes/neighborhood.test.ts
git commit -m "test(universe): lock the blurb fallback to null, not undefined

The focus card renders \`blurb ?? summary\`. A declined pair must yield
null so it falls back to the templated line; undefined would render an
empty slot.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Author blurbs — the repeating batch

**This task repeats until the queue view returns zero rows** (roughly 30
iterations at 100 pairs each). Each iteration is identical in procedure and
differs only in data. Each produces its own migration file and its own commit,
so a batch can be reviewed and reverted independently.

**Files:**
- Create, once per iteration:
  `supabase/migrations/YYYYMMDDHHMMSS_relationship_blurbs_batch_NN.sql`

**Interfaces:**
- Consumes: `public.hero_relationship_blurb_queue` from Task 2;
  `hero_relationship_blurbs.status` from Task 1.
- Produces: rows in `public.hero_relationship_blurbs`. No code interfaces.

- [ ] **Step 1: Pull the next 100 pairs**

```sql
select hero_a, hero_b, name_a, name_b, kind, fame_a, fame_b, publisher
from public.hero_relationship_blurb_queue
order by fame_total desc, name_a, name_b
limit 100;
```

The deterministic `order by` matters: `fame_total` alone ties frequently, and an
unstable order would let a pair slip between batches.

- [ ] **Step 2: Judge every pair, then write or decline**

For each of the 100, choose exactly one outcome. Apply the writing contract from
Global Constraints verbatim.

Reference examples, drawn from the existing 36 — match this register:

**Batman · Bane** (enemy):

> Bane worked out what no other rogue had: that Batman is a man on a schedule.
> He wore him down for weeks, then broke his back. Everything since has been a
> rematch.

**Superman · Lois Lane** (ally):

> Lois Lane was investigating Superman long before she loved him, and she is the
> reporter who never needed the glasses explained. Theirs is one of the few
> marriages in comics that keeps being allowed to stick.

**Magneto · Professor X** (enemy):

> Charles Xavier and Erik Lehnsherr want the same thing and disagree entirely
> about what people are — one spent his life teaching, the other survived
> Auschwitz. Between the wars, they keep being friends.

Decline criteria, applied honestly:

| Situation | Status | `note` |
| --- | --- | --- |
| These two have no actual connection; the edge is a ComicVine array artifact (e.g. cross-franchise pairs, one-panel crowd scenes) | `no_relationship` | why you judged it artifact |
| Real connection, but you cannot state a specific checkable fact beyond what the shared-roster fallback already says | `nothing_to_say` | what you'd need to know |
| You are unsure whether the pair is real | `no_relationship` | `'unverified'` |

The third row is the important one: **uncertainty resolves to a decline, never to
a guess.** A declined pair keeps today's templated line, which is honest. A
fabricated one is the failure this whole design exists to prevent.

- [ ] **Step 3: Write the batch migration**

Substitute the real batch number for `NN`. Ids come verbatim from Step 1 — never
resolve heroes by name in the insert, because names collide (`Robin`, `Dracula`
and `Batman` all have multiple rows in `heroes`).

```sql
-- Relationship blurbs, batch NN.
--
-- Pairs drawn from hero_relationship_blurb_queue in fame order. Declines are
-- recorded alongside writes so the queue drains; see 20260727160000 for why.

insert into public.hero_relationship_blurbs
  (hero_a, hero_b, blurb, author, verified, status, note)
values
  ('<hero_a id>', '<hero_b id>',
   'The written note, 125-220 chars, naming both characters.',
   'claude', false, 'written', null),
  ('<hero_a id>', '<hero_b id>',
   null, 'claude', false, 'no_relationship', 'cross-franchise ComicVine artifact'),
  ('<hero_a id>', '<hero_b id>',
   null, 'claude', false, 'nothing_to_say', 'roster overlap only')
on conflict (hero_a, hero_b) do nothing;
```

`on conflict do nothing` guards against a concurrent session having recorded the
same pair between Step 1 and Step 3.

- [ ] **Step 4: Apply the migration**

Use `mcp__supabase__apply_migration` with name `relationship_blurbs_batch_NN`.

- [ ] **Step 5: Verify the batch landed and the queue shrank**

```sql
select status, count(*) from public.hero_relationship_blurbs group by status order by 1;
select count(*) as remaining from public.hero_relationship_blurb_queue;
```

Expected: the status counts rose by exactly 100 in total, and `remaining` fell by
exactly 100. If `remaining` fell by less, a pair failed to insert — most likely a
`hero_a < hero_b` ordering mistake; re-check against Step 1's output.

- [ ] **Step 6: Verify no written row breaks the length contract**

```sql
select count(*) as too_short
from public.hero_relationship_blurbs
where status = 'written' and char_length(blurb) < 125;
```

Expected: `0`. The database check permits 20 characters; 125 is the house rule
from the writing contract and is not enforced by a constraint, so it is asserted
here every batch.

- [ ] **Step 7: Report the decline rate**

```sql
select
  count(*) filter (where status = 'written') as written,
  count(*) filter (where status <> 'written') as declined,
  round(100.0 * count(*) filter (where status <> 'written') / nullif(count(*), 0)) as decline_pct
from public.hero_relationship_blurbs where author = 'claude';
```

Report the running `decline_pct` to the user after each batch. This is the number
that decides whether to widen the queue later (drop to fame ≥ 50, `+254` pairs)
or stop early. A rate above ~50% sustained across three batches means the fame
≥ 60 gate is already past the useful tail — raise it with the user rather than
grinding through 20 more batches of declines.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/*_relationship_blurbs_batch_NN.sql
git commit -m "content(universe): relationship blurbs, batch NN

<W> written, <D> declined. Running total <T> of ~3,058.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 9: Loop**

Re-run Step 1. If it returns rows, start the next iteration with `NN + 1` and a
fresh migration timestamp. If it returns zero rows, the queue is drained — go to
Task 6.

---

### Task 6: Close out

**Files:**
- Modify: `docs/superpowers/specs/2026-07-27-relationship-blurbs-design.md`

- [ ] **Step 1: Measure the final state**

```sql
select
  count(*) filter (where status = 'written') as written,
  count(*) filter (where status = 'no_relationship') as artifact,
  count(*) filter (where status = 'nothing_to_say') as thin
from public.hero_relationship_blurbs;

select count(*) as heroes_with_a_written_blurb
from (
  select hero_a as id from public.hero_relationship_blurbs where status = 'written'
  union
  select hero_b from public.hero_relationship_blurbs where status = 'written'
) x;
```

- [ ] **Step 2: Record the outcome in the spec**

Append a `## Outcome` section to the spec with the four numbers from Step 1, the
final decline rate, and — if the rate came in low enough to justify it — a
recommendation on widening to fame ≥ 50 or re-admitting cross-publisher pairs.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-27-relationship-blurbs-design.md
git commit -m "docs(spec): record relationship blurb outcome

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Deferred, by decision

Recorded so a later reader knows these were considered and consciously left out:

- **Consuming the `no_relationship` denylist** in `rebuild_hero_relationships()`
  to suppress junk edges from the graph. The rows accumulate from Task 5 onward
  and are ready when wanted; acting on them changes every universe page at once
  and deserves its own decision.
- **The 75 characters at fame ≥ 20 with no edges in either direction** —
  Pennywise, Willy Wonka, Katniss Everdeen, Walter White. They are blank for an
  ingest reason, not a blurb reason: ComicVine never carried them, so no pipeline
  ever filled their arrays. Reverse edges cannot help a character with zero
  incoming edges either. This is a sourcing problem.
- **Teammate-pair blurbs** (2,388 pairs at this fame gate). The templated line
  already names the shared roster, which is true and specific.
