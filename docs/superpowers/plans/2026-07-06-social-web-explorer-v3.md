# Social Web Explorer v3 — Enrichments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the explorer legible and alive — node names, a focus detail card, starfield + living edges + hover lift, legend filters, and search with shared-connection highlighting.

**Architecture:** Focus state lifts from `SocialWebCanvas` up to the screens (so the focus card and search can drive it); the canvas keeps owning the camera transform and gains a `centerOnId` signal. `SocialWebGraph` gains name chips, an `activeKinds` filter, a shared-connection tier, living subject-edge animation, and hover lift. Two new shared components: `SocialWebFocusCard` and `SocialWebSearch`.

**Tech Stack:** React Native Web, react-native-gesture-handler 2.31, react-native-reanimated 4.3, react-native-svg 15.15, jest-expo.

**Spec:** `docs/superpowers/specs/2026-07-06-social-web-explorer-v3-enrichments-design.md`

## Global Constraints

- yarn only; `yarn tsc --noEmit` + `yarn test:ci` green before each commit; `npx prettier --write` touched files (pre-push checks format; `--no-verify` only if the hook fails on unrelated parallel work — CI re-gates).
- Reuse v2 data/renderer/canvas. Shared components (`character/`) stay RN-safe: svg + gesture-handler + reanimated; hover + `wheel` are `Platform.OS === 'web'`-guarded.
- Two loops max: the v2 subject pulse + the v3 subject-edge energy flow; both reduced-motion gated. Nothing else loops.
- Never Flame-Bold; `INK_TEXT` tokens on ink; `StyleSheet.create`.
- Commit to `main` after each task; push at the end.

## File map

| File | Responsibility |
| --- | --- |
| `src/components/character/socialWebFocus.ts` | + `sharedWithSubject`, `nodeDegree` (pure, tested) |
| `src/components/character/SocialWebGraph.tsx` | name chips, `activeKinds` filter, shared tier, living edges, hover lift; remove Open chip; controlled `focusId` |
| `src/components/character/SocialWebCanvas.tsx` | controlled `focusId` + `onFocusChange`; `centerOnId` signal; starfield behind graph; `activeKinds` passthrough |
| `src/components/character/SocialWebFocusCard.tsx` | NEW — focus detail card |
| `src/components/character/SocialWebSearch.tsx` | NEW — search field + results |
| `app/social-web/[id].web.tsx` / `[id].tsx` | own `focusId`/`activeKinds`/search; interactive legend; render card + search |

---

### Task 1: Node name chips

**Files:**
- Modify: `src/components/character/SocialWebGraph.tsx`

**Interfaces:**
- Produces: `SocialWebGraph` shows a name chip under a node when it's the subject, the focused node, or (web) hovered.

- [ ] **Step 1: Add hover state + name chips**

Use one source of truth for hover: `const [hoveredId, setHoveredId] = useState<string | null>(null)` at the top of `SocialWebGraph`. The node `Pressable` gets `onHoverIn`/`onHoverOut` (RN Pressable fires these on web; no-op native) and derives its lift-scale from `hoveredId`:

```tsx
const hovered = hoveredId === n.id;
// …
<Pressable
  onPress={() => onNodePress?.(n.id)}
  onLongPress={() => onNodeLongPress?.(n.id)}
  onHoverIn={() => setHoveredId(n.id)}
  onHoverOut={() => setHoveredId((c) => (c === n.id ? null : c))}
  style={
    [
      styles.node,
      {
        width: d,
        height: d,
        borderRadius: d / 2,
        borderColor: ring,
        borderWidth: n.is_subject ? 3 : 2,
        transform: [{ scale: hovered ? 1.08 : 1 }],
        transition: 'transform 160ms ease',
      },
    ] as object
  }
>
  {/* existing HeroImage / mono content unchanged */}
</Pressable>
```

The chip is a sibling inside `nodeWrap`, shown when `n.is_subject || isFocused || hovered`:

```tsx
{n.is_subject || isFocused || hovered ? <NameChip name={n.name} /> : null}
```

