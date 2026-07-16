# Web motion & transition polish — implementation plan

**Date:** 2026-07-16
**Status:** Implemented (2026-07-16). Foundation + pressables + card→detail morph + StatBar/Reveal + CSS niceties all landed on `main`. Deferred: broad `useSkeletonTransition` rollout (E2) and blanket image-fade sweep (E1 done for prominent thumbnails only); idle-rail `HeroRail` morph not wired. See "Deferred / follow-ups" at the end.
**Scope:** Web only (`*.web.tsx`, `src/components/web/`). Native screens are untouched.
**Goal:** Make navigation and interaction feel physically continuous — pages morph instead of blink, controls feel tactile, data reveals itself with pacing — building on the motion patterns the codebase already proved in the compare flow.

---

## Context: what already exists (do not rebuild)

| Pattern | Where | Notes |
| --- | --- | --- |
| View Transitions API wrapper | `src/lib/viewTransition.ts` — `withViewTransition(run)` | `flushSync` inside `startViewTransition`; no-ops on Firefox/Safari/native. |
| Shared-element morph (proven) | `app/compare/[hero]/pick.web.tsx` + `[opponent].web.tsx` (`VT_HERO`/`VT_PICK`), `src/components/compare/{OpponentCard,FighterAnchor,VsAnchor}.tsx` | Tags the clicked card's `viewTransitionName` **synchronously** before navigating inside `withViewTransition`; arrival screen carries the same name. Handles the "two elements can't share one name" rule on back-morph. **This is the reference implementation for Workstream A.** |
| Scroll-entrance reveal | `src/components/web/Reveal.tsx` | IO-driven rise+fade, fires once, drops composited styles after landing (iOS Safari clipping fix), `prefers-reduced-motion` → instant. |
| Skeleton crossfade | `src/hooks/useSkeletonTransition.ts` | 4-phase pre/skeleton/crossfade/content state machine. |
| Hover transitions | `WebHeroCard`, `MatchupCard`, `SearchBrowse`, `ShowdownStage` | Ad-hoc per component; durations/curves inconsistent (150–200ms, mixed easings). |
| Injected `<style>` house pattern | `src/components/web/Skeleton.tsx`, `web/home/PulseTicker.tsx`, `game/ClueSticker.tsx`, `ui/LogoLoader.web.tsx` | RNW can't express keyframes/pseudo-selectors; the escape hatch is a real `<style>` tag created in an effect (or `dangerouslySetInnerHTML` in `app/+html.tsx` for build-time CSS). |
| RNW CSS escape hatch | everywhere | Web-only CSS props (`transition`, `boxShadow`, `gridColumn`, `viewTransitionName`) go through `as object` casts on RN styles. Keep doing this. |

House rules that bind every workstream:

