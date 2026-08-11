# Dailies and streaks

> The three daily surfaces — the Guess-the-Hero puzzle, the daily debate, and
> the daily team battle — and the server streak calendar that ties them
> together. Read this before adding a fourth surface, touching completion
> recording, or changing anything about how "today" is computed.

## Mental model (read this first)

There are three daily rituals, each with its own game loop, and **one shared
retention backbone**: a per-user completion calendar on the server. Completing
*any* surface counts the day; the streak is computed from distinct days, not
per-surface. The surfaces know nothing about streaks — they each call one
fire-and-forget recorder and move on.

| Surface | Key | Where it lives | Daily selection |
| --- | --- | --- | --- |
| Guess-the-Hero puzzle | `puzzle` | `/play` (`app/play.tsx` + `.web.tsx`) → `src/components/game/DailyGame.tsx` → `src/hooks/useDailyHero.ts` | `get_daily_hero` RPC — 500-hero pool, stable-hash shuffle, indexed by day |
| Daily debate | `debate` | Today's Matchup on Explore; votes via `src/hooks/useMatchupVote.ts` | `daily_debate` table row per date |
| Team battle | `team_battle` | Arena; `src/hooks/useTeamBattle.ts` | `pickDailyTeamPair` in `src/lib/db/teams.ts`, deterministic client-side |

**Everything is anchored to the UTC calendar day.** The server stamps
`current_date` (UTC on Supabase), the debate roll runs at 00:05 UTC, and the
team-battle seed is `yyyymmdd` from `getUTC*` methods. Use local dates anywhere
in this system and "today" disagrees across timezones around midnight — that's
the trap.

## The puzzle

Wordle for superheroes: one recognisable hero per day, same for everyone. The
`get_daily_hero` RPC (`20260619140000_daily_hero_puzzle.sql`) returns the
**answer itself** plus pre-shuffled tap options (answer + decoys,
`20260619150000_daily_hero_options.sql`); guesses are checked client-side.
Honour-system on purpose — the puzzle is not a server secret, and that posture
is repeated everywhere downstream.

The game state lives in `src/hooks/useDailyHero.ts`, not the view:
**`MAX_GUESSES = 4`**. Each wrong guess sharpens the blurred holographic card
(`MysteryPortrait`, both platform files) and peels another `ClueSticker`
(`src/components/game/ClueSticker.tsx`). On game over:

- `record_daily_result` / `get_daily_distribution` (`src/lib/db/dailyStats.ts`)
  store an anonymous per-day tally and power the "you beat X%" percentile.
- `buildShareGrid` (`src/lib/game/shareGrid.ts`) builds the spoiler-free share
  text — a single row of emoji squares plus `Guess the Hero #N 2/4`.
- The **local** streak updates in AsyncStorage (`src/lib/game/streak.ts`, key
  `dh_streak_v1`) — this is the logged-out streak, and the original one.

## The debate

`daily_debate` holds one public-read row per `debate_date`: the pair (stored
`a <= b`), an optional `hook_text` line, and — once resolved — yesterday's
frozen result. Writes are RPC-only:

| RPC | Who | Does |
| --- | --- | --- |
| `set_daily_debate` | admin (command-center `DebatePickerPanel`) | Upsert a curated pair for a date, clearing any prior resolution |
| `pick_daily_debate` | service role | Auto-pick when no one curated (real people excluded — `20260714140939_exclude_real_people_daily_debate.sql`) |
| `resolve_daily_debate` | service role | Freeze yesterday's `final_votes_a/b` and crown the top take |

The pg_cron job `daily-debate-roll` (00:05 UTC,
`20260712120000_matchup_takes_daily_debate.sql`) runs resolve then pick, so
yesterday closes and today opens in one pass. `getYesterdayResult`
(`src/lib/db/dailyDebate.ts`) reads the frozen split + top take.

**Trap:** the vote hook (`useMatchupVote`) serves *every* matchup surface, and
compare pages vote on arbitrary pairs. That's why completion goes through
`recordDebateCompletionIfDaily` (`src/lib/db/dailies.ts`), which checks the
voted pair against today's `daily_debate` row — order-insensitively — before
counting the day. The team battle has the same guard
(`recordTeamBattleCompletionIfDaily`).

