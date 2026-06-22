# Team Battles — design

**Status:** approved design, pre-plan
**Date:** 2026-06-22
**Extends:** the Versus / Arena hub (`/versus`) and the 1v1 clash page (`/compare/[hero]/[opponent]`)

## Summary

Extend Versus from 1v1 into **team battles**: two rosters of up to 5 heroes clash, and
the winner is decided by a **synergy + stats hybrid** — averaged composite
powerstats plus a transparent synergy bonus that rewards *real* teams over random
picks. The signature experience is a deck that **deals out** into two formations,
synergy links igniting, a **CLASH** beat, then a **tug-of-war meter** that charges
toward the synergy-adjusted winner, ending on an AI verdict and a community vote.

The feature ships in two phases sharing one resolution engine:

- **Phase 1 — Curated daily team battle.** A deterministic daily pairing of two
  featured teams, resolved end-to-end on a dedicated clash page. Leans on the
  existing daily-pick + verdict-cache + voting machinery. Stands alone and looks
  finished before any builder exists.
- **Phase 2 — Unified Battle Builder.** One picker that scales from 1v1 up to
  5-per-side, asymmetric allowed (team vs 1), all from a single intuitive page. It
  *generalizes the existing 1v1 picker* rather than adding a parallel flow, and
  routes on commit by size — `1 × 1` to the existing arena, anything larger to the
  team clash page — resolving via the *same* `get_team_synergy` math.

Each phase is its own implementation plan. This spec is the shared design.

## Design decisions (locked)

1. **Core mechanic:** synergy + stats hybrid (not pure stats, not crowd-only).
2. **Roster source:** both featured (curated daily) and drafted, phased.
3. **Team size:** flexible **1–5 per side** — 1v1 is the degenerate case of the same
   builder; a "team" is any side with ≥2; sides may be asymmetric (e.g. 3 vs 1).
4. **Synergy rules:** canon teammate links + shared affiliation + role balance. Synergy
   is 0 for a side of 1 (no pairs) — no special-casing.
