# App Store submission

Everything App Review looks at that is not the code. Kept here because the
listing is edited by hand in App Store Connect, nothing in CI checks it, and it
goes stale the moment a feature lands — so the repo has to be the place the
answers are worked out, even though it is not the place they are entered.

The privacy label has its own file: `privacy-and-data-collection.md`.

## Guideline 1.2 is satisfied

Guideline 1.2 requires **all four** of these for any app with UGC. The app now
has all four:

| Requirement | Status |
| --- | --- |
| Filter objectionable material | Report reasons + an admin queue (`src/lib/db/reports.ts`, `admin_reports_queue`) |
| Report offensive content, with timely response | `src/components/report/ReportSheet.tsx`, wired into every take |
| Block abusive users | `blocked_users` table + RLS (`supabase/migrations/20260814120000_blocked_users.sql`), block action in `ReportSheet.tsx`, unblock list in `/settings` (`useBlockedUsers`) |
| Published contact info | `app/support.tsx` |

Takes (`src/lib/db/takes.ts`) are free text, attached to a display name and
avatar, shown to every reader on a matchup — that is the surface the guideline
is written for, and it is now covered: a block is a one-directional RLS filter
on `matchup_takes`' SELECT policy (see `docs/features/arena-and-matchups.md`),
so every read path inherits it with no client-side filtering to keep in sync.
Blocking requires an account, same as posting a take; the blocked user is
never told. Verified against production (real user ids, two-tier RLS
simulation, self-cleaning transaction): a blocker stops seeing the blocked
user's takes immediately, the blocked user still sees their own, anon is
unaffected, and unblocking restores visibility.

## Age rating

Answer the questionnaire from what the app actually contains:

- **Violence — cartoon or fantasy:** yes, infrequent/mild. Character pages carry
  powers, fights and villain biographies; the Arena is explicitly about who
  would win. It is reference text about fiction, not depicted violence.
- **Horror/fear themes:** infrequent/mild. Some villains and events qualify.
- **Sexual content, nudity, profanity, alcohol/drugs/tobacco, gambling,
  simulated gambling, contests, medical/treatment info:** none.
- **Unrestricted web access:** **yes** — `Linking.openURL` opens TMDB and
  external source links from the title page. Answer honestly; a "no" here that
  the app contradicts is a straightforward rejection.
- **User-generated content:** **yes** (takes). This alone floors the rating and
  is why 1.2 above is not optional.

Expect **12+**. Do not aim lower by under-declaring the UGC or the web links —
both are visible in a two-minute review pass.

## What the listing has to say out loud

The app is a fan-made encyclopedia built on other people's characters. Three
things belong in the description, not buried:

1. **Unaffiliated.** "Unofficial fan app. Not affiliated with or endorsed by
   Marvel Entertainment, DC Comics, or any other publisher." Already in-app at
   the foot of settings; the listing needs it too.
2. **Sources.** TMDB and Comic Vine, with TMDB's required wording — see
   `src/components/legal/Attribution.tsx`. The credit is a licence obligation,
   and a reviewer who sees third-party catalogue data with no attribution goes
   looking for a reason.
3. **Community.** Readers post takes and vote. Say so; it sets the expectation
   that there is moderation behind it.

## Screenshots

The iPad target is live (`supportsTablet: true`, all four orientations), so the
iPad sets are now **required**, not optional:

| Set | Sizes | Notes |
| --- | --- | --- |
| iPhone 6.9" | 1320 × 2868 | The primary set |
| iPhone 6.5" | 1242 × 2688 | Still required for older devices |
| iPad 13" | 2064 × 2752 | New — the tablet layouts |

Shoot the iPad set **after** a real device pass. The tablet layouts have never
been seen on hardware (there is no simulator in the environment they were
written in), and the two-panel daily game in landscape is the least certain
thing in the app.

Suggested order, leading with what is distinctive rather than with a menu:
Explore's billboard · a character page · the Arena mid-verdict · the daily game
· a house tree.

## Review notes

Give App Review a demo account — most of the app is browsable logged out, but
takes, favourites and profile are not, and a reviewer who cannot reach half the
features may reject on incompleteness.

State plainly: the app is an unofficial fan encyclopedia; character data comes
from public sources under attribution; user content is moderated via in-app
reporting with an admin queue.

## Before submitting

- [x] **Blocking implemented** (Guideline 1.2) — see above
- [ ] TMDB logo asset added beside the credit text (`Attribution.tsx` explains
      why it is text-only today)
- [ ] Privacy label entered to match `privacy-and-data-collection.md`
- [ ] Age rating questionnaire answered as above
- [ ] iPad screenshots shot from a real device pass
- [ ] Demo account created and in the review notes
- [ ] Support URL live (`app/support.tsx` has the in-app surface)

## History

- `docs/superpowers/specs/2026-08-14-user-blocking-design.md` — the fourth
  Guideline 1.2 requirement (`blocked_users` + the takes RLS filter).