## The team battle

No table drives the daily pair. `getFeaturedTeams` pulls the top-40 featured
teams, and `pickDailyTeamPair` picks two deterministically from a UTC
`yyyymmdd` seed — pure, tested (`__tests__/lib/db/teams.test.ts`), and
identical for every client without a cron. `useTeamBattle` records the
completion on vote.

## The streak calendar

`20260716090000_daily_streaks.sql` is the whole backbone:

| Piece | What it is |
| --- | --- |
| `user_daily_completions (user_id, day, surface)` | The calendar. Own-row select only; writes are RPC-only |
| `record_daily_completion(p_surface)` | Auth-required, always stamps the current UTC day — no backfilling |
| `get_my_daily_streak()` | `{ current, longest, today: {puzzle, debate, team_battle} }` |
| `get_streaks_at_risk(p_min)` | Service-role only — streaks ending exactly yesterday, nothing yet today |

`current` counts the consecutive-day island whose last day is today **or
yesterday** — the standard grace, because today isn't over yet.
`get_streaks_at_risk` feeds the "streak on the line" nudge in
`supabase/functions/send-daily-push/index.ts` (called with `p_min: 3`); it is
never client-visible.

A "perfect day" (all three surfaces) is **reserved in the migration comment
for a future badge — it is not built**. Don't invent UI for it.

Client plumbing (`src/lib/db/dailies.ts`) is deliberately fire-and-forget: the
server write in `recordDailyCompletion` silently no-ops when logged out or on
any failure. A missed write costs one day of streak; it must never throw into a
game or vote flow.

**Today's ticks are not gated on auth; the streak is.** Every completion also
writes a local, date-stamped mirror (`dailyDone:<surface>:<UTC date>`), and
`getMyDailyStreak` ORs it over the server response. Two reasons:

1. Voting is deliberately anon-friendly — no sign-up wall at the vote moment.
   Reading today's ticks from the signed-in RPC alone meant a logged-out player
   saw three permanently OPEN rows in the Arena's ledger no matter what they
   played: the app refusing to acknowledge a vote it had just accepted.
2. The debate is voted **on** the Arena. `useDailies` refreshed on focus, so
   even signed in, the row you had just satisfied kept saying OPEN until you
   left the tab and came back. `subscribeToDailies` re-reads on completion.

`DailyStreak.tracked` is false when logged out — today's ticks are real, but no
streak is being kept, so a surface can offer an account instead of showing a
zero that playing cannot move.

## Logged out, and the merge

There is no cross-surface anonymous identity (the debate's `voter_key` covers
votes only), so the server calendar starts at auth. Logged-out players keep
the local AsyncStorage puzzle streak. `useDailyStreak`
(`src/hooks/useDailyStreak.ts`) shows **`max(local, server)`** so a player
whose local history predates the server calendar never sees their number drop
on signing in. It refreshes on focus, as does `useDailies`
(`src/hooks/useDailies.ts`), which adds today's per-surface checkmarks.

## Where the dailies surface

- `DailyChallengeBanner` (`src/components/game/DailyChallengeBanner.tsx`) —
  the `daily` row on Explore, both platforms.
- `TodaysDailies` (`src/components/game/TodaysDailies.tsx`) — the hub strip on
  the **Arena** tab (`app/(tabs)/versus.tsx` + `.web.tsx`), fed by `useDailies`.

## History

Historical specs and plans (status lines in them may be stale):

- `docs/superpowers/plans/2026-06-21-desktop-daily-game.md` and
  `docs/superpowers/specs/2026-06-21-desktop-daily-game-design.md` — the puzzle.
- `docs/superpowers/plans/2026-07-11-matchup-takes-daily-debate.md` and
  `docs/superpowers/specs/2026-07-11-matchup-takes-daily-debate-design.md` —
  takes, the debate table, and its crons.
- `docs/superpowers/plans/2026-06-22-team-battles-phase1.md` and
  `docs/superpowers/specs/2026-06-22-team-battles-design.md` — team battles.
- `docs/superpowers/specs/2026-07-15-web-push-daily-design.md` — the daily
  push and the streak-at-risk audience.
