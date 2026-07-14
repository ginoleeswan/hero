# Signup & Retention — design

**Date:** 2026-07-14
**Status:** Proposed. Phase 1 is client-only and ready to build; Phases 2–3 need
Supabase auth (migrations + type regen) before they can be applied.

## 1. Problem & goal

Mythique already ships more habit-forming *content* than most apps: a curated
daily debate (`useVersusHub`), a Wordle-style "Guess the Hero" game
(`useDailyHero`), voting streaks (`get_my_battle_record`), fan tiers, and a badge
wall. But three wires are cut, so almost none of it converts a visitor into a
returning, signed-in user:

1. **Nothing brings anyone back.** There are zero notifications in the codebase
   (no `expo-notifications`, no push tokens, no scheduled sends). A *daily*
   debate and a *daily* game with streaks have no doorbell.
2. **The streak is device-local, so it is neither portable nor a signup reason.**
   The guess-game streak/stats live only in AsyncStorage (`dh_streak_v1`,
   `dh_stats_v1` in `useDailyHero.ts`) — lost on reinstall, invisible to the
   account, and the best loss-aversion pitch we are not making.
3. **The #1 conversion moment is hidden.** When a guest wants to favourite a
   hero the heart button is not even rendered (`app/character/[id].tsx:919`,
   `user ? <heart> : null`). The most natural "save this → make an account"
   moment in the app is invisible.

**Primary goal:** turn the existing daily content into a habit by (a) recovering
the earned-value signup moments and (b) giving the app a re-engagement channel.
Signups are the *means* (they unlock notifications, portable state, a durable
social identity, and better taste-based curation), not the end. The north-star is
D1/D7 retention, measured per prompt so we learn which moment converts.

## 2. Principles

- **Pull, don't push.** Keep browsing and anonymous voting open (an explicit,
  already-decided design stance — see the takes/daily-debate spec). Insert the
  ask only at moments of demonstrated intent, and always name the specific thing
  the user is about to get ("Save Batman to your collection", not "join the
  community").
- **Every prompt is dismissible.** Never gate the front door.
- **Lose nothing on signup.** Local streak/favourite intent migrates into the
  account, so the pitch is pure upside.

## 3. Phase 1 — Recover the conversion moments (client-only)

No schema changes; needs no Supabase auth. Highest ROI because the #1 moment is
currently invisible.

- **1A. Favourite → signup.** `app/character/[id].tsx:919` — render the heart for
  guests too. On tap when `!user`, open a shared `SignInPrompt` sheet ("Save
  {name} to your collection — free account"). Stash the intended `heroId`
  (AsyncStorage `pendingFavourite`); after signup auto-add it and return to the
  character.
- **1B. Streak-rescue prompt.** In the daily-game screen + `useDailyHero.ts`,
  when an anonymous user finishes a day with a local streak ≥ 2
  (`streak.current`), show a dismissible banner: *"You're on a {n}-day streak 🔥
  — create a free account to keep it safe across devices."* Phase 2A migrates the
  streak on signup, so nothing is lost. Loss-aversion framing.
- **1C. Unify existing gates.** Today the gates (takes submit
  `TakesSection.tsx:182`, contribute/report `[id].tsx:1685/1705`, team battle
  `versus/team/[battleId].tsx:21`) do bare redirects to `/(auth)/login`.
  Introduce one `useSignInGate(reason)` hook + `SignInPrompt` component mapping
  each reason to benefit copy ("Add your voice to the debate"), and replace the
  raw redirects.
- **1D. Local streak reminder.** Add `expo-notifications`. When a user finishes
  today's game with an active streak, schedule a *local* notification for
  tomorrow evening ("Your {n}-day streak ends tonight"); cancel it when they next
  play. No backend required. Ask notification permission contextually here — not
  at signup.

**Tests:** pure logic only (pending-favourite handoff, gate-reason→copy map,
local-reminder schedule/cancel decision). Per repo convention, no screen/nav
tests.

## 4. Phase 2 — Retention backbone (needs Supabase auth)

- **2A. Account-bound daily-game streak.** Makes the streak portable *and* powers
  1B's migration.
  - Migration: `daily_game_results (user_id, puzzle_date, solved, attempts,
    created_at)`, unique `(user_id, puzzle_date)`, RLS to own rows.
  - RPCs: `record_daily_game_result(p_date, p_solved, p_attempts)` (idempotent
    upsert) and `get_my_daily_streak()` (current/max streak + win% + distribution
    computed server-side). Reuse the consecutive-day logic from
    `src/lib/game/streak.ts`; keep it **UTC** to match `previousDay()`.
  - New module `src/lib/db/dailyGame.ts`. `useDailyHero.ts`: logged-in →
    server-backed (AsyncStorage becomes offline cache); on sign-in, one-time
    merge of local results into the account (max streak, union of per-day rows).
    Mirrors the lazy `syncGoogleProfile`/`syncAppleProfile` pattern in
    `useAuth.ts`.
- **2B. Push notification infrastructure.**
  - `expo-notifications` + `expo-device`. On native login register the Expo push
    token → `push_tokens (user_id, token, platform, tz, updated_at)`; capture
    timezone here.
  - Prefs: `notification_prefs (user_id, daily_debate, streak_reminder, social)`
    + a settings section on the profile tab.
  - Delivery: a `send-notifications` Supabase Edge Function (mirror the existing
    `supabase/functions/delete-user` pattern) driven by a `pg_cron` schedule,
    posting to the Expo Push API for two jobs — **daily-debate drop** (when
    Today's Debate goes live) and **streak-at-risk** (streak ≥ 2, not played
    today, in their evening). Respect prefs + quiet hours.
  - Build note: iOS/Android push needs APNs/FCM in EAS and a **dev/prod build,
    not Expo Go**. Web push is out of scope for v1. Local reminders (1D) cover the
    streak case before this lands.

## 5. Phase 3 — Personalization & polish

- **3A. First-run interest picker.** After confirmation/OAuth, a 2–3 step
  pick-3-heroes/universes flow seeds the taste profile (`get_my_taste_profile`)
  immediately so day-1 Explore is personalized, then lands on `/explore`. Wire
  into `AuthGate`. Keep the profile "Getting Started" checklist as the follow-on.
- **3B. Social notifications.** "Your take got N new agrees" — batched daily,
  never per-agree, gated on the `social` pref.
- **3C. Measurement.** `trackEvent` already exists (`src/lib/analytics.ts`;
  `sign_up` fires at `useAuth.ts:105`). Add the funnel:
  `signup_prompt_shown{reason}`, `signup_prompt_tapped`, `onboarding_completed`,
  `notification_permission_granted`, `notification_opened{type}`,
  `streak_migrated`. North-star: D1/D7 retention + conversion rate by prompt
  reason.

## 6. Sequencing rationale

1B → 2A → 3A form one thread: the streak becomes portable, becomes the pitch,
then migrates on signup. Phase 1 recovers lost conversions and ships without the
DB or Supabase auth. Phase 2 is the re-engagement engine that finally lets the
already-built daily content reach a user. Phase 3 compounds it. Each phase is
independently shippable and de-risks the next.

## 7. Risks & open questions

- **Supabase MCP auth** is required before Phases 2–3 migrations/type regen.
- **Timezone** for streak day boundaries: the pure lib uses UTC; the server
  streak must match (keep UTC, or store per-user tz consistently).
- **Build implication:** notifications require an EAS dev build; they will not
  work in Expo Go.
- **Don't over-gate:** browsing + anonymous voting stay open; prompts stay
  dismissible.