with a small helper at the bottom of the file:

```tsx
function NameChip({ name }: { name: string }) {
  return (
    <View style={styles.nameChip} pointerEvents="none">
      <Text style={styles.nameChipText} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}
```

Styles:

```ts
nameChip: {
  position: 'absolute',
  bottom: -20,
  alignSelf: 'center',
  maxWidth: 120,
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 999,
  backgroundColor: 'rgba(11,24,32,0.9)',
},
nameChipText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 10, color: INK_TEXT.primary },
```

Add `onHoverIn`/`onHoverOut` to the node Pressable and place `{showChip ? <NameChip name={n.name} /> : null}` inside the `nodeWrap` View (after the Pressable). `showChip = n.is_subject || isFocused || hoveredId === n.id`.

- [ ] **Step 2: Typecheck** — `yarn tsc --noEmit` clean; `yarn test:ci` green.

- [ ] **Step 3: Commit**

```bash
git add src/components/character/SocialWebGraph.tsx
git commit -m "feat(social-web): node name chips (subject/focused always, hover on web)"
```

---

### Task 2: Shared-connection + degree logic

**Files:**
- Modify: `src/components/character/socialWebFocus.ts`
- Modify: `__tests__/components/socialWebFocus.test.ts`

**Interfaces:**
- Produces: `nodeDegree(edges, nodeId): number` (count of incident edges); `sharedWithSubject(edges, subjectId, focusId): Set<string>` (nodes adjacent to BOTH subject and focus, excluding the two themselves).

- [ ] **Step 1: Add failing tests**

Append to `__tests__/components/socialWebFocus.test.ts`:

```ts
import { nodeDegree, sharedWithSubject } from '../../src/components/character/socialWebFocus';

describe('nodeDegree', () => {
  it('counts incident edges in either direction', () => {
    expect(nodeDegree(edges, 'S')).toBe(2);
    expect(nodeDegree(edges, 'A')).toBe(2);
    expect(nodeDegree(edges, 'C')).toBe(1);
  });
});

describe('sharedWithSubject', () => {
  const e2 = [
    { from: 'S', to: 'A' },
    { from: 'S', to: 'X' },
    { from: 'F', to: 'A' }, // A is shared: adjacent to both S and F
    { from: 'F', to: 'Y' },
  ];
  it('returns nodes adjacent to both subject and focus', () => {
    expect(sharedWithSubject(e2, 'S', 'F')).toEqual(new Set(['A']));
  });
  it('is empty when focus is the subject', () => {
    expect(sharedWithSubject(e2, 'S', 'S')).toEqual(new Set());
  });
});
```

(The existing `edges` fixture — `S-A`, `S-B`, `A-C` — gives degrees S:2, A:2, C:1.)

- [ ] **Step 2: Run** — FAIL (functions not defined).

- [ ] **Step 3: Implement** (append to `socialWebFocus.ts`)

