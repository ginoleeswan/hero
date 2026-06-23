# Battle Builder — Draft-Rails redesign (Phase 2c)

**Status:** approved direction, pre-plan
**Date:** 2026-06-23
**Extends:** the Battle Builder (Phase 2b, `2026-06-23-battle-builder-phase2b-design.md`). Same `/compare/pick` route, same `useBattleBuilder` state and `resolveBattleRoute` output. This phase is **purely the screen layout + four build-assist enrichments** — no change to the builder's state model or downstream routing.

## Why

The current builder sits on a fighting-game "matchup stage" (two captain anchors + VS + a grid). That frame is borrowed from classic character-select screens (SFII / MK / Smash), which all assume a **small fixed roster you can see at once**. We have **3,000+ characters** and **teams of 1–5 per side** — a scale no fighting game faces. The genres that solved "huge roster + assemble a squad + synergy" are **MOBA drafts** (LoL/Dota), **squad builders** (FUT chemistry), and **gacha team builders** (Marvel Snap / MSF).

**Thesis:** keep the *drama* of fighting games (VS, mirrored teams, a focal fighter rising, a FIGHT lock-in) but adopt the *navigation engine* of draft screens (filters, popularity default, recommended, one-tap presets). The chosen backbone is the **MOBA draft**: two team rails flanking a central character pool.

## Layout

### Web (`app/compare/pick.web.tsx`) — three columns

```
┌─────┬──────────────────────────┬─────┐
│SIDE │   ★ BUILD A BATTLE       │SIDE │
│  A  │   [ focal render ] ⚔ VS  │  B  │
│[██] │ ── filters ──            │[██] │
│[██] │ [All][Marvel][DC]        │[██] │
│[██] │ [Heroes][Villains]       │[██] │
│[+]  │ Quick teams: [Avengers]… │[+]  │
│[+]  │ 🔍 search                │[+]  │
│SYN  │ ▦▦▦▦▦  grid  ▦▦▦▦▦       │SYN  │
│+18% │ ▦▦▦▦▦        ▦▦▦▦▦       │+6%  │
└─────┴──────────────────────────┴─────┘
          [ ⚔ FIGHT · 3 vs 2 ]
```

