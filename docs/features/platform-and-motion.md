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

| Screen | Native | Web |
| --- | --- | --- |
| `app/character/[id].tsx` | ~2,300 lines | **~4,300 lines** |
| `app/(tabs)/profile.tsx` | ~1,500 lines | ~2,300 lines |
| `app/(tabs)/explore.tsx` | ~600 lines | ~2,000 lines |

When you change behaviour on one side, grep the other side for the same
feature before calling it done. New shared logic goes in the hook, not in
whichever file you happened to have open.

## Web chrome: the constant-ink system

iOS Safari tints its status bar and toolbar from the **document background**,
not from your React tree. The rule that fell out of much pain: **the document
canvas is always ink**. Light screens paint their own paper body on their root
container; the document behind it stays dark.

| Piece | Path | Job |
| --- | --- | --- |
| Build-time paint | `app/+html.tsx` | `html, body { background-color: #0b1820 }` so the very first paint is navy, plus the 16px input floor |
| Screen declaration | `src/hooks/useScreenChrome.ts` | one call declares `top` + `canvas` together so they can't drift |
| Document background | `src/hooks/useWebCanvas.ts` | implementation; `useWebCanvas` is an alias of `useWebDocumentScroll` (`src/hooks/useWebDocumentScroll.ts` re-exports it) |
| Top chrome | `src/contexts/WebChromeContext.tsx` | `WebChromeProvider` + `AdaptiveStatusBarCover` — a fixed `env(safe-area-inset-top)` strip portaled into `document.body`, cross-fading with the theme colour as pages change from dark-topped to light-topped |
| Nav | `src/components/web/TopBar.tsx` | floating nav, locks to the declared `top` colour |
| Page bottom | `src/components/web/PageEndCap.tsx` | closes light pages back into the ink canvas |

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

| Name | Morph |
| --- | --- |
| `vt-hero-portrait` (`VT_PORTRAIT`) | card art → character-page portrait, via `src/hooks/useHeroMorph.ts` (which also hands the detail page a `MorphArt` payload so the portrait paints before its query resolves) |
| `vt-fighter-a` / `vt-fighter-b` | compare flow, `app/compare/[hero]/pick.web.tsx` + `[opponent].web.tsx` |
| `vt-topbar` | the nav itself stays pinned through transitions |

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
  (`app/_layout.tsx`), one continuous piece from OS splash to feed: **still**
  (first frame pixel-continuous with the native splash — same flat `#293C43`,
  same filled 200px mask; never a trace-in, which erased and redrew the mark
  the user was already looking at), **alive** (depth gradient + ember halo
  fade in, the mark breathes), **open** (gated on the Explore feed's first
  paint via `src/lib/bootReveal.ts`, capped at 1.4s — ring ripples, the mark
  blooms and is gone by 55%, the stage dissolves over the fully-opaque app,
  which scale-settles from 96.5%; the feed's row cascade lands as the stage
  clears). Only the stage ever fades — double-fading stage + app reads as a
  grey wash. Honors Reduce Motion (plain crossfade). `LogoLoader` remains the
  simple fallback (web, Suspense).
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
`crossfade` renders the real content and dissolves the skeleton *on top of it*,
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

| Primitive | Use for | Replaces |
| --- | --- | --- |
| `src/components/ui/PressScale.tsx` | any tappable **card/row/tile** | bare `Pressable` with no feedback; hand-rolled press springs. Forwards a11y + testID props, so adopting it never costs a label. |
| `src/components/ui/EmptyState.tsx` | "nothing here" surfaces | plain grey text. `tone` picks the canvas (dark stage / beige paper); `compact` for inline sections. |
| `src/components/ui/SectionHeader.tsx` | section eyebrow + title (+ "See all") | eleven different eyebrow sizes and letter-spacings outside `home/`. |
| `src/lib/nativeMotion.ts` | every duration, easing, spring | ~25 ad-hoc `withTiming` durations and 6 spring configs. |
| `src/constants/tokens.ts` | radii, spacing, tracking, `SCREEN_PAD` | 30 distinct radii, 27 letter-spacings, 8 screen gutters. |

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

| Thing | Where | Convention |
| --- | --- | --- |
| Haptics | ~19 files | `impactAsync(Light)` on card open, `selectionAsync` on chips/filters, `Medium` on votes and reveals (`app/(tabs)/versus.tsx`, `src/components/home/TodaysMatchup.tsx`) |
| Squircles | `src/components/ui/SquircleMask.tsx` | `cornerRadius` defaults to 26, `cornerSmoothing: 1`; simpler surfaces use `borderCurve: 'continuous'` (~55 files) |
| Long-press peek | `src/components/compare/HeroPeek.tsx` | `onLongPress` on grid cards (category, team pages) |
| Texture | `src/components/home/PaperSurface.tsx`, `src/components/ui/DotGrid.tsx`, `CardTexture.tsx` | paper grain on light surfaces |
| Not-found / load-error | `src/components/NotFoundView.tsx` | wanted-poster styling; `LoadErrorView` (same file) for "it exists but the fetch failed" |
| Crash surface | `ErrorBoundary` in `app/_layout.tsx` / `_layout.web.tsx` | branded; reports to `client_errors` (`src/lib/db/clientErrors.ts`) on web, Sentry (`src/lib/sentry.ts`) on native |
| Sound | nowhere | deliberate — no audio dependency exists |

## Fonts

`app/_layout.web.tsx` splits loading into a **critical pass** (Flame faces +
the two common Nunito weights, gating first paint) and a **deferred pass**
(heavy display weights + Righteous, resolving in the background) — roughly a
third of font bytes off the critical path.

Restating the CLAUDE.md rule because it bites constantly: **any clamped Flame
text (`numberOfLines` set) needs `lineHeight ≥ 1.22× fontSize`**, or descenders
clip — on web, RNW turns the clamp into `overflow: hidden`.

## History

Design docs under `docs/superpowers/` (historical; statuses may be stale):

- `docs/superpowers/specs/2026-04-04-web-version-design.md` — the original web split
- `docs/superpowers/specs/2026-04-05-topnav-redesign.md` — TopBar
- `docs/superpowers/specs/2026-06-18-mobile-web-audit.md` — where the chrome/scroll rules were learned
- `docs/superpowers/specs/2026-07-06-nebula-loader-design.md` — LogoLoader
- `docs/superpowers/specs/2026-07-16-web-motion-polish-plan.md` — motion.ts, Reveal, view transitions, skeleton system