```ts
/** Number of edges incident to a node. */
export function nodeDegree(edges: { from: string; to: string }[], nodeId: string): number {
  let n = 0;
  for (const e of edges) if (e.from === nodeId || e.to === nodeId) n++;
  return n;
}

/** Nodes adjacent to BOTH the subject and the focus (the "who they both know"),
 *  excluding the subject and focus themselves. */
export function sharedWithSubject(
  edges: { from: string; to: string }[],
  subjectId: string,
  focusId: string,
): Set<string> {
  if (focusId === subjectId) return new Set();
  const nb = (id: string) => {
    const s = new Set<string>();
    for (const e of edges) {
      if (e.from === id) s.add(e.to);
      if (e.to === id) s.add(e.from);
    }
    return s;
  };
  const subj = nb(subjectId);
  const foc = nb(focusId);
  const out = new Set<string>();
  for (const id of foc) if (subj.has(id) && id !== subjectId && id !== focusId) out.add(id);
  return out;
}
```

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/character/socialWebFocus.ts __tests__/components/socialWebFocus.test.ts
git commit -m "feat(social-web): nodeDegree + sharedWithSubject helpers"
```

---

### Task 3: Lift focus + focus card + shared tier

**Files:**
- Create: `src/components/character/SocialWebFocusCard.tsx`
- Modify: `src/components/character/SocialWebCanvas.tsx` (controlled focus)
- Modify: `src/components/character/SocialWebGraph.tsx` (shared tier; remove Open chip)
- Modify: `app/social-web/[id].web.tsx`, `app/social-web/[id].tsx` (own focus + render card)

**Interfaces:**
- Consumes: `sharedWithSubject`, `nodeDegree`, `subjectKind` (existing).
- Produces:
  - `SocialWebCanvas` props change: add `focusId: string | null`, `onFocusChange: (id: string | null) => void`; **remove** internal focus state and `onNavigate` (navigation moves to the card). Keep `onRecenter`.
  - `SocialWebGraph` props: add `sharedIds?: Set<string>`; remove `onNodeOpen` and the Open chip. Shared nodes get a brighter ring.
  - `SocialWebFocusCard` props: `{ node: NeighborNode; subjectName: string; kind: 'enemy'|'ally'|'teammate'|null; degree: number; accent: string; onView: () => void; onClose: () => void }`.

- [ ] **Step 1: Build the focus card**

```tsx
// src/components/character/SocialWebFocusCard.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import type { NeighborNode } from '../../lib/db/heroes/neighborhood';

const KIND_LABEL: Record<string, string> = { enemy: 'Enemy', ally: 'Ally', teammate: 'Teammate' };
const KIND_COLOR: Record<string, string> = { enemy: COLORS.red, ally: COLORS.green, teammate: COLORS.blue };

function alignmentLabel(a: string | null): { label: string; color: string } | null {
  const v = (a ?? '').toLowerCase();
  if (v === 'good') return { label: 'Hero', color: COLORS.blue };
  if (v === 'bad') return { label: 'Villain', color: COLORS.red };
  if (v === 'neutral') return { label: 'Anti-Hero', color: COLORS.orange };
  return null;
}

