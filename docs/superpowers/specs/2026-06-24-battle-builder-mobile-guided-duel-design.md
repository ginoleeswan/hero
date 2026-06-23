# Battle Builder — Mobile Guided Duel (Phase 2e)

**Status:** approved direction, pre-plan
**Date:** 2026-06-24
**Supersedes (mobile only):** the symmetric mobile Draft Drawer / deck-stage. **Desktop is unchanged** — it keeps the sandbox (flanks either side + centered grid), which suits its real estate. Same route (`/compare/pick`), same `useBattleBuilder` engine, same `resolveBattleRoute` output.

## Why (the psychology)

People don't open this to "edit a team" — they open it with a question: *"who would win, this vs that?"* The dopamine loop is **pose the matchup → see the verdict**; the build is foreplay, the FIGHT is payoff. A symmetric two-team **sandbox** is an *editor* mindset — cold, and on a phone it forces you to hold two teams + a 3,000-grid + an invisible "active side" at once (the active-side ambiguity that bites). Phones want a **story**: beginning → rising tension → climax. So mobile becomes a **guided 3-act duel** — one full-screen question per act, anticipation building, and the "which side?" problem *disappears* because you only ever fill one side at a time.

## The three acts (mobile)

A slim **stepper** sits up top the whole time: **① Your Squad → ② Challenger → ③ Fight** (current act lit; tap a completed act to go back). Same engine underneath — Act 1 fills side A, Act 2 fills side B, Act 3 routes to the clash.

### Act 1 — "Your Squad"
Full screen, one job: assemble *your* side (1–5). Pure ownership.
- The pool (search + Filters + grid) + **discovery rows** (`⚡ Teammates of <lead>`, `★ Popular`, `⚡ Quick teams`) to kill the blank canvas.
- A **bottom bar** shows your **growing deck** (the stacked-deck visual) + synergy + a **"Next: Choose Challenger →"** CTA (enabled at ≥1).
- Adds always go to side A — there is only one side here, so no active-side concept exists.

### Act 2 — "The Challenger"
The matchup question, framed as a **dare**. Opens on the grudge-match fantasy:
- **Hero header:** *"Who dares face <your lead>?"* (your squad shown small for context).
- **⚔ Arch-enemies row** — your lead's canon enemies (`getRelatedHeroes(leadId, 'enemy')`), one-tap to drop into the challenger side. *This is the emotional peak* and leverages the rivalry graph. Falls back to `★ Popular` when a hero has no rivals.
- **Other paths:** `Build a custom challenger` (the full pool, adds to side B), `Iconic rival teams` (presets → fill side B), `🎲 Surprise me` (random fill side B).
- A **bottom bar** shows the challenger's growing deck + a **"⚔ FIGHT →"** CTA (enabled when side B ≥1). **Back** returns to Act 1 (state preserved).

### Act 3 — "Clash"
The payoff: `resolveBattleRoute(aIds, bIds)` → the existing `/compare/<a>/<b>` arena (1×1) or `/versus/team/draft` (teams). Unchanged.

## Scales 1v1 → 5v5, asymmetric included (a first-class case)

The flow must feel **fastest and most natural at 1v1** — that's the most iconic, highest-intent path ("Batman vs Joker"), and the original picker users loved was exactly a 1v1. The guided duel makes 1v1 *quicker* than the sandbox ever was:

- **1v1:** Act 1 — tap your fighter, "Next". Act 2 — tap an arch-enemy from the rivals row. FIGHT. Three taps to a grudge match. **Never pressure the user to fill 5** — "Next"/"FIGHT" enable at **≥1**; empty slots are an invitation, not a requirement.
- **1-vs-many / many-vs-1 (asymmetric):** just keep adding to either side. A lone hero facing a squad (or vice-versa) is fully supported — `addToSide`/`canBattle` already allow 1–5 per side, asymmetric, and `resolveBattleRoute` sends a `1×1` to the duel arena and anything larger to the drafted clash.
- The deck/bottom-bar and the "Choose Challenger"/"FIGHT" CTAs read naturally whether a side holds 1 or 5 (singular vs squad copy where it helps, e.g. "Your fighter" vs "Your squad").

