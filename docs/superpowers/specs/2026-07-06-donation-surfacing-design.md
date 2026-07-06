# Donation Surfacing — Support Mythique

**Date:** 2026-07-06
**Status:** Design — pending review
**Scope:** Make it easy and inviting to donate (Ko-fi). One rail, one-tap in-app,
a rich Support screen for context, and very-gentle peak-moment nudges. No native
in-app-purchase tip jar (separate future project).

## Problem

Donations run through a single Ko-fi link (`ko-fi.com/glstudio`) surfaced only on
the Profile and Settings screens — the two lowest-traffic, most "settings-y"
surfaces. There is no ask on high-traffic surfaces (Explore, web landing), no ask
at emotional peaks (after sharing a card, earning a badge, leveling a tier), the
copy is a bare "Support this project · Ko-fi," and `KO_FI_URL` is duplicated
across 4+ files. Net: the donation path is technically present but effectively
invisible and cold.

## Goals

- **Lowest friction:** one tap to Ko-fi from every in-app support entry.
- **Ask at peaks:** a gentle, dismissible nudge right after share / tier-up / new
  badge — capped so it never nags.
- **Context where it helps:** a warm Support screen (story + suggested tiers) as
  the destination for the web landing CTA and an optional "Learn more."
- **One source of truth:** centralize the Ko-fi link; make adding a partner later
  a one-line change.

## Non-goals

- No native StoreKit/Play Billing tip jar (30% cut + review rules — its own spec).
- No second donation partner now (Ko-fi has 0% donation fees; the registry keeps
  it extensible). "Buy me a coffee" is button copy, not the buymeacoffee.com rail.
- No server/DB changes — nudge frequency state is per-device local storage.

## Architecture

### 1. Single Ko-fi source — `src/lib/support/kofi.ts`

```ts
export const KO_FI_URL = 'https://ko-fi.com/glstudio';
/** Extensible registry so a future partner is one entry. */
export const SUPPORT_LINKS = [{ id: 'kofi', label: 'Ko-fi', url: KO_FI_URL }] as const;
/** Open the donation page (Linking.openURL). Single call site for analytics later. */
export function openKofi(): void;
```

Replace the duplicated `KO_FI_URL` consts in `app/(tabs)/profile.tsx`,
`app/(tabs)/profile.web.tsx`, `app/settings.tsx`, `app/settings.web.tsx` with
imports from here. Their existing "Support this project" rows switch from an inline
`Linking.openURL(KO_FI_URL)` to `openKofi()` — still **one tap, straight to Ko-fi**
(unchanged friction; just centralized).

### 2. Frequency policy — `src/lib/support/donationPrompt.ts`

Pure, testable policy + a thin storage layer.

```ts
export interface DonationPromptState {
  lastShownAt: number | null;      // epoch ms
  lastDismissedAt: number | null;
  lastConvertedAt: number | null;  // tapped "Buy me a coffee"
  lastSeenTier: string | null;     // fan tier name last recorded
  seenBadgeIds: string[];          // earned-badge ids last recorded
}

// Very gentle: ≥30 days since any show; ≥90 days after a dismiss OR a convert.
export const MIN_DAYS_BETWEEN_SHOWS = 30;
export const BACKOFF_DAYS_AFTER_ACTION = 90;
export function shouldPrompt(state: DonationPromptState, now: number): boolean;

// Milestone detection (pure): returns which new milestone (if any) fired.
export function detectMilestone(
  prev: Pick<DonationPromptState, 'lastSeenTier' | 'seenBadgeIds'>,
  current: { tier: string; earnedBadgeIds: string[] },
): 'tier' | 'badge' | null;
```

`shouldPrompt` returns true only when `now - lastShownAt ≥ 30d` **and**
`now - max(lastDismissedAt, lastConvertedAt) ≥ 90d` (nulls treated as "long ago").

`detectMilestone` returns `'tier'` if `current.tier !== prev.lastSeenTier` **and**
current tier is higher (rank compared via the `fanTier` tier order), else `'badge'`
if `current.earnedBadgeIds` has any id not in `prev.seenBadgeIds`, else `null`.
Ranking helper `tierRank(name): number` added to `src/lib/profile/fanTier.ts`
(exported) so "higher" is unambiguous and a tier *drop* never fires.