export function SocialWebFocusCard({
  node,
  subjectName,
  kind,
  degree,
  accent,
  onView,
  onClose,
}: {
  node: NeighborNode;
  subjectName: string;
  kind: 'enemy' | 'ally' | 'teammate' | null;
  degree: number;
  accent: string;
  onView: () => void;
  onClose: () => void;
}) {
  const align = alignmentLabel(node.alignment);
  return (
    <View style={styles.card}>
      <View style={styles.portrait}>
        <HeroImage
          id={node.id}
          name={node.name}
          imageUrl={node.image_url}
          portraitUrl={node.portrait_url}
          imageMdUrl={node.image_md_url}
          grid
          contentFit="cover"
          contentPosition={{ top: '-15%', left: '50%' }}
          style={StyleSheet.absoluteFill}
          recyclingKey={node.id}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {node.name}
        </Text>
        <View style={styles.meta}>
          {align ? (
            <View style={[styles.badge, { borderColor: align.color + '80' }] as object}>
              <Text style={[styles.badgeText, { color: align.color }] as object}>{align.label}</Text>
            </View>
          ) : null}
          {kind ? (
            <Text style={[styles.kind, { color: KIND_COLOR[kind] }] as object}>
              {KIND_LABEL[kind]} of {subjectName}
            </Text>
          ) : null}
        </View>
        <Text style={styles.degree}>
          {degree > 0 ? `${degree} connection${degree === 1 ? '' : 's'} in this web` : 'No other links here'}
        </Text>
        <Pressable onPress={onView} style={[styles.view, { backgroundColor: accent + '22', borderColor: accent + '55' }] as object}>
          <Text style={[styles.viewText, { color: accent }] as object}>View dossier</Text>
          <Ionicons name="chevron-forward" size={13} color={accent} />
        </Pressable>
      </View>
      <Pressable onPress={onClose} style={styles.close} hitSlop={8}>
        <Ionicons name="close" size={16} color={INK_TEXT.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    bottom: 56,
    width: 300,
    maxWidth: '90%',
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(11,24,32,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
  } as object,
  portrait: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.navy } as object,
  body: { flex: 1, gap: 4 },
  name: { fontFamily: 'Flame-Regular', fontSize: 18, lineHeight: 22, color: INK_TEXT.primary } as object,
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  badgeText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  kind: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  degree: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: INK_TEXT.muted },
  view: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', marginTop: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  viewText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },
  close: { position: 'absolute', top: 8, right: 8, padding: 2 },
});
```

- [ ] **Step 2: Make the canvas controlled**

In `SocialWebCanvas`: remove `const [focusId, setFocusId] = useState`; add props `focusId: string | null; onFocusChange: (id: string | null) => void;` and remove `onNavigate`. Node handlers become:

```tsx
onNodePress={(id) => onFocusChange(focusId === id ? null : id)}
onNodeLongPress={(id) => onRecenter(id)}
```

Remove the `onNodeOpen` prop passed to `SocialWebGraph`. In the re-fit `useEffect`, drop `setFocusId(null)` (the screen clears focus on recenter). Add `activeKinds`/`sharedIds`/`centerOnId` passthrough later (Tasks 4–6) — for now just thread `focusId`.

- [ ] **Step 3: Renderer — shared tier, remove Open chip**

In `SocialWebGraph`: add prop `sharedIds?: Set<string>` (default empty). Remove the `onNodeOpen` prop and the entire Open-chip `Pressable` block. For a node in `sharedIds`, brighten its ring (e.g. use a lighter mix or add a second thin ring): set `borderWidth` +1 and `borderColor: ring` but add an inner glow — simplest: when `sharedIds.has(n.id)`, bump the halo alpha to `'55'` and ring width to 3. Compute `const shared = sharedIds?.has(n.id) ?? false;` and fold into the halo/ring styles.

- [ ] **Step 4: Wire the screens**

In `app/social-web/[id].web.tsx` (and mirror in `[id].tsx`): add `const [focusId, setFocusId] = useState<string | null>(null);`. Compute, when `data` + `focusId`:

```tsx
const focusNode = data?.nodes.find((n) => n.id === focusId) ?? null;
const focusKind = focusNode ? subjectKind(data!.edges, focusSubject, focusId!) : null;
const focusDegree = focusNode ? nodeDegree(data!.edges, focusId!) : 0;
const sharedIds = useMemo(
  () => (focusId && data ? sharedWithSubject(data.edges, focusSubject, focusId) : new Set<string>()),
  [focusId, data, focusSubject],
);
```

Pass `focusId`, `onFocusChange={setFocusId}` to `SocialWebCanvas` (and later `sharedIds`). Clear focus on recenter: `onRecenter={(nodeId) => { setFocusSubject(nodeId); setFocusId(null); }}`. Render the card:

```tsx
{focusNode && !focusNode.is_subject ? (
  <SocialWebFocusCard
    node={focusNode}
    subjectName={data?.nodes.find((n) => n.is_subject)?.name ?? ''}
    kind={focusKind}
    degree={focusDegree}
    accent={theme.accent}
    onView={() => router.push(`/character/${focusNode.id}` as Parameters<typeof router.push>[0])}
    onClose={() => setFocusId(null)}
  />
) : null}
```

Import `subjectKind`, `nodeDegree`, `sharedWithSubject`, `SocialWebFocusCard`, `useMemo`.

- [ ] **Step 5: Typecheck + tests + prettier + commit**

```bash
yarn tsc --noEmit && yarn test:ci
npx prettier --write src/components/character/SocialWebFocusCard.tsx src/components/character/SocialWebCanvas.tsx src/components/character/SocialWebGraph.tsx "app/social-web/[id].web.tsx" "app/social-web/[id].tsx"
git add src/components/character/SocialWebFocusCard.tsx src/components/character/SocialWebCanvas.tsx src/components/character/SocialWebGraph.tsx "app/social-web/[id].web.tsx" "app/social-web/[id].tsx"
git commit -m "feat(social-web): focus detail card + shared-connection tier (lift focus state)"
```

---

### Task 4: Atmosphere — starfield, living edges, hover lift

**Files:**
- Modify: `src/components/character/SocialWebCanvas.tsx` (starfield)
- Modify: `src/components/character/SocialWebGraph.tsx` (living edges; hover lift already added in Task 1)

- [ ] **Step 1: Starfield behind the graph (canvas)**

In `SocialWebCanvas`, render a fixed SVG starfield in the viewport (not inside the transformed `Animated.View`), before the `GestureDetector`:

```tsx
{vp.w > 0 ? (
  <Svg width={vp.w} height={vp.h} style={StyleSheet.absoluteFill} pointerEvents="none">
    <Defs>
      <Pattern id="stars" x={0} y={0} width={38} height={38} patternUnits="userSpaceOnUse">
        <Circle cx={2} cy={2} r={1} fill="rgba(245,235,220,0.10)" />
        <Circle cx={22} cy={14} r={0.7} fill="rgba(245,235,220,0.07)" />
        <Circle cx={12} cy={28} r={0.9} fill="rgba(245,235,220,0.08)" />
      </Pattern>
    </Defs>
    <Rect x={0} y={0} width={vp.w} height={vp.h} fill="url(#stars)" />
  </Svg>
) : null}
```

Import `Svg, { Defs, Pattern, Circle, Rect }` from `react-native-svg`.

- [ ] **Step 2: Living subject edges (renderer)**

In `SocialWebGraph`, add an animated dashed overlay on subject-incident edges. Add a reanimated shared value `dash` looping `0 → 12` (reduced-motion → static), and an `AnimatedLine = Animated.createAnimatedComponent(Line)` with `animatedProps` setting `strokeDashoffset`. Render one animated dashed line per subject-incident edge, over the existing edge, tinted with the kind color at moderate alpha, `strokeDasharray="2 8"`. Guard with `reducedMotion()`. Keep it subtle (thin, low alpha) so it reads as energy, not noise.

```tsx
// near the pulse setup
const dash = useSharedValue(0);
useEffect(() => {
  if (reducedMotion()) return;
  dash.value = withRepeat(withTiming(-10, { duration: 900, easing: Easing.linear }), -1, false);
}, [dash]);
const dashProps = useAnimatedProps(() => ({ strokeDashoffset: dash.value }));
const AnimatedLine = useMemo(() => Animated.createAnimatedComponent(Line), []);
```

In the edge map, for `incident && isEdgeLit(e, focusId) && !reducedMotion()`, additionally render:

```tsx
<AnimatedLine x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color + 'aa'} strokeWidth={1.4} strokeDasharray="2 8" animatedProps={dashProps} opacity={entrance} />
```

(Add `useAnimatedProps` to the reanimated import.)

- [ ] **Step 3: Typecheck + tests + prettier + commit**

```bash
yarn tsc --noEmit && yarn test:ci
npx prettier --write src/components/character/SocialWebCanvas.tsx src/components/character/SocialWebGraph.tsx
git add src/components/character/SocialWebCanvas.tsx src/components/character/SocialWebGraph.tsx
git commit -m "feat(social-web): starfield backdrop + living subject edges"
```

---

### Task 5: Legend filters

**Files:**
- Modify: `src/components/character/SocialWebGraph.tsx` (respect `activeKinds`)
- Modify: `src/components/character/SocialWebCanvas.tsx` (passthrough)
- Modify: `app/social-web/[id].web.tsx`, `app/social-web/[id].tsx` (state + interactive legend)

**Interfaces:**
- Produces: `activeKinds: { enemy: boolean; ally: boolean; teammate: boolean }` flows screen → canvas → graph.

- [ ] **Step 1: Renderer respects filters**

Add prop `activeKinds?: { enemy: boolean; ally: boolean; teammate: boolean }` (default all true) to `SocialWebGraph`. In the edge map, skip rendering an edge whose `e.kind` is inactive. In the node map, compute the node's subject-relationship kind; if that kind is inactive (and not the subject), treat the node as filtered: opacity `0.15 * entrance`, `pointerEvents="none"`. A subject-incident kind check: `const nodeKind = n.is_subject ? null : subjectKind(edges, subjectId, n.id); const filtered = nodeKind ? !activeKinds[nodeKind] : false;` (nodes with no subject edge stay visible).

- [ ] **Step 2: Canvas passthrough**

Add `activeKinds` prop to `SocialWebCanvas`, forward to `SocialWebGraph`.

- [ ] **Step 3: Interactive legend (screens)**

In each screen add `const [activeKinds, setActiveKinds] = useState({ enemy: true, ally: true, teammate: true });`. Make each `Legend` chip a `Pressable` that toggles its kind; render muted when off. Update the `Legend` component to accept `active` + `onToggle`:

```tsx
function Legend({ color, label, active, onToggle }: { color: string; label: string; active: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: active ? color : 'transparent', borderWidth: active ? 0 : 1, borderColor: color }]} />
      <Text style={[styles.legendText, !active && { opacity: 0.4 }]}>{label}</Text>
    </Pressable>
  );
}
```

Wire: `<Legend color={COLORS.red} label="Enemy" active={activeKinds.enemy} onToggle={() => setActiveKinds((k) => ({ ...k, enemy: !k.enemy }))} />` (and ally/teammate). Pass `activeKinds` to `SocialWebCanvas`. If all three are off, the graph shows just the subject — acceptable; optionally show the hint "All relationships hidden" when `!activeKinds.enemy && !activeKinds.ally && !activeKinds.teammate`.

- [ ] **Step 4: Typecheck + tests + prettier + commit**

```bash
yarn tsc --noEmit && yarn test:ci
npx prettier --write src/components/character/SocialWebGraph.tsx src/components/character/SocialWebCanvas.tsx "app/social-web/[id].web.tsx" "app/social-web/[id].tsx"
git add src/components/character/SocialWebGraph.tsx src/components/character/SocialWebCanvas.tsx "app/social-web/[id].web.tsx" "app/social-web/[id].tsx"
git commit -m "feat(social-web): interactive legend filters by relationship kind"
```

---

### Task 6: Search + center-on

**Files:**
- Create: `src/components/character/SocialWebSearch.tsx`
- Modify: `src/components/character/SocialWebCanvas.tsx` (`centerOnId` signal)
- Modify: `app/social-web/[id].web.tsx`, `app/social-web/[id].tsx` (render search)

**Interfaces:**
- Produces: `SocialWebSearch` props `{ nodes: NeighborNode[]; onPick: (id: string) => void }`. `SocialWebCanvas` gains `centerOnId?: string | null` (animate the camera to that node, then the screen resets it).

- [ ] **Step 1: Build the search component**

```tsx
// src/components/character/SocialWebSearch.tsx
import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import type { NeighborNode } from '../../lib/db/heroes/neighborhood';