So the staged structure is **not** a "team-only" flow — it's a duel that scales from a single champion to a 5-v-5, with 1v1 as the marquee fast-path.

## State

Mobile adds one screen-level state: `act: 'squad' | 'challenger'` (default `'squad'`). It drives which side the pool adds to (`setActive('A')` on entering Act 1, `setActive('B')` on entering Act 2) and which deck/CTA the bottom bar shows. The FIGHT CTA in Act 2 navigates the `battleHref`. No change to `useBattleBuilder` (still `aHeroes`/`bHeroes`/`addToActive`/`fillActive`/`removeHero`/`clearSide`/synergy/`battleHref`/`canBattle`). The symmetric `DraftDrawer` is retired on mobile; its `ManageSide`/`DeckStack` card visuals are reused for the per-act bottom bar + squad management.

## Components

- **`src/components/versus/DuelStepper.tsx`** (new) — the ① ② ③ progress header; props `{ act, hasSquad, onBack }`.
- **`src/hooks/useCuratedRows.ts`** (new) — contextual rows keyed on the relevant lead: `teammates` (Act 1) and `rivals`/`enemies` (Act 2) via `getRelatedHeroes(leadId, kind)`, plus `popular` (empty-query browse). Filters out placed heroes; degrades to `[]`. (`useBattleBuilder` already exposes `teammates`; this generalizes to enemies + popular.)
- **`src/components/versus/CuratedRow.tsx`** (new) — a labeled horizontal `ScrollView` of `OpponentCard`, hidden when empty. Used by both acts and (optionally) the desktop pool.
- **`app/compare/pick.tsx` / `pick.web.tsx`** — the mobile branch becomes the act state-machine (Act 1 pool / Act 2 challenger / bottom bars + stepper); the desktop branch stays the sandbox. A new **`src/components/versus/ChallengerIntro.tsx`** renders the "Who dares face X?" header + arch-enemies row + path buttons.
- The bottom bar per act = a slim deck + CTA (reuse `DeckStack`; tap to expand a manage sheet reusing `ManageSide`). Squad management (remove a member) lives in that expand, same as the drawer.

Reused: `useBattleBuilder`, `useHeroSearchInfinite`, `OpponentCard`, `FilterChips`/`PresetRail`, `getRelatedHeroes`, `getTeamRoster`, `resolveBattleRoute`, faction colors, the frosted sticky search + iOS safe-area handling.

## Edge cases & failure

- **Empty squad:** Act 1 "Next" disabled until side A ≥1.
- **No rivals for the lead:** the arch-enemies row hides; Act 2 leads with `★ Popular` + Surprise + Build. Never a dead end.
- **Back from Act 2:** preserves both sides; re-entering Act 2 keeps the challenger as built.
- **Empty challenger:** FIGHT disabled until side B ≥1.
- **A row/query fails:** that row hides (degrade-to-hidden); the act still works via search + the other paths.
- **Hero already placed:** filtered from rows + grid; adds are add-only/no-op (existing guards).

## Testing

- `useCuratedRows` — returns teammates/enemies/popular for a lead, filters placed, degrades to `[]` on error (mocked db). `__tests__/hooks/useCuratedRows.test.tsx`.
- Act state transitions are screen-level (not unit-tested per convention); `battleBuilderState`/`useBattleBuilder` tests stay green (no engine change).

## Out of scope (later)

- Animated act transitions (slide/VS-slam between acts) — a polish pass after the structure lands.
- Saving teams; sharing the matchup pre-fight.
- Applying the staged flow to desktop (desktop stays sandbox).
- Aggregating enemies across the *whole* squad (v1 uses the lead's enemies for a clear "Who dares face <lead>?").
