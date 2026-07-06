# Social Web Explorer v2 — pan/zoom, focus, native parity, dark-constellation redesign

**Date:** 2026-07-06
**Status:** Approved design, pre-implementation
**Scope:** Elevate the social-web explorer (`app/social-web/[id].web.tsx` + native `[id].tsx`) from a static flat graph into an interactive, atmospheric **constellation map**: pan + pinch/wheel zoom, focus-highlighting, a real native screen, and a dark immersive visual redesign. Reuses the shipped `get_hero_neighborhood` RPC, `getHeroNeighborhood` fetch, and `layoutNeighborhood` sim. No schema/data changes.

## Goal

The explorer today renders portraits + thin lines on flat beige with no camera and no depth. v2 makes it a **dark-constellation universe map** you can pan/zoom and read: glowing kind-tinted edges on deep ink, portrait nodes with halos, the subject blooming its accent from the core, tap-to-focus that lights one hero's connections, and full native parity via the proven `FamilyCanvas` gesture stack.

## 1. Interaction — pan / zoom / focus

Mirror `src/components/family/FamilyCanvas.tsx` (the app's proven pannable/zoomable graph):

- **Pan:** `Gesture.Pan()` with `activeOffsetX/Y([-8,8])` (a deliberate drag pans; a flick still scrolls) driving reanimated `tx`/`ty` shared values.
- **Zoom:** `Gesture.Pinch()` → `scale` shared value, clamped `[0.5, 2.5]`; `Gesture.Simultaneous(pan, pinch)`. Web additionally supports **wheel/trackpad zoom** (a `wheel` listener adjusting `scale`) and **+/− zoom buttons** (bottom-right).
- **Auto-fit on mount / on recenter:** compute a fit scale + centering translate from the graph bounds so the whole web is framed initially (FamilyCanvas `computeCenter`). A **"recenter" control** (bottom-right, near zoom buttons) re-fits.
- **The canvas transform** wraps the shared `SocialWebGraph` render (SVG edges + portrait nodes) in a `GestureDetector` + `Animated.View` with `{ translateX, translateY, scale }`.

**Focus-highlighting (new):**

- **Single tap a node → focus it:** its edges and directly-connected nodes stay full-strength; all other nodes and edges **dim** (opacity ~0.2). Reading one hero's connections in a dense web is the payoff of zoom. The focused node gets a brighter ring/halo.
- **Tap the focused node again, or tap empty space → clear focus** (all return to full strength).
- **Tap a non-focused node when one is focused → move focus** to it.
- **Long-press a node → recenter** the ego network on it (existing behavior: refetch `getHeroNeighborhood(nodeId)`, re-fit; entry id stays the URL).
- **Double-tap a node → navigate** to that character's dossier. (Replaces single-tap-navigate, since single tap now focuses. A small persistent "Open ▸" affordance appears on the focused node as an explicit alternative to double-tap.)

`focusId` (highlight) and the recenter subject are distinct: highlighting is a view state over the current neighborhood; recenter refetches a new neighborhood.

## 2. Visual redesign — dark constellation

- **Canvas:** deep-ink immersive surface (`SURFACE.ink` / the `stageImmersive` radial family), not beige. `useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink })`. The subject's **accent blooms** as a large soft radial glow from the graph center (an absolutely-positioned radial gradient behind the canvas), so each character's universe is tinted its own color.
- **Edges glow:** kind-tinted (enemy `COLORS.red` / ally `COLORS.green` / team `COLORS.blue`), rendered on dark so they read like a star map. Achieve glow by drawing each edge twice in SVG — a wide, low-alpha blurred underlay + a crisp thin core line. Subject-incident edges brighter/thicker than neighbor-neighbor edges.
- **Nodes:** portrait avatars gain a soft outer **halo** (accent for subject, kind-color for neighbors) via a layered ring; a faint dark-to-transparent vignette keeps portraits legible on ink. The **subject** is largest, accent-ringed, with a slow **pulse** (reanimated scale/opacity loop on the halo — the one looping animation, calm). Node diameter can scale subtly with `fame_score` (more famous = slightly larger) for hierarchy.
- **Entrance motion:** on load, edges fade/draw in and nodes settle from the center outward (staggered opacity, ~400ms), once. Respect `prefers-reduced-motion` (render settled). On recenter, a quick cross-fade to the new web.
- **Chrome:** an immersive header on the ink — back control, `{focusName}'s universe` in Flame with a small subject portrait chip, and a compact **relationship legend** as tinted chips. A bottom hint + the zoom/recenter control cluster. All on `INK_TEXT` tokens for contrast. **Must clear the global web TopBar** (offset by `TOPBAR_HEIGHT`) — the v1 bug this design also fixes properly.

## 3. Native parity

The native route (`app/social-web/[id].tsx`) stops being a redirect and becomes the **real explorer**, sharing the gesture + render approach:

- Native uses `Gesture.Pan`/`Gesture.Pinch` directly (no wheel/buttons needed, though +/− buttons are kept for parity). `GestureHandlerRootView` is already at the app root.
- The `SocialWebGraph` renderer is already `react-native-svg` + RN `View`/`Pressable` — shared unchanged. Only the **gestured shell** (`SocialWebCanvas`) and the **screen chrome** differ per platform where needed.
- Native screen chrome uses safe-area insets instead of `TOPBAR_HEIGHT`; otherwise the same header/legend/controls.

## Architecture / new units

| Unit | Responsibility |
| --- | --- |
| `src/components/character/SocialWebGraph.tsx` (relocate + modify) | **Move** from `web/character/` to shared `character/` (it's already RN-safe; native must import it without reaching into `web/`, per the PullQuoteBio precedent). Update the import in `SocialWebPreview`. Then extend: `focusId?`, `dimUnfocused?`, glow-edge rendering, node halos, `fameScale`, entrance progress. Stays the pure renderer. |
| `src/components/character/SocialWebCanvas.tsx` | Gestured, zoomable, focus-aware shell wrapping `SocialWebGraph`; owns `tx/ty/scale` shared values, pan+pinch, auto-fit, +/−/recenter controls, focus state. Shared web+native (gesture-handler works on both). Web adds a `wheel` listener guarded by `Platform.OS === 'web'`. |
| `app/social-web/[id].web.tsx` (rework) | Dark-constellation chrome + `SocialWebCanvas`; TopBar clearance; accent bloom; wheel/buttons. |
| `app/social-web/[id].tsx` (rework) | Real native explorer: same chrome via safe-area, `SocialWebCanvas`, back nav. |
| `src/components/character/socialWebFocus.ts` | Pure helpers: `connectedIds(edges, nodeId) → Set<string>` and `isEdgeLit(edge, focusId, connected)` — unit-tested; drive the dim/highlight logic. |

## Data flow

Unchanged. Explorer fetches `getHeroNeighborhood(focusSubjectId, 24)` (React Query, key `['neighborhood', id, 24]`). Recenter changes the fetched subject; focus-highlight is pure view state over the loaded neighborhood. `layoutNeighborhood` still computes positions (deterministic); the canvas applies the camera transform on top.

## Error / edge handling

- **Sparse hero:** if `< 3` nodes, show a calm empty state ("Not enough connections to map yet") + back — no lonely graph. (The preview already hides for these.)
- **Missing portrait:** monogram node (existing fallback), halo still applies.
- **Reduced motion:** no entrance stagger, no subject pulse — settled render.
- **Gesture vs page scroll:** `activeOffset` thresholds (FamilyCanvas pattern) keep a vertical flick scrolling on mobile web.
- **Zoom bounds:** clamp `[0.5, 2.5]`; recenter always returns to a sane fit.

## Testing

Per `CLAUDE.md`, no full-screen render tests. Unit-test pure logic only:

- `socialWebFocus.ts` — `connectedIds` returns the node + its direct neighbors from a fixture; `isEdgeLit` true only for edges incident to the focus (or all when no focus). `__tests__/components/socialWebFocus.test.ts`.
- Existing `layoutNeighborhood` / `subjectKind` tests stay green.
- Gestures, glow, and chrome are view-layer — verified via device screenshots (desktop + iOS Safari + native).

## Guardrails

- Reuse the shipped RPC/fetch/sim — no data or schema changes.
- `SocialWebCanvas` + `SocialWebGraph` stay RN-safe (react-native-svg, gesture-handler, reanimated — all cross-platform); web-only bits (`wheel`, `TOPBAR_HEIGHT`) are `Platform.OS === 'web'`-guarded or live in the `.web.tsx` screen.
- No three.js (deliberately — ≤24 nodes, native parity, portrait nodes; SVG + gesture-handler is the right tool, per FamilyCanvas precedent).
- Never Flame-Bold; `StyleSheet.create`; `INK_TEXT` tokens for text on the dark canvas.
- One looping animation only (subject pulse); everything else fires once.

## Delivery — phased, each landing on main

1. **Focus logic:** `socialWebFocus.ts` (+ tests).
2. **Renderer upgrade:** relocate `SocialWebGraph` to shared `character/` (repoint `SocialWebPreview`), then add glow edges, node halos, `focusId`/dim, `fameScale`, entrance progress.
3. **Gestured shell:** `SocialWebCanvas` (pan/pinch/auto-fit/zoom buttons/recenter/focus) wrapping the renderer.
4. **Web screen redesign:** dark-constellation chrome + accent bloom + wheel/TopBar clearance.
5. **Native screen:** real explorer with safe-area chrome.
6. Screenshot verify (desktop + iOS Safari + native); iterate on density/legibility.
