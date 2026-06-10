# Family Tree Pannable Canvas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flex-measured family card with a pannable canvas whose node positions are computed by `d3-hierarchy` and rendered with `react-native-svg`, so the tree reads as a real pedigree (siblings flank the hero, aunts share the parents row), never tangles, and pans/zooms instead of collapsing.

**Architecture:** A pure `layoutFamily` engine turns the existing `FamilyGraph` into absolute `{x,y}` node positions + typed edges using `d3-hierarchy` (two trees — ancestors up, descendants down — stitched at the hero, plus a horizontal hero-generation band). `FamilyCanvas` renders those positions: an SVG edge layer + absolutely-positioned nodes inside a viewport that pans (drag) and zooms (− / + ) via the already-installed `react-native-gesture-handler` + `react-native-reanimated`. A fixed left axis labels the generations.

**Tech Stack:** Expo Router 4, React Native (+ react-native-web), TypeScript, `d3-hierarchy` (new), `react-native-svg` 15.15, `react-native-gesture-handler` 2.31, `react-native-reanimated` 4.3, jest-expo, yarn.

**Spec:** `docs/superpowers/specs/2026-06-10-family-tree-pannable-canvas-design.md`

**Working branch:** `master` (commit directly; no feature branches).

**Baseline note:** `yarn tsc --noEmit` has a PRE-EXISTING noisy baseline (`splash`, `absoluteFillObject`). Your bar: no NEW errors referencing your files. Check `yarn tsc --noEmit 2>&1 | grep -E '<file>'`.

---

## File Structure

**Create:**
- `src/lib/family/layoutFamily.ts` — pure layout engine (d3-hierarchy → positions + edges + rows + bounds).
- `src/components/family/FamilyCanvas.web.tsx` — web viewport + pan/zoom + SVG + nodes.
- `src/components/family/FamilyCanvas.tsx` — native equivalent.
- Test: `__tests__/lib/family/layoutFamily.test.ts`.

**Modify:**
- `package.json` — add `d3-hierarchy` dep + `@types/d3-hierarchy`; add `d3-hierarchy` to jest `transformIgnorePatterns` allowlist.
- `app/_layout.tsx` (and `app/_layout.web.tsx` if it exists) — wrap app in `GestureHandlerRootView`.
- `app/character/[id].web.tsx` / `app/character/[id].tsx` — render `<FamilyCanvas>` instead of `<FamilyTree>`.

**Delete:**
- `src/lib/family/connectorPaths.ts` + `__tests__/lib/family/connectorPaths.test.ts` (superseded).
- `src/components/family/FamilyTree.web.tsx` + `src/components/family/FamilyTree.tsx` (replaced by FamilyCanvas).

---

## Task 1: Add d3-hierarchy + jest transform

**Files:** `package.json`

- [ ] **Step 1: Install**

```bash
yarn add d3-hierarchy
yarn add -D @types/d3-hierarchy
```

- [ ] **Step 2: Allow jest to transform d3-hierarchy (ESM)**

`d3-hierarchy` ships ESM; jest-expo won't transform `node_modules` by default. In `package.json`, find the `jest.transformIgnorePatterns` array (around line 90) and add `d3-hierarchy` to the negative-lookahead allowlist (the long `node_modules/(?!(...))` string) — append `|d3-hierarchy` before the closing `)`. Example: `...|react-native-svg|react-native-reanimated|d3-hierarchy)`.

- [ ] **Step 3: Sanity check the import works under jest**

Create a throwaway test `__tests__/lib/family/_d3.smoke.test.ts`:

```ts
import { hierarchy, tree } from 'd3-hierarchy';
it('d3-hierarchy imports and lays out', () => {
  const root = tree<{ id: string; children: { id: string; children: never[] }[] }>()
    .nodeSize([10, 10])(hierarchy({ id: 'r', children: [{ id: 'a', children: [] }] }));
  expect(typeof root.x).toBe('number');
});
```

Run: `yarn jest _d3.smoke`
Expected: PASS. If it fails with an ESM/`import` syntax error, the transformIgnorePatterns edit (Step 2) is wrong — fix it until this passes. Then delete the smoke test:

```bash
git rm __tests__/lib/family/_d3.smoke.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add package.json yarn.lock
git commit -m "build(family): add d3-hierarchy for tree layout"
```

---

## Task 2: layoutFamily engine (TDD)

