# Auth and identity

> Who a Mythique user is — to the router, to Postgres, and to the vote
> counters — and the permission patterns that keep a public catalogue fast
> while per-user writes stay locked. Read this before adding any screen or RPC
> that writes on behalf of a user, or before touching the login flow.

## Mental model: two identity tiers, not one

The app is **not auth-gated for browsing**. A logged-out visitor can read the
entire catalogue and — deliberately — participate in the fun parts. There are
two identity tiers, and every feature must decide which one it needs:

1. **Anonymous device identity.** `src/lib/voterKey.ts` mints a stable
   per-device key (`vk_…`, AsyncStorage-persisted, "not a security boundary —
   a dedup key for a fun poll"). It keys matchup votes
   (`cast_matchup_vote_v2` / `get_matchup_tally_v2`, via `useMatchupVote` →
   `src/lib/db/matchupVotes.ts`) and take agreements (`toggle_take_agreement`
   in `src/lib/db/takes.ts`). The daily-puzzle streak for logged-out players is
   local-only AsyncStorage. There is no cross-surface anon identity — the voter
   key covers votes/agreements only.
2. **Account identity.** Favourites, takes, profile edits, server-side daily
   streaks, contributions. These go through RLS-locked tables or auth-required
   RPCs that **reject anon and otherwise fail silently** — so the client rule
   is: check `useAuth().user` first and route to `/(auth)/login` (with
   `returnTo`) when absent. Never let an anon caller discover the wall via a
   silent no-op.

## The client pieces

`src/lib/supabase.ts` creates the one client (`createClient<Database>`), with
AsyncStorage session storage on native and the SSR-safe localStorage default on
web. **Import it; never re-create a client.** Screens never import it directly
either — DB access goes through `src/lib/db/`.

`src/hooks/useAuth.ts` is session state plus every auth verb: `signIn`,
`signUp`, `signOut`, `resetPassword`, `signInWithGoogle`, `signInWithApple`,
`changePassword`, `deleteAccount`. Notable behaviours:

- The whole app boots behind `loading`, so `getSession()` is guarded on every
  path (resolve, reject, and an 8 s hard timeout) — a hung token refresh must
  degrade to logged-out browsing, never wedge the splash loader.
- Google/Apple OAuth on web sets `redirectTo: window.location.href` so the
  user returns to the page they were acting on; native uses ID-token sign-in.
  OAuth metadata is merged into `user_profiles` (`syncGoogleProfile` /
  `syncAppleProfile` — Apple only returns the name on the *first* sign-in).
- `deleteAccount` calls the `delete-user` edge function
  (`supabase/functions/delete-user/`) with the user's own token, then signs
  out. The UI lives in `/settings` (`app/settings.tsx` + `.web.tsx`).

## AuthGate and redirects

`AuthGate` lives in `app/_layout.tsx` and **must stay a child of the root
layout, not the root itself** — it needs the router context (`useSegments` +
`useRouter`) to exist. Rules: an authenticated user landing on an `(auth)`
screen, or on the root on native, is redirected via `postAuthTarget(returnTo)`;
everyone else falls through (on web the root is the public landing page).

`?returnTo` is attacker-controllable, so it is only ever consumed through
`src/lib/loginRedirect.ts`: `sanitizeReturnTo` requires a single-`/` internal
path (rejects `//evil.com`, the root, and the auth group), `postAuthTarget`
falls back to `/explore`, and `loginHref`/`signupHref` build the outbound
links. The gate owns the post-login redirect — it fires as a second redirect
and would clobber any navigation a screen tried to do itself.

Sign-in methods, all in `app/(auth)/` (each screen has a `.web.tsx` twin):
email/password; Google (hidden in Expo Go — `login.tsx` checks
`Constants.executionEnvironment`, and `_layout.tsx` only configures
`GoogleSignin` when a client ID exists); Apple. Signup parks on a
`pendingEmail` confirmation card (a confirmation-link round-trip loses
`returnTo` — known limitation), and forgot-password has a resend cooldown.

## House rules for permissions

| Pattern | Use for | Example |
| --- | --- | --- |
| Anon-granted `SECURITY DEFINER` RPC | Public writes that dedupe by voter key | `cast_matchup_vote_v2`, `toggle_take_agreement` (`20260712120000_matchup_takes_daily_debate.sql`) |
| Grants-not-RLS | Public read-only **catalog** tables | `heroes` and friends (`20260715104931_heroes_reads_without_rls.sql`, `20260715105126_catalog_reads_without_rls.sql`) |
| Owner-scoped RLS | Per-user rows | `user_favourites`, `user_profiles`, `push_subscriptions` |
| Inline `is_admin` check inside the RPC | Admin surfaces | every `admin_*` RPC checks `user_profiles.is_admin` against `auth.uid()` |

**The RLS planner shackle** is the load-bearing lesson: catalog tables once had
RLS with `USING (true)` — filtering nothing, but its mere presence stopped the
planner using column statistics for non-leakproof operators, and browse queries
ran **7.2 s as anon vs 33 ms as postgres**. The fix (browse went to ~130 ms)
swapped the write barrier from RLS to revoked grants and dropped RLS. New
catalog tables get the same treatment, and the standing rule — echoed in
`docs/ROADMAP.md` — is **always benchmark as the `anon` role**, because the
admin connection lies to you.

Admin gating client-side is `useIsAdmin` (`src/lib/query/heroDetailQueries.ts`,
a React Query read of `user_profiles.is_admin`) plus `useCachedAdminFlag`
(`src/hooks/useCachedAdminFlag.ts`, a localStorage last-known flag so admin UI
renders on first paint). The cache is optimistic by design: every admin surface
re-verifies server-side, so a stale `true` shows a dead entry at worst. Note
there is **no standalone `is_admin` RPC** — the check is inlined in each admin
function; don't invent one in docs or code review comments.

## History

- `docs/superpowers/specs/2026-04-11-google-signin-design.md` — Google sign-in.
- `docs/superpowers/specs/2026-07-15-auth-returnto-design.md` — the sanitized
  `returnTo` flow (part of the 2026-07-15 hardening batch,
  `docs/superpowers/specs/2026-07-15-hardening-execution-plan.md`).
- `docs/superpowers/specs/2026-07-11-matchup-takes-daily-debate-design.md` —
  where anon votes became real votes (voter key, v2 RPCs).
- `docs/superpowers/specs/2026-04-04-profile-redesign.md`,
  `docs/superpowers/specs/2026-04-11-profile-photos-design.md`,
  `docs/superpowers/specs/2026-07-05-profile-reorganize-elevate-design.md` —
  the profile surface that account identity feeds.