5. **Signature UX:** deck deals out → synergy ignites → CLASH → tug-of-war meter → verdict + vote.
6. **Routing:** a dedicated team-battle *clash* route launched from the hub — *not* an
   extension of the 1v1 `/compare/[hero]/[opponent]` clash page (its two path segments
   can't carry a roster). The *builder*, by contrast, is a single unified picker that
   produces either a 1v1 or a team battle and routes to the right clash page on commit.
7. **DB philosophy:** the team layer is a **derived, rebuildable mirror** of the hero
   layer, with `heroes.teams[]` as the single source of truth.

## The DB design

### Through-line: one source of truth, mirrored layers

`heroes.teams[]` is already the raw source of truth that `rebuild_hero_relationships()`
derives `teammate` edges from (set-based, ranked by popularity, idempotent). The team
layer extends the **same** rails rather than introducing a parallel hand-curated source.

| Hero layer (exists) | Team layer (new) |
| --- | --- |
| `heroes` | `teams` |
| `hero_relationships` (teammate edges) | `team_members` (roster edges) |
| `rebuild_hero_relationships()` | `rebuild_teams()` |
| `get_related_heroes()` | `get_team_roster()` |
| `verdicts` | `team_verdicts` |
| `matchup_votes` + tally/cast RPCs | `team_battle_votes` + tally/cast RPCs |

Shared conventions carried over verbatim: normalized `lo <= hi` pair keys; pick stored
**by id**, not side; `SECURITY DEFINER` + `set search_path = public`; client-facing
RPCs revoked from `public, anon` and granted explicitly; **public-read RLS** on
catalogue tables (new tables auto-enable RLS — without an explicit read policy anon
reads 0 rows and RPCs return `[]` silently).

### Tables

**`teams`** — derived breadth + thin curation overlay. **Upsert-stable** (never
truncated, because votes/verdicts reference it):

```sql
create table public.teams (
  id           text primary key,            -- stable slug, e.g. 'avengers'; survives rebuilds
  name         text not null,
  publisher    text,
  logo_url     text,                         -- curated
  member_count integer not null default 0,
  popularity   bigint   not null default 0, -- sum of members' issue_count; daily-pick weight
  is_featured  boolean  not null default false, -- only featured teams enter the daily pool
  updated_at   timestamptz not null default now()
);
```

`logo_url` and `is_featured` are the **only** human-touched fields: breadth is
auto-derived, quality is curated for the daily hero slot.

**`team_members`** — derived roster edges, fully regenerated on rebuild, ranked by hero
popularity (mirrors the teammate rebuild):

```sql
create table public.team_members (
  team_id text not null references public.teams(id) on delete cascade,
  hero_id text not null references public.heroes(id) on delete cascade,
  rank    integer,                            -- 1 = most popular member within the team
  primary key (team_id, hero_id)
);
create index team_members_team_idx on public.team_members (team_id, rank);
create index team_members_hero_idx on public.team_members (hero_id);
```

**`team_verdicts`** — AI verdict cache, exact mirror of `verdicts`, normalized
`team_a_id <= team_b_id`. Public read; anon insert (frontend saves after a successful
edge-function call), same as `verdicts`.

**`team_battle_votes`** — exact mirror of the hardened `matchup_votes`, keyed on
`(team_a_id, team_b_id, user_id)` with `picked_team_id`, ordered-pair + pick-in-pair
constraints, RLS locked to each user's own row. Separate from `matchup_votes` so
hero-text-ids and team-slugs never collide and the 1v1 vs team voting records stay
distinguishable.

### `rebuild_teams()`

`SECURITY DEFINER`, `service_role` only, idempotent. Set-based, in one statement family:

1. Derive distinct team slugs from `unnest(heroes.teams[])` (normalize whitespace/case to
   a canonical name + slug), aggregating `member_count` and `popularity` (sum of member
   `issue_count`).
2. **Upsert** into `teams` on conflict `(id)` — refresh `name`, `publisher`,
   `member_count`, `popularity`, `updated_at`; **preserve** the curated `logo_url` and
   `is_featured`.
3. Regenerate `team_members`: delete the rebuilt teams' rows and re-insert
   `unnest`-derived `(team_id, hero_id)` edges ranked by `issue_count`, bounded
   (e.g. top 40) to keep mega-teams sane.

Safe to re-run after any enrichment that refreshes `heroes.teams[]`.

### `get_team_roster(p_team_id, p_limit)`

`STABLE` read API, granted to `anon, authenticated, service_role`. Returns members
joined to `heroes` with the stat columns + portrait/image, ordered by `rank` — the shape
`useTeamBattle` needs for the composite.

### `get_team_synergy(p_hero_ids text[])` — the centerpiece

`SECURITY DEFINER`, `STABLE`, granted to `anon, authenticated, service_role`. Computes
synergy for **any** roster (curated *or* drafted), returning a structured, auditable
breakdown that does double duty — it feeds the resolution **and** is exactly what the UI
explains:

```sql
get_team_synergy(p_hero_ids text[]) returns json
-- {
--   "teammate_links":     { "count": 3, "max": 3, "pct": 0.12 },   -- canon edges within the set (hero_relationships, kind='teammate')
--   "shared_affiliation": { "team": "Justice League", "coverage": 3, "pct": 0.06 }, -- largest shared heroes.teams[] coverage
--   "role_balance":       { "archetypes": 3, "pct": 0.04 },        -- distinct dominant-stat archetypes present
--   "total_pct": 0.18
-- }
```

- **teammate_links:** count distinct unordered pairs within `p_hero_ids` that have a
  `teammate` edge in `hero_relationships`, over the max possible pairs. Rewards genuine
  canon partnerships.
- **shared_affiliation:** the largest team in `heroes.teams[]` shared across members, by
  coverage (members in that team ÷ roster size).
- **role_balance:** each member's dominant powerstat (argmax over the 6 stat columns) →
  count of distinct archetypes present, over roster size.

Each component contributes a bounded percentage; `total_pct` caps at ~0.25. Weights live
in the RPC as named constants so they are tunable in one place. (Phase 2's draft flow
calls this RPC unchanged on an arbitrary `hero_ids[]`.)

### `team_battle_votes` RPCs

`get_team_battle_tally(p_a, p_b)` and `cast_team_battle_vote(p_a, p_b, p_picked)` — copies
of `get_matchup_tally` / `cast_matchup_vote` retargeted to team slugs: normalize the pair
`lo <= hi`, store the pick by team id, upsert one vote per `(pair, user)`, return the fresh
tally relative to the caller's order. `SECURITY DEFINER`, `search_path` pinned, revoked
from `public, anon`, granted to `authenticated, service_role`. The clash page guards the
vote action client-side and routes logged-out users to `/(auth)/login` (the RPC is
authenticated-only and otherwise fails silently for anon).

### Migrations

New files in `supabase/migrations/` (`YYYYMMDDHHMMSS_*.sql`), applied via the Supabase MCP
tool, regenerating `database.generated.ts` after:

1. `*_create_teams_and_members.sql` — tables, indexes, RLS public-read, `rebuild_teams()`,
   `get_team_roster()`.
2. `*_team_synergy_rpc.sql` — `get_team_synergy()`.
3. `*_team_verdicts.sql` — verdict cache (mirror of `verdicts`).
4. `*_team_battle_votes.sql` — votes table + tally/cast RPCs (mirror of `matchup_votes`).
5. A seed step: mark ~12–20 canonical teams `is_featured` + attach `logo_url`.

## The resolution engine — `src/lib/teamBattle.ts`

Pure, DB-free, unit-testable (matching the testing convention). Sibling of `compare.ts`.

```ts
interface TeamSide {
  team: { id: string; name: string; publisher: string | null; logo_url: string | null } | null;
  roster: Hero[];               // 1–5, with stat columns (1 = the solo/1v1 case)
  synergy: SynergyBreakdown;    // from get_team_synergy; 0 for a roster of 1
}
interface TeamBattleResult {
  stats: StatResult[];          // per-stat composite winner (reuses StatResult shape)
  powerA: number; powerB: number; // synergy-adjusted totals → the meter split (e.g. 62/38)
  winsA: number; winsB: number;
  verdict: string;
}
function resolveTeamBattle(a: TeamSide, b: TeamSide): TeamBattleResult;
```

- **Base composite:** per stat key, **average** across the roster (size-neutral — a
  5-roster does not auto-beat a 3-roster on raw stats; the size advantage is earned
  through more synergy opportunities, not inflated totals). This also makes **team-vs-1**
  meaningful: a lone powerhouse (averaged = its own stats) can still beat a weak trio,
  while a balanced trio's synergy is its edge — "it takes a real team to take down a titan."
- **Asymmetric & solo sides:** any side may be 1–5. A side of 1 averages itself and
  carries synergy 0. A `1 × 1` battle is delegated to the existing `compareStats` path
  (the builder routes it to `/compare/a/b`), so the proven 1v1 resolution is untouched;
  `resolveTeamBattle` handles every case with ≥2 on either side.
- **Synergy boost:** apply each side's `total_pct` to its composite total → `powerA` /
  `powerB`, normalized to the meter split.
- **Per-stat winners** reuse the `StatResult` shape so the desktop composite breakdown can
  reuse the `StatBattleRow` rhythm. Synergy is shown as its own row.
- **Verdict:** cached per `(team_a, team_b)` in `team_verdicts`; generated via the AI edge
  function on first request with a deterministic fallback ("Justice League take it —
  synergy was the difference"), exactly like `getTodaysMatchup`.

## Data + view layer

- `src/lib/db/teams.ts` — `getFeaturedTeams()`, `getTeamRoster(id)`, `getTeamSynergy(ids)`,
  `getTeamBattleTally(a,b)`, `castTeamBattleVote(a,b,picked)`, `getTodaysTeamBattle()`
  (deterministic daily seed over featured teams, popularity-weighted — mirrors
  `getTodaysMatchup`). Screens never import `supabase` directly.
- `src/hooks/useTeamBattle.ts` — platform-neutral react-query hook orchestrating roster +
  synergy + tally + verdict for a battle id. Both `.tsx` and `.web.tsx` views consume it so
  fetch logic never drifts (per the platform-file rule).
- `src/types/index.ts` — `Team = Tables<'teams'>`, etc., derived from the regenerated
  generated types.

## Routing & reuse

| Route / file | Role | Phase |
| --- | --- | --- |
| `/versus` hub | + featured team-battle card; + "Build a battle" entry | 1 / 2 |
| `/versus/team/[battleId]` (+`.web`) | The clash page — deck-deal sequence | 1 |
| `/compare/pick` (+`.web`) — generalized | The unified Battle Builder (1–5 per side) | 2 |
| `/compare/[hero]/[opponent]` (+`.web`) | Existing 1v1 arena — unchanged, the `1 × 1` target | — |
| `src/lib/teamBattle.ts` | Composite + synergy engine | 1 |
| `src/hooks/useTeamBattle.ts` | Shared native/web data hook | 1 |
| `src/lib/db/teams.ts` | Roster + synergy + vote reads | 1 |

Reuses: the hub launcher and `useVersusHub` spine; the Battle Deck holo-card tokens; the
`StatBattleRow` rhythm for the composite breakdown; the verdict-cache + voting patterns.

The `battleId` for a curated daily battle encodes the ordered featured pair (e.g.
`avengers-vs-justice-league`); `getTodaysTeamBattle()` resolves it deterministically so
votes/verdicts key naturally on the pair. A *drafted* battle hands its two rosters to the
clash page via a `stashFighters`-style handoff (no shareable id needed until we add saved
teams in a later phase).

## The Unified Battle Builder (Phase 2)

One picker, one mental model: **assemble each side, 1 to 5 heroes.** It *generalizes the
existing 1v1 picker* (`/compare/pick`) rather than forking it, so 1v1 stays a first-class
case of the same screen — no parallel flow to keep in sync.

- **Two roster trays** (Side A / Side B) pinned at the top; tapping a side makes it
  **active**, tapping a hero in the grid adds them to the active side's next slot, tapping
  a slotted hero removes them. Asymmetric is just unequal trays (3 vs 1).
- **Reuses the picker's building blocks** — `OpponentCard`, `HeroPeek`, the
  `useHeroSearchInfinite` grid, the navy-stage/beige-sheet chrome — with multi-select
  selection state layered on instead of single-tap-commits-and-leaves.
- **Rails adapt to the active side's drafted members:** a **"Teammates"** rail (from
  `hero_relationships`, kind `teammate`) and a **"Same affiliation"** rail surface as you
  build, so assembling a real synergistic squad is one-tap. (The 1v1 case keeps the
  existing Rivalries / Same Universe / Similar Power rails relative to the single fighter.)
- **Live synergy preview:** as a side reaches ≥2, call `get_team_synergy` on its current
  ids and show the climbing "+%" with its breakdown — synergy becomes legible *while you
  build*, and rewards adding canon teammates in real time.
- **Commit routes by size:** when both sides have ≥1, a **Battle** CTA appears. `1 × 1`
  routes to `/compare/a/b` (the untouched 1v1 arena); anything larger routes to the team
  clash page. The builder owns the destination decision.
- **Entry points:** the hub's "Build a battle" action, plus a "Make it a team battle"
  affordance on the existing pick/arena screens to cross-link the flows.

This unified builder is the reason `resolveTeamBattle` accepts asymmetric and solo sides
(see the engine section): the screen can produce any shape from 1v1 to 5v5, and the engine
resolves all of them with one code path.

## The signature UX (the clash page)

Same composition on mobile (3-column: Team A left, slim VS/synergy spine, Team B right,
meter + verdict + vote in a footer) and desktop (3-up split with a prominent center
column + a beige composite-breakdown panel below). Approved 9s entry sequence:

1. **Deck arrives** — a single holo deck riffles center-stage (the shuffle-ghost language).
2. **Deal out** — cards spring to their slots, staggered (Team A column, then Team B), a
   holo sheen sweeping as they land.
3. **Synergy ignites** — gold links/badges pop between canon teammates; each side's
   TEAM-UP % counts up. The badge count = teammate links (the auditable "why").
4. **CLASH** — rosters nudge inward, a white-gold impact flash, the word punches in.
5. **Tug-of-war decides** — the central meter charges from 50/50 to the synergy-adjusted
   split; knob settles; verdict + the two vote buttons fade in.
6. **Holds at rest** in the spaced layout.

Animation is reanimated 4 (native) / CSS (web). Respects reduced-motion: skip straight to
the resting composition. Reference mockups: `.superpowers/brainstorm/**/layouts-animated.html`.

## Failure behavior

Mirrors the hub's "degrade to hidden, never broken":

- No featured teams / `rebuild_teams()` not yet run → the hub's team-battle card does not
  render; nothing breaks.
- `get_team_synergy` error → treat synergy as 0 (battle resolves on raw composite stats,
  meter still works).
- AI verdict function unavailable → deterministic stat-summary fallback.
- Anon vote → guarded client-side, routed to login; the RPC rejects anon regardless.

## Testing

Per the convention (unit-test pure logic + hooks with mocked Supabase; no full-screen
render tests):

- `__tests__/lib/teamBattle.test.ts` — `resolveTeamBattle`: averaged composite is
  size-neutral; synergy boost shifts the split predictably; per-stat winners correct;
  verdict fallback; ties.
- `__tests__/lib/db/teams.test.ts` — `getTodaysTeamBattle` determinism (same pair all day,
  new pair next day); degrade-to-null on error.
- `get_team_synergy` correctness (teammate-link counting, coverage, archetype distinctness)
  is exercised through `teamBattle` tests with mocked breakdowns; the SQL itself is verified
  manually against seeded teams during the migration step.

## Out of scope (Phase 1)

- The Unified Battle Builder and the generalized `/compare/pick` (Phase 2).
- Saved/persisted user teams (decide in Phase 2 — ephemeral `stashFighters`-style handoff
  vs a `saved_teams` table).
- Team battle stats on the profile (a future `get_my_team_battle_record`, mirroring the
  existing battle record).
- Tournaments / brackets.