**Files:**
- Create: `src/lib/family/layoutFamily.ts`
- Test: `__tests__/lib/family/layoutFamily.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/family/layoutFamily.test.ts
import { layoutFamily, HERO_ID } from '../../../src/lib/family/layoutFamily';
import { buildFamilyGraph } from '../../../src/lib/family/buildFamilyGraph';
import type { FamilyMember } from '../../../src/lib/family/types';

function m(p: Partial<FamilyMember> & { id: string }): FamilyMember {
  return {
    name: p.id, alias: null, role: 'role', relation: 'other', tier: 0,
    modifiers: [], status: null, position: 0,
    heroId: null, heroImage: null, heroPower: null, heroAlignment: null,
    treeParentId: null, branchSide: null, ...p,
  };
}

const layout = (members: FamilyMember[]) => layoutFamily(buildFamilyGraph(members));

describe('layoutFamily', () => {
  it('includes the hero node and one node per member', () => {
    const out = layout([m({ id: 'f', relation: 'parent', tier: 1 }), m({ id: 'c', relation: 'child', tier: -1 })]);
    const ids = out.nodes.map((n) => n.id).sort();
    expect(ids).toEqual([HERO_ID, 'c', 'f'].sort());
    expect(out.nodes.find((n) => n.isHero)?.id).toBe(HERO_ID);
  });

  it('places ancestors above the hero and descendants below', () => {
    const out = layout([
      m({ id: 'gp', relation: 'grandparent', tier: 2 }),
      m({ id: 'f', relation: 'parent', tier: 1 }),
      m({ id: 'c', relation: 'child', tier: -1 }),
      m({ id: 'gc', relation: 'grandchild', tier: -2 }),
    ]);
    const y = (id: string) => out.nodes.find((n) => n.id === id)!.y;
    expect(y('gp')).toBeLessThan(y('f'));
    expect(y('f')).toBeLessThan(y(HERO_ID));
    expect(y(HERO_ID)).toBeLessThan(y('c'));
    expect(y('c')).toBeLessThan(y('gc'));
  });

  it('puts siblings on one side of the hero and the spouse on the other', () => {
    const out = layout([
      m({ id: 'b', relation: 'sibling', tier: 0 }),
      m({ id: 'w', relation: 'spouse', tier: 0 }),
    ]);
    const x = (id: string) => out.nodes.find((n) => n.id === id)!.x;
    expect(x('b')).toBeLessThan(x(HERO_ID));
    expect(x('w')).toBeGreaterThan(x(HERO_ID));
  });

  it('emits marriage, sibling, and bloodline edges with correct kinds', () => {
    const out = layout([
      m({ id: 'w', relation: 'spouse', tier: 0 }),
      m({ id: 'b', relation: 'sibling', tier: 0 }),
      m({ id: 'f', relation: 'parent', tier: 1 }),
    ]);
    const kind = (to: string) => out.edges.find((e) => e.toId === to || e.fromId === to)!.kind;
    expect(kind('w')).toBe('marriage');
    expect(kind('b')).toBe('sibling');
    expect(kind('f')).toBe('bloodline');
  });

  it('positions a resolved grandparent over its parent column', () => {
    const out = layout([
      m({ id: 'f', relation: 'parent', tier: 1 }),
      m({ id: 'gp', relation: 'grandparent', tier: 2, treeParentId: 'f' }),
    ]);
    const x = (id: string) => out.nodes.find((n) => n.id === id)!.x;
    expect(Math.abs(x('gp') - x('f'))).toBeLessThan(1); // single child centers under parent
  });

  it('produces positive coords, a bounds box, and generation rows', () => {
    const out = layout([m({ id: 'f', relation: 'parent', tier: 1 })]);
    expect(out.nodes.every((n) => n.x >= 0 && n.y >= 0)).toBe(true);
    expect(out.bounds.width).toBeGreaterThan(0);
    expect(out.bounds.height).toBeGreaterThan(0);
    expect(out.rows.map((r) => r.tier)).toEqual(expect.arrayContaining([0, 1]));
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `yarn jest layoutFamily`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the engine**

```ts
// src/lib/family/layoutFamily.ts
// Pure layout: FamilyGraph → absolute node positions + typed edges, using
// d3-hierarchy. Ancestors grow up, descendants grow down (two d3 trees stitched
// at the hero), the hero's generation is a horizontal band. (x,y) are node CENTERS.
import { hierarchy, tree } from 'd3-hierarchy';
import type { FamilyGraph, FamilyMember } from './types';

