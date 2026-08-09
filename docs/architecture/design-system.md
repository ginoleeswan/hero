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

| Layer | What it is | Examples |
| --- | --- | --- |
| **Primitives** | Raw scales. No opinion about where they're used. | `RADIUS`, `SPACE`, `TRACKING`, `DISPLAY`/`BODY`/`LABEL`, `ELEVATION`, the `COLORS` palette |
| **Semantic** | What a value *means* on a given canvas. | `SURFACE`, `PAPER_TEXT`, `INK_TEXT`, `ACCENT_INK`, `EYEBROW` |

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

## The type scale

Three families, three jobs, and they do not swap:

| Family | Job | Token |
| --- | --- | --- |
| Flame | Display only — titles, hero names, pull quotes | `DISPLAY.xl…xs` |
| FlameSans | Long-form body copy — summaries, prose | `BODY.lg…sm` |
| Nunito | UI — labels, buttons, stats, captions | `LABEL.lg…xs` |

**Every Flame step satisfies `lineHeight >= 1.22 × fontSize`.** Flame's ink
spans ~119% of its em box, so a clamped (`numberOfLines`) Flame style with a
tighter line-height loses its descenders — RNW turns `numberOfLines` into
`-webkit-line-clamp` + `overflow: hidden` and cuts the g/y/p. Picking a step
from the scale means clamping is always safe. That rule used to live only in a
CLAUDE.md comment, where it had to be remembered rather than inherited.

## Elevation

Four steps, because four is how many depths the app actually has: resting,
lifted (a card), floating (a pill, a FAB), overlaying (a sheet). Shadow is a
depth *signal* — when every card has its own, the signal carries no information.

**Each step carries `elevation` as well as `boxShadow`**, because `boxShadow`
is a no-op on Android. Spreading the token gets you a shadow on both platforms;
that omission is the single most common cause of "the card looks flat on
Android".

## The ratchet — why this system isn't decorative

Three token files preceded this one and were ignored, because they were
*descriptive* and nothing enforced them. The audit that prompted this found:

| | Count |
| --- | --- |
| `borderRadius` call sites | ~1,000 across 24 distinct values |
| Distinct `fontSize` values | 52 |
| Hardcoded hex colours | 170, against 53 tokens |
| Distinct `boxShadow` strings | 87 |

Failing CI on all of those at once would mean turning the rule off within a
day. So `yarn check:ui` runs a **ratchet** instead:

- It counts off-scale `borderRadius` and `fontSize` literals.
- It compares against `scripts/ui/design-baseline.json`.
- **The count may fall. It may not rise.**

New code has to pick a step. Existing code converges when someone is already in
the file. The number travels one direction only.

When the count falls, the check passes *and* prints the new baseline to adopt —
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

| Concern | Path |
| --- | --- |
| The one import | `src/design/index.ts` |
| Radius / space / tracking | `src/constants/tokens.ts` |
| Type scale | `src/design/type.ts` |
| Elevation | `src/design/elevation.ts` |
| Palette + semantic roles + contrast | `src/constants/colors.ts` |
| Motion vocabulary | `src/lib/nativeMotion.ts` |
| Enforcement | `scripts/ui/check-ui-invariants.mjs`, `scripts/ui/design-baseline.json` |
| Contrast / target / label rules | `docs/features/platform-and-motion.md` |
