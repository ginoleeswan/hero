# Versus — Battle Discovery Feed (Phase 3a)

**Status:** approved direction + scope, pre-plan
**Date:** 2026-06-24
**Scope:** the `/versus` hub (`app/(tabs)/versus.web.tsx` + native `versus.tsx`). **The top section is unchanged** — Today's Showdown stage (`ShowdownStage`) + the Build/Surprise actions stay exactly as they are. This phase **replaces only the sections beneath them** (today's single team-battle card + the rivalry deck) with a richer **Battle Discovery feed**: rows of one-tap matchup cards generated from data we already fetch.

## Why

The hub ends fast and surfaces one slice (rivalries) of a deep content graph. The app is content-rich but audience-poor, so the win is **discovery, not community features that sit empty**: turn the relationship graph, powerstats, and teams into many tappable battles. No new backend — every row is a pure transform of existing queries, and each row degrades to hidden when thin.

## The rows (all four, in order)

Each row is a labeled horizontal scroll of **matchup cards** (two portraits facing off + a VS + the two names); tapping routes into the clash.

1. **⚔ Greatest Rivalries** — straight from `getTopRivalries(12)`, which already returns `{ a, b, crossUniverse }` matchups. No generation; map → cards.
2. **💥 Dream Matches** — cross-universe fantasy: split `iconicPool` (popularity-ranked `Hero[]`) into Marvel vs DC, pair `marvel[i]` × `dc[i]`. (A small name-curated marquee seed is a fast-follow, not v1 — generated pairs ship first.)
3. **🏆 David vs Goliath** — power-gap upsets: total = `intelligence+strength+speed+durability+power+combat`; pair a low-total underdog with a heavyweight from `iconicPool`.
4. **🦸 Team Battles** — `getFeaturedTeams()` paired team-vs-team → the drafted clash route.

Generation is **deterministic, day-seeded** where it adds freshness (Dream, Goliath, Teams) so the feed is stable within a day but rotates daily; Rivalries keep popularity order.

## Data + logic (pure, testable)

New `src/lib/discovery.ts` — pure builders (no IO), unit-tested:

```ts
export interface HeroLite { id: string; name: string; image_url?: string | null; portrait_url?: string | null; }
export interface Matchup { a: HeroLite; b: HeroLite; }

export function heroPowerTotal(h): number;                          // sums the 6 stats (null→0)
export function buildDreamMatches(pool: Hero[], n: number, seed: number): Matchup[];   // Marvel[i] × DC[i]
export function buildGoliathMatches(pool: Hero[], n: number, seed: number): Matchup[]; // low-total × high-total
export function buildTeamMatches(teams: FeaturedTeam[], n: number, seed: number): TeamMatchup[];
```

- **Dream:** partition pool by publisher (Marvel / DC via the same `pubKey` logic as the builder), zip the two lists; skip if either side <1.
- **Goliath:** sort pool by `heroPowerTotal` desc; pair index `i` (top) with `len-1-i` (bottom) for the first `n`, keeping a real gap; require both to have stats.
- **Teams:** seed-shuffle featured teams, pair consecutive (A vs B), distinct.
- Day seed: `Math.floor(Date.now() / 86_400_000)` (same idea as `pickDailyTeamPair`).

New hook `src/hooks/useDiscoveryRows.ts` wires it: consumes `useVersusHub()` (`rivalries`, `iconicPool`) + a featured-teams query (reuse `usePresetTeams`), runs the builders, returns `{ rivalries, dream, goliath, teams }`. Degrades to `[]` lists.

## Components

- **`src/components/web/versus/MatchupCard.tsx`** (new) — a compact dual-portrait card: hero A left, hero B mirrored right (`scaleX:-1`), a small gold VS between, names beneath, faction-tinted hairlines (oxblood A / teal B). Portrait→image→monogram fallback (reuse the existing card art pattern). Pressable → `onOpen(a, b)`.
- **`src/components/web/versus/MatchupRow.tsx`** (new) — `★ label` + horizontal `ScrollView` of `MatchupCard`; returns `null` when empty.

## Page wiring

- **`versus.web.tsx`:** keep the stage block untouched. Replace the team-battle `Pressable` + the `deckSec` (`RivalryDeck`) with the four `MatchupRow`s (Rivalries, Dream, Goliath, Teams), each padded with `contentPad`, max-width-capped + centered like the other sections.
- **Routing:** 1v1 cards → `stashFighters(a, b)` then `withViewTransition(() => router.push(resolveBattleRoute([a.id],[b.id])))` (= `/compare/a/b`). Team cards → `/versus/team/${A.id}-vs-${B.id}` (the route today's team card already uses).
- **`versus.tsx` (native):** same four rows via the shared hook + a native `MatchupRow`/`MatchupCard` (or a thin native variant); the stage stays. (Web first; native follows in the same phase.)

`RivalryDeck` becomes unused on the hub once Rivalries is a `MatchupRow` — remove it if no other consumer (verify), or keep if referenced elsewhere.

## Edge cases & failure

- Any row with <2 valid matchups → hidden (degrade, never a broken/empty row).
- Thin/odd pool (few of one publisher) → Dream/Civil shorten or hide; never crash.
- Missing portraits → image→monogram fallback (no blank cards).
- Hero appears in multiple rows → fine (different framings); within a row, no self-vs-self and no duplicate pair.

## Testing

`__tests__/lib/discovery.test.ts` — pure builders: `heroPowerTotal` sums/handles nulls; `buildDreamMatches` only pairs cross-publisher and never self-pairs; `buildGoliathMatches` pairs a low total with a high total (real gap) and is stable for a fixed seed; `buildTeamMatches` yields distinct team pairs. Components/page are presentational (not unit-tested, per convention).

## Out of scope (later)

- Hand-curated marquee Dream Matches (name-matched seed list) — generated pairs ship first.
- Civil Wars (same-universe) + Most Feared rows — easy follow-ups on the same machinery.
- Personalization / "Continue your battles" / trending — needs traffic.
- Community surfaces (votes, leaderboards, streaks) — deliberately deferred (audience-poor).
