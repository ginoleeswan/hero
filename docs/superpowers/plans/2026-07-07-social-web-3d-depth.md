# Social Web — 3D Cosmic Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Social Web constellation read as a 3D cosmic field — orbs at varying depths that vary in size and drift in gentle parallax — without hurting legibility, tap accuracy, or reduced-motion support.

**Architecture:** A new deterministic depth channel `z ∈ [0,1]` (1 = nearest) is computed in the pure `layoutNeighborhood` layout, encoding "closeness" (degree-in-web + fame). The shared `SocialWebGraph` renderer consumes `z` for size, opacity, and occlusion, and quantizes it into 3 drift bands (near drifts more than far → parallax). Drift eases to a stop on interaction (settle-on-touch), driven by an `interacting` flag from `SocialWebCanvas`. Both the compact preview and the full explorer inherit it because they share the renderer.

**Tech Stack:** TypeScript, React Native / React Native Web (Expo SDK 56), react-native-svg, react-native-reanimated 4, react-native-gesture-handler, Jest.

## Global Constraints

- **Package manager:** yarn only. Never npm/bun.
- **`x/y` layout output must be byte-for-byte unchanged** — `z` is an independent channel; `weight` feeds only `z`, never the force sim.
- **Reduced motion:** `prefers-reduced-motion` disables all drift but keeps static depth. Reuse the existing `reducedMotion()` helper pattern already in these files.
- **No `any`;** prefer `unknown` for caught errors. Functional components only. `StyleSheet.create` for styles (except `StyleSheet.absoluteFill`).
- **Loaded Nunito weights only:** 400 / 700Bold / 800ExtraBold / 900Black. Never `Nunito_600SemiBold`. Never `Flame-Bold`.
- **Determinism:** same neighbourhood → identical `z` on every visit (seed via the existing `hash01`).
- **Accessibility floors:** interactive far orbs clamp to min diameter 28px; far-node opacity floors at 0.55; name-chip / focus / hover states render at full opacity regardless of depth.
- **Verification of visual behaviour** is via the user's own device screenshots — do NOT spin up a local server. Only `forceLayout` is unit-tested.
- Commit after each task. End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Work on `main` directly.

---

### Task 1: Add the `z` depth channel to `layoutNeighborhood`

**Files:**
- Modify: `src/lib/graph/forceLayout.ts`
- Test: `__tests__/lib/graph/forceLayout.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `layoutNeighborhood(nodes: { id: string; isSubject: boolean; weight?: number }[], edges: { from: string; to: string }[], opts?: { iterations?: number }): Map<string, { x: number; y: number; z: number }>`
  - Semantics: `z ∈ [0,1]`, `1 = nearest`. Subject → `z === 1`. Non-subjects spread across `[0.15, 0.9]` by descending centrality rank (`0.5·degreeNorm + 0.5·min(1, weight/100)`), ties broken by `hash01(id)`. `x/y` identical to prior behaviour.

- [ ] **Step 1: Update the existing subject assertion for the new `z` field**

In `__tests__/lib/graph/forceLayout.test.ts`, change the first test's assertion (it currently expects only `{ x: 0, y: 0 }`):

```ts
  it('pins the subject at the center (nearest depth)', () => {
    const pos = layoutNeighborhood(nodes, edges);
    expect(pos.get('S')).toEqual({ x: 0, y: 0, z: 1 });
  });
