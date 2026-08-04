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
| `src/components/ui/Sheet.tsx` | any bottom sheet | `ReportSheet`/`ContributeSheet`/`StatsSheet` each hand-rolled the same Modal + backdrop + grabber + safe-area foot — three backdrop alphas, two grabber colours, and only one remembering to lift above the keyboard. `tone` picks paper/ink and carries the grabber and scrim with it; `avoidKeyboard` opts into the `KeyboardAvoidingView` (it changes layout even with no keyboard, so input-less sheets stay out). |
| `src/components/ui/FloatingBackButton.tsx` | back chevron on a screen with no native header | see the iOS 26 scroll-edge note below. |
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

## Text colour and contrast

Every text colour resolves through a ramp in `src/constants/colors.ts`. There
is one per canvas, and picking the right one is the whole rule — the palette's
`COLORS.*` entries are **fill** colours, tuned to be seen, not read.

| Canvas | Ramp | Use |
| --- | --- | --- |
| Deep ink | `INK_TEXT` | `.primary` / `.muted` / `.faint` / `.placeholder` |
| Beige paper | `PAPER_TEXT` | same four roles |
| Orange as text on paper | `ORANGE_INK` | eyebrows, links, CTAs on beige/white |
| Any accent as text on paper | `ACCENT_INK` | taxonomy chips, category labels |
| Gold as text on ink | `GOLD_INK` | arena eyebrows, verdict labels |
| Houses/family module | `HOUSE_INK` | that domain's warmer parchment ink |
| Section eyebrow | `EYEBROW` / `EYEBROW_ON_PAPER` | pick by canvas |

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

## Failure and offline states

Two separate problems. One is fixed; the other is measured but deliberately
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

### Connectivity (blocked)

`onlineManager` has no RN wiring either, so React Query assumes it is always
online. That is the safer default — queries still try — but nothing
auto-refetches on reconnect. Fixing it properly needs NetInfo or
`expo-network`, both native modules, so it is blocked on a rebuild.

### Errors that look like empty data (measured, not swept)

**90 of the 155 `if (error)` branches in `src/lib/db/` swallow the failure and
return `[]` / `null`.** The other 65 throw.

Where a screen's own data does that, a network failure is indistinguishable
from a genuinely empty result: React Query sees a *successful* empty response,
so `retry` never fires, the 5-minute `staleTime` caches the emptiness, and the
screen renders an empty state that is lying. Only three native screens
(`character`, `issue`, `title`) render any error state at all, even though
`LoadErrorView` exists for exactly this.

**Done so far** — the primary-subject fetch for each detail route now throws,
and the screen splits failure from absence:

| Fetch | Screen | What an outage used to say |
| --- | --- | --- |
| `getHeroById` | character, biography | "this character doesn't exist" / "No biography yet" |
| `getTeamById` | team (native + web) | "This team doesn't exist" |
| `getEventDossier` | event (native + web) | "No page for this event yet" |

Three of those error branches already existed and were **unreachable**.
`heroLoadPlan.ts` even documents the intent — *"a transient query failure is
not a 404 — keep it distinct so the screen can offer a retry"* — but
`getHeroById` never let `isError` become true, so the retry UI could not render.
The event screen had the same dead branch, and the biography web twin showed a
skeleton forever.

Two gotchas that recur:

- Gate not-found on **`isSuccess`**, never `isFetched` or `!isLoading`. Both are
  true after a failure, which is precisely how "doesn't exist" got shown for an
  outage.
- A `null` return must mean exactly one thing. `getHeroById` and `getTeamById`
  keep `null` for PGRST116 ("no rows") and throw for everything else.

The rest was not swept, because the split is real and only a human eye can draw it:

- **Page-critical** — the thing the screen is *about*. Must throw, so React
  Query retries and the screen can offer `LoadErrorView` + retry.
- **Optional rail** — a supplementary shelf on a page that stands without it.
  Soft-failing to `[]` is correct here; it just needs to be *deliberate* rather
  than the accidental default it is now.

Converting all 90 blind would turn every failed side-rail into a blown-up page.
Do it per screen, starting with the detail routes, and make the soft-failing
ones say so in a comment.

