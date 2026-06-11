# Native Explore polish — design

**Date:** 2026-06-12
**Status:** Approved (design)

## Goal

Elevate the native Explore (Discover) screen from "a clean stack of nine
identical carousels" to a top-tier, characterful home — without abandoning the
carousel model. The direction is **polish the carousels** (chosen over a full
web-magazine reflow): keep the spotlight + personal rows + curated carousels, but
raise the art direction, rhythm, and motion so it feels premium and varied.

Matchup-centric web modules (Today's Matchup, Greatest Rivalries) are **out of
scope** — they now live on the Arena tab, so Explore stays pure discovery.

## Current state

[app/(tabs)/explore.tsx](app/(tabs)/explore.tsx) renders, in an `Animated.ScrollView`:
- `SpotlightBanner` — a featured hero that auto-rotates every 6s via a
  `spotlightIndex` interval (image crossfade), gradient to beige, name +
  publisher + progress dots.
- `HomeHeroRow` "Jump Back In" (recently viewed, thumb variant) and "Your
  Favourites" (portrait), when present.
- Nine curated `HomeHeroRow`s (Most Iconic, Villains, Marvel, DC, Anti-Heroes,
  Strongest, X-Men, Brightest Minds, Recently Added), tone alternating light/dark
  by catalog index.

`HomeHeroRow` is already capable (Apple Zoom portrait cards, press spring +
haptic, light/dark bands, portrait/thumb variants, orange accent bar). The
recent zoom work left portrait cards at a screen-relative aspect with a
transparent background.

## The four polish moves

### 1. Cinematic spotlight
Refactor `SpotlightBanner.tsx` into two focused units:
- **`SpotlightCarousel.tsx`** — owns paging via `react-native-reanimated-carousel`
  (already a dependency, v4). Feeds the existing `SPOTLIGHT_POOL` (top-5 popular)
  heroes. `autoPlay` every 6s with `autoPlayInterval`, looping, **swipeable**
  (manual swipe pauses auto-advance briefly, then resumes). Exposes the active
  index to drive the dots. Receives a `scrollY` `Animated.Value` for parallax.
- **`SpotlightSlide.tsx`** — the per-hero visual (portrait, gradient-to-beige,
  eyebrow/name/publisher) plus:
  - a slow **Ken-Burns drift** on the active slide (scale 1 → ~1.06 over the
    dwell), and
  - a **"View hero ›" CTA pill** under the name.
- **Scroll parallax**: the spotlight image translates at a fraction of page
  scroll (driven by `scrollY`), so it drifts as you scroll into the rows.
- Animated **progress dots** (active dot widens), retained from today.

Replaces the `spotlightIndex` interval in `explore.tsx`; the carousel owns
rotation. `spotlightHeight(insetTop)` is preserved so layout math is unchanged.

### 2. Ranked rows
`HomeHeroRow` gains an optional `ranked?: boolean`. When set, each card overlays
an oversized chart numeral (1, 2, 3, …) — Flame-Bold, semi-transparent with a
subtle stroke/shadow, in a corner — so the row reads as a leaderboard, not just
another carousel. The numeral is the card's index + 1. A small `RankBadge`
subcomponent inside `HomeHeroRow` renders it.

Applied to the leaderboard-natured categories: **Most Iconic, Strongest,
Brightest Minds**.

### 3. Editorial rhythm & variety
`HomeHeroRow` gains:
- **`accent?: string`** — overrides the orange accent bar + label colour
  per category (e.g. Villains → red, DC → blue, Marvel → red, Mutants/X-Men →
  purple). Defaults to `COLORS.orange`.
- **`feature?: boolean`** — a larger card treatment for one hero row so the page
  opens with a confident, oversized first row instead of nine equal rows. The
  first curated row (Most Iconic) is the feature row.

Plus, in `explore.tsx`:
- **Deliberate dark bands** (Villains, Anti-Heroes, Strongest on navy) instead of
  pure index alternation, for intentional rhythm.
- **Slim dividers** between consecutive light rows.

A single pure helper centralises this so `explore.tsx` stays declarative:

```ts
// src/lib/home/rowStyle.ts
export interface RowStyle {
  tone: 'light' | 'dark';
  accent: string;       // accent bar + label colour
  ranked: boolean;
  feature: boolean;
}
export function rowStyle(key: string): RowStyle { /* maps category key → style */ }
```

`rowStyle` is the one unit-tested unit (deterministic map; no rendering).

### 4. Scroll micro-interactions
`explore.tsx`'s `Animated.ScrollView` gains an `onScroll` `Animated.event`
writing a `scrollY` `Animated.Value` (currently it has none). That drives:
- **`StickyHeader.tsx`** — a thin top bar (a "Discover" eyebrow/title) that fades
  + slides in once the user scrolls past the spotlight, giving the screen a
  persistent identity on scroll. Absolutely positioned over the top, safe-area
  aware.
- **Spotlight parallax** (the `scrollY` passed into `SpotlightCarousel`).
- **Snap haptic**: a light selection haptic when the spotlight carousel changes
  slide (`onSnapToItem`).

## Files

**Create:**
- `src/components/home/SpotlightCarousel.tsx` — paging + parallax + autoplay owner.
- `src/components/home/SpotlightSlide.tsx` — per-hero visual + Ken-Burns + CTA.
- `src/components/home/StickyHeader.tsx` — scroll-revealed top bar.
- `src/lib/home/rowStyle.ts` — category → `RowStyle` map.
- `__tests__/lib/home/rowStyle.test.ts` — unit tests for the map.

**Modify:**
- `src/components/home/HomeHeroRow.tsx` — add `ranked` / `accent` / `feature` +
  `RankBadge`.
- `app/(tabs)/explore.tsx` — swap `SpotlightBanner` → `SpotlightCarousel`, add
  `scrollY` + `onScroll`, render `StickyHeader`, drive per-row props from
  `rowStyle(key)`, set dark bands + dividers.

**Delete:**
- `src/components/home/SpotlightBanner.tsx` — replaced by the carousel + slide.

Data layer unchanged — same queries already in `explore.tsx`.

## Out of scope
- Web magazine modules (RankingCard, StatPods, PulseTicker, EraTimeline,
  CoverGallery, HallOfInfamy, UniverseBreakdown) — those belong to the rejected
  "full reflow" direction.
- Today's Matchup / Greatest Rivalries — owned by the Arena tab.
- Changing the data fetching, the curated catalog, or category routes.
- The character-screen zoom transition (separate, parked).

## Testing
Per `CLAUDE.md`, no full-screen render or navigation tests. `rowStyle` is the
only pure unit and is unit-tested (every category key returns the expected
tone/accent/ranked/feature; unknown keys fall back to a sane default). Everything
else is presentational/motion and is verified manually: spotlight swipes + auto-
advances with parallax and a CTA; ranked rows show numerals; accents/feature/dark
bands give varied rhythm; the sticky header reveals on scroll.
