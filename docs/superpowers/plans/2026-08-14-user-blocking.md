# User Blocking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in reader block another user so that user's takes stop reaching them — the fourth and only missing requirement of App Review Guideline 1.2.

**Architecture:** One new table (`blocked_users`) and one added conjunct on `matchup_takes`' existing SELECT policy. Because takes are read straight from the table over PostgREST by seven modules, the filter lives in RLS: every read path is covered by construction and blocked text never leaves the database. A thin `src/lib/db/blocks.ts` handles block/unblock/list; the UI is a block action in `ReportSheet` and an unblock list in settings.

**Tech Stack:** Supabase (Postgres + RLS), TypeScript, React Native (Expo SDK 56), expo-router, jest-expo.

**Spec:** `docs/superpowers/specs/2026-08-14-user-blocking-design.md`

## Global Constraints

- **yarn only.** Never npm or bun.
- Gate for every task: `yarn tsc --noEmit`, `yarn test:ci`, `yarn lint` (`--max-warnings=0`, 0 errors), `yarn check:ui`, `yarn format:check`. Task 5 also runs `yarn docs:links`.
- Migrations are a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql` **and** applied with the Supabase MCP `apply_migration` tool — not by hand in the dashboard. Regenerate `src/types/database.generated.ts` afterwards with the MCP types tool; **never hand-edit it**.
- Screens never import `supabase` directly. All DB access goes through `src/lib/db/`.
- **No `any`**; `unknown` for caught errors.
- **`StyleSheet.create` for all styles**; no inline style objects except `StyleSheet.absoluteFill`; dynamic values in a style array.
- Fonts: `Flame-Regular` display, `FlameSans-Regular` body, `Nunito_700Bold` UI labels. **Never `Flame-Bold`.** Clamped Flame text needs `lineHeight` ≥ 1.22× `fontSize` (uppercase-only text is exempt — no descenders).
- **Never a coloured vertical side rail.** Colour belongs on a pill or badge that labels something.
- Design-scale ratchets: `RADIUS_SCALE = {4,8,12,16,20,24,999}`, `FONT_SCALE = {10,11,12,13,13.5,14.5,15,18,23,30,38,46}`. Do **not** raise `scripts/ui/design-baseline.json`.
- A screen with a `.web.tsx` twin must be changed in **both** or they drift.
- Commit directly to `main`. No feature branches. Do not push. Stage only the files you changed — **never `git add -A`**.

---

### Task 1: The table, its policies, and the takes filter

The whole feature is this migration. Everything after it is surface.

**Files:**
- Create: `supabase/migrations/<timestamp>_blocked_users.sql`
- Modify: `src/types/database.generated.ts` (regenerated, never hand-edited)

**Interfaces:**
- Produces: table `public.blocked_users(blocker_id uuid, blocked_id uuid, created_at timestamptz)`, and a replaced `takes_public_read` policy on `matchup_takes`.

- [ ] **Step 1: Write the migration**

```sql
-- Guideline 1.2 requires four things of an app with UGC; this is the fourth.
-- One-directional: the blocker stops seeing the blocked user's takes, and the
-- blocked user is never told. See
-- docs/superpowers/specs/2026-08-14-user-blocking-design.md.
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_no_self check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

-- Scoped to the owner on all three verbs. There is deliberately NO update
-- policy: a block has no mutable state, and unblocking is a delete. And
-- nobody can read whose block list they are on, which is what keeps blocking
-- invisible to the person blocked.
create policy blocked_users_own_read on public.blocked_users
  for select using (blocker_id = (select auth.uid()));
create policy blocked_users_own_insert on public.blocked_users
  for insert with check (blocker_id = (select auth.uid()));
create policy blocked_users_own_delete on public.blocked_users
  for delete using (blocker_id = (select auth.uid()));

grant select, insert, delete on public.blocked_users to authenticated;

-- The filter. Takes are read straight from the table by seven modules, so this
-- policy is the only place that catches all of them — and blocked text never
-- leaves the database. `(select auth.uid())` stays wrapped to keep the initplan
-- optimisation; unwrapped it is re-evaluated per row.
drop policy if exists takes_public_read on public.matchup_takes;
create policy takes_public_read on public.matchup_takes
  for select using (
    ((status = 'visible') or (user_id = (select auth.uid())))
    and not exists (
      select 1 from public.blocked_users b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = matchup_takes.user_id
    )
  );
