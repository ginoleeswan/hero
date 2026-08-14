# The iPad spotlight — a deck, not a letterbox

**Date:** 2026-08-14
**Status:** designed, not yet implemented
**Domain doc to update on landing:** `docs/features/explore-feed-and-pulse.md`

## The problem

The Explore billboard (`SpotlightCarousel` → `SpotlightSlide`) draws a ~2:3
portrait with `contentFit="cover"` and `contentPosition="top"` into a box whose
height is `spotlightHeightFor(width, height, insetTop)` — a ratio of the window.
Cover matches the box's *width* and discards everything past its height, so the
share of the artwork that survives is a function of the box's aspect:

| Window | Billboard box | Aspect | Art kept |
| --- | --- | --- | --- |
| iPhone 390 × 844 | 390 × 481 | 0.81 | 82% — face framed |
| iPad portrait 1032 × 1376 | 1032 × 664 | 1.55 | **43%** — scalp and brow |
| iPad landscape 1376 × 1032 | 1376 × 540 | 2.55 | **26%** — hair and hats |

Observed on an iPad Pro 13" simulator at `112d0ae4`: Cyborg renders as 60%
forehead with one eye at the bottom edge and the name block sitting on his face;
Black Cat is an unreadable white mass; Cypher is a hat brim. The phone is
correct and always has been — the defect is invisible until the box widens.

A second defect compounds it. At 1032pt wide the head renders ~2.6× its phone
size. Even with a corrected crop anchor, a full-bleed portrait on a tablet is a
magnifying glass — the failure mode `src/constants/layout.ts` was written to
prevent ("the same physical card, more of them"). The billboard is the one
surface that rule was never applied to.

## The rule this adopts

`spotlightLayout()` — today at `src/components/web/home/spotlightLayout.ts` —
already solves precisely this, for the web, and its header states the same
diagnosis: *the card's aspect ratio is the invariant and the stage height
follows the card width.* Its four states and their real output at our widths:

| Width | State | Stage | Card | Deck slivers |
| --- | --- | --- | --- | --- |
| < 720 | `stacked` | 360–500 | full width | — |
| 720–999 | `caption` | 300–500 | 240–340 | — |
| 1032 (iPad portrait) | `duo` | 502 | 276 | 138, 99 |
| 1376 (iPad landscape) | `gallery` | 509 | 280 | 140, 100, 76, 54, 39, 28, 20 |

Every card is 0.55 w/h — the crop the portraits were painted for. Rotating an
iPad changes how many cards are visible, never what shape they are.

Native consumes three of these four states. `stacked` is web-only — see
decision 4. `caption` (720–999, reachable on an iPad mini in portrait and on a
3/4 Split View) is the deck's degenerate case: one correctly-proportioned card
and the panel, no slivers, and it needs no separate design.

**Panel contents by `detail`,** which is what each state takes away:

| `detail` | States | Panel carries |
| --- | --- | --- |
| `full` | gallery | kicker · name · blurb · rail |
| `trim` | duo | kicker · name · blurb (clamped to 3 lines) · rail |
| `lean` | caption | kicker · name · rail |

(`minimal` belongs to `stacked` and is unused on native.)

## Decisions

### 1. One shared module, in `src/constants/`

**Move** `src/components/web/home/spotlightLayout.ts` →
`src/constants/spotlightLayout.ts`; the web spotlight and `HomeSkeleton` update
their imports. Nothing under `components/web/` becomes load-bearing for native,
because after the move nothing native-facing lives there.

The file is pure arithmetic — no React, no platform APIs, one import
(`pageGutter` from `constants/colors.ts`, itself platform-neutral). This is
exactly the shape `constants/layout.ts` already holds, and that file's own
comment on `heroImageAspect` is the precedent: *"Two files deriving 'the same'
ratio independently is precisely how that drifts, so it is written down once,
here."* This repo has been burned by duplicated geometry twice already —
`homeGeometry.ts` exists because the skeleton and the feed drifted, and the
character screen's native/web pair still does.

**Gutter check.** `spotlightLayout` uses web's `pageGutter` (CONTENT_MAX_WIDTH
1440), while native sizing uses `pagePadding` (CONTENT_MAX_WIDTH 900). At both
iPad widths the two agree at 32pt, so the move introduces no drift where it
matters. The module keeps `pageGutter`; the two systems are not unified here.

**Threshold seam.** The module's stacked cutoff is 720; `BREAKPOINTS.tablet` is
700. The spotlight keeps its own 720 — it is tuned to the card arithmetic, not
to page gutters. A 20pt band where the page is "tablet" but the billboard is
still stacked is harmless, and retuning either number is unjustified churn.

### 2. No CTA button on native — the name carries a chevron

The panel renders kicker, name, blurb and rail. It does **not** render the
"View profile" pill that web's `duo`/`gallery` panels carry.

