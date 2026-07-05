# Profile — Reorganize & Elevate

**Date:** 2026-07-05
**Status:** Design — pending review
**Scope:** Reorganize the existing Profile screen (web + native) for hierarchy and
identity. No new data, no schema changes. Extract account plumbing into a new
`/settings` route.

## Problem

The current Profile (`app/(tabs)/profile.tsx` + `.web.tsx`) is a competent but
undifferentiated social-profile-meets-settings page. Its weaknesses:

1. **Reads as a settings dump.** Every section — Getting Started, Battle Record,
   Your Universe, Badges, Contributions, Favourites, Account — has identical
   visual weight (same title size, same hairline divider). No hierarchy signals
   what matters.
2. **Scattered stats.** Saved-count appears as a pill *and* a section count;
   battle record is three tiles; badges are `x/y` in a header. No single
   at-a-glance moment.
3. **Oversized, misplaced Account block.** Email, password, member-since, Ko-fi,
   sign-out, and delete-account all sit inline on the main profile — read-only
   info, support CTAs, and destructive actions mixed together. On desktop this
   plumbing occupies the entire left sidebar.
4. **The fandom identity (taste, badges, battle record) — the emotional payload
   of a fan app — is buried mid-scroll and styled as muted as "Change Password".**

## Goals

- Establish clear hierarchy: **identity → fandom → collection**, with account
  plumbing removed from the main scroll.
- Introduce a single **stat strip** ("you at a glance") that absorbs the scattered
  counts.
- Elevate **Your Universe** and **Badges** as the fandom identity core.
- Make **My Favourites** the visual anchor.
- Extract account management into a dedicated **`/settings`** route.
- Preserve web/native parity and reuse the existing platform-neutral hooks
  (`useProfile`, `useProfileData`) unchanged.

## Non-goals

- No changes to data hooks, DB, or the badge/taste/battle computation logic.
- No bold themed "hero card" identity treatment (that was the deferred, more
  ambitious option). This is reorganization + elevation only.
- No change to avatar/cover upload behavior or the share-universe card.

## New Profile structure (ordered)

```
COVER (unchanged treatment)            [⚙ gear → /settings]  top-right
  avatar overlaps cover
IDENTITY
  Name  [✎ edit]
  quiet meta line: "Member since June 2025"  (+ @username on web)
  STAT STRIP  ← NEW, absorbs scattered counts
  [ Share my universe ]  (unchanged button)
GETTING STARTED  (new users only — existing conditional)
YOUR UNIVERSE   (elevated: larger title, warmer card)
BADGES          (elevated)
MY FAVOURITES   (anchor grid)
MY CONTRIBUTIONS  (if any — unchanged)
❤ SUPPORT THIS PROJECT (Ko-fi)   ← kept visible on profile
disclaimer
```

Removed from the profile scroll: the standalone **Battle Record** section
(collapses into the stat strip) and the entire **Account** card (moves to
`/settings`).

## The Stat Strip

A single horizontal row of stat tiles directly under the identity meta line,
replacing: the saved-heroes pill, the 3-tile Battle Record block, and the badge
`x/y` header count.

**Candidate stats (max 4):** Saved · Battles · Streak · Badges.
Battle Record's "with the crowd %" also collapses here (see below).

**Zero-handling (approved):** hide zeros gracefully. A brand-new user should not
see a row of `0 / 0 / 0 / 0`. Rule:

- Render only stats whose value is `> 0`.
- If **all** are zero (brand-new user), render **no** stat strip at all — the
  Getting Started card already carries the "what to do next" load in that state,
  so the strip would be redundant noise.
- Saved-count is derived from `favourites.length` (already loaded); until
  `loading` settles, show a skeleton tile rather than `0`.

**Battle Record collapse (approved — full collapse):** no separate Battle Record
section. Its numbers become stat-strip tiles:

- `Battles` = `battle.total`
- `Streak` = `battle.streak` (with the 🔥 affordance the current design uses)
- `With the crowd` = `battle.agreePct%` — included as a stat tile when
  `battle.total > 0`.

So the strip can hold up to 5 potential tiles (Saved, Battles, With-the-crowd,
Streak, Badges); it renders whichever are non-zero, capped/ordered as: **Saved,
Battles, Streak, With-the-crowd, Badges**. Badges shows `earned` count (not
`earned/total`) to keep tiles uniform; the full `x/y` still lives in the Badges
section header.

**Tapping a stat tile** (nice-to-have, not required): Battles/Streak/With-the-crowd
→ `/versus`; Badges → scrolls to / no-ops; Saved → scrolls to Favourites. Keep
simple — non-interactive tiles are acceptable for v1 if it reduces risk.

## Member-since flex line

`Member since {Month Year}` moves out of the Account rows into the identity block
as a quiet line under the name (color `COLORS.grey`, small). It's a flex, not a
setting. On web the existing `@username` (email local-part) can join it as
`Member since June 2025 · @ginoswanepoel` — or stay separate; either is fine.

## The `/settings` route (NEW)

A dedicated route, reached by a **gear icon at the top-right of the profile**
(over the cover, mirroring the existing camera/cover pills). Per repo convention
(`CLAUDE.md`: screens with a web variant must ship both files), create:

- `app/settings.tsx` (native)
- `app/settings.web.tsx` (web)

