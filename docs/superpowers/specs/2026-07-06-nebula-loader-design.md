# NebulaLoader — cosmic loading state for the social-web explorer

**Date:** 2026-07-06
**Status:** Approved design, pre-implementation
**Scope:** One new shared component + a small swap in each explorer screen's loading branch. Web + native. No data/schema changes.

## Goal

Replace the plain "Mapping the universe…" text shown while the explorer loads a hero's neighborhood (initial load, and — the felt moment — after a long-press **recenter** to a new hero) with a lush, atmospheric cosmic nebula. It reads as *the universe forming* while the new web loads, then hands off to the graph's existing entrance bloom.

## When it shows

The explorer screens render the canvas only when `data && !sparse`; otherwise they show the loading/empty branch. Today that branch is a `<Text>`. NebulaLoader replaces the **loading** case (`data` undefined). The **sparse** case (loaded but <3 nodes) keeps its "Not enough connections to map yet." text. React Query has no `keepPreviousData`, so a recenter to an uncached hero briefly yields `data === undefined` → the nebula shows; a cached target is instant (no loader, correct).

## Visual design

A full-canvas scene on the deep ink (`SURFACE.ink`), composed back-to-front:

1. **Layered nebula clouds** — 4–5 large soft radial-gradient clouds in a fixed cosmic palette (deep indigo, violet, magenta, teal, rose), overlapping at low opacity so edges blend into an aurora haze. Each is an SVG `<Circle>` filled by its own `<RadialGradient>` (opaque-ish center → transparent edge).
2. **Two depth layers (parallax)** — a back set drifts slower + dimmer; a front set faster + brighter. This parallax sells depth over "flat gradient."
3. **Starfield** — 40–60 `<Circle>` stars of varied radius (0.5–1.6) and brightness scattered across the field; a subset twinkle (opacity breathing on offset phases). Deterministic positions (seeded) so it doesn't reshuffle each frame.
4. **Forming core** — a bright central star-point with a soft halo and one or two **staggered expanding pulse-rings** (`<Circle>` stroke, radius growing + opacity fading on a loop) — a universe igniting.
5. **Vignette** — a radial gradient darkening the edges to deep ink, so the scene feels boundless.
6. **Caption** — a small, quietly letter-tracked "Mapping the universe…" low-center in `INK_TEXT.faint`.

**Palette is fixed cosmic, not the hero accent** — during a recenter the target's accent isn't known until data lands; a fixed palette avoids a wrong-color flash and reads as "the universe."

## Motion

Driven by **reanimated** shared values (cross-platform; matches the map's stack):

- Each cloud drifts on a slow loop (translate x/y via `withRepeat(withTiming(...), -1, true)`) with a **distinct period** (e.g. 7–13s) so overlaps continuously re-blend; plus a gentle scale breathe.
- A handful of stars twinkle (opacity 0.3↔1 on offset timers).
- The core pulse-ring(s) expand + fade on a ~2.5s loop, staggered.
- Slow and hypnotic — nothing fast or looping-jarring.
- **`prefers-reduced-motion`** → render one composed still frame (clouds, stars, core, vignette) with no drift/twinkle/pulse. It must look good frozen.

## Architecture

| Unit | Responsibility |
| --- | --- |
| `src/components/character/NebulaLoader.tsx` (new) | Self-contained cosmic scene. Props: `{ label?: string }` (default "Mapping the universe…"). Fills its parent (flex 1 / absolute-fill). All SVG + reanimated; RN-safe. |
| `app/social-web/[id].web.tsx` / `[id].tsx` | In the loading branch, render `<NebulaLoader />` instead of the plain text; keep the sparse-case text. |

Deterministic star/cloud layout comes from a tiny seeded PRNG inside the component (so the scene is stable across renders, not reshuffling). No external dependency.

## Error / edge handling

- Nebula only shows while genuinely loading; it never blocks interaction (there's nothing to interact with yet).
- If a fetch errors, `getHeroNeighborhood` returns `{nodes:[],edges:[]}` → `data` is defined but empty → the **sparse** branch shows its text (not an infinite nebula). Correct.
- Reduced motion still renders the full still scene.

## Testing

Per `CLAUDE.md`, no full-screen render tests and this is pure-visual with no branching logic worth a unit test (the seeded PRNG is trivial). Verified via device screenshots (desktop + iOS Safari + native), including a reduced-motion still.

## Guardrails

- Shared component, RN-safe: `react-native-svg` + `reanimated` only; no web-only CSS. Web-only concerns (none here) would be `Platform`-guarded.
- Fixed cosmic palette; never Flame-Bold; `INK_TEXT` for the caption; `StyleSheet.create`.
- Motion respects `prefers-reduced-motion`.

## Delivery

One pass: build `NebulaLoader`, wire it into both explorer loading branches, screenshot-verify (animated + reduced-motion). Tunable afterwards (cloud count, drift speed, palette) from screenshots.
