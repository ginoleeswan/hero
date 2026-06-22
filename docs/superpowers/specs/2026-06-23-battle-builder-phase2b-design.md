# Battle Builder — Phase 2b design

**Status:** approved design, pre-plan
**Date:** 2026-06-23
**Extends:** the team-battles feature (`docs/superpowers/specs/2026-06-22-team-battles-design.md`) — this is the "Unified Battle Builder" half of Phase 2. The drafted-battle backbone (Phase 2a) is already built.

## Summary

Replace today's 1v1 picker at `/compare/pick` with one **unified Battle Builder** that scales from 1v1 up to **5-per-side**, asymmetric allowed, from a single page. You assemble two sides by tapping heroes into the **active** side; tapping **Battle** routes by size — a `1 × 1` to the existing `/compare/[hero]/[opponent]` arena, anything larger to the drafted clash page `/versus/team/draft?a=…&b=…` (both already built in Phase 2a). The builder writes nothing new downstream: it produces a route via the existing `resolveBattleRoute`.

It rewards assembling *real* teams while you build: a **Teammates** rail surfaces the active captain's canon teammates, each side shows a **live synergy %**, and a small **all-Marvel / all-DC** badge marks a unified roster.

## Design decisions (locked)

1. **Scope:** the unified builder **replaces** `/compare/pick` (both `pick.tsx` and `pick.web.tsx`); the older character-locked two-step flow at `app/compare/[hero]/pick.*` is **removed** (superseded). The hub's "Build your own" entry keeps pointing at `/compare/pick` — no new route.
2. **Sides:** two rosters, **1–5 heroes each**, asymmetric allowed (e.g. 3-vs-1). A hero may appear on at most one side.
3. **Add-to-side:** an **active-side toggle** — one tray is active (gold-ringed); tapping a hero in the grid or rail adds them to the active side; tapping the other tray's header switches the active side.
4. **Slots:** each side always shows **5 fixed slots**; empty ones are dashed placeholders. Grid/rail taps are **add-only**; **removal happens by tapping a filled slot** in the tray.
5. **Build assist (all three):** a captain **Teammates** rail (`get_related_heroes`, kind `teammate`), a **live synergy %** per side (`get_team_synergy`), and a **same-publisher badge** (all-Marvel / all-DC).
6. **Commit:** the **Battle** CTA is enabled only when **both sides have ≥1**; it navigates to `resolveBattleRoute(aIds, bIds)`.
7. **Layout:** desktop = trays as a top bar over a beige sheet; mobile = trays stacked over a beige body with a sticky Battle bar (mockups in `.superpowers/brainstorm/**/builder-*.html`).

## Architecture

The builder produces a *route*, nothing more. All resolution/rendering downstream already exists (Phase 2a):

- `resolveBattleRoute(aIds, bIds)` → `/compare/<a>/<b>` for `1×1`, else `/versus/team/draft?a=<ids>&b=<ids>`.
- The 1v1 arena (`/compare/[hero]/[opponent]`) and the drafted clash (`/versus/team/draft`, via `useDraftBattle` + `ClashArena`) consume those routes unchanged.

So Phase 2b is **entirely the builder UI + its state hook**.

## Shared logic — `src/hooks/useBattleBuilder.ts`

A platform-neutral hook owns all state and logic so `pick.tsx` and `pick.web.tsx` are thin views that never duplicate fetch/state (per the platform-pair rule):

```ts
export interface BattleBuilder {
  aIds: string[];
  bIds: string[];
  active: 'A' | 'B';
  setActive: (side: 'A' | 'B') => void;
  rosterA: RosterHero[];      // resolved slot art/stats for side A (getDraftRoster)
  rosterB: RosterHero[];
  synergyA: number;           // 0–100, live; from get_team_synergy
  synergyB: number;
  publisherA: 'marvel' | 'dc' | null;  // non-null only when the side is unified
  publisherB: 'marvel' | 'dc' | null;
  teammates: HeroSearchResult[];        // canon teammates of the ACTIVE side's captain
  addToActive: (id: string) => void;    // no-op if side full (5) or hero already placed on either side
  removeHero: (id: string) => void;     // remove from whichever side holds it
  canBattle: boolean;                   // aIds.length >= 1 && bIds.length >= 1
  battleHref: string | null;            // resolveBattleRoute(aIds, bIds)
}
export function useBattleBuilder(): BattleBuilder;
```