```

- [ ] **Step 2: Add the failing `z` tests**

Append these tests inside the `describe('layoutNeighborhood', ...)` block in `__tests__/lib/graph/forceLayout.test.ts`:

```ts
  it('gives every node a z in [0,1]', () => {
    const pos = layoutNeighborhood(nodes, edges);
    for (const p of pos.values()) {
      expect(p.z).toBeGreaterThanOrEqual(0);
      expect(p.z).toBeLessThanOrEqual(1);
    }
  });

  it('places the subject nearest (max z)', () => {
    const pos = layoutNeighborhood(nodes, edges);
    const zs = [...pos.values()].map((p) => p.z);
    expect(pos.get('S')!.z).toBe(Math.max(...zs));
  });

  it('floats more-central nodes nearer than less-central ones', () => {
    // Degrees: A=2 (S-A, A-B), B=2 (S-B, A-B), C=1 (S-C). A,B nearer than C.
    const pos = layoutNeighborhood(nodes, edges);
    const nearest = Math.min(pos.get('A')!.z, pos.get('B')!.z);
    expect(nearest).toBeGreaterThan(pos.get('C')!.z);
  });

  it('lets fame pull a low-degree node nearer', () => {
    const weighted = [
      { id: 'S', isSubject: true },
      { id: 'A', isSubject: false },
      { id: 'B', isSubject: false },
      { id: 'C', isSubject: false, weight: 100 },
    ];
    const pos = layoutNeighborhood(weighted, edges);
    // C has degree 1 but max fame → should out-rank degree-2 A.
    expect(pos.get('C')!.z).toBeGreaterThan(pos.get('A')!.z);
  });

  it('leaves x/y unchanged when weights are supplied (weight feeds only z)', () => {
    const base = layoutNeighborhood(nodes, edges);
    const withWeights = layoutNeighborhood(
      nodes.map((n) => ({ ...n, weight: 50 })),
      edges,
    );
    for (const id of ['S', 'A', 'B', 'C']) {
      const a = base.get(id)!;
      const b = withWeights.get(id)!;
      expect({ x: b.x, y: b.y }).toEqual({ x: a.x, y: a.y });
    }
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `yarn test:ci __tests__/lib/graph/forceLayout.test.ts`
Expected: FAIL — the `z` tests fail (`p.z` is `undefined`) and the updated subject test fails (`z` missing).

- [ ] **Step 4: Implement `z` in `layoutNeighborhood`**

In `src/lib/graph/forceLayout.ts`, change the node parameter type and return type on the signature:

```ts
export function layoutNeighborhood(
  nodes: { id: string; isSubject: boolean; weight?: number }[],
  edges: { from: string; to: string }[],
  opts?: { iterations?: number },
): Map<string, { x: number; y: number; z: number }> {
```

Then, replace the final normalization + return block (currently the `// normalize into [-1,1] …` section through `return pos;`) with this — the `x/y` normalization is untouched; a `z` channel is computed and merged in:

```ts
  // normalize into [-1,1] keeping subject at origin
  let max = 0.0001;
  for (const p of pos.values()) max = Math.max(max, Math.abs(p.x), Math.abs(p.y));
  const scale = max > 1 ? 1 / max : 1;
  for (const p of pos.values()) {
    p.x *= scale;
    p.y *= scale;
  }

  // --- depth channel (z): encode "closeness" to this character's web ---
  // 1 = nearest/front. Subject pinned nearest; others spread by centrality rank
  // (degree within the neighbourhood + fame), ties broken deterministically.
  const degree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (degree.has(e.from)) degree.set(e.from, degree.get(e.from)! + 1);
    if (degree.has(e.to)) degree.set(e.to, degree.get(e.to)! + 1);
  }
  const maxDeg = Math.max(1, ...nodes.map((n) => degree.get(n.id) ?? 0));
  const centrality = (n: { id: string; weight?: number }) =>
    0.5 * ((degree.get(n.id) ?? 0) / maxDeg) + 0.5 * Math.min(1, (n.weight ?? 0) / 100);

  const zOf = new Map<string, number>();
  const subject = nodes.find((n) => n.isSubject);
  if (subject) zOf.set(subject.id, 1);
  const others = nodes
    .filter((n) => !n.isSubject)
    .sort((a, b) => centrality(b) - centrality(a) || hash01(a.id) - hash01(b.id));
  const NEAR = 0.9;
  const FAR = 0.15;
  others.forEach((n, i) => {
    const t = others.length > 1 ? i / (others.length - 1) : 0; // 0 = most central
    zOf.set(n.id, NEAR - t * (NEAR - FAR));
  });

  const result = new Map<string, { x: number; y: number; z: number }>();
  for (const [id, p] of pos) result.set(id, { x: p.x, y: p.y, z: zOf.get(id) ?? FAR });
  return result;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn test:ci __tests__/lib/graph/forceLayout.test.ts`
Expected: PASS — all tests green (original 4 + updated subject + 5 new).

- [ ] **Step 6: Typecheck**

Run: `yarn typecheck`
Expected: no errors. (Consumers still compile — `z` is additive; `SocialWebCanvas`/`SocialWebGraph` read only `.x/.y` today.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/graph/forceLayout.ts __tests__/lib/graph/forceLayout.test.ts
git commit -m "feat(social-web): add encode-closeness z depth channel to layoutNeighborhood

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Consume `z` for static depth in `SocialWebGraph`

Size scales with depth, far nodes dim (floored), and nodes render back-to-front so near orbs occlude far ones. No motion yet. Both the preview and the explorer inherit this.

**Files:**
- Modify: `src/components/character/SocialWebGraph.tsx`

**Interfaces:**
- Consumes: `layoutNeighborhood(...)` now returning `{ x, y, z }` per node (Task 1).
- Produces: unchanged public props on `SocialWebGraph`. Internal helpers `zOf(id)`, `depthScale(z)`, `depthOpacity(z)` and a `z`-sorted `ordered` node list.

- [ ] **Step 1: Pass fame into the layout**

In `src/components/character/SocialWebGraph.tsx`, update the `positions` memo to pass `weight`:

```tsx
  const positions = useMemo(
    () =>
      layoutNeighborhood(
        nodes.map((n) => ({ id: n.id, isSubject: n.is_subject, weight: n.fame_score ?? 0 })),
        edges,
      ),
    [nodes, edges],
  );
```

- [ ] **Step 2: Add depth helpers + `interactive` flag**

Immediately after the `at` helper definition (the `const at = (id) => {…}` block), add:

```tsx
  // Depth channel → visual weight. z: 1 = nearest/front, ~0.15 = farthest/back.
  const zOf = (id: string) => positions.get(id)?.z ?? 0.15;
  const depthScale = (z: number) => 0.62 + z * (1.12 - 0.62); // 0.62 … 1.12
  const depthOpacity = (z: number) => 0.55 + z * 0.45; // 0.55 … 1
  // Only the explorer wires node handlers; the preview is a single Pressable.
  const interactive = !!onNodePress;
```

- [ ] **Step 3: Depth-weight the edges**

In the `edges.map((e, i) => { … })` block, after `const color = KIND_COLOR[e.kind] ?? COLORS.grey;`, add the mean-depth factor:

```tsx
          const ez = (zOf(e.from) + zOf(e.to)) / 2;
          const edgeOpacity = entrance * depthOpacity(ez);
```

Then change the `opacity={entrance}` prop on **all three** `<Line>` / `<AnimatedLine>` elements in that block to `opacity={edgeOpacity}`.

- [ ] **Step 4: Sort nodes back-to-front for occlusion**

Replace `{nodes.map((n) => {` (the start of the node loop) with a depth-sorted iteration. First add this memo just after the `positions` memo:

```tsx
  // Paint far → near so nearer orbs occlude farther ones (a core depth cue).
  const ordered = useMemo(
    () => [...nodes].sort((a, b) => (a.is_subject ? 1 : positions.get(a.id)?.z ?? 0.15) - (b.is_subject ? 1 : positions.get(b.id)?.z ?? 0.15)),
    [nodes, positions],
  );
```

Then change the loop opener from `{nodes.map((n) => {` to `{ordered.map((n) => {`.

- [ ] **Step 5: Depth-scale the node diameter + tap floor**

Inside the node loop, replace the diameter line:

```tsx
        const d = Math.round((n.is_subject ? 72 : 40 + 12 * (fame / 100)) * nodeScale);
```

with:

```tsx
        const z = n.is_subject ? 1 : zOf(n.id);
        const base = n.is_subject ? 72 : 40 + 12 * (fame / 100);
        let d = Math.round(base * depthScale(z) * nodeScale);
        if (interactive && !n.is_subject) d = Math.max(28, d); // tap-target floor
```

- [ ] **Step 6: Depth-dim the node, but pop attention states to full**

Still in the node loop, the node wrap `opacity` currently reads:

```tsx
                  opacity: filtered ? 0.15 * entrance : lit ? entrance : 0.2 * entrance,
```

`showChip` is computed a few lines above the returned JSX (`const showChip = n.is_subject || isFocused || hovered;`). Move nothing — just replace the opacity line with a depth-aware version that leaves subject/focused/hovered at full strength:

```tsx
                  opacity:
                    (filtered ? 0.15 : lit ? 1 : 0.2) *
                    entrance *
                    (showChip ? 1 : depthOpacity(z)),
```

- [ ] **Step 7: Typecheck, tests, format**

Run: `yarn typecheck && yarn test:ci && yarn format`
Expected: typecheck clean; all tests pass (Task 1's suite unaffected); prettier reformats/no-ops.

- [ ] **Step 8: Manual verification**

Ask the user to open `/character/<id>` (a well-connected hero, e.g. Batman) and the full explorer (long-press / "Explore the web"), and screenshot on device. Confirm: orbs sit at visibly different sizes/brightness, near orbs overlap far ones, the subject reads as the front anchor, and nothing looks clipped. Do not proceed until the user confirms the static depth looks right.

- [ ] **Step 9: Commit**

```bash
git add src/components/character/SocialWebGraph.tsx
git commit -m "feat(social-web): depth-scale nodes + occlusion + far-edge recede

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 3-band parallax drift with settle-on-touch

Quantize `z` into 3 bands that drift on a shared clock (near drifts more → parallax), keeping each band's edges glued to its nodes. Drift eases to a stop while the user interacts, then eases back. Reduced-motion → no drift.

**Files:**
- Modify: `src/components/character/SocialWebGraph.tsx`
- Modify: `src/components/character/SocialWebCanvas.tsx`

**Interfaces:**
- Consumes: depth helpers + `ordered` list + `interactive` flag from Task 2.
- Produces:
  - `SocialWebGraph` gains two optional props: `interacting?: boolean` (default `false`) and `onInteract?: () => void`.
  - `SocialWebCanvas` owns `interacting` state, a `nudge()` poke, and passes `interacting` down + `onInteract={nudge}`.

- [ ] **Step 1: Extract the edge + node render into local functions**

In `src/components/character/SocialWebGraph.tsx`, the render currently inlines `edges.map(...)` inside one `<Svg>` and `ordered.map(...)` as sibling Views. Convert these two `.map` callbacks into named local functions declared just before the `return (`:

```tsx
  const renderEdge = (e: (typeof edges)[number], i: number) => {
    // (paste the exact existing edges.map callback body here, unchanged —
    //  the block that returns the <Fragment key={i}> with the glow/core/flow lines,
    //  including the `if (!kinds[e.kind]) return null;` guard and the
    //  `const ez = …; const edgeOpacity = …;` lines added in Task 2)
  };

  const renderNode = (n: (typeof nodes)[number]) => {
    // (paste the exact existing ordered.map callback body here, unchanged —
    //  the block that returns the <View key={n.id}> node wrapper)
  };
```

Leave the two callback bodies exactly as they are; you are only lifting them out of JSX so they can be reused per band. The functions close over the same variables (`at`, `entrance`, `focusId`, `kinds`, `dashProps`, `flow`, `zOf`, etc.), so no parameters change beyond `e, i` / `n`.

- [ ] **Step 2: Add the band model + clock + settle + per-band styles**

Add near the top of the module (after the `KIND_COLOR` / `reducedMotion` consts), the band definitions:

```tsx
const TAU = Math.PI * 2;
// z → band index: 0 far, 1 mid, 2 near. Amplitudes rise with nearness so the
// bands parallax against each other. Far barely moves; near floats most.
const bandOf = (z: number) => (z >= 0.66 ? 2 : z >= 0.33 ? 1 : 0);
const BAND_AMP = [2, 6, 11]; // far, mid, near (px)
const BAND_PHASE = [0, 2.1, 4.2];
```

Inside the component, add the two props to the destructured signature (with defaults) — `interacting = false` and `onInteract`:

```tsx
  interacting = false,
  onInteract,
```

and to the prop type block:

```tsx
  /** While true, ambient drift eases to a stop (settle-on-touch). */
  interacting?: boolean;
  /** Fired on node hover/press-in so the host can trigger settle. */
  onInteract?: () => void;
```

Then add the clock, settle value, and three band styles alongside the existing `pulse`/`dash` shared values:

```tsx
  const still = reducedMotion();
  const clock = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    clock.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false);
  }, [still, clock]);

  // 1 = full drift, 0 = settled. Eases down fast on touch, back up gently.
  const settle = useSharedValue(1);
  useEffect(() => {
    settle.value = withTiming(interacting ? 0 : 1, {
      duration: interacting ? 180 : 700,
      easing: Easing.out(Easing.quad),
    });
  }, [interacting, settle]);

  // Three band transforms (integer-harmonic sin/cos → seamless loop at the wrap).
  const farStyle = useAnimatedStyle(() => {
    const a = clock.value * TAU + BAND_PHASE[0];
    const s = settle.value;
    return { transform: [{ translateX: Math.sin(a) * BAND_AMP[0] * s }, { translateY: Math.cos(a) * BAND_AMP[0] * 0.75 * s }] };
  });
  const midStyle = useAnimatedStyle(() => {
    const a = clock.value * TAU + BAND_PHASE[1];
    const s = settle.value;
    return { transform: [{ translateX: Math.sin(a) * BAND_AMP[1] * s }, { translateY: Math.cos(a) * BAND_AMP[1] * 0.75 * s }] };
  });
  const nearStyle = useAnimatedStyle(() => {
    const a = clock.value * TAU + BAND_PHASE[2];
    const s = settle.value;
    return { transform: [{ translateX: Math.sin(a) * BAND_AMP[2] * s }, { translateY: Math.cos(a) * BAND_AMP[2] * 0.75 * s }] };
  });
  const bandStyles = [farStyle, midStyle, nearStyle];
```

- [ ] **Step 3: Fire `onInteract` from node hover/press**

In `renderNode`, on the node `<Pressable>`, add `onPressIn` and augment `onHoverIn` so touching/hovering a node pokes settle:

```tsx
              onPressIn={() => onInteract?.()}
              onHoverIn={() => {
                onInteract?.();
                setHoveredId(n.id);
              }}
```

(Replace the existing `onHoverIn={() => setHoveredId(n.id)}` with the block above; leave `onHoverOut` as-is.)

- [ ] **Step 4: Rebuild the return as 3 drifting bands**

Replace the component's `return ( … )` with a banded composition. Each band is an `Animated.View` overlay holding its own edge `<Svg>` and its nodes; bands paint far → near:

```tsx
  return (
    <View style={{ width: size, height: size }}>
      {[0, 1, 2].map((band) => {
        const bandEdges = edges.filter((e) => bandOf(Math.max(zOf(e.from), zOf(e.to))) === band);
        const bandNodes = ordered.filter((n) => bandOf(n.is_subject ? 1 : zOf(n.id)) === band);
        return (
          <Animated.View
            key={band}
            style={[StyleSheet.absoluteFill, bandStyles[band]] as object}
            pointerEvents="box-none"
          >
            <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
              {bandEdges.map((e) => renderEdge(e, edges.indexOf(e)))}
            </Svg>
            {bandNodes.map(renderNode)}
          </Animated.View>
        );
      })}
    </View>
  );
```

Note: `renderEdge` still keys on the original edge index (`edges.indexOf(e)`) so keys stay stable across bands.

- [ ] **Step 5: Wire `interacting` in `SocialWebCanvas`**

In `src/components/character/SocialWebCanvas.tsx`, add `runOnJS` to the reanimated import:

```tsx
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
```

Add interaction state + poke helpers inside the component (after the `vp` state):

```tsx
  const [interacting, setInteracting] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  };
  const beginInteract = useCallback(() => {
    clearIdle();
    setInteracting(true);
  }, []);
  const endInteractSoon = useCallback(() => {
    clearIdle();
    idleTimer.current = setTimeout(() => setInteracting(false), 500);
  }, []);
  const nudge = useCallback(() => {
    beginInteract();
    endInteractSoon();
  }, [beginInteract, endInteractSoon]);
  useEffect(() => () => clearIdle(), []);
```

Add `useRef` to the React import at the top of the file (it currently imports `useCallback, useEffect, useState`):

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
```

- [ ] **Step 6: Poke settle from the gestures + wheel, and pass it down**

In `SocialWebCanvas`, add begin/finalize pokes to the pan and pinch gestures. Update the `pan` gesture's `.onBegin` and add `.onFinalize`:

```tsx
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
      runOnJS(beginInteract)();
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    })
    .onFinalize(() => {
      runOnJS(endInteractSoon)();
    });
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
      runOnJS(beginInteract)();
    })
    .onUpdate((e) => {
      scale.value = Math.min(2.5, Math.max(0.5, startScale.value * e.scale));
    })
    .onFinalize(() => {
      runOnJS(endInteractSoon)();
    });
```

In the `onWheel` handler, add `nudge()` after adjusting scale:

```tsx
      ? (e: { deltaY: number; preventDefault?: () => void }) => {
          e.preventDefault?.();
          const next = scale.value * (e.deltaY > 0 ? 0.92 : 1.08);
          scale.value = Math.min(2.5, Math.max(0.5, next));
          nudge();
        }
```

Finally, pass the two new props into the `<SocialWebGraph>` element:

```tsx
          <SocialWebGraph
            neighborhood={neighborhood}
            subjectId={subjectId}
            accent={accent}
            size={GRAPH}
            focusId={focusId}
            sharedIds={sharedIds}
            activeKinds={activeKinds}
            interacting={interacting}
            onInteract={nudge}
            onNodePress={(id) => onFocusChange(focusId === id ? null : id)}
            onNodeLongPress={(id) => onRecenter(id)}
          />
```

- [ ] **Step 7: Typecheck, tests, lint, format**

Run: `yarn typecheck && yarn test:ci && yarn lint && yarn format`
Expected: typecheck clean; tests pass; lint clean (watch for `react-hooks/exhaustive-deps` on the new effects — the shown dep arrays are complete); prettier no-ops.

- [ ] **Step 8: Manual verification (device screenshots)**

Ask the user to check, on device:
1. **Explorer at rest:** orbs float gently, near ones visibly drifting more than far ones (parallax depth).
2. **On touch:** starting a pan/pinch or tapping a node makes the drift settle to still — tap targets hold while aiming — then resume after release.
3. **Preview** (`/character/<id>`): still reads clean; the 6-node portal has subtle life and depth, nothing clipped.
4. **Reduced motion** (OS setting on): depth intact, zero drift.
Do not proceed until the user confirms.

- [ ] **Step 9: Commit**

```bash
git add src/components/character/SocialWebGraph.tsx src/components/character/SocialWebCanvas.tsx
git commit -m "feat(social-web): 3-band parallax drift with settle-on-touch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Depth `z` in `layoutNeighborhood`, encode-closeness, subject nearest, `[0.15,0.9]` spread, deterministic → **Task 1**. ✅
- Fame passed as `weight`; canvas's separate layout call reads only `x/y` (unaffected) → **Task 1 interface + Task 2 Step 1**. ✅
- Size = base·depthScale·nodeScale (0.62–1.12); far opacity floor 0.55; occlusion via z-sort; edges mean-z → **Task 2**. ✅
- 3-band parallax drift; edges glued per band; small/slow amplitudes; settle-on-touch; reduced-motion off → **Task 3**. ✅
- Accessibility: tap floor 28px (interactive only); opacity floor; name/focus/hover full strength; no behavior regressions → **Task 2 Steps 5–6, Task 3**. ✅
- forceLayout unit tests (determinism, range, subject nearest, centrality monotonic, x/y invariant) → **Task 1**. ✅
- Visual verification via device screenshots → **Task 2 Step 8, Task 3 Step 8**. ✅

**Placeholder scan:** The only "paste the existing body here" directions are in Task 3 Step 1 (a pure lift-and-shift of already-existing, already-shown code out of JSX into a named function) — the code exists verbatim in the file and in Task 2's edits; reproducing it inline would be error-prone duplication, so the instruction points at the exact block instead. No `TODO`/`TBD`/vague-error placeholders.

**Type consistency:** `z` typed `number` throughout; `weight?: number`; return `Map<string, { x: number; y: number; z: number }>` consistent across Task 1 signature, Task 2 consumption, Task 3 `zOf`. `interacting?: boolean` / `onInteract?: () => void` named identically in the graph props, the canvas pass-down, and the settle effect. `nudge` / `beginInteract` / `endInteractSoon` names consistent between definition (Task 3 Step 5) and use (Step 6). ✅
