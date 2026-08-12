# Platform split, chrome and motion

> The cross-cutting UI system: how one codebase serves native and web without
> forking its logic, how the web owns its browser chrome, and the motion /
> loading / delight layers that make Mythique feel like one product on every
> platform. Read this before adding a screen, touching anything under
> `src/components/web/`, or animating anything.

## Mental model (read this first)

Three layers, strictly ordered:

1. **Logic is platform-neutral.** Data fetching, state, and derived values live
   in `src/hooks/` and `src/lib/query/` with no `.web`/`.native` suffix, so both
   sides of a screen pair import the same hook.
2. **Views are platform-specific and thin.** `foo.tsx` (native) and
   `foo.web.tsx` (web) are render layers over the shared hook. Metro picks by
   extension.
3. **Chrome and motion are web problems solved once.** The browser's status
   bar, toolbar tinting, document scroll, and view transitions are owned by a
   small set of shared modules — screens declare intent, never reimplement.

If you find yourself writing a `useEffect` with a fetch inside a `.web.tsx`
file, you are on the wrong layer.

## The screen pair convention

Both halves of a pair **must exist** or expo-router throws a resolution error —
`HouseLinks` once lived only in the web character page for several commits and
the feature was unreachable on a phone. Two screens are deliberate single-file
exceptions that branch on `Platform.OS` / `useWindowDimensions` instead of
splitting: `app/title/[id].tsx` and `app/issue/[id].tsx`.

**The drift trap:** nothing warns you when a pair's bodies diverge, and several
web halves have drifted far past "thin":

| Screen                   | Native       | Web              |
| ------------------------ | ------------ | ---------------- |
| `app/character/[id].tsx` | ~2,300 lines | **~4,300 lines** |
| `app/(tabs)/profile.tsx` | ~1,500 lines | ~2,300 lines     |
| `app/(tabs)/explore.tsx` | ~600 lines   | ~2,000 lines     |

When you change behaviour on one side, grep the other side for the same
feature before calling it done. New shared logic goes in the hook, not in
whichever file you happened to have open.

**This is not hypothetical — the character pair had silently drifted in three
user-visible ways**, each found only by reading the two files side by side:

| Behaviour             | Native said                                      | Web said    | Reach                |
| --------------------- | ------------------------------------------------ | ----------- | -------------------- |
| Placeholder filtering | kept `Unknown` / `None` / `No alter egos found.` | hid them    | 426 + 236 + 164 rows |
| `alignment: neutral`  | "Neutral"                                        | "Anti-Hero" | 919 characters       |
| `origin: training`    | "Training"                                       | "Trained"   | —                    |

All three were _duplicated constants_, not duplicated markup: each file had its
own junk-value set and its own label map. They now live in
`src/lib/characterFacts.ts` and `src/lib/characterTaxonomy.ts`, tested, so the
next divergence has to be deliberate.

**And the pair was not the whole story.** Sweeping for the same literals turned
up the alignment chip re-implemented on five further surfaces — the spotlight
slide, the search role badge, the social-web focus card, the explore feed and
the daily-game reveal — with the daily game spelling it "Anti-hero" and
`HeroPeek` falling through to the raw database value, so a neutral character's
chip read a lowercase `neutral` beside properly cased ones. All seven now read
from `ALIGNMENT_LABELS`. **When you find a duplicated constant in a pair, grep
the whole tree before assuming the pair was the extent of it** — the fix that
only unified the two files would have left the character page as the one screen
saying something different.

The placeholder list had spread the same way: four copies, in
`contribute/missingFields.ts`, `family/parseRelatives.ts`, `game/reveal.ts` and
`RelatedHeroStrip.tsx`. `missingFields.ts` was the instructive one — its comment
claimed to use "the same sentinels the character screen treats as empty" while
knowing only half of them, so a field the reader saw hidden was never offered
for contribution. A comment asserting two things agree is not a mechanism for
making them agree. All four now call `isPresentableFact`, and
`__tests__/lib/characterFacts.test.ts` asserts the consumers still match.

The lesson generalises: **when de-duplicating a pair, start with the constants
and pure helpers, not the JSX.** They are where drift actually hurts (it changes
what the app says), they are safe to extract without touching either layout, and
they are testable. The markup can stay forked — it is genuinely platform-specific
— as long as the meaning behind it is not.

## Web chrome: the constant-ink system

iOS Safari tints its status bar and toolbar from the **document background**,
not from your React tree. The rule that fell out of much pain: **the document
canvas is always ink**. Light screens paint their own paper body on their root
container; the document behind it stays dark.

| Piece               | Path                                | Job                                                                                                                                                                                                          |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build-time paint    | `app/+html.tsx`                     | `html, body { background-color: #0b1820 }` so the very first paint is navy, plus the 16px input floor                                                                                                        |
| Screen declaration  | `src/hooks/useScreenChrome.ts`      | one call declares `top` + `canvas` together so they can't drift                                                                                                                                              |
| Document background | `src/hooks/useWebCanvas.ts`         | implementation; `useWebCanvas` is an alias of `useWebDocumentScroll` (`src/hooks/useWebDocumentScroll.ts` re-exports it)                                                                                     |
| Top chrome          | `src/contexts/WebChromeContext.tsx` | `WebChromeProvider` + `AdaptiveStatusBarCover` — a fixed `env(safe-area-inset-top)` strip portaled into `document.body`, cross-fading with the theme colour as pages change from dark-topped to light-topped |
| Nav                 | `src/components/web/TopBar.tsx`     | floating nav, locks to the declared `top` colour                                                                                                                                                             |
| Page bottom         | `src/components/web/PageEndCap.tsx` | closes light pages back into the ink canvas                                                                                                                                                                  |

Wired in `app/_layout.web.tsx`, which also owns **scroll reset per route**
(`window.scrollTo` on `usePathname` change).

Two traps:

- **Never nest an RN `ScrollView` as the page scroller on web.** The document
  must own scroll or Safari's toolbar-collapse behaviour breaks (the toolbar
  never minimises, overscroll shows the wrong colour). Screens render into the
  document flow and let the body scroll.
- **Inputs need `font-size ≥ 16px`** or iOS Safari auto-zooms on focus.
  `app/+html.tsx` enforces `max(16px, 1em)` globally — don't undercut it with
  an inline style.

## Motion

`src/lib/motion.ts` is the single vocabulary — inert data plus one pure
function, so it's safe to import anywhere:

- Durations: `fast` 150ms, `base` 200ms, `entrance` 600ms, `stagger` 50ms with
  a cap of 8 items (the rest arrive with item 8).
- Easings: `EASE_OUT_EXPO` (decisive settle) and `EASE_OVERSHOOT` (playful
  spring-past).
- `prefersReducedMotion()` — SSR-safe and native-safe; callers fall through to
  their non-animated branch.

`src/components/web/Reveal.tsx` is the scroll-entrance wrapper: children rise
~14px and fade the first time they enter the viewport (`useInViewOnce`), and
render settled immediately under reduced motion.

### View Transition morphs

`src/lib/viewTransition.ts` wraps the View Transitions API:
`withViewTransition` commits the update inside `flushSync` and **no-ops
gracefully** where unsupported (Firefox, older Safari, native) — callers get
`null` back and navigation just happens. Named pairs:

