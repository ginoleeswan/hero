# Family Tree — Pannable Canvas Redesign

**Date:** 2026-06-10
**Status:** Approved (design), pending implementation plan
**Builds on:** the shipped tier tree + kinship graph (`2026-06-10-hero-family-tree-design.md`, `2026-06-10-family-tree-kinship-graph-design.md`)
**Platforms:** Web (desktop + mobile web) and Native — full parity

## 1. Summary

Replace the fixed, flex-measured family card with a **pannable canvas** whose node positions are **computed** (not measured), so the tree reads like a real pedigree and never tangles. Generations are fixed rows; the hero's generation is a single row with **siblings flanking the hero**; **aunts/uncles share the parents row**; connectors are drawn from exact computed positions and styled by relationship (bloodline / marriage / same-generation); generation labels live in a **fixed left axis** the connectors never cross. The canvas **pans by drag and zooms with − / + buttons**; nothing collapses.

The genuinely hard part — non-overlapping layout — is delegated to **`d3-hierarchy`** (pure JS, cross-platform). Pan/zoom uses the already-installed **`react-native-gesture-handler` + `react-native-reanimated`**; edges use **`react-native-svg`** (installed). Only one new dependency: `d3-hierarchy`.

## 2. Why this replaces the current renderer

The current `FamilyTree.web.tsx`/`.tsx` measure flex layout to place SVG connectors. That is fragile (measurement races, the bug we just fixed), forces "+N more" collapsing for space, and produces tangled connectors when subtrees overlap. Computing positions ourselves (via a layout library) fixes all three at the root and unlocks pan/zoom.

The shipped data layer is unchanged: `hero_relatives` (+ `tree_parent_id`/`branch_side`), `getHeroFamily`, `resolveKinship`, and `buildFamilyGraph` all stay. `buildFamilyGraph` feeds the new layout engine; `connectorPaths` is **superseded** (its elbow math moves into the engine).

## 3. Layout engine — `layoutFamily` (pure, library-backed)

`src/lib/family/layoutFamily.ts` — `layoutFamily(graph: FamilyGraph): FamilyLayout`. Pure, jest-tested, no RN imports. Uses `d3-hierarchy`'s `hierarchy()` + `tree()`.

The family is hero-centric: ancestors grow **up**, descendants grow **down**, the hero's generation is a horizontal **band**. We run `d3.tree()` twice and stitch:

- **Ancestor tree** (above): root = hero; children = tier **+1** nodes (parents *and* aunts/uncles); their children = tier **+2** nodes (grandparents/ancestors) linked by `treeParentId` (unresolved tier-2 nodes attach to the hero root). Run `d3.tree()`, then **negate Y** so it grows upward.
- **Descendant tree** (below): root = hero; children = tier **−1** nodes anchored to the hero (`treeParentId` null or = a hero-band member); their children = tier **−2**. Run `d3.tree()` downward. Nieces/nephews (anchored to a sibling) hang as a small subtree under that sibling; cousins' descendants are rare — if present, attach to the cousin, else fall to the children row.
- **Hero band** (tier 0): hero centered; **siblings to the left**, **spouse + cousins + in-laws + other to the right**, packed with a fixed gap and centered on the hero's X.

Output:

```ts
export interface PositionedNode { id: string; member: FamilyMember | null; x: number; y: number; isHero: boolean; }
export type EdgeKind = 'bloodline' | 'marriage' | 'sibling';
export interface LayoutEdge { fromId: string; toId: string; kind: EdgeKind; }
export interface FamilyLayout {
  nodes: PositionedNode[];   // hero included (member: null, isHero: true)
  edges: LayoutEdge[];       // orthogonal elbow segments derived in the renderer, or precomputed points
  rows: { tier: number; label: string; y: number }[]; // for the left axis
  bounds: { width: number; height: number };          // canvas size
}
```

