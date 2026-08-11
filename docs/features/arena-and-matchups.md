# Arena and matchups

> The live reference for everything "who would win?": matchup voting, takes,
> the daily debate, team battles, the battle builder, and the Versus hub. Read
> this before touching any vote/tally RPC, adding a surface that shows a crowd
> split, or wiring a new route into the arena — the identity model and the
> v1/v2 RPC split both have sharp edges that don't announce themselves.

## Mental model (read this first)

Everything in the arena hangs off **one primitive: the normalized pair**.
Every table and RPC stores `(hero_a_id, hero_b_id)` with `hero_a_id <=
hero_b_id`, normalizes server-side, and answers relative to the order the
caller passed. A-vs-B and B-vs-A are the same battle, the same tally, the same
takes thread — client caches key on the sorted pair for the same reason
(`queryKeys.takes` in `src/lib/query/keys.ts`).

The second axis is **who is voting**. There are two identities, resolved in
order:

1. A signed-in user — `auth.uid()`, rows in `matchup_votes`, feeds the battle
   record and profile history.
2. Anyone else — a per-device **voter key** (`src/lib/voterKey.ts`, a random
   `vk_*` string persisted in AsyncStorage), rows in `matchup_votes_anon`.

This is a dedup key for a fun poll, **not a security boundary** — the server
says so in the migration and caps anon writes at 60 votes/hour/key. The point
is product, not crypto: there is deliberately **no login wall at the vote
moment**. Votes and take-agreements work anonymously; posting a take, and the
battle record, require auth.

Third axis: **battle size**. A 1-v-1 goes to the proven single-pair arena at
`/compare/[hero]/[opponent]`; a curated team fight lives at
`/versus/team/[battleId]`; anything hand-built and larger than 1-v-1 becomes a
drafted battle at `/versus/team/draft?a=&b=` whose rosters travel in the URL.
`resolveBattleRoute` in `src/lib/battleRoute.ts` is the single place that
decision is made — route through it, don't re-derive it.

## The trap: v1 and v2 tallies disagree on purpose

`cast_matchup_vote` / `get_matchup_tally` (**v1**, auth-only) predate
anonymous voting. `cast_matchup_vote_v2` / `get_matchup_tally_v2` union authed
and anon votes and are granted to `anon` — **every client surface is on v2**
(`src/lib/db/matchupVotes.ts` exposes both).

The catch is `matchup_vote_seeds` (`20260618230000_matchup_vote_seeds.sql`): a
hand-tuned per-pair baseline added **inside the v1 SECURITY DEFINER tally** so
marquee matchups never unfurled with zero votes. The v2 tally
(`20260712120000_matchup_takes_daily_debate.sql`) does **not** join the seeds
— in-app counts are organic. So the two RPCs report different totals for the
same pair, and both are correct for their era. v1 still serves
`api/share-meta.ts`, `api/bot-page.ts`, and `scripts/social/lib.mjs`;
`api/og/index.tsx` and `api/battle.ts` are already on v2. If you migrate the v1
stragglers, decide explicitly whether the seed baseline moves with them or
dies — don't let it vanish (or double-apply) as a side effect. The client
never touches the seeds table; RLS keeps it RPC-only.

## Voting: `useMatchupVote`

`src/hooks/useMatchupVote.ts` is the one vote hook, shared by the daily
matchup card and the compare arena so the surfaces can't drift. On a vote it:

1. reveals optimistically (state flips before the network),
2. mirrors the pick to AsyncStorage (`matchupVoteKey`) — instant reveal on
   return visits and an offline fallback,
3. fires `trackEvent('matchup_vote', { authed })`,
4. casts via `cast_matchup_vote_v2` with the voter key, and
5. calls `recordDebateCompletionIfDaily` — counts toward the daily streak
   only when the pair is today's daily debate (the guard lives in
   `src/lib/db/dailies.ts`, the hook votes on any pair).

On mount it reads the tally + `my_pick` (uid first, voter key second), falling
back to the local mirror. Re-voting the same pair switches the pick server-side
(upsert), but the hook itself no-ops after a pick — reveal is one-way per mount.

The signed-in aggregate is `get_my_battle_record` → `{total, agree, agreePct,
streak}` (`getBattleRecord` in `src/lib/db/matchupVotes.ts`), shown on the
profile. Auth-only by grant; anon votes never enter it.