| Name                               | Morph                                                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vt-hero-portrait` (`VT_PORTRAIT`) | card art → character-page portrait, via `src/hooks/useHeroMorph.ts` (which also hands the detail page a `MorphArt` payload so the portrait paints before its query resolves) |
| `vt-fighter-a` / `vt-fighter-b`    | compare flow, `app/compare/[hero]/pick.web.tsx` + `[opponent].web.tsx`                                                                                                       |
| `vt-topbar`                        | the nav itself stays pinned through transitions                                                                                                                              |

On native, the character page uses expo-router's `Link.AppleZoomTarget` zoom
instead (`app/character/[id].tsx`).

## Loading

The system is anti-flash first: a fast load should show **nothing**, never a
half-frame of skeleton.

- `src/hooks/useSkeletonTransition.ts` — four phases (`pre` → `skeleton` →
  `crossfade` → `content`); loads that resolve within the delay skip the
  skeleton entirely.
- `src/components/ui/FadeOutSkeleton.tsx` — dissolves the skeleton **over**
  already-rendered content, so placeholders resolve in place instead of the
  content fading up from zero.
- Per-surface skeletons in `src/components/skeletons/` (Home, Character,
  Category, House, Title), built from `src/components/ui/Skeleton.tsx` +
  `SkeletonProvider` (one shared shimmer clock).
- `src/components/ui/LogoLoader.tsx` — **mounted once** in `app/_layout.web.tsx`
  spanning the whole cold start (fonts → auth settle), so the boot animation
  never restarts.
- `src/components/ui/BootStage.tsx` — the **native** boot surface
  (`app/_layout.tsx`). One idea: **you put the mask on** — it recoils, lunges,
  and settles over your face, and the app is what the world looks like through
  its eye.

  **Still.** The first frame is not a lookalike of the native splash, it is the
  same picture: `assets/splash.png` and the JS stage are both drawn from
  `SPLASH_LOCKUP` in `src/constants/logo.ts` — mark high, wordmark low, on flat
  `#293C43`. expo-splash-screen renders the PNG at `imageWidth` points wide,
  centred, aspect preserved, so the stage can rebuild that exact box from the
  screen size alone. Nothing assembles, because the composition is already what
  you launched into. Only the ambient wakes: depth gradient and ember fade in,
  the mark breathes.

  **Open.** Gated on the Explore feed's first paint (`useSignalFirstPaint`),
  capped at `REVEAL_CAP_MS`, floored at `HOLD_MS`. The wordmark sinks and fades
  while the mask **recoils** (`RECOIL`, ~4.5%) — anticipation is what separates
  a lunge from a zoom; everything that moves like it has a body loads up before
  it strikes, and it doubles as the handover beat so the mask never grows while
  the wordmark is still on screen. Then it lunges, tipping a few degrees under
  `perspective` so it moves through space instead of inflating in place
  (levelling out as it reaches you — a mask being seated straight, not a card
  spinning), with its **left eye** pulled to the centre of the screen. The
  curtain drops with **one medium haptic tap** — the mask making contact, fired
  from an animated reaction at the exact progress the ramp hands `cover` over
  (`GROW_AT[3]`), because the moment is defined by the animation, not a timer.
  The eye keeps opening to 1.5× the display: the overshoot is the mask passing
  your head as you put it on, and it is free — the rim leaves the screen at
  `cover`, so the extra magnification lands entirely on ink that is off
  screen.

  **Why an eye and not the centre.** The bridge between the eyes is solid, so
  scaling about the mark's centre parks a growing beige column over the middle
  of the screen forever. The aperture has to be a hole, and `LOGO_MASK_PATH`'s
  eyes already are holes in the filled path — so whatever is drawn under the
  mark shows through them. No mask layer, no blend modes, no animated SVG props:
  the reveal is a transform on one view.

  **The rule the reveal must obey.** The curtain may not start to fade until the
  mark's ink covers the whole display. Drop it early and the app does not arrive
  through the eye — it leaks in around the mark's outer edge, on whichever
  device the margin happens to fail on. So the curtain's opacity is keyed to the
  mark's **scale**, not to elapsed time: "does the ink cover the screen" is a
  fact about geometry and the device's height. That maths lives in
  `src/lib/bootGeometry.ts` and is swept across six screen heights (SE → iPad)
  in `__tests__/lib/bootGeometry.test.ts`. The test has teeth — the naive
  coverage constant fails it.

  `centringPull` finishes before the curtain is allowed to move, which is what
  lets `cover` budget only half a screen of ink. While the centring lagged, the
  ink had to reach the far edge from wherever the eye had got to (0.68 of the
  height, not 0.55) — that cost real magnification, and magnification is
  sharpness, because react-native-svg rasterises at layout size and UIKit does
  not redraw for a transform.

  **The boot carries information, not just motion** (`src/lib/bootSignal.ts`,
  `useBootSignal`). The choreography is identical every launch; only the LIGHT
  behind the mask changes, and it changes for two reasons:

  - **Its colour says what day it is.** `emberForDate` seeds one of eight lamps
    from the UTC date, so everyone who opens the app on the same day sees the
    same light and it turns over at midnight UTC. Shared, therefore worth
    mentioning to someone. Eight rather than seven on purpose: a seven-lamp
    cycle indexed by date lands on the same colour every Tuesday, which makes
    the ritual a calendar rather than a surprise. Tested.
  - **Its intensity says whether the day's game is still waiting.** Lit while
    today's daily is unfinished, calm once it is spent. Nobody is told this;
    you learn it the way you learn a room is occupied from the light under the
    door. A notification with no notification.

  Both are DERIVED, not fetched — the date is the date, and the daily's result
  is already in AsyncStorage (`dh_v3_<date>`, written by `useDailyHero`). That
  is the only reason either is allowed near a splash: it resolves in a couple
  of milliseconds, offline, on the first frame. The ember is held back until
  the read lands rather than shown in the fallback colour and swapped
  underneath the viewer, and an unparseable record is treated as _finished_ —
  this decides how bright a glow is, so the failure mode has to be the quiet
  one.

  The VoiceOver label carries the same thing the light does ("today's game is
  waiting"), because a personalisation that only exists for sighted users is
  half a feature.

  **Contact gets one frame of warm light** — a 14% beige wash over everything,
  about 150ms, peaking at `SEAT_AT` under the same haptic, so the eye is told
  what the hand is told. Anything stronger reads as a camera flash, which is
  where the device stops feeling physical and starts feeling cheap.

  **There is no ember rim on the mask, and that was tried.** A stroke of the
  same path in the accent, riding inside the silhouette, looked like a sticker
  outline; stacking strokes to fake a falloff banded into a contour map and put
  a brown halo round the eyes. A hard-edged stroke is a graphic device, not a
  light — and the screen already has real light in the ember, so a second,
  worse implementation of the same idea makes it cheaper rather than richer.

  **The ember sits above the curtain and below the mark**, so one layer does two
  jobs: at rest it is the bloom around the mark and a faint glow inside its
  eyes; during the flight it is the only thing visible through the eye while the
  curtain is still up. Without it, that stretch was navy seen through navy — the
  mark grew, the screen went flat, and the sense of being inside an eye was lost
  exactly when it should have been strongest. It is held burning past the
  curtain's drop so the app arrives on a warm frame, not a dark one.

  **The draw-back is one gesture, not three.** The mask contracts, the ember
  dims, and the wordmark rises and shrinks toward the mask — drawn in by the
  breath rather than shooed off the bottom of the screen. Same 230ms; the
  difference is whether the screen is doing one thing or three separate ones.

  Only the curtain ever fades — double-fading curtain + app reads as a grey
  wash. Honors Reduce Motion (plain crossfade, no fly-through, no haptic).

  **Every animated style has to branch on Reduce Motion, and the reason is
  structural:** the flying curves are written in PROGRESS space against a
  1150ms exit, and Reduce Motion swaps that for a 220ms crossfade. The same
  numbers then mean something completely different — `[0, LUNGE_AT]` stops
  being "the first 230ms" and becomes "the first 44ms". Three separate bugs
  came out of this one mistake: the mask sat at full opacity over the app and
  popped out at the end, the wordmark vanished in the opening frames, and the
  ember dimmed and then spiked to 2.4x inside a fifth of a second — a
  brightness flash delivered to exactly the people who asked for less of this.
  If you add a style here, branch it.

  On the mask's opacity specifically: with nothing carrying it off
  screen it must leave _with_ the curtain, where the flying curve left it
  sitting at full opacity over the app and then popping out in the crossfade's
  last few milliseconds. `LogoLoader` remains the simple fallback (web,
  Suspense).

  **The floor.** The reveal is gated on content, which was only safe on a
  **cold** start. On a warm launch — fonts cached, no auth round-trip —
  `booting` can flip false around 300–500ms and the feed can paint immediately
  after, turning the whole screen into a flash. `HOLD_MS` (from MOUNT) holds the
  open until the composition has been readable for a beat; `REVEAL_CAP_MS` runs
  on a _different clock_ — from boot resolving — so the window is
  `[mount + HOLD_MS, bootResolved + REVEAL_CAP_MS]`. Reduce Motion skips it.

  **Do not remove the floor to shave startup time.** It is the difference
  between a choreography that always plays and one that plays only when the
  network is slow.

  **The driver is LINEAR, and that is load-bearing.** Every act carries its own
  easing, so a driver with a curve of its own does not add polish — it silently
  reweights how much time each act gets, and nowhere can you read the result.
  Two versions of this went out wrong. `EASE_REVEAL` is
  `bezier(0.22, 1, 0.36, 1)` — 96% done by the halfway point, correct for one
  property settling to one value, catastrophic here: recoil 46ms, lunge over by
  126ms, breakthrough at 193ms, then ~900ms creeping through scales already off
  screen. It read as a glitch followed by nothing. Its replacement,
  `inOut(quad)`, was better and still wrong: the ease-_in_ stretched a 4.5%
  draw-back across 465ms, under the threshold where a scale change reads as
  motion at all — the anticipation was invisible for the second time running.
  Linear makes the constants honest: progress _is_ the fraction of `EXIT_MS`,
  so `LUNGE_AT = 0.2` means "the draw-back takes a fifth of the sequence" and
  can be checked against a stopwatch.

  **Paced for the twentieth launch, not the first.** A hit every time is a
  different brief from a good first impression: it has to be over before anyone
  could wish it were. `EXIT_MS` is 1150 and the hold 650 — 1.8s from mount,
  down from 2.25s — and the shortening came out of the approach, not the
  payoff. `LUNGE_BITE` (>1) makes the mask accelerate all the way in rather
  than approach at a constant rate: constant speed is a dolly move, a thrown
  object keeps gaining. Tested as growth-per-unit-progress rising across the
  lunge, so it is the property that is pinned rather than the constant.

  **The app LANDS, it does not ramp.** A scale driven off `exit` arrives at 1.0
  with whatever velocity the curve happens to have and stops. `land` is a
  separate shared value kicked with a spring at the contact frame, so the
  arrival has its own physics — 4% overshoot, then settle. That beat is what
  the whole sequence has been setting up, and `interpolate` is deliberately
  left unclamped at the top so the overshoot survives. The style also outlives
  the stage: the spring is still settling ~440ms after the reveal ends, and
  swapping to a static style at `revealDone` would snap the last of it off.
  `land` is seeded from `booting`, because on a warm launch the stage never
  mounts, nothing kicks the spring, and a 0 would strand the app at 93%.

  **Two haptic beats, not one.** Soft at the bottom of the draw-back, rigid at
  contact. A single tap is an event; a load followed by a strike is a gesture,
  and that is most of the difference between feeling designed and feeling like
  a notification.

  **`SEAT_AT` splits the running time, and the split is a design decision.**
  Everything before it is approach; everything after is the only part the
  audience came for. At 0.72 the approach ran 728ms and the payoff got 248ms.
  The reveal should not be the shortest act in its own sequence — it is 0.65
  now.

  **The tilt is level everywhere the curtain can move.** Perspective
  foreshortens the far side of a rotated plane, and `cover` is computed from
  flat geometry. Rather than reconcile the two, `markTilt` returns to zero
  exactly at `SEAT_AT`, so no frame is ever subject to both. Tested, because
  the failure mode of extending the tilt "just a little further" is invisible
  until it isn't.

  `markGrow` is continuous rather than piecewise-linear for the same reason:
  linear scale is not linear approach (scale goes as 1/distance, so constant
  speed is _exponential_ growth), and every anchor in a piecewise ramp is a
  corner the eye reads as a stutter. Three acts: draw-back easing to a stop,
  exponential approach, decelerating seat. `__tests__` pins the acts to sane
  shares of the running time, so "it feels choppy" surfaces as a failing test.

  **`SETTLE_MS` always applies after the paint signal**, even when the floor
  has already elapsed. `signalFirstPaint` fires from the feed's first layout —
  the busiest frame of the launch (list commit, image decode, row cascade).
  Starting a 1.4s animation in that frame is how a reveal that costs nothing on
  the UI thread still looks dropped.

  **The wordmark is outlined, not set.** `WORDMARK_PATH` is Righteous converted
  to a path by `scripts/brand/build-splash.mjs` (`yarn build:splash`), which
  draws the splash PNG from the same geometry. Live text could never match a
  raster exactly, and drawing type on the very first frame means gating on font
  load. As paths there is nothing to load and nothing to disagree about.

  **The mark's viewBox is cropped to the INK, not the 1024 artboard**, and that
  is what finally stopped it being clipped on device. The box used to be a
  1024-viewBox square laid out at 512pt, which was wrong three ways at once:
  the ink is 24% of that square's area, so three quarters of the raster was
  empty; a 512pt box centred on a 160pt mark sits at `left: -59.5` on a 393pt
  screen, hanging off both edges and relying on nothing in the parent chain
  ever clamping it; and every position needed a correction for where the ink
  sat inside the artboard, arithmetic that can silently disagree with what the
  layout engine actually did. Declaring an explicit `width`/`height` was tried
  first and was **not** enough — the mask still came back clipped from the
  device. Cropping the viewBox makes the box's centre the ink's centre, makes
  the geometry independent of artboards and box sizes (`INK_PT` and `grow` are
  all it needs), and makes the box smaller than the screen with positive
  offsets everywhere. There is nothing left to clamp and nothing left to clip;
  a test pins that.

  **There is no 3D tilt, and that is a proven constraint.** A `perspective`
  transform on the mask's view CLIPS IT on device. Established by A/B across
  four shipped builds: removed alongside the viewBox crop and the clipping
  stopped; restored on its own and it came straight back; the build after that
  touched no geometry at all and it stayed.

  The arithmetic said it was safe every time — the keystone was bounded, the
  near edge sat at 16% of the camera distance, the tilt was level before any
  large scale, and there were tests pinning all three. It clipped regardless.
  iOS rasterises a 3D-transformed layer differently and a view magnified 30x
  afterwards is exactly where that bites; reasoning was not the missing
  ingredient, a device was. The perspective distance question (1000 projects a
  4% keystone, 420 projects 20%) is real and was worth answering — it just
  turned out to be answering the wrong question.

  **What it gets instead is squash and stretch**, and that is not a
  consolation prize. A skew was the obvious substitute and is the wrong one: a
  rotation reads as a turn because of the KEYSTONE, an affine transform cannot
  produce one, so a 2D "turn" is only `scaleX × cos(θ)` — a horizontal squash
  wearing a rotation's name — and an actual skew on a symmetrical mask reads as
  italic, which looks like a rendering fault rather than depth.

  `markSquash` compresses the mask as it loads and elongates it as it strikes:
  wide-and-short into the draw-back, snapping through uniform to
  narrow-and-tall on the launch, recovered by `SQUASH_DONE`. A few percent —
  weight, not cartoon — with the two axes moving opposite ways by similar
  amounts so volume is roughly conserved, which is what makes it read as a body
  rather than a glitch. Tested, along with the rule that matters: it is uniform
  from `SQUASH_DONE` onward, well before `SEAT_AT`, so every frame the
  flat-geometry coverage rule applies to is uniformly scaled. That is the trap
  the tilt fell into, avoided the same way — resolve before the rule starts
  applying, and pin it.

  **`assets/splash.png` and `imageWidth` are NATIVE.** They are baked into the
  binary and cannot ship over the air, so a change to the lockup needs a new
  build — until then the OS shows the old splash and the JS stage shows the new
  one, and the handoff pops.

- Explore's entrance: the skeleton dissolves in place (exiting fade overlay)
  and the first batch of feed rows cascades once (`STAGGER.step`, soft
  spring), keyed to the boot reveal via `signalFirstPaint()` — only rows in
  the first batch (`index < STAGGER.cap`, matching `initialNumToRender`)
  cascade, because later-batch rows would start their delay from whenever
  virtualization mounted them and read as ragged pop-in.

## The motion scale

`src/lib/motion.ts` is the **web** scale (CSS strings). `src/lib/nativeMotion.ts`
is the **native** one — `DUR` (fast/base/enter/exit/feature), `STAGGER`,
`EASE_OUT`/`EASE_IN_OUT`/`EASE_REVEAL`, `SPRING_PRESS`/`SPRING_SETTLE`, and
`SHIMMER_MS`. Reach for a token before typing a number; native had ~25 distinct
`withTiming` durations and 6 different spring configs before it existed.
`SHIMMER_MS` is the one skeleton tempo — `SkeletonProvider` and `ClashSkeleton`
both read it so two skeletons never breathe at different rates.

## The loading contract (native)

Every native screen with a skeleton runs it through `useSkeletonTransition` +
`FadeOutSkeleton`, not a bare mount. The four phases matter in this order:
`pre` renders **nothing** for 150 ms, so a cached or fast load never blinks a
skeleton; `skeleton` only appears once the load outlasts that window;
`crossfade` renders the real content and dissolves the skeleton _on top of it_,
so placeholders resolve in place; then `content`. A hard-mounted skeleton is a
regression — it makes a fast screen look slower than it is.

## Card → page: Apple's fluid zoom

Native uses the real UIKit zoom transition (iOS 18+), not a JS approximation:
`<Link.AppleZoom>` wraps the source card inside a `<Link>`, and
`<Link.AppleZoomTarget>` marks the destination region (the character page's
portrait). Both degrade to plain pass-throughs on Android, older iOS and web,
so the standard push is the automatic fallback — no capability check needed.

The catch is **coverage**: a card can only be a zoom source if it navigates
through a `<Link>`. Cards that `router.push` imperatively slide instead, and
the same hero opening two different ways from two screens is exactly the kind
of incoherence this is meant to remove. Explore rows (`HomeHeroRow`) and the
search grid (`PortraitCard`, via its optional `href`) are wired; other entry
points still push imperatively. When adding one, pass an `href` rather than
calling `router.push`, and keep the press handler for side effects only —
Radix's `Slot` composes both handlers, so navigation and side effects coexist.

## Shared native primitives

Reach for these before hand-rolling; each replaced a pattern that had drifted
into a dozen variants.

| Primitive                                  | Use for                                        | Replaces                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui/PressScale.tsx`         | any tappable **card/row/tile**                 | bare `Pressable` with no feedback; hand-rolled press springs. Forwards a11y + testID props, so adopting it never costs a label.                                                                                                                                                                                                                                                                                        |
| `src/components/ui/EmptyState.tsx`         | "nothing here" surfaces                        | plain grey text. `tone` picks the canvas (dark stage / beige paper); `compact` for inline sections.                                                                                                                                                                                                                                                                                                                    |
| `src/components/ui/SectionHeader.tsx`      | section eyebrow + title (+ "See all")          | eleven different eyebrow sizes and letter-spacings outside `home/`.                                                                                                                                                                                                                                                                                                                                                    |
| `src/components/ui/Sheet.tsx`              | any bottom sheet                               | `ReportSheet`/`ContributeSheet`/`StatsSheet` each hand-rolled the same Modal + backdrop + grabber + safe-area foot — three backdrop alphas, two grabber colours, and only one remembering to lift above the keyboard. `tone` picks paper/ink and carries the grabber and scrim with it; `avoidKeyboard` opts into the `KeyboardAvoidingView` (it changes layout even with no keyboard, so input-less sheets stay out). |
| `src/components/ui/FloatingBackButton.tsx` | back chevron on a screen with no native header | see the iOS 26 scroll-edge note below.                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/components/ui/OverscrollBleed.tsx`    | a dark band as the first child of a ScrollView | the beige root showing through on rubber-band. See "Overscroll must never show the canvas" below.                                                                                                                                                                                                                                                                                                                      |
| `src/lib/nativeMotion.ts`                  | every duration, easing, spring                 | ~25 ad-hoc `withTiming` durations and 6 spring configs.                                                                                                                                                                                                                                                                                                                                                                |
| `src/constants/tokens.ts`                  | radii, spacing, tracking, `SCREEN_PAD`         | 30 distinct radii, 27 letter-spacings, 8 screen gutters.                                                                                                                                                                                                                                                                                                                                                               |

`tokens.ts` is **descriptive, not a migration**: every step is a value the
codebase already favours, and ~700 existing radius call sites were left alone
on purpose — many are deliberate (a 2px bar, a 26px squircle tuned to its art)
and the only way to verify a sweep would be visual. Use it for new work and
when you're already editing a rule. Note `SCREEN_PAD` (20, the screen gutter)
is a different measure from a rail's 16 — `SectionHeader` uses the rail gutter
so headers line up with the cards beneath them, not with the screen edge.

Small controls (icon buttons, chips, toggles) take a `pressed` opacity style
rather than `PressScale` — a scale animation on a small control feels wrong.

All four tabs animate in with `FadeIn.duration(DUR.base)`. On Search the
wrapper goes around the **list**, not the screen root, so `Stack.Header` /
`Stack.SearchBar` / `Stack.Toolbar` stay direct children — that's how
expo-router registers the native header.

## Native performance notes

Three costs that specifically hurt the home screen's first paint, all fixed —
don't reintroduce them:

- **`BlurView` composites every frame even at `opacity: 0`.** Explore's
  spotlight frost is mounted only after the first real scroll
  (`useAnimatedReaction` on `scrollY`), so the entrance cascade isn't taxed by
  an invisible full-screen blur.
- **`PaperSurface`'s halftone is per-row.** It's `memo`ised and rasterised
  (`shouldRasterizeIOS` / `renderToHardwareTextureAndroid`) — otherwise a dozen
  live SVG pattern fills re-rasterise down the feed.
- **`HomeSkeleton` must mirror the real feed** — row order AND the
  dark-stage/beige-paper zone split. It previously put beige directly under the
  spotlight, so the entire background flipped tone at the handoff.
- React Query conventions: `placeholderData` / `keepPreviousData` keep stale
  content on screen through refetches; `prefetchHeroRow`
  (`src/lib/query/heroQueries.ts`) fires on `onPressIn` so the detail page is
  warm before the press completes.
- `/title` uses a two-stage reveal: the header paints from seeded data
  immediately, the body arrives gated behind its own skeleton
  (`app/title/[id].tsx`).

## Delight inventory

| Thing                  | Where                                                                                      | Convention                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Haptics                | ~19 files                                                                                  | `impactAsync(Light)` on card open, `selectionAsync` on chips/filters, `Medium` on votes and reveals (`app/(tabs)/versus.tsx`, `src/components/home/TodaysMatchup.tsx`) |
| Squircles              | `src/components/ui/SquircleMask.tsx`                                                       | `cornerRadius` defaults to 26, `cornerSmoothing: 1`; simpler surfaces use `borderCurve: 'continuous'` (~55 files)                                                      |
| Long-press peek        | `src/components/compare/HeroPeek.tsx`                                                      | `onLongPress` on grid cards (category, team pages)                                                                                                                     |
| Texture                | `src/components/home/PaperSurface.tsx`, `src/components/ui/DotGrid.tsx`, `CardTexture.tsx` | paper grain on light surfaces                                                                                                                                          |
| Not-found / load-error | `src/components/NotFoundView.tsx`                                                          | wanted-poster styling; `LoadErrorView` (same file) for "it exists but the fetch failed"                                                                                |
| Crash surface          | `ErrorBoundary` in `app/_layout.tsx` / `_layout.web.tsx`                                   | branded; reports to `client_errors` (`src/lib/db/clientErrors.ts`) on web, Sentry (`src/lib/sentry.ts`) on native                                                      |
| Sound                  | nowhere                                                                                    | deliberate — no audio dependency exists                                                                                                                                |

## Fonts

`app/_layout.web.tsx` splits loading into a **critical pass** (Flame faces +
the two common Nunito weights, gating first paint) and a **deferred pass**
(heavy display weights + Righteous, resolving in the background) — roughly a
third of font bytes off the critical path.

Restating the CLAUDE.md rule because it bites constantly: **any clamped Flame
text (`numberOfLines` set) needs `lineHeight ≥ 1.22× fontSize`**, or descenders
clip — on web, RNW turns the clamp into `overflow: hidden`.

## Text colour and contrast

Every text colour resolves through a ramp in `src/constants/colors.ts`. There
is one per canvas, and picking the right one is the whole rule — the palette's
`COLORS.*` entries are **fill** colours, tuned to be seen, not read.

| Canvas                      | Ramp                           | Use                                               |
| --------------------------- | ------------------------------ | ------------------------------------------------- |
| Deep ink                    | `INK_TEXT`                     | `.primary` / `.muted` / `.faint` / `.placeholder` |
| Beige paper                 | `PAPER_TEXT`                   | same four roles                                   |
| Orange as text on paper     | `ORANGE_INK`                   | eyebrows, links, CTAs on beige/white              |
| Any accent as text on paper | `ACCENT_INK`                   | taxonomy chips, category labels                   |
| Gold as text on ink         | `GOLD_INK`                     | arena eyebrows, verdict labels                    |
| Houses/family module        | `HOUSE_INK`                    | that domain's warmer parchment ink                |
| Section eyebrow             | `EYEBROW` / `EYEBROW_ON_PAPER` | pick by canvas                                    |

Why this exists: for a long time only `INK_TEXT` was written down, so every
muted label on beige invented its own alpha and **all of them failed** 4.5:1.
The asymmetry is the trap — beige needs only 0.6α on ink to pass (6.13:1),
while navy needs ~0.73α on beige, so an alpha copied from a dark screen to a
light one silently halves its contrast. `COLORS.orange` is 5.92:1 on ink and
2.58:1 on paper; `COLORS.grey` is 6.95:1 on ink and 2.20:1 on paper. Same
token, opposite verdicts.

Three things that are easy to miss:

- **`opacity` on a text style composites exactly like alpha.** `color:
COLORS.navy` with `opacity: 0.55` is 2.95:1, not 9.77:1. Set the colour from
  the ramp; don't dim it.
- **Placeholders are text** (WCAG 1.4.3) and hold the same floor.
- **Empty-slot glyphs** (the compare/arena `?` and `+`) are the only cue a slot
  is unfilled, so they're content, not ornament.

Genuinely exempt, and deliberately left faint: the colossal ghost watermarks
behind content (Explore's backdrop name, the footer wordmark, the 210px
history numeral), and hover/pressed/disabled state opacities.

Ratios in the colour-token comments are computed, not estimated. Re-derive
before changing a token.

## `yarn check:ui` — the invariants CI enforces

`scripts/ui/check-ui-invariants.mjs` (gated in CI, same shape as
`check-doc-links.mjs`) fails the build on four rules. Every one was a real
shipped bug, and none of them changes how anything renders when broken — which
is exactly why they kept coming back:

| Rule              | Catches                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `contrast`        | a text colour under 4.5:1, alpha and `opacity` composited           |
| `unnamed-control` | a `Pressable` wrapping only an icon, with no accessible name        |
| `small-target`    | a styled control under 44pt with no `hitSlop`                       |
| `web-only-prop`   | `aria-label` as the _only_ name in a file that can render on native |

Two things worth knowing before you touch it:

- **A style cannot declare its surface.** The contrast rule infers the canvas
  from the ink's own lightness, which is right in every case but one: a dark-ish
  accent painted on a dark scrim over artwork. Those live in `ALLOW` with the
  measured ratio. If you add an entry, measure it and say so — an exception
  without a reason is just a silenced check.
- **"Shared" is not just the file extension.** A file renders on native unless
  it is a `.web.tsx` pair half, a `.dom.tsx` component, or under
  `src/components/web/`.

## Touch targets and control labels

Two rules, both easy to violate silently because nothing renders differently
when you do.

**Every icon-only control needs an `accessibilityLabel`.** A `Pressable`
containing nothing but an `Ionicons` announces as an unnamed button — the glyph
name is not a label. 22 native controls were in that state: the family-tree and
social-web canvas controls, close buttons, password reveals, clear-search
affordances. Where the control is a toggle, the label carries the _state_
("Show password" / "Hide password"), because the glyph swap is invisible to a
screen reader.

Note that **`aria-label` is a web-only prop** — React Native ignores it. In a
shared (non-`.web`) file use `accessibilityLabel`, which works on native and is
mapped to `aria-label` by react-native-web. `MovieStrip` had the web-only form
in a shared file, so its arrows were unnamed on native.

**44pt is the target floor.** The canvas controls are deliberately small so
they don't cover the artwork they sit on — 32pt and 34pt and 38pt. The fix is
`hitSlop`, not a bigger button: it buys the target back without moving a pixel.
Each site names the arithmetic (`32 + 6*2 = 44`) so the slop is obviously tied
to the size rather than an arbitrary number.

Both are checkable mechanically, and **`yarn check:ui` now does** — see below.

## Failure and offline states

Three separate problems. Two are fixed; the third is measured but deliberately
not swept.

### Focus revalidation (fixed)

React Query decides "is this query focused?" from `document.hasFocus()` and
`visibilitychange`. Neither exists on React Native, so the focusManager never
changed state and `refetchOnWindowFocus` could not fire — which is why a
backgrounded app came back to whatever it had cached, with nothing revalidating
until the user navigated somewhere new. `refetchOnWindowFocus` was set to
`false`, which was accurate about the effect but hid the cause.

`src/lib/query/appFocus.ts` wires the focusManager to `AppState` (core RN, no
native module, ships over the air) and `refetchOnWindowFocus` is now on. It is
gated by the 5-minute `staleTime`, so returning quickly still costs nothing.
`'inactive'` counts as blurred, not focused: it is the app-switcher/incoming-call
state, and treating it as focused would mean peeking at the switcher never
produces a false→true edge, so no refetch would ever fire.

### Connectivity (fixed)

`onlineManager` had no RN wiring either, so React Query assumed it was always
online. That sounds like the safe default — queries still try — but it is worse
than it looks: on a phone with no signal, requests don't fail fast, they hang
until the OS times them out and then retry twice (`retry: 2`), so the user
watches a spinner for tens of seconds and is told nothing. Nothing refetched on
reconnect either, because the library never learned it had gone.

`src/lib/query/appOnline.ts` wires `onlineManager` to
`@react-native-community/netinfo`. Queries now pause while offline and resume
the moment signal returns. Two decisions worth keeping:

- **`isInternetReachable` beats `isConnected`.** The former distinguishes
  "joined a wifi network" from "that wifi routes somewhere", which is the
  captive-portal case where every request otherwise hangs.
- **`null` reachability means online, not offline.** NetInfo reports `null`
  until it has probed; treating that as offline would pause every query for the
  first moments after launch. Better to try and fail than refuse to try.

Unlike `appFocus.ts`, **this could not ship over the air** — NetInfo is a native
module. It landed with the EAS build that includes it.

That asymmetry is a trap worth naming: `appOnline.ts` itself _does_ ship over
the air, and an update carrying it can land on an older binary that predates the
NetInfo build — same `runtimeVersion`, same channel, so expo-updates considers
them compatible and delivers it.

**A `try`/`catch` around the `require` is not enough**, which this cost a red
screen to learn. NetInfo throws from module scope
(`internal/nativeInterface.ts`: `if (!RNCNetInfo) throw`), and Metro reports a
module-initialisation failure to LogBox _regardless of whether the caller
swallows the rethrow_. The error is caught, the app keeps running — and the user
still stares at a full-screen error. Not importing it at all is the only quiet
failure, so the code checks `NativeModules.RNCNetInfo` first, mirroring
NetInfo's own resolution in `internal/nativeModule.ts`.

**Any native module reached from OTA-shipped code needs a native-side presence
check, not an exception handler.**

`useIsOffline` (`src/hooks/useIsOffline.ts`) reads the _onlineManager_, not
NetInfo, so the UI can never disagree with what the data layer is actually
doing — and the native module stays out of the web bundle, where the browser's
own online/offline events feed the manager instead. `OfflineBanner` renders from
it in both root layouts. It is a persistent pill, not a Toast: offline is a
state the user sits in, not an event that just happened. It offers no advice,
because there is none to give — the data layer recovers on its own.

### Errors that look like empty data (measured, not swept)

**90 of the 155 `if (error)` branches in `src/lib/db/` swallow the failure and
return `[]` / `null`.** The other 65 throw.

Where a screen's own data does that, a network failure is indistinguishable
from a genuinely empty result: React Query sees a _successful_ empty response,
so `retry` never fires, the 5-minute `staleTime` caches the emptiness, and the
screen renders an empty state that is lying. Only three native screens
(`character`, `issue`, `title`) render any error state at all, even though
`LoadErrorView` exists for exactly this.

**Done so far** — the primary-subject fetch for each detail route now throws,
and the screen splits failure from absence:

| Fetch                             | Screen                    | What an outage used to say                                        |
| --------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| `getHeroById`                     | character, biography      | "this character doesn't exist" / "No biography yet"               |
| `getTeamById`                     | team (native + web)       | "This team doesn't exist"                                         |
| `getEventDossier`                 | event (native + web)      | "No page for this event yet"                                      |
| `useHouse` (already threw)        | house (native + web)      | "No such house", with the raw `Error.message` as the only tell    |
| `getCategoryPage` (already threw) | category                  | "No characters found — try a different search, or clear a filter" |
| `getHeroNeighborhood`             | social-web (native + web) | an empty universe, then a nebula loader that never resolves       |

Three of those error branches already existed and were **unreachable**.
`heroLoadPlan.ts` even documents the intent — _"a transient query failure is
not a 404 — keep it distinct so the screen can offer a retry"_ — but
`getHeroById` never let `isError` become true, so the retry UI could not render.
The event screen had the same dead branch, and the biography web twin showed a
skeleton forever.

Two gotchas that recur:

- Gate not-found on **`isSuccess`**, never `isFetched` or `!isLoading`. Both are
  true after a failure, which is precisely how "doesn't exist" got shown for an
  outage.
- A `null` return must mean exactly one thing. `getHeroById` and `getTeamById`
  keep `null` for PGRST116 ("no rows") and throw for everything else.

Two of those fetches **already threw** — the screens simply never read
`isError`, which is its own lesson: making the data layer honest is only half
the job. `getHeroNeighborhood` is the reverse case, and shows why the
page-critical/optional-rail split has to be made per _consumer_, not per
function: the social-web explorer **is** that data, while the character page's
portal preview is an optional rail reading the same call. Throwing serves both
— the explorer can retry, and the portal already hides itself when data is
missing.

The rest was not swept, because the split is real and only a human eye can draw it:

- **Page-critical** — the thing the screen is _about_. Must throw, so React
  Query retries and the screen can offer `LoadErrorView` + retry.
- **Optional rail** — a supplementary shelf on a page that stands without it.
  Soft-failing to `[]` is correct here; it just needs to be _deliberate_ rather
  than the accidental default it is now.

Converting all 90 blind would turn every failed side-rail into a blown-up page.
Do it per screen, starting with the detail routes, and make the soft-failing
ones say so in a comment.

## Android deltas

Android is the least-exercised platform here — nothing in this repo has been
run on a device. What a static audit found and what was done about it:

| Thing                        | State                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shadows                      | `shadow*` props do nothing on Android; `elevation` is the knob. 30 blocks pair them. The 3 that were neutral drop shadows and missing `elevation` now have it.                                                                                                                                                                                                                |
| Coloured glows               | 6 blocks use `shadowColor` as a **glow** (orange/gold, zero offset). Left iOS-only and commented as such: `elevation` would substitute a grey box shadow for a colour bloom, which reads worse than no glow, and the elements carry their own colour anyway.                                                                                                                  |
| Conditional animation wrappers | `renderRow` in `explore.tsx` returned `entering ? <Animated.View entering={entering}>{row}</Animated.View> : row`. `entering` goes undefined when the entrance cascade window closes, 1900ms after the feed lands — and React does not diff across a change of element type, so every row in the first batch was unmounted and remounted at that instant. The spotlight carousel rendered nothing for a frame while its visible range re-resolved, then faded its portrait back in over expo-image's transition: a flash on the same image, exactly as the entrance finished. Keep the element type stable and let the prop go undefined; an entering animation only runs on mount anyway. |
| Skeleton geometry | A placeholder that claims to mirror a layout has to READ FROM the same source, not restate it. `CategorySkeleton` had its own copies of the grid and stage numbers and drifted three ways at once: still drawing an eyebrow bar the screen had stopped rendering (23pt), padding its stage 26 against the screen's 36, and starting its first grid row 4pt high — about 37pt of jump as content landed. `src/constants/categoryGeometry.ts` now holds the grid and the stage's vertical rhythm, and both read from it. Note the stage constants are `lineHeight`s, not font sizes: a placeholder bar has to occupy the line box the text will. Same rule as `PUBLISHER_GRID`, which `HomeSkeleton` already follows. |
| Beige seam corners | The rounded cap that rises over a dark stage shows whatever is BEHIND its corner cut-outs — and behind the cap is the list's content background, which on these screens is beige. Overlap the stage by less than the corner radius and the bottom of each curve sits over beige rather than the stage, so the cut-out is filled in and the curve looks truncated where it meets the straight edge. **`SEAM.overlap` must be ≥ `SEAM.radius`** (`src/constants/tokens.ts`). Eight surfaces shipped with overlaps of 14–18 against radii of 24–28; `character/[id]` was the only one that tied the two together, and the only seam that looked right. `yarn check:ui` fails on any style pairing `borderTopLeftRadius: X` with `marginTop: -Y` where `Y < X`, resolving `SEAM.*` and same-file numeric consts — a literal-only check would have waved through `borderTopLeftRadius: SEAM.radius` beside `marginTop: -16`, the exact bug wearing the fix as a disguise. Full audit of every rounded box with a negative pull across native and web: the rest are decorative circles and badges centred by `marginTop: -radius`, where the cut-out revealing the background is the intended look. |
| Tab bar colours | **iOS owns the bar; the app sets one colour.** The system guarantees contrast between its own material and its own label colours — it resolves both from the same trait collection. It cannot reason about a brand colour handed to it, so the tint is the only thing left to get right. `iconColor`, `labelStyle`, `blurEffect` and `backgroundColor` were all removed: they were fighting a system that had already overruled them (the file asked for `systemChromeMaterialDark` and iOS 26's glass rendered the bar CREAM with dark labels over the beige Profile page). This was tried once before and reverted because the unselected items came out near-black — the same failure from the other side, because the colours were removed while the forced dark material stayed. They have to go together. `disableTransparentOnScrollEdge` is NOT colour and stays: without it UIKit can apply the fully-transparent scroll-edge appearance permanently, leaving bare icons over content. |
| Tab bar selected tint | A fixed orange cannot work: the backdrop swings from cream in light appearance to near-black in dark, and no orange clears 4.5:1 on both — the best manages ~3.5:1 on its worse side, because the two sit on opposite sides of the hue's luminance. `DynamicColorIOS({ light: TAB_ACTIVE_LIGHT, dark: TAB_ACTIVE })` resolves the tint from the same trait collection iOS uses for the material. Both halves are lighter than contrast alone would choose, deliberately: the dark half clears the floor at 5.53–8.75:1, the light half does not at 2.40–3.04:1. That is a chosen trade, and a short-lived one — `userInterfaceStyle: 'dark'` means the bar is always dark from the next native build, so `TAB_ACTIVE` is what actually ships and the light half only covers OTA clients still on the older binary. `TAB_ACTIVE_LIGHT` is its own constant rather than `ORANGE_INK`, which is body text on paper in a dozen files and would go down with it. **`app.config.ts` now pins `userInterfaceStyle: 'dark'`**, so the bar is always dark and the dark half is the one that ships — but that is `UIUserInterfaceStyle` in Info.plist, so it lands on the next NATIVE build, not over the air. The pairing stays for the interval: an OTA client in light mode still gets a light bar and must still get the dark orange on it. Note the brand orange fails even on a dark bar (3.27:1 at worst), which is why `TAB_ACTIVE` is a lifted relative rather than `COLORS.orange`. **On a light bar, "lighter" and "legible" pull against each other** — walking the hue from `ORANGE_INK` toward `COLORS.orange` drops below the floor at the very first step (4.34/3.97 typical/worst), so `ORANGE_INK` is already the lightest orange that clears it, and the only way to a genuinely bright tab orange is a bar that is reliably dark. On a DARK bar they pull the same way, which is why that half is lifted further than strictly needed. Two different colours rather than one compromise, for exactly that reason. |
| `fontWeight` on custom faces | Only `Flame-Regular`, `FlameSans-Regular` and `Righteous` are registered (`Flame-Bold` was de-registered — see CLAUDE.md). `FlameSans-Regular` + `fontWeight: '700'` had no bold face to resolve to, so the platforms diverged — Android synthesises a fake bold, iOS does not. The 6 family-module sites now use `Nunito_700Bold`, a real registered face, which is also what CLAUDE.md prescribes for UI text. |
| Modals                       | `statusBarTranslucent` + `navigationBarTranslucent` are set on `Sheet`, without which a modal stops at the system bars — an undimmed band top and bottom, and no way to reach the real bottom edge.                                                                                                                                                                           |
| `expo-blur`                  | The Explore frost has no `experimentalBlurMethod`, so Android renders a flat translucent overlay rather than a live blur. Left alone: the frost is a dark scrim, a flat version of it is a graceful degradation, and the experimental method carries a real perf cost on a platform that can't be measured from here.                                                         |
| `borderCurve: 'continuous'`  | iOS-only, silently ignored elsewhere. Harmless.                                                                                                                                                                                                                                                                                                                               |

Unverified and worth checking first on a real device: `includeFontPadding`
(Android adds font padding on top of `lineHeight`, and the Flame 1.22x rule was
tuned on iOS — only 5 styles opt out today), and `expo-image` `blurRadius`
parity, which the biography stage leans on.

## The root `SafeAreaProvider` is load-bearing — never remove it

`app/_layout.tsx` renders `<SafeAreaProvider initialMetrics={initialWindowMetrics}>`
around everything. It looks redundant, because expo-router already wraps each
native tab screen in its own provider. It is not.

A nested `SafeAreaProvider` seeds its state from the **parent**:

```js
useState(initialMetrics?.insets ?? initialSafeAreaInsets ?? parentInsets ?? null);
```

With no root provider, `parentInsets` is `null`, so every tab screen started
with **no insets** and jumped to the real ones a frame or two later, once the
native measurement landed. Everything keyed to `insets.top` moved with it —
Arena pads `insets.top + 24`, Profile sizes its cover `140 + insets.top`,
Explore computes the billboard height from it. The symptom reported was _"the
content is there and then it shifts down"_, on **every tab**, and the gap that
opened above the content read as a band of the root colour.

`initialWindowMetrics` is a synchronous snapshot captured natively at startup,
so frame one already has the right numbers and the per-tab providers inherit
them instead of `null`.

**It cost four wrong fixes to find.** Each one looked at whichever screen the
screenshot showed — the spotlight parallax, then the scroll-offset primitive,
then the slide's transform — because the band was only ever reported on
Explore. The evidence that broke it open was _"it happens on Arena and Profile
too"_: no amount of debugging one screen's transforms can explain a shift that
happens on three unrelated screens at once. **When a layout bug appears on
screens that share no layout code, look at what they share — the provider
tree.**

### …and the root provider was necessary but not sufficient

The shift came back — later in a session, after switching tabs rather than at
boot. Seeding the providers correctly fixes frame one; it does not stop a
nested provider being _re-measured_ afterwards and disagreeing with the window.

`useSafeAreaInsets()` answers "what is safe inside the nearest provider's
view". expo-router gives each tab screen its own provider, so on these screens
that is a different question from the one they are actually asking: "where does
the window's chrome end". When the two answers diverge, every screen keyed to
the value moves at once — the same three-screens-together signature as before.

`src/hooks/useStableTopInset.ts` removes the dependency instead of arbitrating
it. The app is **portrait-locked** (`orientation: 'portrait'`), so the window's
top inset physically cannot change while the app runs — which means a top inset
that _does_ change is wrong no matter what produced it. The hook returns
`initialWindowMetrics.insets.top`, a native snapshot taken before the first
render, falling back to the live hook where that is unavailable.

Full-bleed, top-anchored screens (Explore, Arena, Profile) use it for `.top`.
Keep `useSafeAreaInsets()` for anything genuinely relative to its container and
for `.bottom`, which tracks the keyboard and tab bar. **The rule: if a value is
physically constant, do not read it from something that can re-measure.**

## Anchor a scale with arithmetic, not `transformOrigin`

A scale transform applies about the view's **centre**. At scale `s` the top edge
rises by `(s − 1) · height / 2`, so pinning the top means translating down by
exactly that much.

`transformOrigin: 'top'` is supposed to do it for you, and the spotlight leaned
on it for both the Ken Burns drift and the pull-down stretch. On device the
carousel slides sat at visibly **different heights from one another** — two of
them side by side mid-swipe with their art starting at different `y`. Each slide
runs its own Ken Burns phase, so different scales meant different vertical
offsets, which can only happen if the origin isn't being honoured and every
slide is scaling about its centre.

Both now compute the offset instead. For the pull-down case the algebra
collapses neatly: with `s = 1 − sy/spotH`, the correction `(s − 1)·spotH/2` is
`−sy/2`, so `translateY: sy` with a top origin is the same thing as
`translateY: sy/2` with the default one.

**The general rule: if a transform's visual correctness depends on
`transformOrigin`, compute the offset instead.** It's two lines of arithmetic
and it behaves identically everywhere, rather than depending on a property whose
support varies by platform and renderer.

## Read the scroll offset, don't accumulate it

Explore's billboard parallax is driven by the list's scroll offset. It used to
be a `useSharedValue` fed by `useAnimatedScrollHandler`, and that shape has a
defect worth naming: **an event handler accumulates, it does not read state**.
Any move the handler doesn't see leaves the value stale, and a stale positive
offset makes the billboard translate DOWN by `staleY × 0.5` with nothing
scrolled away above it — the deep-navy root shows as a band across the top of
the art.

It got patched twice by guessing which moves went unseen: first `useFocusEffect`
(tab away and back), then `onScrollToTop` and an `AppState` resume hook. Each
guess closed one door and the band returned through another, because a list's
offset can change without an `onScroll` in more ways than are worth
enumerating — tab-bar scroll-to-top, state restoration on resume, RNScreens
re-attaching the scroll view, a content-size change that clamps the offset.

`useScrollOffset(animatedRef)` reads the scroll view's live `contentOffset`
instead, so it cannot hold a value the list doesn't have. All three patches
were deleted with it. **Prefer it over a hand-rolled scroll handler wherever
the value drives layout rather than just an effect** — if a stale offset would
be visible, an event handler is the wrong primitive.

## Overscroll must never show the canvas

Keep the bounce. It is the iOS feel and a screen without it reads as broken —
the rule is not "stop the pull", it is **the pull must reveal more of the page,
never the surface behind it**. Two different ways that broke:

**A dark band as the first child of a ScrollView.** The house page and the
houses index open on the navy band, but their root is `COLORS.beige`, so
rubber-banding above the band showed a beige strip. `OverscrollBleed` fixes it:
a 600px slab hanging above the content in the band's own colour, absolutely
positioned so it takes no layout space and no touches. Drop it in as the first
child, coloured to match whatever band follows it. Any dark-topped scroll screen
on a light root needs it.

**A centre-anchored scale used for a stretchy header.** The character page grows
the hero art on overscroll (`scale: 1 + d/H`). Because the scale is
centre-anchored, it grows `d/2` up _and_ `d/2` down, while the content below
moves down by the full `d` — so the translate has to make up the difference. It
was `−d/2`, which pins the image's **top** edge to the screen and leaves the
**bottom** short by `d`: a beige gap opens under the identity block. The right
sign is `+d/2`:

- top edge: `−d/2` (from scale) `+ d/2` (translate) = `0` → stays at the screen top
- bottom edge: `H + d/2 + d/2` = `H + d` → tracks the content exactly

Same rule in both cases, and the sign is easy to get backwards because
`−d/2` _looks_ like it counteracts the overscroll. Check the bottom edge, not
the top.

## The iOS 26 scroll-edge scrim

Every native screen that **has a header** gets a `UIScrollEdgeEffect` over its
content ScrollView on iOS 26+ — a light blur band under the header items, on by
default (`automatic`). Over a flat dark top it reads as a grey scrim across the
status bar.

**`scrollEdgeEffects: { top: 'hidden' }` is the fix, and it IS reachable from
expo-router.** Put it straight in `Stack.Screen options`:

```tsx
const headerOptions = {
  headerShown: true,
  headerTransparent: true,
  headerTintColor: COLORS.beige,
  scrollEdgeEffects: { top: 'hidden' }, // ← kills the grey band
} as const;
```

This section previously said the option was "not reachable through
expo-router's Stack options — only react-native-screens' raw `<Screen>` or its
gamma `<ScrollViewMarker>`", and sent screens to `headerShown: false` plus
`FloatingBackButton` as the workaround. That is **out of date**: expo-router
56.2.15 documents `scrollEdgeEffects` in its own native-stack option types
(`expo-router/build/react-navigation/native-stack/types.d.ts`), all four edges
optional. A screen can keep a real native header — system chevron, system
swipe-back — and still have no scrim. Check the installed types before
assuming an option is unreachable.

`FloatingBackButton` is still right for a screen that genuinely wants no
header (`biography/[id]` renders its own chrome over a full-bleed stage). It is
no longer the answer to the scrim.

Audit of the native screens that show a header:

| Screen                      | Header carries    | Top surface   | Verdict                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `biography/[id]`            | chevron only      | flat deep-ink | **fixed** — no header                                                                                                                                                                                                                                                                                                                  |
| `compare/[hero]/pick`       | chevron only      | flat navy     | affected; safe to convert                                                                                                                                                                                                                                                                                                              |
| `event/[slug]`              | chevron only      | flat deep-ink | affected; safe to convert                                                                                                                                                                                                                                                                                                              |
| `event/index`               | chevron only      | flat deep-ink | affected; safe to convert                                                                                                                                                                                                                                                                                                              |
| `house/[slug]`              | chevron only      | **navy band** | **fixed** — keeps its native header, with `scrollEdgeEffects: { top: 'hidden' }`. This row used to read "beige · unaffected", which was wrong: the screen's ROOT is beige but its top SURFACE is the navy `HouseBanner`, and the scrim was plainly visible on device. Check the surface at the top of the scroll, not the root colour. |
| `character/[id]`            | + `headerRight`   | dark stage    | affected, but the header has real content                                                                                                                                                                                                                                                                                              |
| `compare/[hero]/[opponent]` | + `headerRight`   | dark          | affected, but the header has real content                                                                                                                                                                                                                                                                                              |
| `category/[slug]`           | `Stack.SearchBar` | dark          | **must keep the header** — the search field lives in it, and a search bar is exactly what the effect is designed to serve                                                                                                                                                                                                              |
| `team/[id]`                 | `Stack.SearchBar` | dark          | same                                                                                                                                                                                                                                                                                                                                   |

## History

Design docs under `docs/superpowers/` (historical; statuses may be stale):

- `docs/superpowers/specs/2026-04-04-web-version-design.md` — the original web split
- `docs/superpowers/specs/2026-04-05-topnav-redesign.md` — TopBar
- `docs/superpowers/specs/2026-06-18-mobile-web-audit.md` — where the chrome/scroll rules were learned
- `docs/superpowers/specs/2026-07-06-nebula-loader-design.md` — LogoLoader
- `docs/superpowers/specs/2026-07-16-web-motion-polish-plan.md` — motion.ts, Reveal, view transitions, skeleton system