It reuses `useAuth` and `useProfile` for its actions. A thin platform-neutral
hook is **not** required here since the logic is just the existing handlers
(`signOut`, `changePassword`, `deleteAccount`, provider meta) already present in
the profile files — those move wholesale into the settings screens. If the two
settings files would duplicate more than trivial handler wiring, extract a
`useAccountSettings` hook in `src/hooks/`; otherwise keep them thin.

**Settings contents (moved from Account block):**

| Row | Source | Notes |
| --- | --- | --- |
| Email | `user.email` | read-only |
| Signed in with | `providerMeta(provider)` | only when not email-user |
| Change Password | `ChangePasswordModal` | only email-users |
| Catalog Health | `/admin/health` | admin only |
| Support this project (Ko-fi) | `KO_FI_URL` | **mirrored** — also on profile |
| Sign Out | `signOut` → `/explore` | |
| Delete Account | `deleteAccount` | bottom, destructive, confirm dialog |

The `ChangePasswordModal`, `EditDisplayNameModal` (name editing stays on profile),
and confirmation `Alert`s follow their current implementations. Screen chrome:
reuse `useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper })` for web
parity with the profile; native uses its existing chrome pattern. Provide a back
affordance (header back / nav) appropriate to each platform.

**Ko-fi stays on the profile too** (approved) — the footer support prompt near
the disclaimer — because donation CTAs perform worse when buried in settings.

## Desktop layout

The freed-up left sidebar no longer holds the Account card. New desktop split:

- **Sidebar:** avatar + identity (name, member-since, stat strip) + Your Universe
  summary + Badges summary + Share button + Ko-fi + disclaimer. Gear → `/settings`
  lives top-right over the cover as on mobile.
- **Main column:** Getting Started (new users) → My Favourites (anchor grid) → My
  Contributions.

Keep the existing `desk` / `mob` StyleSheet split; this is a re-composition of
existing styled blocks plus the new stat-strip and gear components, not a
restyle from scratch. Elevation/color use existing `COLORS` / `SURFACE` tokens.

## Components to add

- **`StatStrip`** (`src/components/profile/StatStrip.tsx` or inline web/native
  blocks) — takes an array of `{ label, value, icon?, onPress? }`, filters zeros,
  renders the row. Shared shape, platform-styled. If sharing across web/native is
  awkward given the existing inline-style split, two parallel implementations
  matching `deskFav`/`mob` conventions are acceptable — but prefer one small
  shared presentational component.
- **Gear button** — small pressable over the cover, top-right, navigates to
  `/settings`. Styled like the existing `editCoverPill` family.

## Components/logic reused unchanged

`useProfile`, `useProfileData`, `computeBadges`/`earnedCount`, `getTasteProfile`
derivations (`tasteChips`, `tasteInsight`, `tasteFootnote`), `GettingStartedCard`,
`WebHeroCard`/`HeroImage`, `useUniverseShareImage`, `BadgeDetailModal`,
skeletons, `Toast`.

## Data flow

Unchanged. `profile.web.tsx` / `profile.tsx` keep calling `useProfile(user.id)` +
`useProfileData(user.id)`. The stat strip derives from already-loaded values
(`favourites.length`, `battle`, `badgesEarned`). Settings screens call `useAuth`
+ `useProfile` (for name/photo if we later add editing there; v1 name editing
stays on profile).

## Error / edge handling

- **Loading:** stat strip shows a skeleton tile for Saved until `loading` false;
  other tiles only appear once their source resolves (they're already null-guarded).
- **Guest (no user):** unchanged `GuestWebProfileScreen` / native guest path. Gear
  and stat strip are authed-only. `/settings` should redirect guests to `/explore`
  or the login screen (match existing auth-gate behavior; profile is not fully
  gated but settings has nothing for a guest).
- **All-zero new user:** no stat strip, no Battle section, no Your Universe (already
  conditional), empty-state Favourites, Getting Started card visible. Page reads as
  an onboarding surface, not a wall of voids.
- **Upload errors, delete/sign-out in-flight states:** preserved from current impl,
  now living on their respective screens.

## Testing

Per `CLAUDE.md`, no full-screen render tests. Unit-test only pure logic:

- **Stat strip model builder** — a pure function `buildProfileStats(input)` →
  ordered, zero-filtered `Stat[]`. Test: all-zero → `[]`; partial → correct subset
  and order; loading → Saved tile flagged skeleton. Put the pure builder in
  `src/lib/profile/stats.ts` and test in `__tests__/lib/profile/stats.test.ts`.
- No tests for navigation or the settings screens (view layers).

## Build sequence

1. Add `src/lib/profile/stats.ts` (pure `buildProfileStats`) + test.
2. Add `StatStrip` presentational component.
3. Create `/settings` route (`app/settings.tsx` + `app/settings.web.tsx`); move
   Account rows + handlers there; add guest redirect.
4. Rework `profile.web.tsx`: remove Account card + Battle Record section, add
   gear→/settings, add stat strip, elevate Universe/Badges, add Ko-fi footer,
   move member-since into identity. Recompose desktop sidebar/main.
5. Mirror the same reorg in native `profile.tsx`.
6. `yarn test:ci`; visual verify on web + native.

## Open questions

None blocking. Optional polish (stat-tile tap targets, exact desktop sidebar
ordering, whether member-since joins `@username`) can be decided during
implementation without changing the design.