## Takes and the daily debate

Takes are pick-a-side one-liners on a pair. Reads are plain RLS selects
(`status = 'visible'` or your own row); writes are RPC-only.

| Piece        | Where                                                                                                              | The rule                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Post/replace | `post_take` RPC via `src/lib/db/takes.ts`                                                                          | auth-only, 3–280 chars, **one take per user per pair** (re-post replaces and resets agreements), 20/day rate limit |
| Agree        | `toggle_take_agreement(take_id, voter_key)` + `take_agreements`                                                    | anon-capable — uid wins over voter key; recounts `agree_count`                                                     |
| Order        | `getTakes`                                                                                                         | `agree_count` desc, then newest                                                                                    |
| Moderation   | `set_take_status` (`20260712150000_take_moderation.sql`) + `reports` with `target_type='take'`                     | admin hide/remove lever                                                                                            |
| UI           | `src/components/takes/TakesSection.tsx`, `src/components/profile/MyTakes.tsx`, hook `src/hooks/useMatchupTakes.ts` | agree is optimistic `setQueryData`; agreed-state is session-only, the server owns the real toggle                  |

`matchup_takes.user_id` references `auth.users`, not `user_profiles`, so
PostgREST can't embed display names — `getTakes` does a second `in()` query.

The **daily debate** (`daily_debate` table, same migration) is the
server-curated pair of the day: admin-set via `set_daily_debate` or auto-picked
(high-fame enemy pair, 90-day no-repeat) by `pick_daily_debate`. The
`daily-debate-roll` cron freezes yesterday's split and crowns its top take just
after midnight UTC — that frozen row powers the hub's yesterday strip.

## Team battles and the builder

Featured team battles (`useTeamBattle`) resolve two rosters
(`get_team_roster`), score them (`get_team_synergy` +
`resolveTeamBattle` in `src/lib/teamBattle.ts`), and vote through
`cast_team_battle_vote` / `get_team_battle_tally` over `team_battle_votes`.
The AI write-up is cached in `team_verdicts` (`src/lib/db/teamVerdicts.ts`).
The deep link `/versus/team/[battleId]` uses an `a-vs-b` slug split on the
**first** `-vs-`; team slugs never contain that literal, and a bad slug
degrades to "not found" rather than mis-resolving.

Drafted battles (`/versus/team/draft?a=&b=`, `useDraftBattle`) are ad-hoc
rosters from the builder — reload-safe and shareable because the ids live in
the URL, and **non-votable** (no stable battle identity to tally against).

The builder itself is `/compare/pick` — `useBattleBuilder` over the pure
reducer helpers in `src/lib/battleBuilderState.ts` (`MAX_SIDE = 5`, N-vs-N,
sides need not match). It surfaces live synergy per side, the active captain's
teammates as suggestions, and preset rosters via `usePresetTeams`.

On native the screen is a **draft board**: a pinned tray (both sides as slot
rows, the armed side tinted with a "+" in its next open slot) above a dominant
catalogue grid. Four rules hold it together, each earned by the design it
replaced: the catalogue starts above the fold (no wall of "?" placeholders);
the tray never scrolls away (adding must visibly change the roster); picked
heroes stay in the grid marked `added` instead of being filtered out (no
reflow under your finger — and tapping an added card removes it); and the CTA
guides rather than scolds (a contextual next-step hint until the battle is
valid, then the Fight button). On paper the "→ Side A/B" destination cue is a
solid faction-tint pill with ink text — raw orange/blue _text_ on paper fails
contrast (see the design-system matrix). Its opponent grid renders at most `GRID_CAP` (120) cards, and **`onEndReached`
is capped to match**. A render cap without a matching pagination cap means the
list keeps fetching pages whose rows the `.slice()` immediately discards —
requests on the user's data for cards that can never appear. Any cap on what a
paginated list renders needs the same cap on what it fetches. The web
guided flow is `DuelStepper` / `MobileDuel` / `DuelDock` in
`src/components/versus/`. The 1-v-1 opponent picker is
`/compare/[hero]/pick` (`usePickOpponents`): rails of sworn rivals,
allies/teammates ("friendly fire"), family, and power-peers.

## The arena page and the hub