`SpotlightSlide` already argued and won this once ("On native a full-bleed
content card IS the affordance"), but that argument was about a full-bleed
slide and no longer applies verbatim to a card beside a panel. The precedent
that does apply is web's own `stacked` state, which faced the identical
composition — art plus caption, touch input — and resolved it: *"A 'View
Profile' button under a tappable portrait is the same instruction printed
twice, so the button is gone and the name carries a chevron to say the same
thing once."*

On touch the card is a ~280 × 500pt target. Adding a 40pt pill for the same
destination is a second target for one intent, and it puts a saturated orange
fill next to art that is supposed to be the loudest thing on the stage. Native
and web panels therefore differ by one control — a platform affordance
difference of the kind the platform doc sanctions, and web's own stacked state
already makes.

### 3. Ghost name only in `gallery`

Change `showGhostName` from `tail.length > 0` to `state === 'gallery'`.

Type-as-scenery needs negative space to be scenery. In `gallery` the deck
tapers to a 20pt edge and the stage keeps real emptiness behind the panel. In
`duo` the strip is 537 of 1032pt and the panel takes 415 more — there is no
negative space, and the ghost would put the character's name at display size
twice within 40pt of itself.

**This changes web too**, at 1000–1279px, and that is deliberate rather than
overlooked: it is the same judgment about the same composition at the same
widths. Blast radius is a 5.5%-opacity backdrop layer. Flagged here explicitly
so it can be vetoed in review.

### 4. The phone does not change

Below 720 the native spotlight renders **today's `SpotlightCarousel` /
`SpotlightSlide` untouched** — full-bleed, centred name, dots-with-filling-pill.
It does *not* adopt web's `stacked` state, whose furniture (kicker, chevron,
plate number, dwell rail) is a different design.

This is the seam that keeps the change safe: the ask was iPad, the defect is
iPad-only, and the phone billboard is tuned and shipped. A narrow Split View
column (320–507pt) is below 720 and so keeps the phone treatment, which is the
correct answer for a phone-width window.

## Architecture

```
src/constants/spotlightLayout.ts     MOVED from components/web/home/ — the arithmetic
                                     + showGhostName rule change (decision 3)

src/components/home/
  SpotlightCarousel.tsx              width < 720 → today's path, unchanged
                                     width ≥ 720 → renders SpotlightDeck
  SpotlightSlide.tsx                 unchanged (phone only)
  SpotlightDeck.tsx        NEW       the tablet stage: strip + panel
  SpotlightDeckCard.tsx    NEW       one 0.55 card at a given width + opacity
  homeGeometry.ts                    exports the deck's stage height so
                                     HomeSkeleton mirrors it

app/(tabs)/explore.web.tsx           import path only
src/components/web/HomeSkeleton.tsx  import path only
```

`SpotlightDeck` is a view layer over the shared function — it owns *what is
shown* at each state, never *how big it is*. That split is the same one
`spotlightLayout`'s header already draws and is what keeps the two platforms
from diverging again.

### Data flow

`useWindowDimensions()` → `spotlightLayout(width)` → `{ state, stageHeight,
cardWidth, tail, detail, showGhostName, panelMaxWidth, gutter }` →
`SpotlightDeck` renders `tail.length + 1` cards at `SLIVER_OPACITY[i]` and a
panel from the active `Hero`. Live width, so rotation and Split View re-render
correctly — no module-scope `Dimensions.get()`.

### Interaction

- The active card and the panel name are both links to the character.
- Tapping a sliver promotes it to active.
- Horizontal swipe on the stage steps the deck (`> 44pt`, matching web).
- Autoplay 6s, paused on interaction, disabled under `useReducedMotion()`.
- The existing `SpotlightProgress` rail is reused for position + dwell.

### Skeleton

`HomeSkeleton` (native) must mirror `stageHeight` per state or the
skeleton→feed handoff jumps — the exact drift `homeGeometry.ts` exists to
prevent. The deck's stage height goes through `homeGeometry.ts`.

## Testing

Unit-test `spotlightLayout()` as a pure function — state, card aspect, and the
deck's taper at 390 / 507 / 744 / 1032 / 1376, plus the invariant that
`cardWidth / stageHeight` stays within a hair of 0.55 at every width from 320 to
1600. Per repo convention, no rendering or navigation tests.

Device pass on the iPad simulator: both orientations, rotate with the deck
mid-autoplay, and confirm the phone billboard is pixel-unchanged at 390.

## Out of scope

- The landscape character-page hero image (`heroImageAspect` returning 1514pt
  into a 1032pt window) — a separate, unrelated defect found in the same pass.
- Retuning `BREAKPOINTS.tablet` or unifying the two CONTENT_MAX_WIDTH systems.
- Any change to the phone billboard.
