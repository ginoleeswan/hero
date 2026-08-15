# The iPad stops being a stretched phone

**Date:** 2026-08-15
**Status:** designed, not yet implemented
**Domain docs to update on landing:** `docs/features/profile-and-gamification.md`,
`docs/features/arena-and-matchups.md`, `docs/features/explore-feed-and-pulse.md`,
`docs/features/platform-and-motion.md`

## The problem, measured

Exactly **two** screens in the native app are width-aware — `app/(tabs)/search/index.tsx`
and `app/character/[id].tsx` — plus the Explore billboard, adapted on 2026-08-14.
Everything else has no notion of width at all and renders a phone layout at
1376pt.

Observed on an iPad Pro 13" simulator in landscape:

| Screen | What it does at 1376pt |
| --- | --- |
| Profile | "Create Account" is a **1330pt-wide** button; list rows run edge to edge; ~380pt of dead space below the fold |
| Arena | Battle-builder cards ~**840pt each**, faces cropped and enormous; "What's left today" a narrow centred strip while "Make a fight" runs full-bleed at 16pt — a ragged left edge down one screen |
| Compare | Same proportion-scaled cards as Arena's builder |

`src/components/ui/PageColumn.tsx` names this exactly in its own header: *"The
single most recognisable 'iPhone app running on an iPad' tell is a form field,
or a settings row, or a paragraph, stretched the full 1194pt of a landscape
tablet."* Profile does not use it.

## The primitives already exist and are under-adopted

Nothing here needs inventing:

- **`PageColumn`** — caps and centres a column. A **no-op on phones** by
  construction, because the cap exceeds the window. Seven consumers, applied
  *within* screens rather than *to* them, which is why Arena reads ragged.
- **`constants/layout.ts`** — `railCardWidth` (the fixed-size-not-proportion
  rule), `gridColumns`, `contentWidth`, `pagePadding`. Used by the home feed and
  almost nowhere else.
- **`useLayout()`** — the live window, and everything derived from it.

The gap is adoption, not capability.

## The rule worth borrowing from web

Web at desktop width does something native does not: it uses the extra width for
**density**, not for **size**. "Today's Battle" and "Guess the Hero" sit side by
side; native stacks them full-width, one after the other.

That is the difference between a layout that was designed for the width and one
that was merely allowed to fill it. `layout.ts` already states the same
principle for rails — *"the same physical card, more of them"* — and this spec
extends it from rails to rows.

## Scope

Four changes, in payoff order.

### 1. Pair the Explore rows at `gallery` width

At `breakpointFor(width) === 'wide'`, place **Today's Battle** beside **Guess
the Hero** in a two-column row, as web does. Both are compact, self-contained
cards that currently each take a full 1376pt-wide band for perhaps 300pt of
content.

Only this pair. Do not pair rows that carry horizontal rails
(`RightNowBand`, `HomeHeroRow`, `TitlePosterRail`, `CoverGallery`) — a rail in a
half-width column is the "broken carousel" failure `layout.ts` exists to prevent.

### 2. Profile through `PageColumn`

Wrap the screen's content column. Nothing else changes: no new sections, no
re-tuned spacing, no phone impact. This is the single highest ratio of
"stops looking wrong" to risk in the app.

### 3. Arena — one gutter, and cards that are cards

- Apply `PageColumn` at the **screen** level rather than per-section, so the
  left edge stops stepping between 16 and centred.
- Put the battle-builder cards on `railCardWidth(width)` so they stop being a
  proportion of the window. The rule is the one already written down: above the
  tablet threshold a card is a fixed size, and the width buys *more* cards or
  more air, never a bigger card.

### 4. Compare — the same card rule

`app/compare/pick.tsx` and `app/compare/[hero]/pick.tsx` already use
`gridColumns`; the builder cards in `app/compare/[hero]/[opponent].tsx` do not.
Same fix as Arena's.

## Non-goals

- **No redesign.** Every screen keeps its composition, its copy and its
  hierarchy. This is about width, not about ideas.
- **No phone change.** `PageColumn` is a no-op below its cap and
  `railCardWidth` returns the existing proportion below the tablet threshold.
  Any phone-visible diff is a bug in the change, and the tests must pin this.
- Not Split View or Stage Manager tuning beyond what keying on the window
  already gives.
- Not the remaining web-parity items on the spotlight deck (the "View Profile"
  CTA divergence stands).

## Testing

Per repo convention: pure functions and hooks unit-tested; no rendering tests
for screens.

The load-bearing assertion is the **phone invariant** — for each screen touched,
a test that the values it derives at 390pt are identical to what they were
before. That is the same guard that made the Explore gutter unification safe.

Everything else here is visual and must be verified on the simulator in both
orientations, because a green suite has repeatedly failed to catch layout and
runtime faults in this codebase.

## History

- Explore billboard adaptation:
  `docs/superpowers/specs/2026-08-14-ipad-spotlight-deck-design.md`