`/compare/[hero]/[opponent]` renders from `useCompareMatchup` — both heroes'
stats, the six-stat comparison (`src/lib/compare.ts`), and the AI verdict. The
verdict is cached in the `verdicts` table, written **only** by the
`generate-verdict` edge function; the client reads with `staleTime: Infinity`,
so a pair generates once, ever. Around it: `CommunityVotes` (the crowd split),
`TakesSection`, and a shareable poster via `src/hooks/useMatchupShareImage.tsx`.

The Versus hub (`app/(tabs)/versus.tsx` / `.web.tsx`) is fed by
`useVersusHub`: today's showdown plus its editorial hook line, the frozen
yesterday strip, curated rivalries (`get_top_rivalries`), the "Public Enemies"
villain board (`get_most_feared`, component `HallOfInfamy`), a fame-ranked
iconic pool for "Surprise me", and the featured team battle. Every query
degrades to a hidden section, never a broken hub. `useDiscoveryRows` derives
the discovery feed (dream matches, goliath fights, team matchups) client-side
from data the hub already fetched — no extra requests.

### The native hub is three acts, grouped by intent

Three people open this tab: the one keeping a **streak**, the one who wants a
**specific fight**, and the one who wants to be **handed** one. `versus.tsx`
answers those three in that order, and nothing appears twice.

1. **Today.** `ShowdownCards` (vote → reveal in place, via `useMatchupVote`),
   then `TodaysLedger`.
2. **Make a fight.** `MakeAFight` — a one-v-one / team toggle over two empty
   slots, then "Surprise me", then the rivalries rail.
3. **Fight a villain.** `HallOfInfamy`.

**It used to show two of the three dailies twice.** The chip card's _Daily
Debate_ called `openArena(matchup.heroA, matchup.heroB)` — the same destination
as the showdown directly above it — and its _Team Battle_ chip pushed the same
route as the featured card directly below it. Nobody needs a third way to reach
today's debate. Grouping by intent removed both duplicates and two whole
sections (the featured team-battle card, the standalone rivalries deck),
because their content moved to where the intent already lived.

**`TodaysLedger` is state, not navigation.** Each daily is a line with its own
subject and an Open/Settled marker, plus the streak. The debate line records
what _you_ did rather than repeating a pairing shown a few hundred points above
it — an echo is not information.

**`MakeAFight` looks like the thing it makes.** Two empty slots canted at the
showdown's angle with the same VS medallion between them, so it reads as an
invitation rather than a control; the toggle swaps them for two squads, which
says without a word that one-v-one and team battle are siblings. Everything
that starts a fight lives in this one act, ordered by how much say you want:
build it, take one that's ready, or let the app choose. Those were three
separate sections serving a single intent.

`RivalriesRail` takes `headless` so a section that supplies its own label does
not get a second heading. The rail still brings its own inset and must sit
**outside** any padded wrapper — see the horizontal-rail rule in CLAUDE.md.

The takes link never opens with a zero: `0 takes — join the debate` advertises
that nobody bothered, so with none yet it reads _Be first to call it_.

Still open: act three's rows go to the character page rather than starting a
fight, because `app/compare/pick.tsx` takes no params and cannot open with a
fighter preselected. That is a new capability, not a layout change.

## History

Historical specs (status lines in them may be stale):
`docs/superpowers/specs/2026-04-06-compare-feature-v2-design.md`,
`docs/superpowers/specs/2026-06-03-vs-screen-redesign-design.md`,
`docs/superpowers/specs/2026-06-11-native-versus-tab-design.md`,
`docs/superpowers/specs/2026-06-18-matchup-og-unfurl-design.md`,
`docs/superpowers/specs/2026-06-22-team-battles-design.md`,
`docs/superpowers/specs/2026-06-23-battle-builder-draft-rails-design.md`,
`docs/superpowers/specs/2026-06-23-battle-builder-phase2b-design.md`,
`docs/superpowers/specs/2026-06-24-battle-builder-deck-stage-design.md`,
`docs/superpowers/specs/2026-06-24-battle-builder-mobile-guided-duel-design.md`,
`docs/superpowers/specs/2026-06-24-versus-battle-discovery-feed-design.md`,
`docs/superpowers/specs/2026-07-11-matchup-takes-daily-debate-design.md`.
