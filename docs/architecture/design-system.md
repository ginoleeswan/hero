# The design system

> The tokens, the two canvases, and the ratchet that stops the scales widening
> again. Read this before adding a colour, a radius, a font size or a shadow —
> and before deciding a value has to be "just this once".

## Mental model

**One import.** Everything a screen needs comes from `src/design`:

```ts
import { COLORS, RADIUS, SPACE, DISPLAY, LABEL, ELEVATION, PAPER_TEXT } from '../design';
```

It is platform-neutral data, so web and `api/` consume the same file. There is
one system, not a native one with a web copy.

**Two layers, and the distinction is the whole point:**

| Layer          | What it is                                       | Examples                                                                                   |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Primitives** | Raw scales. No opinion about where they're used. | `RADIUS`, `SPACE`, `TRACKING`, `DISPLAY`/`BODY`/`LABEL`, `ELEVATION`, the `COLORS` palette |
| **Semantic**   | What a value _means_ on a given canvas.          | `SURFACE`, `PAPER_TEXT`, `INK_TEXT`, `ACCENT_INK`, `EYEBROW`                               |

**Reach for semantic first.** `PAPER_TEXT.muted` says "secondary text on the
beige canvas" and is a measured 5.61:1. `COLORS.navy` at 60% opacity says
nothing, and happens to be 3.33:1 — a WCAG failure. The palette exists to build
new semantic roles, not to be used at a call site.

## The two canvases

The app has exactly two grounds, and every surface resolves to one:

- **paper** — `COLORS.beige` (`#f5ebdc`), the content canvas.
- **ink** — `COLORS.deepNavy` (`#0b1820`), the stage, with `SURFACE.band` as
  the same material lifted one step.

The same alpha behaves completely differently on each: beige at 0.6α on ink is
6.13:1; navy at 0.6α on beige is 3.33:1. That asymmetry is why the text roles
are split by canvas rather than shared, and why `check:ui` measures contrast
against the canvas a colour is evidently for.

### Dark stages come from `STAGE_INK`, never from hand-rolled hex

Every dark surface in the app sits in one hue family — deepNavy, navy, the
daily game, the boot stage, the profile cover are all **~195–200°**, a teal
ink. The Arena hub and the Battle Builder had hand-rolled
`['#1c2f5a','#13203a','#0c1526']`, which is **~220°** — a true blue that
appears nowhere in `COLORS`. A 20–25° hue gap is obvious the moment two of
those screens are seen in sequence, and nothing was stopping the drift because
the values were raw literals in a JSX prop, not tokens.

`STAGE_INK` (in `colors.ts`) is the native colour array for
`expo-linear-gradient`; the Arena, the builder and the daily game now share it.
`SURFACE_GRADIENT` remains the CSS-string equivalent for web. **If a screen
needs a dark stage, take this one** — a gradient written inline is how the app
grew a second navy.