**Storage layer** (same module): `loadPromptState()` / `savePromptState(patch)`
using a cross-platform KV: `localStorage` on web, `AsyncStorage` on native
(mirrors `src/lib/supabase.ts`'s `Platform.OS === 'web'` branch). Key:
`mythique.donationPrompt.v1`. All reads tolerate missing/corrupt JSON → defaults.

### 3. `useDonationNudge` hook — `src/hooks/useDonationNudge.ts`

Platform-neutral controller the profile mounts. Exposes:

```ts
interface DonationNudge {
  visible: boolean;
  requestNudge(reason: 'share' | 'milestone'): Promise<void>; // gated by policy
  onDismiss(): void;    // records dismiss, hides
  onConvert(): void;    // records convert, opens Ko-fi, hides
  syncMilestones(input: { tier: string; earnedBadgeIds: string[] }): Promise<void>;
}
```

- `syncMilestones` (called on profile load once data is ready): loads state, runs
  `detectMilestone`; **always** updates `lastSeenTier`/`seenBadgeIds` to current
  (so a milestone only counts once); if a milestone fired **and** `shouldPrompt`,
  set `visible = true` and record `lastShownAt`.
- `requestNudge('share')` (called after a successful share): if `shouldPrompt`,
  show + record `lastShownAt`.
- `onConvert` → `recordConverted()` + `openKofi()` + hide. `onDismiss` →
  `recordDismissed()` + hide.

First-run guard: on a brand-new device `lastSeenTier`/`seenBadgeIds` are null/empty;
the **first** `syncMilestones` seeds them **without** firing a nudge (treat null
baseline as "no prior" → seed, return null). This prevents a nudge on first open.

### 4. `DonateNudge` component — `src/components/support/DonateNudge.tsx`

Cross-platform bottom-sheet/modal. Content: ☕ + "Enjoying Mythique?" + one warm
line ("It's free, made by one person — a coffee keeps it alive.") +
**Buy me a coffee** (primary → `onConvert`) + **Maybe later** (→ `onDismiss`).
Dossier grammar (paper surface, orange primary button, `Flame` heading). Reuses
`Modal`/overlay; respects reduced motion. Rendered by both profile view files,
driven by the hook.

### 5. Support screen — `app/support.tsx` + `app/support.web.tsx` (`/support`)

Reachable from the web landing CTA and an optional in-app "Learn more" link — NOT
in any one-tap critical path. Contents (Dossier grammar, `SectionShell`):

- Header: back affordance + Flame title "Support Mythique" (clears web nav like
  `/settings`).
- Story panel: what Mythique is, that it's one person, why it's free.
- **Suggested tiers**: three chips — ☕ Coffee ($3) · ❤️ Fan ($10) · ⭐ Champion
  ($25) — each calls `openKofi()` (Ko-fi collects the actual amount; chips are
  anchors, labeled "suggested"). A note: "Amounts are suggestions — Ko-fi lets you
  choose."
- Primary **Buy me a coffee** button → `openKofi()`.
- Warm thank-you line.
- Guest-safe: no auth needed to view or donate (unlike settings; `/support` does
  NOT gate on user).

### 6. Web landing CTA — `src/components/landing/LandingPage.dom.tsx`

A tasteful "Support Mythique" entry (link/button) → `/support`. Placement: in the
existing footer/secondary area of the landing (not competing with the primary
sign-up CTA). DOM component, so a normal anchor/button.

### 7. Wiring the triggers (profile view files)

- `app/(tabs)/profile.tsx` and `.web.tsx` mount `useDonationNudge` and render
  `<DonateNudge …/>`.
- After a successful `handleShareUniverse` → `nudge.requestNudge('share')`.
- On profile data ready (`!loading`) → `nudge.syncMilestones({ tier: tier.name,
  earnedBadgeIds: badges.filter(b => b.earned).map(b => b.id) })`. Run once per
  data settle (guard with the effect deps / a ref) so it doesn't re-fire each render.

## Data flow

Peak event → hook checks per-device policy state (local KV) → maybe show
`DonateNudge` → user taps "Buy me a coffee" → `openKofi()` (Linking) + record
convert → 90-day backoff. No network, no DB.

## Error handling / edges

- **Storage unavailable / corrupt JSON** → treat as default state (nudge still
  works, just uncapped-from-empty, but first-run seeding prevents an immediate ask).
- **Web SSR** (`window`/`localStorage` undefined at module load) → storage layer
  guards `typeof window`/`Platform.OS` like `supabase.ts`; returns defaults.
- **Guest on profile** → guest profile view doesn't mount the nudge (no tier/badges);
  `/support` remains reachable and works for guests.
- **Share on web vs native** — both call the same `requestNudge('share')`.
- **Rapid milestones** (tier + badges at once) → only one nudge per 30 days via
  `shouldPrompt`; `syncMilestones` still records all seen state so none re-fires.

## Testing

Per `CLAUDE.md`, pure logic only:

- `__tests__/lib/support/donationPrompt.test.ts`:
  - `shouldPrompt`: never within 30d of last show; blocked for 90d after
    dismiss/convert; allowed when clear; null timestamps = allowed.
  - `detectMilestone`: tier-up fires 'tier'; tier drop/no-change → null; a new
    badge id fires 'badge'; first-run null baseline → null (seed, no fire).
- `__tests__/lib/profile/fanTier.test.ts` (extend): `tierRank` ordering
  (Newcomer < Fan < Collector < Curator < Legend).
- No tests for view files, the hook's storage effects, or navigation.

## Files

- Create: `src/lib/support/kofi.ts`, `src/lib/support/donationPrompt.ts`,
  `src/hooks/useDonationNudge.ts`, `src/components/support/DonateNudge.tsx`,
  `app/support.tsx`, `app/support.web.tsx`,
  `__tests__/lib/support/donationPrompt.test.ts`.
- Modify: `src/lib/profile/fanTier.ts` (+`tierRank`), `app/(tabs)/profile.tsx`,
  `app/(tabs)/profile.web.tsx`, `app/settings.tsx`, `app/settings.web.tsx`
  (use `openKofi`), `src/components/landing/LandingPage.dom.tsx` (CTA),
  `__tests__/lib/profile/fanTier.test.ts` (tierRank).

## Build sequence

1. `kofi.ts` (+ repoint the four existing support rows to `openKofi`).
2. `tierRank` in `fanTier.ts` (+ test).
3. `donationPrompt.ts` pure policy + storage (+ tests).
4. `DonateNudge` component.
5. `useDonationNudge` hook.
6. Wire triggers into both profile view files.
7. `/support` screen (web + native).
8. Landing CTA.
9. `yarn test:ci` + typecheck; device/web visual verify.

## Open questions

None blocking. Suggested tier amounts ($3/$10/$25) and exact landing placement can
be tuned during implementation without changing the design.