## Android deltas

Android is the least-exercised platform here — nothing in this repo has been
run on a device. What a static audit found and what was done about it:

| Thing | State |
| --- | --- |
| Shadows | `shadow*` props do nothing on Android; `elevation` is the knob. 30 blocks pair them. The 3 that were neutral drop shadows and missing `elevation` now have it. |
| Coloured glows | 6 blocks use `shadowColor` as a **glow** (orange/gold, zero offset). Left iOS-only and commented as such: `elevation` would substitute a grey box shadow for a colour bloom, which reads worse than no glow, and the elements carry their own colour anyway. |
| `fontWeight` on custom faces | Only `Flame-Regular`, `Flame-Bold`, `FlameSans-Regular` and `Righteous` are registered. `FlameSans-Regular` + `fontWeight: '700'` had no bold face to resolve to, so the platforms diverged — Android synthesises a fake bold, iOS does not. The 6 family-module sites now use `Nunito_700Bold`, a real registered face, which is also what CLAUDE.md prescribes for UI text. |
| Modals | `statusBarTranslucent` + `navigationBarTranslucent` are set on `Sheet`, without which a modal stops at the system bars — an undimmed band top and bottom, and no way to reach the real bottom edge. |
| `expo-blur` | The Explore frost has no `experimentalBlurMethod`, so Android renders a flat translucent overlay rather than a live blur. Left alone: the frost is a dark scrim, a flat version of it is a graceful degradation, and the experimental method carries a real perf cost on a platform that can't be measured from here. |
| `borderCurve: 'continuous'` | iOS-only, silently ignored elsewhere. Harmless. |

Unverified and worth checking first on a real device: `includeFontPadding`
(Android adds font padding on top of `lineHeight`, and the Flame 1.22x rule was
tuned on iOS — only 5 styles opt out today), and `expo-image` `blurRadius`
parity, which the biography stage leans on.

## The iOS 26 scroll-edge scrim

Every native screen that **has a header** gets a `UIScrollEdgeEffect` over its
content ScrollView on iOS 26+ — a light blur band under the header items, on by
default (`automatic`). Over a flat dark top it reads as a grey scrim across the
status bar.

`scrollEdgeEffects: { top: 'hidden' }` is the surgical fix but is **not
reachable through expo-router's Stack options** — only react-native-screens'
raw `<Screen>` or its gamma `<ScrollViewMarker>`, and that one is a Fabric
native component, so it renders an empty view on any build predating it. It
cannot be shipped over the air.

The workable fix for a header that carries nothing but a back chevron is to not
have a header: `headerShown: false` plus `FloatingBackButton`.

Audit of the native screens that show a header:

| Screen | Header carries | Top surface | Verdict |
| --- | --- | --- | --- |
| `biography/[id]` | chevron only | flat deep-ink | **fixed** — no header |
| `compare/[hero]/pick` | chevron only | flat navy | affected; safe to convert |
| `event/[slug]` | chevron only | flat deep-ink | affected; safe to convert |
| `event/index` | chevron only | flat deep-ink | affected; safe to convert |
| `house/[slug]` | chevron only | beige | unaffected — a light scrim on paper is invisible |
| `character/[id]` | + `headerRight` | dark stage | affected, but the header has real content |
| `compare/[hero]/[opponent]` | + `headerRight` | dark | affected, but the header has real content |
| `category/[slug]` | `Stack.SearchBar` | dark | **must keep the header** — the search field lives in it, and a search bar is exactly what the effect is designed to serve |
| `team/[id]` | `Stack.SearchBar` | dark | same |

## History

Design docs under `docs/superpowers/` (historical; statuses may be stale):

- `docs/superpowers/specs/2026-04-04-web-version-design.md` — the original web split
- `docs/superpowers/specs/2026-04-05-topnav-redesign.md` — TopBar
- `docs/superpowers/specs/2026-06-18-mobile-web-audit.md` — where the chrome/scroll rules were learned
- `docs/superpowers/specs/2026-07-06-nebula-loader-design.md` — LogoLoader
- `docs/superpowers/specs/2026-07-16-web-motion-polish-plan.md` — motion.ts, Reveal, view transitions, skeleton system