```

- [ ] **Step 2: Apply it with the MCP tool**

Use `apply_migration` with the file's contents. Do not paste into the dashboard.

- [ ] **Step 3: Prove the policy in the database, not in your head**

Run these and paste the output in your report:

```sql
-- the new table's policies
select policyname, cmd, qual, with_check from pg_policies
where schemaname='public' and tablename='blocked_users' order by policyname;

-- the replaced takes policy
select policyname, cmd, qual from pg_policies
where schemaname='public' and tablename='matchup_takes' and cmd='SELECT';

-- self-block is impossible
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid='public.blocked_users'::regclass and contype='c';
```

Expected: three policies on `blocked_users` (select/insert/delete, each
`blocker_id = ( SELECT auth.uid() AS uid)`), one SELECT policy on
`matchup_takes` containing `NOT (EXISTS ( SELECT 1 FROM blocked_users`, and the
`blocked_users_no_self` check.

- [ ] **Step 4: Regenerate the types**

Use the MCP `generate_typescript_types` tool and write the result to
`src/types/database.generated.ts`. Confirm `blocked_users` appears in it.

- [ ] **Step 5: Gate and commit**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint && yarn format:check`

```bash
git add supabase/migrations src/types/database.generated.ts
git commit -m "feat(blocking): a blocked user's takes stop reaching you, in RLS"
```

---

### Task 2: `src/lib/db/blocks.ts`

**Files:**
- Create: `src/lib/db/blocks.ts`
- Test: `__tests__/lib/db/blocks.test.ts`

**Interfaces:**
- Consumes: the table from Task 1; `supabase` from `src/lib/supabase`.
- Produces:
  - `interface BlockedUser { userId: string; displayName: string | null; avatarUrl: string | null; createdAt: string }`
  - `blockUser(blockedId: string): Promise<boolean>`
  - `unblockUser(blockedId: string): Promise<boolean>`
  - `getBlockedUsers(): Promise<BlockedUser[]>`

- [ ] **Step 1: Write the failing tests**

Follow the mocking style already used in `__tests__/lib/db/`. Cover: block
inserts a row and returns true; block returns false and warns on error; block is
idempotent (a duplicate primary key is not an error the caller should see);
unblock deletes and returns true; `getBlockedUsers` maps rows to `BlockedUser`
and returns `[]` on error rather than throwing.

- [ ] **Step 2: Run them and watch them fail**

Run: `yarn test:ci __tests__/lib/db/blocks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`blocker_id` is never passed from the client — it is `auth.uid()`, enforced by
the insert policy's `with check`. Sending it would be a lie the database would
reject anyway. Follow the error-handling shape of `src/lib/db/takes.ts`:
`console.warn` and return a falsy result rather than throwing, because these are
called from render paths.

`getBlockedUsers` joins `user_profiles` for the display name and avatar so the
settings list has something to show.

- [ ] **Step 4: Run them and watch them pass**

Run: `yarn test:ci __tests__/lib/db/blocks.test.ts`

- [ ] **Step 5: Gate and commit**

```bash
git add src/lib/db/blocks.ts __tests__/lib/db/blocks.test.ts
git commit -m "feat(blocking): the data layer for a block list"
```

---

### Task 3: The block action in `ReportSheet`

**Files:**
- Modify: `src/components/report/ReportSheet.tsx`
- Modify: `src/components/takes/TakesSection.tsx`

**Interfaces:**
- Consumes: `blockUser` from Task 2.
- Produces: `ReportSheet` gains optional `authorId?: string | null` and `authorName?: string | null`.

- [ ] **Step 1: Thread the author through**

`ReportSheet` is rendered in three places, and only one of them is about a
person: `TakesSection.tsx:293`. The other two (`app/character/[id].tsx:1787`,
`app/character/[id].web.tsx:2694`) report a page or an image, where there is
nobody to block. So the block action renders **only** when
`context === 'take'` and `authorId` is present — do not show a dead control on
the character page.

`reportTarget` in `TakesSection` is a `Take`, which already carries `userId` and
`displayName`, so pass `authorId={reportTarget?.userId ?? null}` and
`authorName={reportTarget?.displayName ?? null}`.

- [ ] **Step 2: Add the action**

Sits beside the existing report action. Copy: **"Block this person"**, with a
line of explanation — *"You won't see their takes any more. They won't be told."*
Say what happens, in the reader's words.

Blocking requires an account. `ReportSheet` already takes `user` and
`onRequestSignIn` — reuse them exactly as reporting does; do not invent a second
sign-in route.

Confirm before acting: blocking is not destructive but it is not obviously
reversible to someone who has just tapped it, so a confirm step with an explicit
"Block" is warranted. On success, close the sheet and refresh the takes list so
the blocked person's takes disappear immediately rather than at the next fetch.

- [ ] **Step 3: Gate and commit**

Run the full gate. No unit test — this is a view, and per CLAUDE.md screens are
not rendering-tested. Say so in your report rather than inventing one.

```bash
git add src/components/report/ReportSheet.tsx src/components/takes/TakesSection.tsx
git commit -m "feat(blocking): block a person from the sheet that already reports them"
```

---

### Task 4: The unblock list in settings

**Files:**
- Modify: `app/settings.tsx`
- Modify: `app/settings.web.tsx`

**Interfaces:**
- Consumes: `getBlockedUsers`, `unblockUser` from Task 2.

- [ ] **Step 1: Add the section**

A "Blocked people" section listing each blocked user's display name and avatar
with an unblock control per row. Empty state when the list is empty — *"You
haven't blocked anyone."* — rather than an empty box.

Signed-out users do not see the section at all; there is no block list without
an account.

**Both files.** `app/settings.tsx` and `app/settings.web.tsx` are a native/web
pair and drift is the failure mode this repo has hit repeatedly. Shared fetching
belongs in a platform-neutral hook in `src/hooks/`, not duplicated across the
pair.

- [ ] **Step 2: Gate and commit**

```bash
git add app/settings.tsx app/settings.web.tsx src/hooks
git commit -m "feat(blocking): a place to change your mind"
```

---

### Task 5: Prove the policy, then document it

The suite mocks Supabase, so **nothing in it tests the RLS policy** — which is
the entire feature. This task is the verification, and it is not optional.

**Files:**
- Modify: `docs/features/arena-and-matchups.md`
- Modify: `docs/features/auth-and-identity.md`
- Modify: `docs/architecture/app-store-submission.md`

- [ ] **Step 1: Verify against the real database**

Using the Supabase MCP `execute_sql` tool and two real user ids from
`user_profiles`, prove each of these and paste the output:

1. With no block, a take by B is visible to A.
2. After inserting a block (A → B), that take is not returned for A.
3. B still sees their own take.
4. Anon still sees it — `auth.uid()` is null, so the `NOT EXISTS` is trivially true.
5. After deleting the block, it returns for A.

Simulate a user with `set local role authenticated;` and
`set local request.jwt.claims = '{"sub":"<uuid>"}';` inside a transaction, and
`rollback` at the end so no test rows survive. If you cannot make that work,
**stop and report** rather than declaring the policy correct from reading it.

- [ ] **Step 2: Update the three docs**

`arena-and-matchups.md` — takes are now filtered by the reader's block list in
RLS, so every read path inherits it. `auth-and-identity.md` — blocking is a
per-user write that requires an account, unlike anon-friendly matchup votes; the
policy pattern is worth recording beside the existing grants-not-RLS notes.
`app-store-submission.md` — tick "Blocking implemented" in the Before submitting
list, and rewrite the BLOCKER section to say it is closed and how.

Add the spec to each doc's History section by explicit path.

- [ ] **Step 3: Gate and commit**

Run: `yarn tsc --noEmit && yarn test:ci && yarn lint && yarn check:ui && yarn format:check && yarn docs:links`

```bash
git add docs/features/arena-and-matchups.md docs/features/auth-and-identity.md docs/architecture/app-store-submission.md
git commit -m "docs(blocking): Guideline 1.2's fourth requirement is closed"
```

---

## Self-Review

**Spec coverage.** Table + RLS → Task 1. `blocks.ts` → Task 2. Block action in
`ReportSheet` → Task 3. Unblock list in settings → Task 4. RLS verification and
the three doc updates → Task 5. One-directional semantics are enforced by the
policy shape in Task 1 and asserted in Task 5. The anon case is covered by Task
5 step 1.4.

**Deliberate gap.** No test asserts the RLS policy, because the suite mocks
Supabase and cannot reach it. Task 5's database verification is the
substitute, and it is a required step rather than a suggestion.

**Type consistency.** `BlockedUser` is defined in Task 2 and consumed in Task 4.
`blockUser(blockedId)` takes only the blocked id — `blocker_id` comes from
`auth.uid()` in the policy, never from the client. `ReportSheet`'s new
`authorId`/`authorName` props are added in Task 3 and passed from
`TakesSection` in the same task.