export const HERO_ID = '__hero__';

const NODE_W = 158;
const NODE_H = 50;
const GAP_X = 26;
const ROW_H = 120;
const PAD = NODE_W / 2 + 16;

export interface PositionedNode {
  id: string;
  member: FamilyMember | null; // null = the hero
  x: number;
  y: number;
  isHero: boolean;
}
export type EdgeKind = 'bloodline' | 'marriage' | 'sibling';
export interface LayoutEdge {
  fromId: string;
  toId: string;
  kind: EdgeKind;
}
export interface FamilyLayout {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
  rows: { tier: number; label: string; y: number }[];
  bounds: { width: number; height: number };
}

interface Spec {
  id: string;
  member: FamilyMember | null;
  children: Spec[];
}

const TIER_LABELS: Record<number, string> = {
  2: 'Grandparents',
  1: 'Parents · aunts',
  0: 'Hero · siblings',
  [-1]: 'Children',
  [-2]: 'Grandchildren',
};

export function layoutFamily(graph: FamilyGraph): FamilyLayout {
  const all: FamilyMember[] = graph.tiers.flatMap((t) => t.nodes.map((n) => n.member));
  const byId = new Map(all.map((mm) => [mm.id, mm]));
  const parentIn = (id: string | null, set: FamilyMember[]) =>
    id && set.some((s) => s.id === id) ? id : null;

  const tier1 = all.filter((mm) => mm.tier === 1);
  const tier2 = all.filter((mm) => mm.tier === 2);
  const tierM1 = all.filter((mm) => mm.tier === -1);
  const tierM2 = all.filter((mm) => mm.tier === -2);
  const band = all.filter((mm) => mm.tier === 0);

  const ancSpec: Spec = {
    id: HERO_ID,
    member: null,
    children: tier1.map((p) => ({
      id: p.id,
      member: p,
      children: tier2
        .filter((g) => parentIn(g.treeParentId, tier1) === p.id)
        .map((g) => ({ id: g.id, member: g, children: [] })),
    })),
  };
  for (const g of tier2.filter((g) => parentIn(g.treeParentId, tier1) === null)) {
    ancSpec.children.push({ id: g.id, member: g, children: [] });
  }

  const descSpec: Spec = {
    id: HERO_ID,
    member: null,
    children: tierM1.map((c) => ({
      id: c.id,
      member: c,
      children: tierM2
        .filter((g) => parentIn(g.treeParentId, tierM1) === c.id)
        .map((g) => ({ id: g.id, member: g, children: [] })),
    })),
  };
  for (const g of tierM2.filter((g) => parentIn(g.treeParentId, tierM1) === null)) {
    descSpec.children.push({ id: g.id, member: g, children: [] });
  }

  const lay = tree<Spec>().nodeSize([NODE_W + GAP_X, ROW_H]);
  const ancRoot = lay(hierarchy(ancSpec));
  const descRoot = lay(hierarchy(descSpec));
  const ancHeroX = ancRoot.x;
  const descHeroX = descRoot.x;

  const nodes: PositionedNode[] = [{ id: HERO_ID, member: null, x: 0, y: 0, isHero: true }];
  const edges: LayoutEdge[] = [];

  ancRoot.each((d) => {
    if (d.data.id === HERO_ID) return;
    nodes.push({ id: d.data.id, member: d.data.member, x: d.x - ancHeroX, y: -d.depth * ROW_H, isHero: false });
    edges.push({ fromId: d.parent ? d.parent.data.id : HERO_ID, toId: d.data.id, kind: 'bloodline' });
  });
  descRoot.each((d) => {
    if (d.data.id === HERO_ID) return;
    nodes.push({ id: d.data.id, member: d.data.member, x: d.x - descHeroX, y: d.depth * ROW_H, isHero: false });
    edges.push({ fromId: d.parent ? d.parent.data.id : HERO_ID, toId: d.data.id, kind: 'bloodline' });
  });

  const siblings = band.filter((mm) => mm.relation === 'sibling');
  const right = band.filter((mm) => mm.relation !== 'sibling');
  siblings.forEach((mm, i) => {
    nodes.push({ id: mm.id, member: mm, x: -(NODE_W + GAP_X) * (i + 1), y: 0, isHero: false });
    edges.push({ fromId: HERO_ID, toId: mm.id, kind: 'sibling' });
  });
  right.forEach((mm, i) => {
    nodes.push({ id: mm.id, member: mm, x: (NODE_W + GAP_X) * (i + 1), y: 0, isHero: false });
    edges.push({ fromId: HERO_ID, toId: mm.id, kind: mm.relation === 'spouse' ? 'marriage' : 'sibling' });
  });

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  for (const n of nodes) {
    n.x = n.x - minX + PAD;
    n.y = n.y - minY + PAD;
  }
  const maxX = Math.max(...nodes.map((n) => n.x));
  const maxY = Math.max(...nodes.map((n) => n.y));

  const tierY = new Map<number, number>();
  const heroNode = nodes.find((n) => n.isHero)!;
  tierY.set(0, heroNode.y);
  for (const n of nodes) if (n.member) tierY.set(n.member.tier, n.y);
  const rows = [...tierY.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([tier, y]) => ({ tier, label: TIER_LABELS[tier] ?? '', y }));

  return { nodes, edges, rows, bounds: { width: maxX + PAD, height: maxY + PAD } };
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `yarn jest layoutFamily`
Expected: PASS. (If d3's `.each` ordering makes a position assertion flaky, assert relative ordering only — the tests above already use `<`/`>` not exact pixels.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/family/layoutFamily.ts __tests__/lib/family/layoutFamily.test.ts
git commit -m "feat(family): layoutFamily d3-hierarchy engine"
```

---

## Task 3: Remove the superseded connectorPaths

**Files:** delete `src/lib/family/connectorPaths.ts`, `__tests__/lib/family/connectorPaths.test.ts`

- [ ] **Step 1: Confirm only the old FamilyTree files import it**

Run: `grep -rn "connectorPaths" src app __tests__`
Expected: references only in `connectorPaths.*`, `FamilyTree.web.tsx`, `FamilyTree.tsx` (all removed in this plan). If anything else imports it, stop and report.

- [ ] **Step 2: Delete + commit**

```bash
git rm src/lib/family/connectorPaths.ts __tests__/lib/family/connectorPaths.test.ts
git commit -m "chore(family): remove connectorPaths (superseded by layoutFamily)"
```

(The `FamilyTree.*` files still import it until Task 7 deletes them; `yarn jest` won't run them, and `yarn tsc` errors there are expected until Tasks 5–7 land.)

---

## Task 4: GestureHandlerRootView at the app root

**Files:** `app/_layout.tsx` (and `app/_layout.web.tsx` if present)

`react-native-gesture-handler` requires the tree to be wrapped in `GestureHandlerRootView` at the root, or gestures silently no-op.

- [ ] **Step 1: Check which root layout files exist**

Run: `ls app/_layout*.tsx`
Apply the edit below to each that exists (the web build uses `_layout.web.tsx` if present, otherwise `_layout.tsx`).

- [ ] **Step 2: Wrap the root**

In each root layout file: add the import and wrap the outermost returned element. Add near the other imports:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
```

Then wrap the top-level returned JSX so the outermost element is:

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  {/* ...existing root content (providers, Stack/Slot, AuthGate, etc.)... */}
</GestureHandlerRootView>
```

Keep all existing children and providers inside, unchanged.

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit 2>&1 | grep -E '_layout'`
Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app/_layout.web.tsx
git commit -m "feat(family): GestureHandlerRootView at app root"
```

---

## Task 5: FamilyCanvas.web + page wiring

**Files:**
- Create: `src/components/family/FamilyCanvas.web.tsx`
- Modify: `app/character/[id].web.tsx`

Screen rendering is not unit-tested (CLAUDE.md). Verify via typecheck + Playwright in Task 7.

- [ ] **Step 1: Build the web canvas**

Create `src/components/family/FamilyCanvas.web.tsx`. Requirements:

1. Props `{ heroName: string; members: FamilyMember[] }`; return `null` if `members.length === 0`.
2. `const graph = buildFamilyGraph(members); const layout = layoutFamily(graph);`
3. Card chrome: the existing `FAMILY` eyebrow + count line + divider (copy styling from the current `FamilyTree.web.tsx`). A small legend footer: ● Bloodline (`#c3b59c`) · ● Marriage (`#E0A335`) · ┄ Same generation.
4. **Viewport**: a `View` with `height: 460`, `overflow: 'hidden'`, `position: 'relative'`, `cursor: 'grab'`.
5. **Pan/zoom** with reanimated shared values:
   ```tsx
   import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
   import { Gesture, GestureDetector } from 'react-native-gesture-handler';
   const tx = useSharedValue(0); const ty = useSharedValue(0); const scale = useSharedValue(1);
   const start = useSharedValue({ x: 0, y: 0 });
   const pan = Gesture.Pan()
     .onBegin(() => { start.value = { x: tx.value, y: ty.value }; })
     .onUpdate((e) => { tx.value = start.value.x + e.translationX; ty.value = start.value.y + e.translationY; });
   const pinch = Gesture.Pinch().onUpdate((e) => { scale.value = Math.min(2, Math.max(0.5, e.scale)); });
   const gesture = Gesture.Simultaneous(pan, pinch);
   const canvasStyle = useAnimatedStyle(() => ({
     transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
   }));
   ```
   Initial centering: after the viewport measures its width/height via `onLayout`, set `tx.value = vpW/2 - heroX` and `ty.value = vpH/2 - heroY` (heroX/heroY from the layout's hero node). Add **− / + / recenter** `Pressable` buttons (absolute, top-right of the viewport) that adjust `scale.value` by ±0.15 (clamped 0.5–2) and reset tx/ty/scale to the centered values.
6. **Canvas**: `<GestureDetector gesture={gesture}><Animated.View style={[{ position:'absolute', width: layout.bounds.width, height: layout.bounds.height }, canvasStyle]}> … </Animated.View></GestureDetector>`.
7. **Edges** (behind nodes): one `<Svg width={bounds.width} height={bounds.height} style={StyleSheet.absoluteFill}>`. For each `LayoutEdge`, look up the two nodes' centers and draw an orthogonal elbow `<Path>`:
   ```tsx
   function elbowD(a: {x:number;y:number}, b: {x:number;y:number}): string {
     const my = (a.y + b.y) / 2;
     return `M${a.x},${a.y} L${a.x},${my} L${b.x},${my} L${b.x},${b.y}`;
   }
   // stroke: bloodline '#c3b59c' solid; marriage '#E0A335' solid; sibling '#e2d6c2' dashed (strokeDasharray="4 4")
   ```
8. **Nodes**: for each `PositionedNode`, an absolutely-positioned wrapper at `left: n.x - NODE_W/2, top: n.y - NODE_H/2` (use a fixed visual width ~`150` with `maxWidth` so long names ellipsize). Reuse the node visuals from the current `FamilyTree.web.tsx`: hero anchor (dark + gold), linked node (portrait/initial + teal power badge + chevron + alignment-tinted border, `onPress` → `router.push('/character/<heroId>')`), plain node (initial avatar), deceased dim + ✝. The hero node uses `heroName`.
9. **Left axis** (fixed overlay, on top, `pointerEvents: 'none'`): for each `layout.rows` entry, a `Text` label positioned with an `useAnimatedStyle` `top: row.y * scale.value + ty.value` and a fixed `left: 8`. Connectors stay right of the leftmost node, so they never cross it.
10. **Asides/footnotes**: render `graph.asides` ("Variants") and `graph.footnotes` ("Also: …") below the viewport, as in the current component.

Keep the file focused; factor the node visual into a small local `CanvasNode` component within the file.

- [ ] **Step 2: Wire into the page**

In `app/character/[id].web.tsx`: change the import on line 10 from `FamilyTree`/`FamilyTree.web` to `import { FamilyCanvas } from '../../src/components/family/FamilyCanvas.web';`, and the render around line 702 from `<FamilyTree heroName={stats.name} members={family} />` to `<FamilyCanvas heroName={stats.name} members={family} />`. Leave the `getHeroFamily` fetch and `family` state as-is.

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit 2>&1 | grep -E 'FamilyCanvas.web|character/\[id\].web'`
Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add src/components/family/FamilyCanvas.web.tsx 'app/character/[id].web.tsx'
git commit -m "feat(family): pannable web FamilyCanvas (d3 layout + svg + pan/zoom)"
```

---

## Task 6: FamilyCanvas native + page wiring

**Files:**
- Create: `src/components/family/FamilyCanvas.tsx`
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Build the native canvas**

Create `src/components/family/FamilyCanvas.tsx` mirroring Task 5 with native specifics:
- Same `layoutFamily` model, same `<Svg>` edge layer, same node visuals (use `TouchableOpacity` for linked nodes, as the current native `FamilyTree.tsx` does).
- Pan/zoom: identical `Gesture.Pan()` + `Gesture.Pinch()` + reanimated transform. To coexist with the page's outer scroll, give the pan gesture `.activeOffsetX([-8, 8]).activeOffsetY([-8, 8])` so a deliberate drag pans the canvas while a vertical flick still scrolls the page.
- Viewport height ≈ 360 (mobile). Same − / + / recenter buttons.
- Same left-axis overlay, legend, asides/footnotes.

- [ ] **Step 2: Wire into the page**

In `app/character/[id].tsx`: change the import on line 31 from `FamilyTree` to `import { FamilyCanvas } from '../../src/components/family/FamilyCanvas';`, and the render around line 1179 from `<FamilyTree …/>` to `<FamilyCanvas heroName={data.stats.name} members={family} />`.

- [ ] **Step 3: Typecheck**

Run: `yarn tsc --noEmit 2>&1 | grep -E 'FamilyCanvas.tsx|character/\[id\].tsx'`
Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add src/components/family/FamilyCanvas.tsx 'app/character/[id].tsx'
git commit -m "feat(family): pannable native FamilyCanvas"
```

---

## Task 7: Remove old FamilyTree + full verification

**Files:** delete `src/components/family/FamilyTree.web.tsx`, `src/components/family/FamilyTree.tsx`

- [ ] **Step 1: Confirm nothing imports the old components**

Run: `grep -rn "FamilyTree" src app __tests__`
Expected: no remaining imports (pages now use `FamilyCanvas`). If any remain, fix them first.

- [ ] **Step 2: Delete**

```bash
git rm src/components/family/FamilyTree.web.tsx src/components/family/FamilyTree.tsx
git commit -m "chore(family): remove old FamilyTree components"
```

- [ ] **Step 3: Full test suite**

Run: `yarn test:ci`
Expected: all pass (new `layoutFamily`; `connectorPaths`/`buildTiers` removed; `buildFamilyGraph`/`resolveKinship`/`parseRelatives`/`classifyRole`/`rowToMember`/`parity` intact).

- [ ] **Step 4: Typecheck — no new errors**

Run: `yarn tsc --noEmit 2>&1 | grep -E 'src/lib/family|src/components/family|character/\[id\]'`
Expected: empty.

- [ ] **Step 5: Live visual check (web)**

With the dev server on `:8081`, load via Playwright and screenshot the Family card for:
- `/character/644` (Superman) — siblings/cousins beside the hero, parents above, forks under the correct parent, drag pans, − / + zooms.
- `/character/145` (Cable) — deep tree; pan to see grandparents/great-grandparents; no tangling.
- `/character/157` (Captain Marvel) — several siblings flank the hero; child below.
- A no-relatives hero — card hidden.
Confirm: connectors attach correctly and never cross the left axis labels; bloodline/marriage/sibling styling reads; 0 console errors; pan + zoom + recenter work.

- [ ] **Step 6: Update the family card skeleton (web), if needed**

The fixed-height viewport changes the card's height/shape. In `app/character/[id].web.tsx`'s `CharacterSkeleton`, confirm the `familyCard` skeleton still roughly matches (a titled card with a tall body). If visibly off, adjust its block to a single ~400px-tall placeholder. Commit only if changed:

```bash
git add 'app/character/[id].web.tsx'
git commit -m "feat(family): align skeleton with canvas viewport"
```

---

## Self-Review Notes

- **Spec coverage:** dep + jest (Task 1); layout engine with two-trees-stitched + hero band + edges + rows + bounds (Task 2, §3); connectorPaths removal (Task 3); gesture root (Task 4, §6); web canvas with viewport/pan/zoom/svg/nodes/axis/legend (Task 5, §4); native parity + gesture coordination (Task 6, §5); cleanup + verification (Task 7, §8). Fullscreen/AI-avatars correctly excluded (§9).
- **Type consistency:** `PositionedNode`/`LayoutEdge`/`EdgeKind`/`FamilyLayout`/`HERO_ID` defined once in `layoutFamily.ts` and consumed by both canvases; `FamilyGraph`/`FamilyMember` reused from existing types.
- **Open items (spec §10):** node spacing constants set in the engine (Task 2); cousins on the right of the band (Task 2); pan clamp + initial centering in the canvas (Tasks 5–6); `GestureHandlerRootView` added (Task 4).
- **Risk:** d3-hierarchy ESM under jest (mitigated by Task 1 Step 3 smoke test) and gesture/scroll coexistence on native (mitigated by `activeOffset` in Task 6).
```
