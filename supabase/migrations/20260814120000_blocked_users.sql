-- Guideline 1.2 requires four things of an app carrying user-generated content.
-- We had three: filtering (report reasons + admin_reports_queue), reporting
-- (ReportSheet on every take) and published contact info (app/support.tsx).
-- This is the fourth.
--
-- One-directional: the blocker stops seeing the blocked user's takes, and the
-- blocked user is never told. That is what the guideline asks for, and it keeps
-- a blocker's identity from leaking to the person they blocked.
--
-- Design: docs/superpowers/specs/2026-08-14-user-blocking-design.md

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_no_self check (blocker_id <> blocked_id)
);

comment on table public.blocked_users is
  'Guideline 1.2 block list. One-directional: blocker stops seeing blocked''s takes. Read by matchup_takes RLS, so every takes read path inherits the filter.';

alter table public.blocked_users enable row level security;

-- Scoped to the owner on all three verbs. Deliberately NO update policy: a block
-- has no mutable state and unblocking is a delete. And nobody can read whose
-- block list they are on, which is what keeps blocking invisible to the blocked.
drop policy if exists blocked_users_own_read on public.blocked_users;
create policy blocked_users_own_read on public.blocked_users
  for select using (blocker_id = (select auth.uid()));

drop policy if exists blocked_users_own_insert on public.blocked_users;
create policy blocked_users_own_insert on public.blocked_users
  for insert with check (blocker_id = (select auth.uid()));

drop policy if exists blocked_users_own_delete on public.blocked_users;
create policy blocked_users_own_delete on public.blocked_users
  for delete using (blocker_id = (select auth.uid()));

grant select, insert, delete on public.blocked_users to authenticated;

-- The filter itself.
--
-- Takes are read STRAIGHT FROM THE TABLE over PostgREST by seven modules
-- (TakesSection, MyTakes, useMatchupTakes, useProfileData, useVersusHub,
-- useNotificationInbox, LandingPage.dom) — there is no read RPC. So this policy
-- is the only place that catches all of them, including any path added later,
-- and blocked text never leaves the database. A client-side filter would ship
-- the body and the author's name to the device and merely decline to draw it.
--
-- `(select auth.uid())` stays wrapped: unwrapped it is re-evaluated per row
-- instead of once as an initplan.
--
-- Anon is unaffected — auth.uid() is null, so the NOT EXISTS is trivially true.
-- You cannot hide your own takes from yourself: the user_id disjunct still
-- applies, and blocked_users_no_self makes self-blocking impossible anyway.
drop policy if exists takes_public_read on public.matchup_takes;
create policy takes_public_read on public.matchup_takes
  for select using (
    ((status = 'visible') or (user_id = (select auth.uid())))
    and not exists (
      select 1
      from public.blocked_users b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = matchup_takes.user_id
    )
  );