Internals:
- **State:** `aIds`, `bIds`, `active` (default `'A'`). `addToActive` appends to the active side's array, guarded: ignore if that side already has 5 ids, or if the id is in `aIds` or `bIds`. `removeHero` filters it out of whichever side holds it.
- **Roster art:** `rosterA`/`rosterB` come from `getDraftRoster(ids)` (preserves order) per side, in react-query keyed on the id list — reused from Phase 2a.
- **Synergy:** `synergyA`/`synergyB` from `getTeamSynergy(ids)` (`Math.round(total_pct * 100)`), keyed on each id list; a side of <2 yields 0 (the RPC already returns 0). React-query caches per id-set, so it only refetches when a side actually changes.
- **Publisher badge:** derived purely from the resolved roster (all same publisher, ≥2 heroes → `'marvel'`/`'dc'`, else `null`).
- **Teammates:** `getRelatedHeroes(captainId, 'teammate')` where captain = the active side's first hero; empty when the active side is empty. Excludes heroes already placed.
- **`battleHref`:** memoized `resolveBattleRoute(aIds, bIds)`.

The pure parts (`addToActive`/`removeHero` guards, `canBattle`, publisher derivation) are extracted as standalone functions so they unit-test without a DB.

## Components

- **`src/components/versus/RosterTray.tsx`** (new, shared) — one side's tray: the side label + captain name, the 5 fixed slots (filled = portrait + remove affordance, empty = dashed `+`), the live synergy %, and the publisher badge. Props: `roster`, `synergy`, `publisher`, `tint`, `active`, `onActivate`, `onRemove(id)`. Tints from `factionColors.ts` (`FACTION_A`/`FACTION_B`).
- **`src/components/versus/TeammatesRail.tsx`** (new, shared) — a labeled horizontal rail ("Teammates of <captain> → Side X") of tappable hero cards (reuses `OpponentCard` or a small chip). Hidden when empty.
- **`app/compare/pick.tsx`** (rewritten, native) — navy header with the two trays **stacked**; beige body = `TeammatesRail` → search → 3-up grid (`useHeroSearchInfinite` + `OpponentCard` + `HeroPeek`); a **sticky gold Battle bar** at the bottom (`canBattle`-gated).
- **`app/compare/pick.web.tsx`** (rewritten, web) — navy top band with the two trays **side-by-side** (`Side A · VS · Side B`); beige sheet = `TeammatesRail` → search → wider hero grid → centered Battle CTA.

Reused as-is: `OpponentCard`, `HeroPeek`, `useHeroSearchInfinite`, the navy-stage/beige-sheet chrome (`useScreenChrome`/`SURFACE` on web), `getDraftRoster`/`getTeamSynergy`/`getRelatedHeroes`, `resolveBattleRoute`.

Removed: `app/compare/[hero]/pick.tsx`, `app/compare/[hero]/pick.web.tsx`, and `src/hooks/usePickOpponents.ts` if it has no remaining consumers after the two-step flow goes (verify before deleting).

## Visual language

Same as the clash: navy stage (`COLORS.navy`→`deepNavy`) for the tray header, beige (`COLORS.beige`) content sheet, oxblood `FACTION_A` (#9A3E38) / teal `FACTION_B` (#3E6E73) for the two sides, gold `COLORS.goldAccent` for the active ring + Battle CTA. Fonts: `Flame-Regular` display, `Nunito_*` UI; never `Flame-Bold`. Styles via `StyleSheet.create`.

## Edge cases & failure behavior

- **Hero already placed:** grid/rail taps are add-only and no-op if the hero is on either side (the card can show a subtle "in" state). Removal only via the tray slot.
- **Side full (5):** further adds are ignored; the active tray gives a subtle nudge (small shake or brief toast) so the cap is legible.
- **Empty builder / one side empty:** Battle CTA disabled (`canBattle === false`).
- **Synergy / teammates / roster fetch failure:** that strip degrades to hidden (synergy shows nothing, the rail doesn't render) — the hub's "degrade to hidden, never broken" rule. The builder itself never blocks on these.
- **Routing:** `battleHref` is `null` only when a side is empty (CTA already disabled), so the navigation is always valid.

## Testing

Per convention (unit-test pure logic + hooks with mocked Supabase; no full-screen render tests):

- `__tests__/hooks/useBattleBuilder.test.ts` (or extracted-helpers test) — `addToActive`: appends to the active side; no-op when that side has 5; no-op when the hero is already on side A or B. `removeHero`: removes from whichever side holds it. `canBattle`: false until both sides ≥1. Publisher derivation: `'dc'`/`'marvel'` only for a unified roster of ≥2, else `null`.
- `battleHref` wiring is covered by the existing `resolveBattleRoute` tests (Phase 2a) — the hook just forwards to it.

## Out of scope (later)

- Naming your sides / saving teams (`saved_teams`) — drafts stay ephemeral (captain-named on the clash page).
- AI verdicts for drafted battles (drafts use the deterministic engine verdict, per Phase 2a).
- A "make it a team battle" bridge from the 1v1 arena — the unified builder already covers 1v1, so the separate bridge is unnecessary.
- Drag-to-reorder within a tray; tournaments/brackets.