The primary CTA (the builder's Fight button) is **flat `goldAccent`, thick,
generously rounded, and lifted by a long soft shadow** — no gradient, no bevel,
no rim. Two richer treatments were tried and both failed for the same reason:
decoration inside the fill competes with the label. A full-width horizontal
faction gradient took the shape of a progress bar (a _status_, not an action),
and a metallic light→deep ramp read as fussy. Depth belongs in the elevation,
not in the paint. Ink on gold measures 7.17:1.

### The palette, measured on both canvases

Every palette colour is canvas-specific — there is no "safe" brand colour that
works on both grounds. Measured WCAG ratios of `COLORS.<token>` as **text**:

| token        | on paper | on ink | on band | safe as text on |
| ------------ | -------: | -----: | ------: | --------------- |
| `beige`      |     1.00 |  15.27 |    9.77 | ink, band       |
| `skin`       |     1.24 |  12.29 |    7.86 | ink, band       |
| `yellow`     |     1.56 |   9.80 |    6.27 | ink, band       |
| `goldAccent` |     2.13 |   7.17 |    4.59 | ink, band       |
| `grey`       |     2.20 |   6.95 |    4.45 | ink             |
| `green`      |     2.45 |   6.23 |    3.98 | ink             |
| `orange`     |     2.58 |   5.92 |    3.79 | ink             |
| `blue`       |     2.65 |   5.76 |    3.69 | ink             |
| `gold`       |     3.08 |   4.96 |    3.17 | ink             |
| `purple`     |     4.83 |   3.16 |    2.02 | paper           |
| `red`        |     5.20 |   2.94 |    1.88 | paper           |
| `navy`       |     9.77 |   1.56 |    1.00 | paper           |
| `brown`      |    11.18 |   1.37 |    1.14 | paper           |
| `black`      |    11.67 |   1.31 |    1.19 | paper           |
| `deepNavy`   |    15.27 |   1.00 |    1.56 | paper           |

Regenerate with `yarn contrast:matrix --md` — the script parses the `COLORS`
literal from source, so the table cannot drift from the palette it describes.
Note `grey` on band: 4.45, which _just_ misses AA. That is exactly the kind of
near-miss a hand-maintained table gets wrong, which is why this one isn't
hand-maintained.

Read the two `orange` cells together — 5.92 on ink, 2.58 on paper — because
that single row has produced the same bug repeatedly: an eyebrow styled once,
reused on the other canvas, and silently illegible. `SectionHeader` solves it
the right way, with an `eyebrowLight` variant swapping in `ORANGE_INK`; the
`FeaturedRivalry` kicker solved it the other right way, by guaranteeing the
canvas with a scrim instead of guessing at it.

**Nothing in the table is a licence to use a raw palette token at a call site.**
It exists so new semantic roles can be built with their contrast known rather
than assumed. If you are picking a colour for text, reach for `PAPER_TEXT` /
`INK_TEXT` / `ACCENT_INK`, which already encode these numbers.

An audit of the native app (excluding the web-only admin console) found **no
text failing on its own canvas** — the semantic roles are doing their job. The
risk this table guards against is not today's code; it is the next component
that hard-codes `COLORS.orange` and gets moved onto paper a year later.

## The type scale

Three families, three jobs, and they do not swap:

| Family    | Job                                            | Token           |
| --------- | ---------------------------------------------- | --------------- |
| Flame     | Display only — titles, hero names, pull quotes | `DISPLAY.xl…xs` |
| FlameSans | Long-form body copy — summaries, prose         | `BODY.lg…sm`    |
| Nunito    | UI — labels, buttons, stats, captions          | `LABEL.lg…xs`   |

**Every Flame step satisfies `lineHeight >= 1.22 × fontSize`.** Flame's ink
spans ~119% of its em box, so a clamped (`numberOfLines`) Flame style with a
tighter line-height loses its descenders — RNW turns `numberOfLines` into
`-webkit-line-clamp` + `overflow: hidden` and cuts the g/y/p. Picking a step
from the scale means clamping is always safe. That rule used to live only in a
CLAUDE.md comment, where it had to be remembered rather than inherited.

## Elevation

Four steps, because four is how many depths the app actually has: resting,
lifted (a card), floating (a pill, a FAB), overlaying (a sheet). Shadow is a
depth _signal_ — when every card has its own, the signal carries no information.

**Each step carries `elevation` as well as `boxShadow`**, because `boxShadow`
is a no-op on Android. Spreading the token gets you a shadow on both platforms;
that omission is the single most common cause of "the card looks flat on
Android".

## The ratchet — why this system isn't decorative

Three token files preceded this one and were ignored, because they were
_descriptive_ and nothing enforced them. The audit that prompted this found:

|                              | Count                            |
| ---------------------------- | -------------------------------- |
| `borderRadius` call sites    | ~1,000 across 24 distinct values |
| Distinct `fontSize` values   | 52                               |
| Hardcoded hex colours        | 170, against 53 tokens           |
| Distinct `boxShadow` strings | 87                               |

Failing CI on all of those at once would mean turning the rule off within a
day. So `yarn check:ui` runs a **ratchet** instead:

- It counts off-scale `borderRadius` and `fontSize` literals.
- It compares against `scripts/ui/design-baseline.json`.
- **The count may fall. It may not rise.**

New code has to pick a step. Existing code converges when someone is already in
the file. The number travels one direction only.

When the count falls, the check passes _and_ prints the new baseline to adopt —
that is the tightening, and it should be committed with the change that earned
it.

**If a value is genuinely deliberate** — a 2px progress bar, a 26px squircle
tuned to its art — raise the baseline in the same commit. The point is not that
exceptions are forbidden; it's that they get reviewed rather than absorbed
silently.

## Deliberately not a mass migration

Rewriting ~1,000 radius call sites to snap to the scale would be a large diff
whose only verification is visual, and a meaningful fraction of those values
are correct as they are. Converge opportunistically. The ratchet guarantees the
direction without demanding the sweep.

## Map

| Concern                             | Path                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------- |
| The one import                      | `src/design/index.ts`                                                   |
| Radius / space / tracking           | `src/constants/tokens.ts`                                               |
| Type scale                          | `src/design/type.ts`                                                    |
| Elevation                           | `src/design/elevation.ts`                                               |
| Palette + semantic roles + contrast | `src/constants/colors.ts`                                               |
| Motion vocabulary                   | `src/lib/nativeMotion.ts`                                               |
| Enforcement                         | `scripts/ui/check-ui-invariants.mjs`, `scripts/ui/design-baseline.json` |
| Contrast / target / label rules     | `docs/features/platform-and-motion.md`                                  |
