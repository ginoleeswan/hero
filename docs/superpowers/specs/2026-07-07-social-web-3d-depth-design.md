# Social Web — 3D Cosmic Depth

**Date:** 2026-07-07
**Status:** Design approved

## Goal

Make the Social Web constellation read as a **3D cosmic field** rather than a flat
2D diagram: orbs sit at varying depths (near/far), vary in size, and gently float
in parallax so it feels like a slice of the character's universe in space — without
sacrificing legibility, tap accuracy, or reduced-motion support.

This is an additive polish pass on the existing renderer. It touches the shared
`SocialWebGraph`, so both surfaces inherit it:

- the compact **preview** on the character page (`SocialWebPreview`, static, non-pannable)
- the full **explorer** (`SocialWebCanvas`, pan/pinch/zoom)

## Two decisions that shape everything

1. **Motion model — depth + settle-on-touch drift.** Orbs float gently at
   different depths at rest (near drifts more than far → parallax). The moment the
   user touches/pans/presses, drift eases to a stop so tap targets hold still while
   they aim; it eases back after release. `prefers-reduced-motion` disables all
   drift but keeps the static depth.
2. **Depth encodes closeness (not aesthetic scatter).** A node's depth carries
   meaning: the subject and its strongest / most-connected / most-famous neighbours
   float **nearer** (bigger, brighter, in front); peripheral characters recede into
   the back. Depth becomes a readable "how central to this web" signal.

## Depth model (`z`)

Computed in `layoutNeighborhood` (`src/lib/graph/forceLayout.ts`) alongside the
existing normalized `{x, y}`. `x/y` are **unchanged** — `z` is a new, independent
channel, so the force sim and every existing consumer of positions (notably the
canvas's `centerOnId` glide) behave exactly as before.

- `z ∈ [0, 1]`, where **1 = nearest / front**, 0 = farthest / back.
- **Encodes closeness:** `z` is derived from a normalized blend of
  *degree-within-this-neighbourhood* (computable from `edges`, already available in
  the layout) and *fame* (`fame_score`, passed in — see below), then **spread
  across roughly `[0.15, 0.9]` by rank** so depth always has visible variety even
  when fame is flat, plus a tiny deterministic id-hash jitter for organic scatter.
- **Subject is pinned at `z = 1`** — the front anchor, consistent with it being
  the largest, centre-pinned node.
- **Deterministic & stable:** same neighbourhood → same `z` on every visit (seeded
  by id hash, same discipline as the existing `hash01` seeding).

### Passing fame into the layout

`layoutNeighborhood`'s node input gains an optional `weight` field:
`{ id, isSubject, weight? }`. `SocialWebGraph` passes
`weight: n.fame_score ?? 0`. Degree comes from `edges` inside the function.

`SocialWebCanvas` also calls `layoutNeighborhood` (for `centerOnId`) with only
`{ id, isSubject }` — it reads **only `x/y`** from the result, so omitting `weight`
there is harmless: `z` may differ but is never read, and `x/y` are identical
regardless of `weight` (weight feeds only the `z` channel, never the force sim).

## Visual mapping (in `SocialWebGraph`)

Applied in the shared renderer so the preview and explorer both inherit it.

- **Size:** node diameter becomes `base(fame) × depthScale(z) × nodeScale`, where
  `depthScale(z)` runs ~`0.62 → 1.12`. Orbs now vary by **both** fame and depth —
  the richer size distribution.
- **Opacity:** far nodes dim toward ~`0.55` (floored — never invisible), multiplied
  into the existing `entrance` / lit / filtered opacity logic.
- **Occlusion:** nodes render **sorted ascending by `z`** (far first) so near orbs
  overlap far ones. Occlusion is the primary depth cue.
- **Edges:** each edge takes the **mean `z`** of its two endpoints for its
  opacity/weight, so far connections recede into the back.

## Motion — settle-on-touch parallax

- **3 depth bands.** `z` is quantized into near / mid / far bands. Each band is a
  group that drifts on a single shared reanimated `clock` (same continuous-loop
  vocabulary as `NebulaLoader`). The **near band drifts with larger amplitude than
  the far band** → relative motion between bands = parallax = the "moving through
  3D space" feel. Fully self-contained: no coupling to the camera transform.
- **Edges stay glued.** Each band group holds **both its edges (an SVG) and its
  nodes**, so when a band drifts, its edges drift with their orbs — endpoints never
  detach. Cross-band edges (endpoints in different bands) are assigned to the band
  of their **nearer** endpoint; at these small, slow amplitudes the few-px slack on
  the far end is imperceptible for thin glow lines.
- **Amplitudes are small & slow** (near band a handful of px, far band ~1–2px) so
  the field breathes rather than sloshes.
- **Settle-on-touch.** A `settle` shared value multiplies drift amplitude. On
  pan / pinch / node-press (and hover) it ramps toward ~0 so **tap targets hold
  still while the user aims**, then eases back after inactivity. In the explorer,
  `SocialWebCanvas` owns the gestures and feeds interaction state down to the graph.
  In the preview there is no pan and the whole panel is one Pressable, so ambient
  drift can never intercept a tap — no settle wiring needed there.
- **Reduced-motion:** `prefers-reduced-motion` → no clock, bands static (drift
  amplitude 0). **Depth is retained** (it is size/opacity/occlusion, not motion).

## Accessibility guardrails

- **Reduced-motion:** drift off, depth intact — the 3D read survives with zero
  movement.
- **Tap-target floor:** in the interactive explorer, far/small orbs clamp to a
  **minimum diameter (~28px)** so depth-shrink never makes a node hard to hit. The
  preview is a single Pressable, so this doesn't apply there.
- **Legibility floor:** far-node opacity bottoms at ~`0.55`; **name chips and
  focus/filter states render at full strength** regardless of depth, so nothing
  readable is dimmed away.
- **No behavior regressions:** depth layers on top of the existing focus-dimming,
  kind filters, hover-lift, entrance animation, and tap/keyboard paths — all
  unchanged.

## Files touched

| File | Change |
| --- | --- |
| `src/lib/graph/forceLayout.ts` | Add `z` to output; accept optional per-node `weight` (fame). **Pure → TDD.** |
| `src/components/character/SocialWebGraph.tsx` | Consume `z` (size / opacity / occlusion); 3-band drift with `settle`. Bulk of the work. |
| `src/components/character/SocialWebCanvas.tsx` | Feed interaction state (pan / pinch / press) into the graph's `settle`. |
| `src/components/web/character/SocialWebPreview.tsx` | Inherits automatically; verify it still reads clean at ~300px. |

## Testing

- **Unit tests for `forceLayout`'s new `z`:**
  - deterministic — same input → identical `z`
  - `z ∈ [0, 1]` for all nodes
  - subject is nearest (`z === 1` / max)
  - higher centrality (degree + fame) → nearer (monotonic by rank)
  - stable across repeated calls ("visits")
  - `x/y` output is byte-for-byte unchanged vs. the pre-`z` behaviour (guards the
    "weight feeds only `z`" invariant)
- **Visual behaviour** (depth cues, band parallax, settle-on-touch, reduced-motion)
  → verified via the user's device screenshots, per project convention. No
  screen-render tests.

## Out of scope

- True 3D projection / a rotating point cloud (rejected in brainstorming: moving
  tap targets and unpredictable edge crossings fight the clean, navigable read).
- three.js (native-parity cost; the SVG + reanimated approach already carries the
  motion vocabulary).
- Any change to the neighbourhood data, RPC, or edge semantics.
