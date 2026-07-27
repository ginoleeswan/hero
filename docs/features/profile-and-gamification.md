# Profile and gamification

> The as-shipped reference for the Profile tab and everything that makes an
> account worth having: favourites, taste, badges, fan tiers, contributions,
> reports, onboarding, presence, and the donation nudge. Read this before
> touching `app/(tabs)/profile.tsx` / `.web.tsx` or anything in
> `src/lib/profile/`. Note the relationship to
> `docs/profiles-and-contributions.md`: that file is the **original proposal**
> (now banner-marked as historical) — most of its Layer 1 (identity) and
> Layer 2 (stewardship) has since shipped, and this doc describes what
> actually exists.

## Mental model (read this first)

Almost everything on the profile is **derived, not stored**. Badges, fan tier,
the stat strip, and the taste profile are all pure functions over data the app
already collects (favourites, votes, contributions, account age). There is
exactly **one stored gamification flag**: `user_profiles.is_supporter`, set by
an admin from Ko-fi receipts via the `admin_set_supporter` RPC. Supporter is
recognition only — it unlocks a badge and suppresses ads/donation prompts,
never features. Everything else can be re-tuned by editing a pure function in
`src/lib/profile/` and its tests.

The second thing to internalise: the screen loads as **one snapshot**.
`src/hooks/useProfileData.ts` fires five sources in parallel and applies them
in a single render once *all* have settled — applying each as it landed made
sections pop in one after another. **Trap:** gate any full-picture logic (fan
tier, milestone detection) on the `settled` flag, not `loading`; `loading`
flips false on the first snapshot but `settled` is the "every source resolved"
signal, so reading before it risks acting on a partial picture.

| Source | Fetcher | Backing |
| --- | --- | --- |
| Favourites | `getUserFavouriteHeroes` — `src/lib/db/favourites.ts` | `user_favourites` |
| Battle record | `getBattleRecord` — `src/lib/db/matchupVotes.ts` | `get_my_battle_record` RPC |
| Contributions | `getMyContributions` — `src/lib/db/contributions.ts` | `get_my_contributions` RPC |
| Taste | `getTasteProfile` — `src/lib/db/taste.ts` | `get_my_taste_profile` RPC |
| Takes | `getMyTakes` — `src/lib/db/takes.ts` | matchup takes |

Signed-out users get `GuestProfileScreen` (defined inside
`app/(tabs)/profile.tsx`). Remember the app's split: matchup votes are
anon-friendly, but favourites, takes, contributions, and profile edits require
auth — check `useAuth().user` and route to `/(auth)/login`.

## Taste — "Your Universe"

`get_my_taste_profile` (migration `20260617140000_taste_profile_rpc.sql`)
blends favourites at **3×** weight with view history at 1× into top
publishers, alignment split, and tag chips. The profile renders it as the
"Your Universe" section via `TasteMixBar`
(`src/components/profile/TasteMixBar.tsx`); `dominantAlignment()` in
`src/lib/db/taste.ts` names the leaning. This is why favouriting matters
three times as much as browsing.

## Badges, fan tier, stat strip

`src/lib/profile/badges.ts` — `computeBadges()` returns eight badges, earned
first, locked ones carrying `progress` toward their target:

| Badge | Earned by |
| --- | --- |
| Supporter | `is_supporter` (the one stored flag) |
| Day One | having an account |
| Veteran | 180 days tenure |
| Curator / Archivist | 10 / 50 favourites |
| Oracle | 10 matchup votes |
| On Fire | 3-day voting streak |
| Loyalist ("Marvel Loyalist" etc.) | a top publisher + 5 favourites |

`src/lib/profile/fanTier.ts` — `fanScore = saves + votes + contributions +
badges × 3`, mapped onto five tiers (Newcomer 0 / Fan 10 / Collector 40 /
Curator 100 / Legend 200); `tierProgress()` powers the "N points to Curator"
hint. `src/lib/profile/stats.ts` builds the at-a-glance strip (Saved,
Battles, Streak, Badges) — all-zero states render no strip at all.

## Onboarding

