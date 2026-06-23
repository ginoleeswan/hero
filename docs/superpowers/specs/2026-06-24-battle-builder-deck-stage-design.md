# Battle Builder — Deck-Stage + Curated Rows (Phase 2d)

**Status:** approved direction, pre-plan
**Date:** 2026-06-24
**Extends:** the Battle Builder (`/compare/pick`, Phases 2b/2c). Same route, same `useBattleBuilder` state, same `resolveBattleRoute` output. This phase reworks the **presentation**: the team display becomes a fanned-hand deck under a matchup header, and the roster pool gains a curated-rows discovery layer over the flat grid.

## Why

The user liked the original two-step picker's header (a big featured portrait per side, "Batman VS ?", "CHOOSE YOUR CHALLENGER") and wants that fused with the Battle Builder, plus a card-game "deck grows as you add" metaphor and the discovery rows the old RIVALRIES rail provided. Locked decisions: **fanned hand** (visible + tappable cards, NOT a hidden stack) for legibility/control; **curated rows + flat grid** for the pool.

## 1. Matchup deck-stage (replaces the edge flanks / mobile slot tray)

A centered matchup header at the top of the page:

```
            ★ BUILD A BATTLE ★
   (deck A)   ┌────────┐   ┌────────┐   (deck B)
   fanned  →  │  BAT   │VS │   ?    │ ←  fanned
              └────────┘   └────────┘
               Batman       YOUR PICK
            CHOOSE YOUR FIGHTERS
```

- **Two featured cards flank a VS badge.** Each side's featured = its **lead** pick (roster[0], the captain) shown big; an empty side shows a dashed **"YOUR PICK ?"** seat. Right side mirrors (`scaleX:-1`).
- **Fanned hand per side:** the squad renders as a **fanned, overlapping hand** beside/behind the featured card — each member **offset enough that its face is partly visible and individually tappable**; **tap a card → remove** (it lifts out). 1–2 faded **ghost cards** at the tail signal "add more" (hidden at 5). The fan grows/fans wider as the side fills (the dynamic-sizing rule: fewer = bigger/calmer, more = a wider fan).
- **Active side** is spotlit (faction glow + "▶ Now Picking"); **inactive recedes** (dim + slight scale) — carried over from current. Tap a side to make it active.
- **Per-side controls:** 🎲 random, Clear — compact, near the side label. Synergy % + publisher badge shown when applicable.
- Eyebrow `★ Build a Battle ★` + the "CHOOSE YOUR FIGHTERS" line (gold).

New component **`src/components/versus/HeroDeck.tsx`** (shared): props `{ roster, tint, active, flip, side, onActivate, onRemove, onRandom, onClear, synergy, publisher }`. Renders the featured card + fanned hand + ghost + meta. Supersedes the desktop `Flank` and the mobile tray's slot rendering (both fold into `HeroDeck`).

## 2. The pool — curated rows + flat grid

Below the stage, on the content sheet:

- **Browsing (no query):** a stack of **curated horizontal-scroll rows**, contextual to the **active side's captain**:
  - `⚡ Teammates of <captain>` — `getRelatedHeroes(captainId, 'teammate')` (already in the hook).
  - `⚔ Rivalries` — `getRelatedHeroes(captainId, 'enemy')`.
  - `★ Popular` — popularity browse (empty-query `useHeroSearchInfinite('', publisher, alignment)`, or the existing popular path).
  - `⚡ Quick teams` — presets (`usePresetTeams` → `getTeamRoster` fills the active side) — repositioned here from the filter panel.
  - Rows with no data hide (degrade-to-hidden). When the active side is empty, Teammates/Rivalries hide and Popular/Quick-teams lead (cold-start).
- **Searching / filtering:** the rows collapse; the pool becomes **one flat ranked grid** (current behaviour). A query or a non-`All` filter triggers the switch.
- Each row item is a tap-to-add card (`OpponentCard`); already-placed heroes are filtered out.

New component **`src/components/versus/CuratedRow.tsx`** (label + horizontal `ScrollView` of `OpponentCard`, hidden when empty) and a hook **`src/hooks/useCuratedRows.ts`** wrapping the related/popular queries keyed on the active captain (degrade to []). The flat grid + filters + progressive-disclosure stay as built.

## 3. Layout / responsive

- **Desktop:** the matchup stage centered at the top (not edge-flanked anymore); the pool (search + Filters, curated rows, flat grid) centered below at the grid width; FIGHT + Clear-all at the end. The decks are big; the stage is the hero.
- **Mobile:** the matchup stage at the top (prominent, like the liked two-step header) — **scrolls** (not sticky; it's tall). A **compact sticky search + Filters bar** (the current frosted head, minus the team strip) stays pinned so search/filter is always reachable while browsing. The fanned decks are sized down. Fixed FIGHT bar stays. (Team state lives in the stage, which you scroll back to — acceptable since the stage is the page's focal point.)

Keep everything else: draft routing (`resolveBattleRoute`), live synergy, publisher badge, filter progressive-disclosure (`Filters` toggle + panel — now publisher/alignment only, since Quick-teams moved to a row), the frosted-on-scroll sticky bar + iOS safe-area handling, faction colors, never `Flame-Bold`.

## State (`useBattleBuilder`)

No new state. Reuses `aHeroes`/`bHeroes`/`active`/synergy/publisher/`teammates`/`addToActive`/`fillActive`/`removeHero`/`clearSide`/`clearAll`/`battleHref`/`canBattle`/`isPlaced`. The Rivalries/Popular rows are screen-level queries (via `useCuratedRows`), not builder state.

## Edge cases & failure

- Empty side: featured = dashed "YOUR PICK ?" seat; fan shows ghost cards only. Teammates/Rivalries rows hide; Popular/Quick-teams lead.
- A curated query fails/returns []: that row hides. None block the builder.
- Removing via a fanned card: tap lifts/removes; the fan reflows; featured falls back to the new lead.
- Hero already placed: filtered from rows + grid; adds are add-only/no-op (existing guards).
- Deck legibility: cards fan with enough offset to stay tappable; never fully occluded (the chosen UX over a hidden stack).

## Testing

Per convention (pure logic + hooks, no full-screen render tests):
- `useCuratedRows` — returns the related/popular lists, filters out placed heroes, degrades to [] on error (mocked db). New `__tests__/hooks/useCuratedRows.test.tsx`.
- `HeroDeck`/`CuratedRow` presentation and the stage layout are screen-level (not unit-tested).
- Existing `battleBuilderState` / `useBattleBuilder` tests stay green (no state change).

## Out of scope (later)

- Card flip/throw animations beyond a simple lift on add/remove.
- Drag-to-reorder the hand; drag from a row into a side.
- Saving teams; per-row "see all" expansion screens.
- Affinity/class rows beyond Teammates / Rivalries / Popular / Quick-teams.