- X/Y are in canvas pixels (engine scales d3's normalized coords by `NODE_W + GAP_X` and `ROW_H`).
- **Edge kinds:** parent↔child and grandparent↔parent = `bloodline`; hero↔spouse = `marriage`; hero↔sibling = `sibling` (dashed).
- The engine guarantees no two nodes in a row overlap (d3.tree separation) — this is what removes the tangle.

**Tested:** generation Y ordering (ancestors above hero above descendants); siblings flank the hero (some x < hero.x, some > ); a resolved grandparent sits above its parent's x; no two nodes share an (x,y); edge kinds correct. Fixtures: Superman, Cable (deep), Captain Marvel (many siblings).

## 4. Rendering — `FamilyCanvas`

`src/components/family/FamilyCanvas.web.tsx` / `FamilyCanvas.tsx` — viewport + pan/zoom + SVG edges + nodes. Props `{ heroName, members }`. Calls `buildFamilyGraph` → `layoutFamily`.

- **Viewport:** fixed-height window (desktop ≈ 460px, mobile ≈ 360px), `overflow: hidden`, the card chrome (FAMILY eyebrow + count + legend) around it.
- **Canvas:** an absolutely-positioned layer sized to `layout.bounds`, holding the SVG edge layer (behind) and the node views (front), transformed by `{ translateX, translateY, scale }` (a reanimated shared value).
- **Pan/zoom:** a `GestureDetector` with a `Pan` gesture (drag → update translate) and a `Pinch` gesture (native) / wheel (web) for zoom; plus on-screen **− / + zoom buttons** and a **recenter** button. Initial transform centers the hero in the viewport. Pan is clamped loosely to keep the tree reachable. Works identically on web and native (both libs support web).
- **Edges:** one `<Svg>` over the canvas; each `LayoutEdge` an orthogonal elbow `<Path>`; stroke by kind — bloodline `#c3b59c` solid, marriage `#E0A335` solid, sibling `#e2d6c2` dashed.
- **Nodes:** the existing node visuals (linked = portrait + power badge + chevron + alignment tint; plain = initial avatar; hero = dark + gold; deceased dimmed ✝), absolutely positioned at each node's `(x, y)`. Linked nodes tappable → `/character/<heroId>`.
- **Left axis:** a fixed overlay column on the viewport's left edge; each `rows[]` label positioned at `row.y * scale + translateY` so it tracks vertical pan but stays pinned left. Connectors are always to the right of the leftmost node, so they never cross the axis.
- **Legend:** a small footer row — ● Bloodline · ● Marriage · ┄ Same generation. Asides (clones → "Variants") and non-family footnotes remain below the viewport.
- **Empty state:** render nothing when `members.length === 0`.

## 5. Gesture coordination (the one real caveat)

The card sits in a vertically-scrolling page. The pan gesture must capture drags inside the viewport without fighting page scroll:

- **Web:** pointer capture on drag inside the viewport; the page scrolls only outside the card.
- **Native:** the `Pan` gesture uses gesture-handler; coordinate with the outer scroll via `activeOffset`/`simultaneousHandlers` so a clear horizontal/2-D drag pans the tree while a mostly-vertical flick still scrolls the page.

A fullscreen/immersive view is **out of scope (v2)** — v1 is the in-card pannable viewport.

## 6. Dependencies

- **Add:** `d3-hierarchy` (+ `@types/d3-hierarchy` dev) via `yarn add` (not Expo-managed).
- **Reuse (installed):** `react-native-gesture-handler` 2.31, `react-native-reanimated` 4.3, `react-native-svg` 15.15.
- Confirm `GestureHandlerRootView` wraps the app root (required by gesture-handler); add it if missing.

## 7. Component structure

```
src/lib/family/
  layoutFamily.ts        NEW — pure d3-hierarchy layout → FamilyLayout; jest-tested
  buildFamilyGraph.ts    unchanged (feeds the engine)
  connectorPaths.ts      REMOVED (superseded by layoutFamily)
src/components/family/
  FamilyCanvas.web.tsx    NEW — viewport + pan/zoom + svg + nodes (replaces FamilyTree.web.tsx)
  FamilyCanvas.tsx        NEW — native equivalent (replaces FamilyTree.tsx)
  familyNode styles       shared node visuals (kept from current files)
app/character/[id].web.tsx, app/character/[id].tsx  — render <FamilyCanvas> instead of <FamilyTree>
```

## 8. Testing

- `layoutFamily` — unit tests (positions/ordering/no-overlap/edge-kinds) over Superman / Cable / Captain Marvel fixtures.
- `buildFamilyGraph` — existing tests stay.
- Canvas/pan/zoom — not unit-tested (per CLAUDE.md, no screen-render tests); verified by typecheck + live Playwright on Superman (forks + siblings), Cable (deep, pan needed), Captain Marvel (sibling flanking), and a no-relatives hero (hidden).

## 9. Out of scope (future)

- Fullscreen/immersive canvas view.
- AI-generated illustrated head avatars (separate project — raster generation pipeline + storage + non-hero fallback; SVG conversion not worth it).
- Pinch/wheel zoom polish beyond basic; minimap.

## 10. Open implementation details (resolve in planning)

- Exact `d3.tree().separation()` + node spacing constants for a compact-but-untangled look.
- Whether the hero band's cousins sit on the right or split both sides when numerous.
- Clamp bounds for pan; initial zoom-to-fit vs fixed scale.
- `GestureHandlerRootView` presence at the app root.
