# Matchup Takes + Daily Debate — design

**Date:** 2026-07-11
**Status:** Approved direction (structured takes; forum explicitly rejected for v1)

## 1. Problem & goal

People on socials debate power stats, rankings, and VS matchups. Mythique has the
catalogue, the stats, the vote table, and the AI verdicts — but no way for a
visitor to voice an opinion. A standalone forum was considered and rejected:
forums are pure network-effect containers and the current audience (~1 active
user) would make one read as abandoned, damaging the brand.

**Primary goal (chosen):** pull the socials audience into the app — every day's
debate produces a shareable artifact, and the landing page converts visitors
into participants with near-zero friction.

**Secondary goal:** make participation *sticky* — a user's opinion should
persist, accumulate, and be visibly acknowledged, so casting a vote or posting a
take creates a reason to come back tomorrow.

## 2. Concept

**Takes, not comments.** To post on a matchup you must pick a side and write a
one-liner (≤ 280 chars). Takes render as side-badged cards
("Team Batman — *prep time ends this in 4 seconds*") with an **agree** reaction,
sorted by agreement. No threading in v1.

**Daily Debate.** One curated matchup per day, surfaced in the Arena hub and on
Explore, so the small early audience concentrates on a single page that looks
alive. It resolves at midnight: the split is frozen, a winning side and a top
take are recorded, and the next day's page links back to yesterday's result.

**The funnel loop:** daily social post (split bar + top take card) → matchup
page → anon vote (instant gratification) → sign-in to post a take → that take
becomes a candidate for tomorrow's social asset.

## 3. Participation friction (decided)

- **Voting: anonymous.** Anyone can tap a side and immediately see the live
  split. Dedup via a `voter_key`: `auth.uid()` when signed in, else a hashed
  device id persisted in localStorage / AsyncStorage.
- **Takes: sign-in required.** The composer routes anon users to
  `/(auth)/login` (existing pattern for favourites/votes). The vote is the hook;
  the take is the conversion.

## 4. Data model

New migration(s) in `supabase/migrations/`, applied via MCP, then regenerate
`database.generated.ts`.

### `matchup_takes`
- `id uuid pk`
- `hero_a_id`, `hero_b_id` — **normalized pair key**, lexicographically smaller
  id first (same convention as `verdicts`; reuse/extract the `normalizeKey`
  helper).
- `user_id uuid` → `auth.users`, not null.
- `side text check (side in ('a','b'))` — which normalized side the take backs.
- `body text check (char_length(body) between 3 and 280)`.
- `agree_count int default 0` (denormalized; bumped by RPC).
- `status text default 'visible'` — `visible | hidden | removed` for moderation.
- `created_at timestamptz`.
- RLS: public read of `status = 'visible'`; insert only as self (authenticated);
  no client update/delete of others. Per-user rate limit enforced in the insert
  RPC (e.g. max N takes per matchup per user, M per day).

### `take_agreements`
- `(take_id, voter_key)` unique — prevents double-agree; `voter_key` same scheme
  as votes so anon users can agree too (agreeing is friction-free like voting).
- `agree_take(take_id, voter_key)` SECURITY DEFINER RPC toggles the row and
  maintains `agree_count`.

### Anon voting change
- New `cast_matchup_vote(hero_a, hero_b, side, voter_key text)` SECURITY DEFINER
  RPC replacing the auth-gated path: upserts on `(pair, voter_key)` so revotes
  switch sides rather than double-count. Signed-in votes keep `user_id` too, so
  existing per-user history/community aggregations still work. Existing rows
  remain valid (their voter_key = user id).
- Basic abuse guard: rate limit per voter_key inside the RPC; this is a fun
  poll, not an election — perfect dedup is a non-goal.

### `daily_debate`
- `debate_date date pk`, `hero_a_id`, `hero_b_id` (normalized), optional
  `hook_text` (editorial one-liner), and resolution fields filled after the day
  ends: `final_votes_a`, `final_votes_b`, `top_take_id`.
- **Unifies with the existing "Today's Battle."** `src/lib/matchup.ts`
  currently picks the daily pair client-side (`dailySeed` over the iconic
  pool) and renders via `TodaysMatchup` on Explore (web + native). The
  `daily_debate` table becomes the server-side source of truth for that same
  surface — one daily pair everywhere (Explore, Arena, landing, social post),
  votable and takeable. The seeded client pick remains only as a fallback when
  the table has no row for today. No parallel "second daily matchup" surface.
- Curated from the command center; a pg_cron fallback auto-picks from high-fame
  `hero_relationships` rivals (enemy pairs, both `fame_score` high, not used in
  the last 90 days) so the surface never goes dark. Folded into the existing
  nightly-maintenance cron per the enrichment-landscape rule (no new cron
  unless required for the midnight resolve timing).
- New tables need explicit public-read RLS policies (known gotcha).