- `StyleSheet.create` for all styles; web-only props via `as object`.
- Every new animation must respect `prefers-reduced-motion` (see Workstream F for the shared helper — build that first).
- Only animate compositor properties (`transform`, `opacity`, `filter`) for anything that runs on many elements or during scroll. One-off centerpieces (like `ShowdownStage`'s `flex-grow` tally) may break this rule deliberately.
- Package manager is **yarn**. Tests: `yarn test:ci`. No new dependencies are needed for any of this.

---

## Workstream F (build FIRST): shared motion foundation

Everything else imports from this. Small, pure, testable.

### F1. `src/lib/motion.ts` (new, platform-neutral module — safe to import from shared components; all values are inert constants)

```ts
// Durations (ms)
export const MOTION = {
  fast: 150,      // hover/pressed feedback
  base: 200,      // most property transitions
  entrance: 600,  // Reveal-style entrances (matches Reveal.tsx)
  stagger: 50,    // per-item cascade delay
  staggerCap: 8,  // max items that stagger; the rest arrive with item 8
} as const;

// Curves — the two the codebase already uses, named
export const EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';   // decisive settle (Reveal, MatchupCard)
export const EASE_OVERSHOOT = 'cubic-bezier(0.34, 1.56, 0.64, 1)'; // playful bounce (ShowdownStage)

/** SSR-safe, web-safe. False on native / during static render. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}
```

Then sweep the existing inline checks (`Reveal.tsx:16`, `explore.web.tsx:286,303`, `character/[id].web.tsx:485`) to use `prefersReducedMotion()`. Behaviour-preserving refactor; do it in the same PR as F1.

### F2. `useInViewOnce` hook — `src/hooks/useInViewOnce.ts` (new)

Extract the IntersectionObserver logic from `Reveal.tsx` into a reusable hook:

```ts
function useInViewOnce(ref, opts?): boolean // true once the element has entered the viewport; sticks true
```

- Same defaults as Reveal (`rootMargin: '0px 0px -8% 0px'`, `threshold: 0.05`).
- Returns `true` immediately when: SSR, no IntersectionObserver, or `prefersReducedMotion()`.
- Refactor `Reveal.tsx` to consume it (keep Reveal's landed-phase teardown — that iOS Safari fix must not regress; read the comment at `Reveal.tsx:43-46` before touching it).
- Unit-test the hook in `__tests__/hooks/useInViewOnce.test.ts` with a mocked IO (there is no existing IO mock — add one to the test file, not jest setup).

### F3. Global motion CSS in `app/+html.tsx`

Append to the existing `rootStyle` string (`+html.tsx` renders it via `dangerouslySetInnerHTML` at line ~80):

```css
/* Root view-transition pacing: quick cross-fade, not the 250ms default lerp */
::view-transition-old(root) { animation-duration: 220ms; }
::view-transition-new(root) { animation-duration: 220ms; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
```

Do **not** add a global `* { transition: none }` reduced-motion nuke — it would fight `useSkeletonTransition`'s timers (the JS state machine assumes the fade takes time) and the compare flow's morph teardown. Reduced-motion stays opt-in per pattern via `prefersReducedMotion()`.

**Acceptance (F):** `yarn test:ci` green; `tsc --noEmit` clean; existing Reveal/skeleton behaviour visually unchanged.

---

## Workstream A: card → character-detail view-transition morph

**The flagship.** Clicking any hero card morphs the card's portrait into the detail page's portrait. Pattern is a direct port of the compare-pick morph.

### A1. Shared VT name + tagging helper

Add to `src/lib/viewTransition.ts`:

```ts
export const VT_PORTRAIT = 'vt-hero-portrait';
```

And a small module-level "departure" latch:

```ts
let pendingMorphHeroId: string | null = null;
export function markMorphDeparture(heroId: string) { pendingMorphHeroId = heroId; }
export function consumeMorphArrival(heroId: string): boolean {
  const hit = pendingMorphHeroId === heroId;
  pendingMorphHeroId = null;
  return hit;
}
```

Why the latch: the detail page must only tag its portrait with `VT_PORTRAIT` when we actually arrived via a morph for **that hero** — otherwise a stale name on an unrelated navigation creates a nonsense morph from whatever element last held the name. (The compare flow solves this with route params; a module latch is less invasive for a catalogue-wide pattern. Both screens live in the same JS session under expo-router client-side nav, so a module variable is safe; on a hard load it's simply `null` → no morph → fine.)

### A2. Departure side — card components

Cards that navigate to `/character/[id]`:

- `src/components/web/WebHeroCard.tsx` (used by `profile.web.tsx` grids)
- `RowCard` in `app/(tabs)/explore.web.tsx:74` (explore carousels)
- Search result cards in `src/components/web/search/SearchBrowse.tsx` / `app/(tabs)/search/index.web.tsx` (locate the card component that pushes to `/character/`)
- `app/category/[slug].web.tsx` grid cards, `app/team/[id].web.tsx` member cards (same treatment if they share a card component; if hand-rolled, tag the image wrapper)

Mechanism per card (copy from `pick.web.tsx:179-196`):

1. Component keeps `const [morphing, setMorphing] = useState(false)`.
2. `onPress`: `setMorphing(true)` — must be committed synchronously, so run the navigation via `withViewTransition` which already `flushSync`es; set state inside the same flush: `withViewTransition(() => { setMorphing(true) in the flushSync? })` — **no**: follow pick.web.tsx exactly — it sets the name via `flushSync(() => setMorphing(true))` *inside* the `startViewTransition` callback together with the `router.push`. Concretely: `markMorphDeparture(id); withViewTransition(() => { setMorphing(true); router.push(`/character/${id}`); })` — both run inside the wrapper's single `flushSync`, so the old snapshot sees the tagged card and the new snapshot sees the detail page.
3. While `morphing`, the card's **image wrapper** style gains `{ viewTransitionName: VT_PORTRAIT } as object`. Tag the element wrapping `HeroImage`, not the Pressable (the overlay gradient + name text would smear into the morph; snapshot just the art). This will need a plain `View` wrapper around `HeroImage` in `WebHeroCard` (currently the image is absolutely filled at line 43-51 — wrap it, keep layout identical).
4. No cleanup needed on the departing screen (it unmounts), but reset `morphing` in an effect on blur anyway for back-nav correctness (`useFocusEffect` or pathname change), mirroring how pick.web.tsx clears its tag.

Prop plumbing: give `WebHeroCard` (and `RowCard`) the hero `id` they already have; add an optional `morph?: boolean` default `true` so callers can opt out (e.g. cards inside an open modal).

### A3. Arrival side — `app/character/[id].web.tsx`

- The desktop portrait card is at line ~1544-1571 (`styles.portraitCard` wrapping `HeroImage`). The mobile immersive header portrait is in the body branch near line ~788-810. Both branches need the same treatment; only one renders at a time, so one name is safe.
- On mount, `const arrivedViaMorph = useMemo(() => consumeMorphArrival(String(id)), [id])`.
- If `arrivedViaMorph`, apply `{ viewTransitionName: VT_PORTRAIT } as object` to the portrait wrapper.
- **Drop the name after arrival settles** (~600ms timeout → state flip), like Reveal's landed phase: a lingering `view-transition-name` will hijack the *next* navigation's snapshot (e.g. detail → another detail via a related-character link would morph the old portrait into something wrong).
- The detail page's own entrance animation (if any at `[id].web.tsx:485` region) should be **skipped** when `arrivedViaMorph` — a fade-in on top of a morph double-animates.

### A4. Keep chrome static during the morph

Give the persistent web chrome its own `view-transition-name` so the root cross-fade doesn't re-fade it:

- `src/components/web/TopBar.tsx` root: `{ viewTransitionName: 'vt-topbar' } as object`
- The web tab bar / bottom chrome if it persists across these routes (check `app/(tabs)/_layout` web behaviour; `PageEndCap` is per-page content, leave it).

Named elements are snapshotted independently — identical old/new snapshots means the browser still cross-fades them, but pixel-identical, i.e. visually static. This also reinforces the constant-ink chrome rule.

**Interaction with the compare flow:** none expected — `VT_PORTRAIT` is a distinct name from `VT_HERO`/`VT_PICK`, and only one name-pair is active per navigation. But manually regression-test the compare pick→arena morph after A4 lands (TopBar gaining a name participates in *every* transition, including compare's).

**Acceptance (A):**
- Chrome (Chromium): explore/search/profile/category card click → portrait visibly morphs into the detail portrait; TopBar doesn't flicker.
- Firefox/Safari: identical navigation, no morph, no errors (already guaranteed by `withViewTransition`'s fallback — verify anyway).
- Detail → detail navigation immediately after arrival does not produce a stray morph.
- Reduced-motion: no morph (the F3 CSS kills VT animations; navigation still works).
- Compare flow morphs unchanged.

---

## Workstream B: shared pressable recipe (tactile controls)

### B1. `src/components/web/pressStyles.ts` (new)

```ts
import { MOTION, EASE_OVERSHOOT } from '../../lib/motion';

export const PRESSABLE = {
  rest: {
    transition: `transform 80ms ease-out, box-shadow ${MOTION.base}ms ${EASE_OVERSHOOT}`,
  } as object,
  pressed: { transform: [{ scale: 0.97 }] } as object,
  hovered: { transform: [{ scale: 1.02 }] } as object, // optional per-callsite
};
```

Note: transitions can't be conditionally quick-out/slow-back in one declaration; 80ms `ease-out` covers press-down, and swapping the pressed style off lets the same transition spring back (accepting symmetric 80ms) — **or** put the transition string on the rest style and a `transition: transform 200ms ${EASE_OVERSHOOT}` override on release. Keep it simple: single `transition: transform 150ms ${EASE_OVERSHOOT}` is fine; tune by eye.

### B2. Apply to (each is a small diff — style-array member added to an existing `({ pressed, hovered })` style function):

| Target | File |
| --- | --- |
| `WebHeroCard` (already has hover scale — add pressed 0.97, unify curve/duration to motion.ts constants) | `src/components/web/WebHeroCard.tsx:91-97` |
| `RowCard` + carousel arrows + "View all" chips | `app/(tabs)/explore.web.tsx` |
| Vote buttons / matchup cards | `src/components/web/versus/{MatchupCard,ShowdownStage,RivalryDeck}.tsx` (unify their existing one-off transitions onto the shared constants) |
| Search chips + browse cards | `src/components/web/search/SearchBrowse.tsx` |
| Favourite button on detail | `app/character/[id].web.tsx` (`styles.portraitFav`, ~line 1592) |
| PageEndCap links | `src/components/web/PageEndCap.tsx:108` (has `opacity 150ms`; add scale) |
| Auth form buttons | `app/(auth)/{login,signup,forgot-password}.web.tsx` (already have opacity transitions; add scale on pressed) |

Do **not** apply to plain text links or the TopBar nav (scale on nav items reads as jitter, not tactility) — TopBar items get a color/opacity transition only.

**Acceptance (B):** every card/button in the table compresses on press and springs back; no layout shift (transform only); `yarn test:ci` green.

### B3. Favourite heart bounce

In `character/[id].web.tsx` (and the profile grid's un-favourite affordance if it has one): when favourited state flips to true, play a quick scale pop on the heart icon. Implementation: house injected-`<style>` keyframes pattern (see `PulseTicker.tsx`) —

```css
@keyframes fav-pop { 0% { transform: scale(1); } 40% { transform: scale(1.35); } 100% { transform: scale(1); } }
```

applied via a `data-` attribute or a swapped class/style for 350ms after toggle, `EASE_OVERSHOOT`. Also transition the button's `background-color`/border `MOTION.base`. Skip the pop under `prefersReducedMotion()` (color transition alone is fine to keep).

---

## Workstream C: StatBar fill + staggered reveals

### C1. Animated StatBar fill

`src/components/web/StatBar.tsx` — animate the fill from 0 to `fill%` when the bar first scrolls into view:

- Use `useInViewOnce` (F2) on the container.
- Render fill at `transform: scaleX(inView ? 1 : 0)` with `transformOrigin: 'left'` and `transition: transform 700ms ${EASE_OUT_EXPO}` — **scaleX, not width** (compositor-only; there are 6+ bars per detail page). Keep `width: ${fill}%` static as the layout size.
- The rounded end-cap distorts under scaleX; with `overflow: hidden` on the track and radius 4 on an 8px bar it's imperceptible mid-animation and correct at rest. Accept it.
- Add `delay?: number` prop; the powerstats grid in `character/[id].web.tsx` passes `index * MOTION.stagger`.
- `prefersReducedMotion()` → render at full scale immediately (`useInViewOnce` already returns true, so this falls out for free — verify).
- Value counter (the number) animating 0→n is **out of scope** (needs rAF loop; not worth it now).

### C2. `Reveal` stagger

- Add `delay?: number` (ms) prop to `Reveal.tsx`: appended as `transition-delay: ${delay}ms` in the transition style, and the landed-phase timeout becomes `650 + delay`.
- Grid/list call sites pass `delay={Math.min(index, MOTION.staggerCap) * MOTION.stagger}`:
  - `app/(tabs)/explore.web.tsx` section reveals (lines ~1413+) — stagger the *sections* is already implicit via scroll; the win is staggering **cards inside a newly-revealed grid**. Where grids render children directly (category/team/search-results grids), wrap items in `Reveal delay={…}` only for the first viewport-load — do NOT wrap infinite-scroll pages' every row (IO cost × hundreds of nodes). Cap: only indices < 12 get a Reveal wrapper; later items render bare.
- Search results (`search/index.web.tsx`): when a query resolves, results cascade in. If results replace in place (not scroll-entrance), use a keyed remount with `@starting-style` instead (see D2) — pick whichever the existing DOM structure makes cheaper; do not restructure the screen for this.

**Acceptance (C):** detail-page stat bars fill left-to-right in a cascade on first scroll-in; category grid's first screenful cascades; scrolling performance unaffected (verify no long frames in DevTools performance panel on the category grid).

---

## Workstream D: modern CSS niceties (progressive enhancement, Chromium-first)

All of these degrade to "instant, no animation" in Firefox/Safari — acceptable by design. Guard nothing in JS; the CSS simply doesn't apply.

### D1. `interpolate-size: allow-keywords` for expanders

- Add `:root { interpolate-size: allow-keywords; }` to the `rootStyle` CSS in `app/+html.tsx`.
- Apply `transition: height ${MOTION.base}ms ${EASE_OUT_EXPO}` (via `as object`) to "read more" bio expanders — locate the expandable bio section in `app/character/[id].web.tsx` and `app/biography/[id].web.tsx` (search for a `numberOfLines`/expanded state toggle). If an expander animates `height: auto`, it also needs `overflow: hidden` while transitioning.
- **Caveat to verify first:** height transitions are layout-property animations — fine for a single one-off user-initiated expand, per the guardrail's centerpiece exception.

### D2. `@starting-style` for popovers/dropdowns

- Search suggestion dropdown (find it in `app/(tabs)/search/index.web.tsx` or TopBar's search affordance) and any web menu/tooltip: give the container a mount transition with `@starting-style { opacity: 0; transform: translateY(-4px) }`.
- RNW can't express `@starting-style` in style objects — use the injected-`<style>` house pattern with a stable class hook: RNW escape hatch is `dataSet={{ anim: 'dropdown' }}` → selector `[data-anim="dropdown"]` (see `ClueSticker.tsx` for the data-attribute precedent).
- Add the shared keyframe/starting-style block once to `+html.tsx` rootStyle rather than per-component injection, since these are static rules.

### D3. Scroll-driven TopBar elevation (stretch, do last)

- `src/components/web/TopBar.tsx`: shadow/border fades in as the page scrolls, via CSS scroll-driven animation (`animation-timeline: scroll()`) targeting a `[data-anim="topbar"]` rule in `+html.tsx`. **First check** whether TopBar already does a JS scroll-elevation (the memory notes a "transient TopBar" behaviour on mobile web — read the component and `WebChromeContext.tsx` before adding anything; if a JS mechanism exists, skip D3 entirely rather than double-driving it).

---

## Workstream E: image + skeleton audit (no new machinery)

- **E1.** Sweep web call sites of `HeroImage`/expo-image for `transition={0}` / missing transitions. `HeroImage` already defaults to `transition ?? 200` (`src/components/HeroImage.tsx:89`) — the audit is for direct `<Image>` uses in web files (`rg "from 'expo-image'" app src/components/web`). Give any web image without a transition `transition={200}`. Exception: the detail-page LCP portrait and any image inside an active view-transition morph should keep `transition={0}`/instant — a fade-in during a morph looks broken (pick.web.tsx already documents this need to paint instantly at line ~292).
- **E2.** Audit data screens for hard skeleton→content cuts: `rg -l "Skeleton" app src/components/web` minus `rg -l useSkeletonTransition`. Wire stragglers through `useSkeletonTransition` (mechanical; follow an existing consumer).

---

## Sequencing & PR slicing

1. **PR 1 — Foundation (F1–F3):** motion.ts + useInViewOnce + Reveal refactor + global CSS. Pure refactor + inert additions. Unit tests for `prefersReducedMotion` (jsdom matchMedia mock) and `useInViewOnce`.
2. **PR 2 — Pressables (B1–B3):** shared recipe + sweep + heart pop.
3. **PR 3 — Card→detail morph (A1–A4):** the flagship. Biggest review surface; keep it to the morph only.
4. **PR 4 — Reveals (C1–C2):** StatBar fill + stagger.
5. **PR 5 — CSS niceties + audits (D, E):** each item independent; can split further.

Each PR: `yarn test:ci` + `npx tsc --noEmit` + a manual web pass (`yarn start` → `w`). PR 3 additionally needs the compare-flow regression check and a Firefox or Safari smoke test (morph gracefully absent).

## Testing strategy

- **Unit (jest-expo):** `motion.ts` helpers, `useInViewOnce`, `useSkeletonTransition` untouched (existing tests must stay green). No tests for visual CSS — per repo convention, don't test rendering of full screens.
- **Manual checklist per PR** (add to PR description): Chromium + one non-Chromium browser + `prefers-reduced-motion` emulated in DevTools rendering panel + mobile-web viewport (the constant-ink chrome rule: nothing here may introduce beige flashes on the mobile-web canvas during transitions — verify the root cross-fade against an ink page like insights).
- **Perf spot-check:** DevTools performance recording while scrolling the category grid (C2) and during a card→detail morph (A) — no dropped-frame clusters, no layout thrash warnings.

## Explicit non-goals

- Native (Reanimated) animation work — nothing in this plan touches `.tsx` native views beyond shared components where changes are web-inert (`StatBar` lives in `web/`, `HeroImage` default already exists).
- Cross-document `@view-transition` (the deployed site is a static export but expo-router navigates client-side; MPA transitions only matter for hard entry, which the splash already covers).
- Animated number counters, page-level parallax, exit animations on unmount (React unmount + CSS transitions don't compose without extra machinery — skip).
- Any change to `useSkeletonTransition`'s state machine.

---

## What actually landed (2026-07-16)

- **Foundation:** `src/lib/motion.ts` (durations + `EASE_OUT_EXPO`/`EASE_OVERSHOOT` + `prefersReducedMotion()`), `src/hooks/useInViewOnce.ts` (extracted from Reveal; unit-tested), `Reveal` refactored onto it with a `delay` prop, and global CSS in `+html.tsx` (root VT pacing 220ms, reduced-motion VT kill, `interpolate-size`, palette `@starting-style`). Inline reduced-motion checks in explore/character swept onto the helper.
- **Pressables:** `src/components/web/pressStyles.ts` (`PRESS_TRANSITION` + `pressTransform`) applied to WebHeroCard, explore RowCard, MatchupCard, SearchBrowse PodTile, category/team/search grid cards, and the detail favourite button. `HeartPop` gives the favourite a spring bounce (injected-`<style>` keyframe, reduced-motion aware). ShowdownStage deliberately left alone (bespoke tilt/flex-grow choreography).
- **Card→detail morph:** `VT_PORTRAIT` + `markMorphDeparture`/`consumeMorphArrival` latch in `viewTransition.ts` (now returns the transition so callers can await `.finished`); `useHeroMorph` hook drives departure tagging + reset-after-finish. Wired on WebHeroCard, explore RowCard, and the category/search/team grid cards; arrival tagging on both the desktop `portraitCard` and mobile `mHero` in `character/[id].web.tsx`, dropped after `MOTION.entrance`. TopBar carries `view-transition-name: vt-topbar` so chrome stays static.
- **Reveals:** `PowerStatCell` (the real powerstats, already animating) consolidated onto `useInViewOnce`/`prefersReducedMotion`; orphan `StatBar.tsx` deleted. Versus hub sections given a capped `delay` stagger.
- **CSS niceties:** search command palette (`SearchPalette`) gets a `@starting-style` entrance; prominent home/search thumbnails (`RightNowBand`, `TopResultRow`) given `transition={200}`.

Verified: `tsc --noEmit` clean, `yarn test:ci` 810 pass (was 759 — `yarn install` also restored RNTL to the branch-locked v13.3.3, unbreaking 15 suites), eslint clean on all touched files. **Not yet done:** live browser visual pass (view-transition morph, palette entrance, reduced-motion, non-Chromium fallback, compare-flow regression) — inherently manual.

## Deferred / follow-ups

- **E2 skeleton crossfade rollout:** most data screens still hard-cut skeleton→content. Wiring each through `useSkeletonTransition` is mechanical but per-screen state work with real regression surface; skipped deliberately. Do screen-by-screen when touching each.
- **E1 image fades:** only the prominent home/search thumbnails were done. Other direct `expo-image` sites (backgrounds, secondary thumbs) were left — low value, and blanket fades on backgrounds can look off. `HeroImage`'s default-200 already covers the main card/portrait path.
- **Idle-rail morph:** `HeroRail` (search idle "Recently viewed"/"Popular" rails) doesn't carry `useHeroMorph` yet — only the active-query results grid does. Add the same wrapper pattern to `HeroRail` if the idle rails should morph too.
- **D3 scroll-driven TopBar elevation:** not attempted — needs the check against the existing transient-TopBar JS (`WebChromeContext`) first.