- **Left rail = Side A / right rail = Side B** (`RailSide`, new): a vertical column — captain render enlarged on top, the remaining slots stacked beneath (5 fixed slots, filled = portrait + remove ×, empty = dashed `+`), the side label, the live synergy %, and the publisher badge. The whole rail is pressable → makes the side active (gold ring). Right rail mirrors its captain + slot portraits (`scaleX:-1`) to face the centre.
- **Centre pool**: the **VS focal stage** (the focal hero's enlarged portrait + the glass VS badge + eyebrow/title), then the **filter chips**, the **presets rail**, **search**, the **infinite grid** (`OpponentCard`, tap = add to active side, hover = set focal on web, long-press = `HeroPeek` on native), and the **FIGHT CTA** pinned below.
- Rails are fixed-width (~168px desktop); the centre flexes. Below ~768px the page falls back to the mobile pattern.

### Mobile (`app/compare/pick.tsx`) — segmented

- A **segmented `Side A | Side B` toggle** at the top: both sides legible as compact slot rows with their synergy; the active side is gold-ringed and tapping a segment switches the active side. A small VS marker between.
- Then the **filter chips** (horizontally scrollable), **presets rail**, **search**, the **3-up infinite grid**, and a **sticky gold FIGHT bar** at the bottom (`canBattle`-gated).
- The same navy stage (`LinearGradient`) + beige sheet chrome as today; matches `/versus`.

## The four enrichments

All four degrade to hidden on data failure (the hub's "degrade to hidden, never broken" rule); none block the builder.

1. **Filter chips (Publisher + Alignment)** — wired to `useHeroSearchInfinite(q, publisher, alignment)`, whose `publisher: 'All'|'Marvel'|'DC'|'Other'` and `alignment: 'All'|'Heroes'|'Villains'|'Anti'` params are already server-side. Two chip groups above the grid hold local state; the empty-query browse stays popularity-ordered. This is the highest-leverage move for our scale.
2. **Focal hero rises** — a `focal` piece of *screen-local* state (not in `useBattleBuilder`): set on grid hover (web) and on every add (both platforms); the centre stage shows that hero's enlarged portrait beside the VS badge. Defaults to the active side's captain when nothing is hovered. Purely presentational.
3. **Iconic-team presets** — a horizontal rail of featured teams from `getFeaturedTeams()`; tapping a chip calls `getTeamRoster(teamId, 5)` and adds those heroes to the **active** side (respecting the 5-cap and cross-side dedupe via the existing `addToActive` guards). New thin hook `usePresetTeams()` wraps the query; the fill is a new `fillActive(heroes)` action on `useBattleBuilder` (loops `addToActive`, same guards).
4. **Random / Surprise per side** — a dice control per rail/segment that fills the side from the current filtered pool (the loaded search/browse page), via `fillActive` of N random not-yet-placed heroes (default fills to a sensible size, e.g. up to 3 or to the cap). Cheap, arcade-flavoured.

## State changes (`useBattleBuilder`)

The state model is unchanged except for one additive action used by presets + random:

- `fillActive(heroes: PickedHero[]): void` — appends each hero to the active side through the existing `addToSide` guards (skips dupes / overflow). Pure addition; `removeHero`, `canBattle`, `battleHref`, synergy/teammates wiring all stay as-is.

`focal` lives in the **screen**, not the hook (it's presentation). Filters live in the **screen** (they feed the search hook, which the builder doesn't own).

## Components

- **`src/components/versus/RailSide.tsx`** (new, shared) — the vertical team rail (captain render + stacked slots + label + synergy + publisher badge + active ring + mirror). Supersedes `BuilderSide` for the web rails; `BuilderSide`'s horizontal strip logic is reused/folded in. Props mirror `BuilderSide` plus `orientation`/`captainSize`.
- **`src/components/versus/FilterChips.tsx`** (new, shared) — the Publisher + Alignment chip groups; controlled (`value`, `onChange`). Pure presentational.
- **`src/components/versus/PresetRail.tsx`** (new, shared) — the featured-teams rail; `teams`, `onPick(teamId)`. Hidden when empty.
- **`src/hooks/usePresetTeams.ts`** (new) — react-query wrapper over `getFeaturedTeams()`.
- **`app/compare/pick.web.tsx`** (rewrite) — the 3-column draft layout.
- **`app/compare/pick.tsx`** (rewrite) — the segmented mobile layout.

Reused as-is: `useBattleBuilder` (+ `fillActive`), `useHeroSearchInfinite`, `OpponentCard`, `HeroPeek`, `VsBadge`, `getFeaturedTeams`/`getTeamRoster`/`getTeamSynergy`/`getRelatedHeroes`, `resolveBattleRoute`, the navy/beige chrome (`useScreenChrome`/`SURFACE_GRADIENT` web, `LinearGradient` native), `FACTION_A`/`FACTION_B`, gold `goldAccent`.

## Visual language

Unchanged from the clash/builder: navy stage (`deepNavy` + `SURFACE_GRADIENT.stageImmersive` on web / the `['#1c2f5a','#13203a','#0c1526']` LinearGradient on native), beige content sheet, oxblood `FACTION_A` (#9A3E38) / teal `FACTION_B` (#3E6E73), gold `goldAccent` for active ring + FIGHT CTA. Fonts: `Flame-Regular` display, `Nunito_*` UI; never `Flame-Bold`. The top section matches `/versus` (gold eyebrow + display title). Styles via `StyleSheet.create`.

## Edge cases & failure behavior

- **Filters yield nothing** — show an empty-state line ("No fighters match these filters"), keep the chips so the user can widen.
- **Preset/roster fetch fails** — the preset rail hides; a tapped preset that returns `[]` is a no-op.
- **Preset overflows the side** — `addToSide` guards drop the extras silently (cap at 5); a side already partly filled takes only what fits.
- **Random with an empty pool** — the dice no-ops (disabled until the pool has ≥1 unplaced hero).
- **Focal with an empty builder** — the stage shows a neutral "?" plinth (the empty-anchor look), no render.
- **Hero already placed** — grid/preset/random adds are add-only and no-op on dupes (existing guards). Removal only via a slot.
- **Battle gating / routing** — unchanged: CTA enabled only when both sides ≥1; navigates to `resolveBattleRoute`.

## Testing

Per convention (pure logic + hooks with mocked Supabase; no full-screen render tests):

- `fillActive` — appends through the guards: stops at the 5-cap, skips heroes already on either side, preserves order. Extend `__tests__/lib/battleBuilderState.test.ts` / the hook test.
- `usePresetTeams` — returns featured teams; `[]` on error (mocked).
- Filter wiring, focal state, and the rails/chips presentation are screen-level and not unit-tested (convention).

## Out of scope (later)

- Animated chemistry lines between synergistic rail slots (FUT-style) — synergy stays a number for now.
- Saving/naming a built team (`saved_teams`) — drafts stay ephemeral.
- Drag-to-reorder within a rail; drag-from-grid-to-rail.
- Class/affiliation filters beyond Publisher + Alignment.
- A 3D/animated focal render — we use the existing portrait, enlarged.