## 5. App surfaces

House rules: data/state in platform-neutral hooks (`src/hooks/`,
`src/lib/query/`), DB access only via `src/lib/db/`, thin `.tsx`/`.web.tsx`
views, React Query as the data layer.

### Matchup page (compare/versus detail) — the landing page
1. **Vote bar** — tap a side, bar animates to the live split, your side is
   marked. Works anon. (Replaces/extends `useMatchupVote`.)
2. **Takes list** — side-badged cards, agree button, sorted by `agree_count`
   then recency. Empty state is a prompt ("No takes yet — have the first
   word"), never a void: the verdict/stats above anchor the page regardless.
3. **Composer** — side picker (defaults to your vote) + one-line input +
   char counter. Anon tap → login.
4. **Report** — takes get an entry in the existing `ReportSheet`
   (`reports` table + command-center Reports lane). `status` flip hides them.

### Arena hub (`useVersusHub`, versus screens)
- **"Today's Debate" card at the top**: the matchup, live split, top take,
  one tap into the matchup page. This is the destination for social links.
- **Yesterday's result strip** under it: "Team Superman won 63/37 — top take:
  …" linking to the archived page. If the viewer voted, personalize:
  "Your side won." This is the core *return-tomorrow* mechanic.

### Explore
- The existing `TodaysMatchup` ("Today's Battle") card is upgraded in place:
  fed by `daily_debate`, gains a "N takes — read the debate" affordance
  linking into the matchup page. No new row is added.

### Landing page (`src/components/landing/LandingPage.dom.tsx`)
- Add a **Daily Debate teaser** section below the Summoning hero: both
  portraits, the live split bar, today's hook line, and a single CTA
  ("Cast your vote"). Tapping goes straight to the matchup page — the vote
  itself happens in-app (anon-allowed), keeping the landing section a teaser,
  not a second voting implementation.
- Design follows the clean/minimal brand rule — one section, no leaderboard
  noise. Data comes from the same daily-debate query hook (React Query),
  degrading to the seeded fallback pair like every other surface, so the
  section never renders empty.
- Landing is a DOM component with its own layout path — verify the section on
  the web root specifically (per the web-layout divergence rule).

### Profile — opinions persist (retention)
- **"My takes"** section: your takes with agree counts, and a simple
  **debate record** (times your side won the daily debate / agrees earned).
  Read from existing per-user rows; no new tables. Deep counters, badges, and
  leaderboards are explicitly deferred — YAGNI until there's volume.
- Daily-debate voting counts toward the existing daily streak
  (`useDailyStreak`) if that wiring is cheap; otherwise defer.

## 6. Growth loop integration

- **OG/share:** extend `api/og.tsx` with a **debate card** — both portraits,
  split bar, top take. `api/` stays RN-free. Re-run `fetch-og-site.mjs` after.
- **Social Studio:** add a `daily-debate` generator to `scripts/social/` — one
  post/asset per day ("Who wins? Vote now — link in bio") pointing at the
  matchup page. Organic lane (portraits allowed), respecting the existing
  brand/venue system and safe-zone rules.
- **SEO (phase 2):** render the daily-debate and matchup-takes pages in the
  bot pipeline (`api/bot-page`) with Q&A-shaped markup ("Who would win,
  X or Y?"). Compounds with SEO phases 2–4.

## 7. Moderation & safety

- Reuse `reports` end-to-end: new report target type `take`, shown in the
  command-center Reports lane; resolving can flip `status`.
- Insert RPC enforces length, rate limits, and strips control chars. No
  client-side trust.
- Display name comes from existing `profiles`; users without one show a
  fallback handle.

## 8. Explicit non-goals (v1)

- No standalone forum tab, no threads/replies, no notifications, no rich text,
  no images in takes, no take editing (delete-own only), no leaderboards.
  Replies-on-takes is the designated phase-2 step *if* take volume appears.

## 9. Testing

Unit tests in `__tests__/` mirroring source, mocked Supabase:
- pair-key normalization shared helper (A/B order invariance),
- vote RPC wrapper: voter_key selection (uid vs device hash), revote behavior,
- takes query hooks: sorting, status filtering, optimistic agree toggle,
- daily-debate hook: today/yesterday selection and personalization line.

No full-screen render tests (house rule).

## 10. Build order (for the implementation plan)

1. Migration: tables + RPCs + RLS + regenerate types.
2. DB layer (`src/lib/db/takes.ts`, extend `matchupVotes.ts`) + query hooks.
3. Matchup page vote bar + takes list/composer (web + native).
4. Daily Debate: command-center picker + cron fallback + resolution job;
   rewire `TodaysMatchup`/Arena onto `daily_debate`.
5. Landing page Daily Debate teaser section.
6. Profile "My takes" + yesterday-result personalization.
7. OG debate card + Social Studio generator.
8. Bot-page rendering (phase 2, separate effort).