export function SocialWebSearch({ nodes, onPick }: { nodes: NeighborNode[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const results = q.trim()
    ? nodes.filter((n) => n.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];
  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Ionicons name="search" size={15} color={INK_TEXT.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Find in this web…"
          placeholderTextColor={INK_TEXT.faint}
          style={styles.input}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={8}>
            <Ionicons name="close" size={15} color={INK_TEXT.muted} />
          </Pressable>
        ) : null}
      </View>
      {q.trim() ? (
        <View style={styles.results}>
          {results.length === 0 ? (
            <Text style={styles.empty}>No one by that name here.</Text>
          ) : (
            results.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => {
                  onPick(n.id);
                  setQ('');
                }}
                style={styles.row}
              >
                <View style={styles.thumb}>
                  <HeroImage id={n.id} name={n.name} imageUrl={n.image_url} portraitUrl={n.portrait_url} imageMdUrl={n.image_md_url} grid contentFit="cover" contentPosition={{ top: '-15%', left: '50%' }} style={StyleSheet.absoluteFill} recyclingKey={n.id} />
                </View>
                <Text style={styles.rowName} numberOfLines={1}>
                  {n.name}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 240, maxWidth: '70%' } as object,
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 38, borderRadius: 999, backgroundColor: 'rgba(245,235,220,0.10)', borderWidth: 1, borderColor: 'rgba(245,235,220,0.18)' },
  input: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: INK_TEXT.primary, outlineStyle: 'none' } as object,
  results: { marginTop: 6, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(11,24,32,0.95)', borderWidth: 1, borderColor: 'rgba(245,235,220,0.14)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 7 },
  thumb: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.navy } as object,
  rowName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: INK_TEXT.primary },
  empty: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: INK_TEXT.faint, padding: 12 },
});
```

(`outlineStyle: 'none'` is a harmless web-only style; native ignores it.)

- [ ] **Step 2: Canvas centers on a node**

Add `centerOnId?: string | null` to `SocialWebCanvas`. The canvas recomputes the layout to find the node's normalized position (it already has `neighborhood`); on `centerOnId` change, animate the camera so that node centers:

```tsx
import { layoutNeighborhood } from '../../lib/graph/forceLayout';
import { withTiming } from 'react-native-reanimated';
// …
useEffect(() => {
  if (!centerOnId || vp.w === 0) return;
  const pos = layoutNeighborhood(
    neighborhood.nodes.map((n) => ({ id: n.id, isSubject: n.is_subject })),
    neighborhood.edges,
  ).get(centerOnId);
  if (!pos) return;
  const R = 720 / 2 - 48; // matches SocialWebGraph R
  const nx = 720 / 2 + pos.x * R;
  const ny = 720 / 2 + pos.y * R;
  const s = scale.value;
  tx.value = withTiming(vp.w / 2 - nx * s);
  ty.value = withTiming(vp.h / 2 - ny * s);
}, [centerOnId, vp.w, vp.h, neighborhood, scale, tx, ty]);
```

(Add `withTiming` to the reanimated import.) Note the camera transform is `translate then scale`, so centering a scaled point uses `vp/2 − n*scale`.

- [ ] **Step 3: Wire search into screens**

Render `<SocialWebSearch nodes={data.nodes} onPick={(pid) => { setFocusId(pid); setCenterOnId(pid); }} />` in the header (web) / below the header (native), with `const [centerOnId, setCenterOnId] = useState<string | null>(null);` passed to `SocialWebCanvas`. Reset after a tick so re-picking the same id re-fires: in the canvas effect, that's fine since the value changes; to allow re-centering the same id, set `centerOnId` to a fresh object or append a nonce — simplest: `onPick` sets `setCenterOnId(pid)` and a `useEffect` in the screen clears it to `null` on a short timeout. Keep it minimal: clearing isn't required for correctness (picking a different node re-fires); re-picking the same node is an edge case — accept it.

- [ ] **Step 4: Typecheck + tests + prettier + commit**

```bash
yarn tsc --noEmit && yarn test:ci
npx prettier --write src/components/character/SocialWebSearch.tsx src/components/character/SocialWebCanvas.tsx "app/social-web/[id].web.tsx" "app/social-web/[id].tsx"
git add src/components/character/SocialWebSearch.tsx src/components/character/SocialWebCanvas.tsx "app/social-web/[id].web.tsx" "app/social-web/[id].tsx"
git commit -m "feat(social-web): search + center-on-select"
```

---

### Task 7: Verify + push

- [ ] **Step 1:** `yarn test:ci && yarn tsc --noEmit && yarn lint` (errors-only) → green (ignore pre-existing unrelated errors; confirm none in the new social-web files).
- [ ] **Step 2:** `npx prettier --write` all new/touched files; commit leftovers.
- [ ] **Step 3:** Push (`git push`; `--no-verify` if the hook fails only on unrelated parallel work).
- [ ] **Step 4:** Hand off for screenshots (desktop + iOS Safari + native) on `/social-web/643`: names show on hover/focus; focusing a node shows the detail card + shared-connection rings; starfield + edge energy visible; legend chips toggle relationship types; search finds and centers a hero. Iterate on card placement/density.