`GettingStartedCard` (`src/components/ui/GettingStartedCard.tsx`) is the
app's **entire onboarding**: a four-step checklist (save a character, call a
daily battle, add a profile photo, set a display name) shown to signed-in
users and rendered as nothing once complete. Steps are wired in the profile
views.

## Favourites

Plain CRUD in `src/lib/db/favourites.ts` on `user_favourites` — no RPC layer.
Consumers: the profile grid, Explore's "Your Favourites" rail (React Query key
`exploreKeys.favourites`, invalidated by the character page's toggle), and the
taste profile at 3× weight. **Discrepancy to know:** the animated burst
`src/components/HeartButton.tsx` (from the 2026-04-04 spec) is currently
imported nowhere — the character page's heart is a plain Ionicons toggle with
haptics. Revive it or delete it, but don't assume it's live.

## Contributions and reports

Both systems are RPC-only writes (SECURITY DEFINER), admin-vetted, with no
auto-approve. The editable-field allow-list (`EDITABLE_FIELDS` in
`src/lib/db/contributions.ts`) is shared with the server's
`_contrib_field_type` — keep them in sync.

| Concern | Tables | RPCs |
| --- | --- | --- |
| Contributions | `contributions`, `contributor_stats` | `submit_contribution`, `get_my_contributions`, `admin_review_queue`, `admin_review_contribution`, `admin_edit_hero` |
| Reports | `reports` | `submit_report` (sole insert path) |

Reports have three entry contexts — `page`, `image`, `take` — each with its
own reason list (`REPORT_REASONS` in `src/lib/db/reports.ts`, mirrored by a
check constraint in `20260701120000_reports_backbone.sql`). Reward copy after
a submission is `rewardLine()` in `src/lib/contribute/reward.ts` — the reward
is deferred (review pending), so it celebrates the act and the tally, never a
live change. The profile lists your contributions with status via
`ContributionsList`; takes via `MyTakes` (both `src/components/profile/`).

## Media, sharing, nudges, presence

- **Avatar / cover** — `useProfile` (`src/hooks/useProfile.ts`) uploads to the
  `user-media` storage bucket (`src/lib/db/profiles.ts`), with optimistic
  swap-and-rollback. Google sign-in autofills name/avatar from
  `user_metadata` in `src/hooks/useAuth.ts` — but never overwrites an avatar
  the user uploaded themselves.
- **Share** — `useUniverseShareImage` renders `ShareableUniverseCard`
  off-screen and snapshots it to a PNG for the OS/browser share sheet.
- **Donation nudge** — `useDonationNudge` + pure logic in
  `src/lib/support/donationPrompt.ts`: peak-moment only (post-share, or a
  `detectMilestone` hit), 30 days between shows, 90-day backoff after an
  action, suppressed entirely for supporters. `SponsorSlot` is likewise
  supporter-suppressed.
- **Presence** — `usePresenceHeartbeat` (mounted in both root layouts) calls
  the `touch_last_seen()` RPC every 60 s while foregrounded; fire-and-forget,
  no-op for anon. It exists solely to feed the admin Community domain
  (`src/components/admin/health/domains/CommunityDomain.tsx`).

## History

The founding document is `docs/profiles-and-contributions.md` (root `docs/`,
banner-marked historical). Related specs under `docs/superpowers/` (historical;
status lines may be stale):

- `docs/superpowers/specs/2026-04-04-profile-redesign.md`
- `docs/superpowers/specs/2026-04-04-heart-animation-design.md`
- `docs/superpowers/specs/2026-04-11-google-signin-design.md`
- `docs/superpowers/specs/2026-04-11-profile-photos-design.md`
- `docs/superpowers/specs/2026-07-05-profile-reorganize-elevate-design.md`
- `docs/superpowers/specs/2026-07-01-hero-reporting-and-moderation-design.md`
- `docs/superpowers/specs/2026-07-11-matchup-takes-daily-debate-design.md`
- `docs/superpowers/specs/2026-04-21-donation-row-design.md` and `2026-07-06-donation-surfacing-design.md`
- `docs/superpowers/specs/2026-07-16-monetization-options.md`
