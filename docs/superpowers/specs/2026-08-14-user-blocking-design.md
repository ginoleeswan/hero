# Blocking a user — Guideline 1.2

**Date:** 2026-08-14
**Status:** designed, not yet implemented
**Domain docs to update on landing:** `docs/features/arena-and-matchups.md` (takes),
`docs/features/auth-and-identity.md` (RLS pattern),
`docs/architecture/app-store-submission.md` (tick the blocker)

## Why

App Review Guideline 1.2 requires **four** things of any app carrying
user-generated content. `docs/architecture/app-store-submission.md` records that
we have three — filtering (report reasons + `admin_reports_queue`), reporting
(`ReportSheet`, wired into every take), and published contact info
(`app/support.tsx`). **Blocking is missing entirely**, and it is the single most
likely cause of a rejection.

The UGC surface is takes: free text on a public matchup, attached to a display
name and an avatar, shown to every reader. That is exactly what the guideline is
written for.

## Semantics — one-directional

I block you, I stop seeing your takes. You keep seeing mine, and you are not
told. That is what the guideline asks for: the *blocker* stops seeing the
blocked user's content. It is not a mutual ban, and it deliberately never
reveals a blocker's identity to the person they blocked.

Rejected alternatives, recorded so they are not re-litigated:

- **Mutual.** Stronger if a blocked user is targeting someone specifically, but
  it lets that person infer they were blocked when takes vanish, and doubles the
  policy surface.
- **Also hiding their agreements.** Makes `agree_count` differ per viewer, which
  breaks caching and reads as a bug rather than a feature.

## The load-bearing decision: filter in RLS, not in the client

Takes are read **straight from the table** over PostgREST — there is no read
RPC. `src/lib/db/takes.ts` exposes `getTakes(a, b)` and `getMyTakes(userId)`,
and seven modules consume them: `TakesSection`, `MyTakes`, `useMatchupTakes`,
`useProfileData`, `useVersusHub`, `useNotificationInbox`, and
`LandingPage.dom.tsx`.

So the filter goes in the **row-level security policy on `matchup_takes`**, not
in `takes.ts`:

- Every read path is filtered by construction, including the four that go
  nowhere near `takes.ts`'s two functions, and including any path added later.
- Blocked content never leaves the database. A client-side filter would ship the
  text and the author's name to the device and merely decline to draw it —
  which is not blocking, it is hiding, and it is trivially bypassed.
- It matches the repo's existing preference for normalising upstream rather than
  filtering per render.

### The policy

`matchup_takes` today has exactly one SELECT policy:

```sql
takes_public_read  SELECT  TO public
  USING ((status = 'visible') OR (user_id = (SELECT auth.uid())))
```

It gains one conjunct:

```sql
USING (
  ((status = 'visible') OR (user_id = (SELECT auth.uid())))
  AND NOT EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE b.blocker_id = (SELECT auth.uid())
      AND b.blocked_id = matchup_takes.user_id
  )
)
```

Three things this gets right:

- **Anon is unaffected.** `auth.uid()` is null, so the `NOT EXISTS` is trivially
  true. Anon has no block list and sees everything, which is correct.
- **You cannot hide your own takes from yourself.** The `user_id = auth.uid()`
  disjunct still applies, and a `CHECK (blocker_id <> blocked_id)` makes
  self-blocking impossible in the first place.
- **`(SELECT auth.uid())` stays wrapped**, preserving the initplan optimisation
  the rest of this schema uses — an unwrapped `auth.uid()` is re-evaluated per
  row.

**No recursion risk.** The policy queries `blocked_users`, whose own policy is
`blocker_id = (SELECT auth.uid())` and does not reference `matchup_takes`. The
subquery runs under the reader's own RLS and returns exactly their block list,
which is what the predicate wants.

## Schema

```sql
create table public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_no_self check (blocker_id <> blocked_id)
);
```

RLS on, with policies scoped to the owner for **select, insert and delete** —
`blocker_id = (SELECT auth.uid())`. No update: a block has no mutable state, and
unblocking is a delete. **Nobody can read whose block list they are on**, which
is what keeps blocking invisible to the blocked user.

An index on `(blocked_id)` is not needed: every query is by `blocker_id`, which
the primary key already leads with.

> **Trap.** A new table gets RLS auto-enabled with no policies, and anon then
> reads zero rows while every RPC silently returns `[]`. The policies are part
> of the same migration, not a follow-up.

## Surfaces

| Surface | Where |
| --- | --- |
| Block action | `src/components/report/ReportSheet.tsx`, beside the existing report action |
| Unblock list | `app/settings.tsx` (+ `.web.tsx`) |
| Data layer | `src/lib/db/blocks.ts` — new, per the one-module-per-table convention |

Blocking requires an account: you need a stable identity to hold a block list.
Check `useAuth().user` and route to `/(auth)/login` when absent, exactly as
favourites and takes do. This is the "per-user writes require auth" half of the
identity model in `docs/features/auth-and-identity.md` — unlike matchup votes,
which are deliberately anon-friendly via the device voter key.

The unblock list shows the blocked user's display name and avatar from
`user_profiles`, with an unblock control per row and an empty state.

## Testing

Per repo convention, pure logic and data-layer functions with mocked Supabase;
no rendering tests for screens.

- `src/lib/db/blocks.ts` — block, unblock, list, with the Supabase client mocked.
- **The RLS policy is the feature**, and a mocked client cannot test it. Verify
  it directly against the database with two real accounts: A sees B's take, A
  blocks B, A no longer sees it, B still sees their own, anon still sees it,
  A unblocks and it returns. Record the results in the PR — a green test suite
  proves nothing about a policy.

## Out of scope

- Blocking anon take authors. Takes require an account to post, so every take
  has a `user_id`.
- Reporting changes. Reporting already exists and is untouched.
- `TRUNCATE` granted to `anon` on 39 tables — real but unreachable through
  PostgREST, so a separate tidy-up rather than a blocker.
