# Privacy and data collection

**What this file is for.** The App Store privacy "nutrition label" is a
declaration under Apple's review, and the cost of getting it wrong is a rejected
or pulled build. It is also the single easiest thing in a repo to let rot: a
label is written once at submission and the code keeps moving. So this is
derived from the code, names the file each claim comes from, and is expected to
be updated in the same PR as any change to what the app collects.

**Scope: the iOS app only.** Several data flows in this repo are web-only and
must NOT appear in the App Store label — they belong to the website:

| Flow | File | Why out of scope |
| --- | --- | --- |
| Page views (`page_views`) | `src/lib/db/pageViews.ts` | Only called from `src/components/Analytics.web.tsx` |
| UTM attribution (`session_attribution`) | `src/lib/attribution.ts` | Web-only; there is no campaign link into a native launch |
| Vercel custom events | `src/lib/analytics/vercel.ts` | `track()` dispatches to it only when `Platform.OS === 'web'` |

Mixing these in is the most likely way to over-declare, which is its own
problem: a label claiming collection the app does not do invites questions it
cannot answer.

## What the iOS app collects

### Contact info — Email address

**Collected, linked to identity, not used for tracking.** Supabase auth
(`src/lib/supabase.ts`, `src/hooks/useAuth.ts`). Email/password, Google Sign-In
and Sign in with Apple. Apple's Hide My Email produces a relay address, which is
still an email address for the label's purposes.

Used for: app functionality (account, sign-in, password reset).

### User content — Photos, other user content

**Collected, linked to identity.**

- Avatar and cover images: `src/lib/db/profiles.ts` → `uploadMedia`.
- Takes (free-text opinions on matchups): `src/lib/db/takes.ts`.
- Display name: `src/lib/db/profiles.ts`.

Used for: app functionality. Takes are shown to other readers, which is the
point of them; that is worth stating in the listing rather than only in a label.

### Identifiers — User ID, Device ID

**Collected, linked to identity.**

- User ID: the Supabase `auth.uid`, on every per-user row.
- Device ID: the Expo push token (`src/lib/notifications/deviceToken.ts`, with
  `platform`), and the per-device voter key (`src/lib/voterKey.ts`) that lets a
  logged-out reader vote once without an account.

Used for: app functionality. **Not** for tracking, and not shared with data
brokers or ad networks.

### Usage data — Product interaction

**Collected, linked to identity when signed in.** PostHog
(`src/lib/analytics/`), native only. The full event list is
`src/lib/analytics/events.ts` — it is a closed `EventMap`, so this table cannot
silently fall behind: adding an event is a type change.

What is deliberately **not** in a payload: no hero names, no take bodies, no
email, no display names, no free text. Ids and enums only. `search` records the
query's LENGTH, never the query. `deep_link_opened` records the path's SHAPE
(`character`, `compare`, …), never the id — that someone opened a character is a
fact about the product; which character is a fact about a person's reading.
`scrubProps()` is a runtime backstop that drops long strings and anything shaped
like an email.

`identify()` is called with the user id alone — never an email or a name.

Two client options are pinned in `src/lib/analytics/index.ts` **because they
decide this section**, even though both are already the SDK's defaults:

- `disableGeoip: true` — PostHog otherwise resolves an approximate location from
  the request IP server-side. That would put this app in the **Location**
  category for a fact it has no use for.
- `enableSessionReplay: false` — replay records the screen, which in this app
  can show an account, an email in a settings field, and whatever was typed into
  search.

A default is a promise the next dependency upgrade can quietly break, and this
one would break a declaration rather than a feature.

### Diagnostics — Crash data

**Collected, not linked to identity.** Sentry (`src/lib/sentry.ts`), with
`sendDefaultPii: false` and `tracesSampleRate: 0`. Inert without
`EXPO_PUBLIC_SENTRY_DSN`.

### Not collected

- **Location.** No location API is used anywhere, and geo-IP is disabled above.
- **Contacts, calendar, reminders, health, fitness, financial info.**
- **Browsing history.** In-app viewing history (`src/lib/db/viewHistory.ts`) is
  the reader's own history *within the app*, which Apple counts under Usage
  Data, not the "Browsing History" category (that means web browsing).
- **Purchases.** There is no IAP or payment path.
- **Advertising data.** The sponsor slots (`src/components/SponsorSlot.tsx`)
  are house promos rendered from our own table; there is no ad SDK, no IDFA
  access, and no `AppTrackingTransparency` prompt — which is only correct for as
  long as that stays true.

### Tracking

**No.** Nothing here is linked to third-party data for advertising or shared
with a data broker. Answer "No" to the tracking question, and do not add
`NSUserTrackingUsageDescription` — declaring it without tracking is its own
inconsistency.

## Everything is inert without a key

PostHog, Sentry and Vercel each no-op when their environment variable is unset,
so a developer's machine and CI write nothing anywhere. That is a deliberate
property, not an accident of configuration.

## When this file must change

Any PR that adds an SDK, a table storing something about a person, a new
`EventMap` entry carrying a new *kind* of value, or a permission prompt. If the
change alters a row in the label, say so in the PR body — the label is edited by
hand in App Store Connect and nothing in CI will notice it drifting.
