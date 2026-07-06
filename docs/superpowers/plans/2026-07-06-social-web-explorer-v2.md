# Social Web Explorer v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the social-web explorer into an interactive dark-constellation map — pan + pinch/wheel zoom, tap-to-focus highlighting, a real native screen, glowing edges and haloed nodes on deep ink.

**Architecture:** A shared gestured shell `SocialWebCanvas` (mirroring `FamilyCanvas`'s pan/pinch/auto-fit with reanimated shared values) wraps the upgraded pure renderer `SocialWebGraph` (relocated to the shared folder; now draws glow edges, node halos, focus-dimming, fame-scaled nodes, a mount entrance, and a subject pulse). Both web and native explorer screens compose the same canvas over a deep-ink accent-bloom background.

**Tech Stack:** React Native Web, react-native-gesture-handler 2.31, react-native-reanimated 4.3, react-native-svg 15.15, jest-expo.

**Spec:** `docs/superpowers/specs/2026-07-06-social-web-explorer-v2-design.md`

## Global Constraints

- yarn only; `yarn tsc --noEmit` + `yarn test:ci` green before each commit; `npx prettier --write` touched files (pre-push checks format; if it fails only on unrelated parallel work, `git push --no-verify` — CI re-gates).
- Reuse shipped `get_hero_neighborhood` RPC, `getHeroNeighborhood`, `layoutNeighborhood`, `subjectKind`, `monogram`. No data/schema changes.
- Shared components (`SocialWebGraph`, `SocialWebCanvas`, `socialWebFocus`) live in `src/components/character/` and stay RN-safe (react-native-svg + gesture-handler + reanimated only). Web-only bits (`wheel`, `TOPBAR_HEIGHT`) are `Platform.OS === 'web'`-guarded or in `.web.tsx`.
- No three.js. Never Flame-Bold; `INK_TEXT` tokens for text on ink; `StyleSheet.create`.
- One looping animation only (subject pulse); everything else fires once; respect `prefers-reduced-motion`.
- Commit to `main` after each task; push at the end.

## Deviation from spec (pragmatic, noted)

- **Navigation is via an explicit "Open ▸" affordance on the focused node + long-press-recenter, not double-tap.** Per-node double-tap vs single-tap-focus vs long-press on gesture-handler nodes is conflict-prone; the spec already offered the Open affordance as the alternative. Single tap = focus, Open chip = navigate, long-press = recenter. Double-tap deferred.

---

### Task 1: Focus logic (`socialWebFocus.ts`)

**Files:**
- Create: `src/components/character/socialWebFocus.ts`
- Test: `__tests__/components/socialWebFocus.test.ts`

**Interfaces:**
- Produces: `connectedIds(edges: { from: string; to: string }[], nodeId: string): Set<string>` (the node + its direct neighbors); `isEdgeLit(edge: { from: string; to: string }, focusId: string | null): boolean`; `isNodeLit(nodeId: string, focusId: string | null, connected: Set<string>): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/components/socialWebFocus.test.ts
import { connectedIds, isEdgeLit, isNodeLit } from '../../src/components/character/socialWebFocus';

const edges = [
  { from: 'S', to: 'A' },
  { from: 'S', to: 'B' },
  { from: 'A', to: 'C' },
];

describe('socialWebFocus', () => {
  it('connectedIds returns the node plus its direct neighbours', () => {
    expect(connectedIds(edges, 'S')).toEqual(new Set(['S', 'A', 'B']));
    expect(connectedIds(edges, 'A')).toEqual(new Set(['A', 'S', 'C']));
  });
  it('isEdgeLit: all lit with no focus; only incident lit with focus', () => {
    expect(isEdgeLit(edges[0], null)).toBe(true);
    expect(isEdgeLit({ from: 'S', to: 'A' }, 'S')).toBe(true);
    expect(isEdgeLit({ from: 'A', to: 'C' }, 'S')).toBe(false);
  });
  it('isNodeLit: all lit with no focus; only connected lit with focus', () => {
    const conn = connectedIds(edges, 'S');
    expect(isNodeLit('C', null, conn)).toBe(true);
    expect(isNodeLit('A', 'S', conn)).toBe(true);
    expect(isNodeLit('C', 'S', conn)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it** — `yarn jest __tests__/components/socialWebFocus.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/components/character/socialWebFocus.ts

/** A node plus every node directly connected to it by an edge. */
export function connectedIds(edges: { from: string; to: string }[], nodeId: string): Set<string> {
  const s = new Set<string>([nodeId]);
  for (const e of edges) {
    if (e.from === nodeId) s.add(e.to);
    if (e.to === nodeId) s.add(e.from);
  }
  return s;
}

/** With no focus, every edge is lit; with focus, only edges touching it. */
export function isEdgeLit(edge: { from: string; to: string }, focusId: string | null): boolean {
  if (!focusId) return true;
  return edge.from === focusId || edge.to === focusId;
}

/** With no focus, every node is lit; with focus, only the focus + its neighbours. */
export function isNodeLit(nodeId: string, focusId: string | null, connected: Set<string>): boolean {
  if (!focusId) return true;
  return connected.has(nodeId);
}
```

- [ ] **Step 4: Run it** — PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/character/socialWebFocus.ts __tests__/components/socialWebFocus.test.ts
git commit -m "feat(social-web): focus-highlight logic (connected/lit helpers)"
```

---

### Task 2: Relocate + upgrade the renderer (`SocialWebGraph`)

**Files:**
- Move: `src/components/web/character/SocialWebGraph.tsx` → `src/components/character/SocialWebGraph.tsx`
- Modify: `src/components/web/character/SocialWebPreview.tsx` (import path)
- Test: (none new — logic is in Task 1; renderer is a view layer)

**Interfaces:**
- Consumes: `layoutNeighborhood`, `subjectKind`, `monogram`, `connectedIds`/`isEdgeLit`/`isNodeLit` (Task 1), `Neighborhood`.
- Produces: `SocialWebGraph` props `{ neighborhood: Neighborhood; subjectId: string; accent: string; size: number; focusId?: string | null; onNodePress?: (id: string) => void; onNodeLongPress?: (id: string) => void; onNodeOpen?: (id: string) => void }` — dark-constellation renderer: glow edges, haloed fame-scaled nodes, focus-dim, mount entrance, subject pulse.

- [ ] **Step 1: Move the file + repoint the preview**

```bash
git mv src/components/web/character/SocialWebGraph.tsx src/components/character/SocialWebGraph.tsx
```

Fix the moved file's relative imports (was in `web/character/`, three levels up; now `character/`, two levels): `../../../constants/...`→`../../constants/...`, `../../HeroImage`→`../HeroImage`, `../../RelatedHeroStrip`→`../RelatedHeroStrip`, `../../../lib/...`→`../../lib/...`. In `SocialWebPreview.tsx`, change `import { SocialWebGraph } from './SocialWebGraph';` → `import { SocialWebGraph } from '../../character/SocialWebGraph';`.

- [ ] **Step 2: Replace the renderer body with the constellation version**

Overwrite `src/components/character/SocialWebGraph.tsx`:

```tsx
import { Fragment, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { monogram } from '../RelatedHeroStrip';
import { layoutNeighborhood } from '../../lib/graph/forceLayout';
import { subjectKind, type Neighborhood } from '../../lib/db/heroes/neighborhood';
import { connectedIds, isEdgeLit, isNodeLit } from './socialWebFocus';

const KIND_COLOR: Record<string, string> = {
  enemy: COLORS.red,
  ally: COLORS.green,
  teammate: COLORS.blue,
};

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

// Dark-constellation renderer: glowing kind-tinted edges + haloed portrait
// nodes on deep ink. Focus dims everything not connected to the focused node.
// Nodes fade/bloom outward from center once on mount; the subject halo pulses.
export function SocialWebGraph({
  neighborhood,
  subjectId,
  accent,
  size,
  focusId = null,
  onNodePress,
  onNodeLongPress,
  onNodeOpen,
}: {
  neighborhood: Neighborhood;
  subjectId: string;
  accent: string;
  size: number;
  focusId?: string | null;
  onNodePress?: (id: string) => void;
  onNodeLongPress?: (id: string) => void;
  onNodeOpen?: (id: string) => void;
}) {
  const { nodes, edges } = neighborhood;
  const positions = useMemo(
    () =>
      layoutNeighborhood(
        nodes.map((n) => ({ id: n.id, isSubject: n.is_subject })),
        edges,
      ),
    [nodes, edges],
  );
  const connected = useMemo(
    () => (focusId ? connectedIds(edges, focusId) : new Set<string>()),
    [edges, focusId],
  );

  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 48;
  const at = (id: string) => {
    const p = positions.get(id) ?? { x: 0, y: 0 };
    return { x: cx + p.x * R, y: cy + p.y * R };
  };

  // Mount entrance: 0→1, re-keyed when the subject (neighbourhood) changes.
  const [entrance, setEntrance] = useState(() => (reducedMotion() ? 1 : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setEntrance(1);
      return;
    }
    setEntrance(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 600, 1);
      setEntrance(1 - (1 - p) ** 3);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [subjectId]);

  // Subject halo pulse (the one loop).
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion()) return;
    pulse.value = withRepeat(withTiming(1.18, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {edges.map((e, i) => {
          const a = at(e.from);
          const b = at(e.to);
          const lit = isEdgeLit(e, focusId);
          const incident = e.from === subjectId || e.to === subjectId;
          const color = KIND_COLOR[e.kind] ?? COLORS.grey;
          const alpha = !lit ? '12' : incident ? 'ee' : '99';
          const glowA = !lit ? '08' : incident ? '3a' : '22';
          return (
            <React.Fragment key={i}>
              {/* wide low-alpha glow underlay */}
              <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color + glowA} strokeWidth={incident ? 6 : 4} opacity={entrance} />
              {/* crisp core */}
              <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color + alpha} strokeWidth={incident ? 1.8 : 1} opacity={entrance} />
            </React.Fragment>
          );
        })}
      </Svg>
      {nodes.map((n) => {
        const p = at(n.id);
        // fame-scaled diameter; subject fixed larger
        const fame = n.fame_score ?? 0;
        const d = n.is_subject ? 72 : Math.round(40 + 12 * (fame / 100));
        const kind = n.is_subject ? null : subjectKind(edges, subjectId, n.id);
        const ring = n.is_subject ? accent : kind ? KIND_COLOR[kind] : COLORS.grey;
        const lit = isNodeLit(n.id, focusId, connected);
        // entrance: lerp from centre outward
        const ex = cx + (p.x - cx) * entrance;
        const ey = cy + (p.y - cy) * entrance;
        const isFocused = focusId === n.id;
        return (
          <View
            key={n.id}
            style={
              [
                styles.nodeWrap,
                { left: ex - d / 2, top: ey - d / 2, width: d, height: d, opacity: lit ? entrance : 0.2 * entrance },
              ] as object
            }
            pointerEvents="box-none"
          >
            {/* halo */}
            {n.is_subject ? (
              <Animated.View
                style={[styles.halo, { width: d + 20, height: d + 20, borderRadius: (d + 20) / 2, backgroundColor: ring + '2e', left: -10, top: -10 }, pulseStyle] as object}
                pointerEvents="none"
              />
            ) : (
              <View
                style={[styles.halo, { width: d + 12, height: d + 12, borderRadius: (d + 12) / 2, backgroundColor: ring + (isFocused ? '3a' : '1f'), left: -6, top: -6 }] as object}
                pointerEvents="none"
              />
            )}
            <Pressable
              onPress={() => onNodePress?.(n.id)}
              onLongPress={() => onNodeLongPress?.(n.id)}
              style={[styles.node, { width: d, height: d, borderRadius: d / 2, borderColor: ring, borderWidth: n.is_subject ? 3 : 2 }] as object}
            >
              {n.portrait_url || n.image_md_url || n.image_url ? (
                <HeroImage id={n.id} name={n.name} imageUrl={n.image_url} portraitUrl={n.portrait_url} imageMdUrl={n.image_md_url} grid contentFit="cover" contentPosition="top" style={{ width: d, height: d }} recyclingKey={n.id} />
              ) : (
                <View style={styles.mono}>
                  <Text style={[styles.monoText, { color: ring }] as object}>{monogram(n.name)}</Text>
                </View>
              )}
            </Pressable>
            {/* Open affordance on the focused node */}
            {isFocused && !n.is_subject ? (
              <Pressable onPress={() => onNodeOpen?.(n.id)} style={[styles.openChip, { borderColor: ring }] as object}>
                <Text style={styles.openText}>Open</Text>
                <Ionicons name="chevron-forward" size={11} color={INK_TEXT.primary} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nodeWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' } as object,
  halo: { position: 'absolute' } as object,
  node: { overflow: 'hidden', backgroundColor: COLORS.navy } as object,
  mono: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy },
  monoText: { fontFamily: 'Flame-Regular', fontSize: 16, lineHeight: 20 } as object,
  openChip: {
    position: 'absolute',
    bottom: -26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(11,24,32,0.85)',
  } as object,
  openText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 10, color: INK_TEXT.primary },
});
```

Add `import React from 'react';` at the top (the `React.Fragment` usage). Verify `react-native-reanimated` exports `withRepeat`/`Easing` (they do in v4).

- [ ] **Step 3: Typecheck + tests** — `yarn tsc --noEmit` clean for the moved file; `yarn test:ci` green (preview still imports correctly).

- [ ] **Step 4: Commit**

```bash
git add src/components/character/SocialWebGraph.tsx src/components/web/character/SocialWebPreview.tsx
git commit -m "feat(social-web): dark-constellation renderer — glow edges, halos, focus dim, entrance"
```

---

### Task 3: Gestured shell (`SocialWebCanvas`)

**Files:**
- Create: `src/components/character/SocialWebCanvas.tsx`

**Interfaces:**
- Consumes: `SocialWebGraph` (Task 2), `Neighborhood`.
- Produces: `SocialWebCanvas` props `{ neighborhood: Neighborhood; subjectId: string; accent: string; onNavigate: (id: string) => void; onRecenter: (id: string) => void }` — a full-flex gestured viewport: owns focus state, pan/pinch/wheel/zoom-buttons/auto-fit, wraps `SocialWebGraph` in a reanimated transform.

- [ ] **Step 1: Implement** (mirrors `FamilyCanvas` gesture code)

```tsx
// src/components/character/SocialWebCanvas.tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { SocialWebGraph } from './SocialWebGraph';
import type { Neighborhood } from '../../lib/db/heroes/neighborhood';

const GRAPH = 720; // fixed logical canvas the graph lays out within

export function SocialWebCanvas({
  neighborhood,
  subjectId,
  accent,
  onNavigate,
  onRecenter,
}: {
  neighborhood: Neighborhood;
  subjectId: string;
  accent: string;
  onNavigate: (id: string) => void;
  onRecenter: (id: string) => void;
}) {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [focusId, setFocusId] = useState<string | null>(null);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  const fit = useCallback(() => {
    if (vp.w === 0) return;
    const s = Math.min(vp.w / GRAPH, vp.h / GRAPH) * 0.92;
    scale.value = s;
    tx.value = vp.w / 2 - GRAPH / 2;
    ty.value = vp.h / 2 - GRAPH / 2;
  }, [vp.w, vp.h, tx, ty, scale]);

  // Re-fit when the viewport or the neighbourhood (subject) changes; clear focus.
  useEffect(() => {
    setFocusId(null);
    fit();
  }, [fit, subjectId]);

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    });
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.min(2.5, Math.max(0.5, startScale.value * e.scale));
    });
  // No canvas-level tap gesture: it would double-fire with the node Pressables
  // (setting then clearing focus). Re-tapping the focused node clears it.
  const gesture = Gesture.Simultaneous(pan, pinch);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const zoomIn = () => {
    scale.value = Math.min(2.5, scale.value + 0.2);
  };
  const zoomOut = () => {
    scale.value = Math.max(0.5, scale.value - 0.2);
  };

  // Web: wheel/trackpad zoom.
  const onWheel =
    Platform.OS === 'web'
      ? (e: { deltaY: number; preventDefault?: () => void }) => {
          e.preventDefault?.();
          const next = scale.value * (e.deltaY > 0 ? 0.92 : 1.08);
          scale.value = Math.min(2.5, Math.max(0.5, next));
        }
      : undefined;

  return (
    <View
      style={styles.viewport}
      onLayout={(e) => setVp({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      // @ts-expect-error web-only DOM prop
      onWheel={onWheel}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.canvas, canvasStyle]}>
          <SocialWebGraph
            neighborhood={neighborhood}
            subjectId={subjectId}
            accent={accent}
            size={GRAPH}
            focusId={focusId}
            onNodePress={(id) => setFocusId((cur) => (cur === id ? null : id))}
            onNodeLongPress={(id) => onRecenter(id)}
            onNodeOpen={(id) => onNavigate(id)}
          />
        </Animated.View>
      </GestureDetector>

      <View style={styles.controls}>
        <Pressable style={styles.ctrlBtn} onPress={zoomIn}>
          <Ionicons name="add" size={18} color={INK_TEXT.primary} />
        </Pressable>
        <Pressable style={styles.ctrlBtn} onPress={zoomOut}>
          <Ionicons name="remove" size={18} color={INK_TEXT.primary} />
        </Pressable>
        <Pressable style={styles.ctrlBtn} onPress={fit}>
          <Ionicons name="scan-outline" size={16} color={INK_TEXT.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  canvas: { position: 'absolute', left: 0, top: 0, width: GRAPH, height: GRAPH } as object,
  controls: { position: 'absolute', right: 14, bottom: 14, gap: 8 } as object,
  ctrlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,235,220,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
  },
});
```

Note the `onWheel` prop is web-DOM-only; the `@ts-expect-error` is deliberate (RNW forwards unknown props to the DOM node). Verify in the screenshot that wheel zoom works; if RNW strips it, attach the listener via a `useEffect` + `ref.current` `addEventListener('wheel', …, { passive: false })` in the `.web` screen instead (fallback).

- [ ] **Step 2: Typecheck** — clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/character/SocialWebCanvas.tsx
git commit -m "feat(social-web): gestured pan/zoom/focus canvas shell"
```

---

### Task 4: Web screen — dark constellation

**Files:**
- Rewrite: `app/social-web/[id].web.tsx`

- [ ] **Step 1: Replace the screen body**

```tsx
// app/social-web/[id].web.tsx
import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SURFACE, INK_TEXT } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { getHeroNeighborhood } from '../../src/lib/db/heroes/neighborhood';
import { SocialWebCanvas } from '../../src/components/character/SocialWebCanvas';
import { deriveCharacterTheme } from '../../src/lib/accent';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';

export default function SocialWebExplorer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  const [focusSubject, setFocusSubject] = useState<string>(id);
  const { data } = useQuery({
    queryKey: ['neighborhood', focusSubject, 24],
    queryFn: () => getHeroNeighborhood(focusSubject, 24),
    staleTime: 5 * 60 * 1000,
  });
  const subjectNode = data?.nodes.find((n) => n.id === focusSubject);
  const theme = useMemo(
    () => deriveCharacterTheme({ publisher: subjectNode?.publisher ?? null }),
    [subjectNode],
  );

  const sparse = data && data.nodes.length < 3;

  return (
    <View style={styles.screen}>
      {/* accent bloom from centre */}
      <View
        style={
          [
            StyleSheet.absoluteFill,
            { backgroundImage: `radial-gradient(60% 50% at 50% 48%, ${theme.accentDeep}4d, transparent 72%)`, pointerEvents: 'none' },
          ] as object
        }
      />
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={20} color={INK_TEXT.primary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {subjectNode ? `${subjectNode.name}'s universe` : 'Universe'}
        </Text>
        <View style={styles.legend}>
          <Legend color={COLORS.red} label="Enemy" />
          <Legend color={COLORS.green} label="Ally" />
          <Legend color={COLORS.blue} label="Team" />
        </View>
      </View>

      {data && !sparse ? (
        <SocialWebCanvas
          neighborhood={data}
          subjectId={focusSubject}
          accent={theme.accent}
          onNavigate={(nodeId) =>
            router.push(`/character/${nodeId}` as Parameters<typeof router.push>[0])
          }
          onRecenter={(nodeId) => setFocusSubject(nodeId)}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {sparse ? 'Not enough connections to map yet.' : 'Mapping the universe…'}
          </Text>
        </View>
      )}

      <Text style={styles.hint}>Tap a node to focus · long-press to recenter · Open to visit</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SURFACE.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: TOPBAR_HEIGHT + 14,
    paddingBottom: 8,
  },
  back: { padding: 6 },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, lineHeight: 28, color: INK_TEXT.primary, flex: 1 } as object,
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: INK_TEXT.faint },
  hint: { textAlign: 'center', fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.faint, paddingVertical: 14 },
});
```

- [ ] **Step 2: Typecheck + tests + prettier + commit**

```bash
yarn tsc --noEmit && yarn test:ci
npx prettier --write "app/social-web/[id].web.tsx"
git add "app/social-web/[id].web.tsx"
git commit -m "feat(social-web): dark-constellation web explorer — bloom, gestures, focus"
```

---

### Task 5: Native screen — real explorer

**Files:**
- Rewrite: `app/social-web/[id].tsx` (was a redirect)

- [ ] **Step 1: Replace the redirect with the real explorer**

Same structure as the web screen but native chrome (safe-area instead of `TOPBAR_HEIGHT`, no wheel):

```tsx
// app/social-web/[id].tsx
import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SURFACE, INK_TEXT } from '../../src/constants/colors';
import { getHeroNeighborhood } from '../../src/lib/db/heroes/neighborhood';
import { SocialWebCanvas } from '../../src/components/character/SocialWebCanvas';
import { deriveCharacterTheme } from '../../src/lib/accent';

export default function SocialWebExplorerNative() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [focusSubject, setFocusSubject] = useState<string>(id);
  const { data } = useQuery({
    queryKey: ['neighborhood', focusSubject, 24],
    queryFn: () => getHeroNeighborhood(focusSubject, 24),
    staleTime: 5 * 60 * 1000,
  });
  const subjectNode = data?.nodes.find((n) => n.id === focusSubject);
  const theme = useMemo(
    () => deriveCharacterTheme({ publisher: subjectNode?.publisher ?? null }),
    [subjectNode],
  );
  const sparse = data && data.nodes.length < 3;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: SURFACE.ink }] as object}
        pointerEvents="none"
      />
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace(`/character/${id}`))}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={22} color={INK_TEXT.primary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {subjectNode ? `${subjectNode.name}'s universe` : 'Universe'}
        </Text>
      </View>
      <View style={styles.legendRow}>
        <Legend color={COLORS.red} label="Enemy" />
        <Legend color={COLORS.green} label="Ally" />
        <Legend color={COLORS.blue} label="Team" />
      </View>

      {data && !sparse ? (
        <SocialWebCanvas
          neighborhood={data}
          subjectId={focusSubject}
          accent={theme.accent}
          onNavigate={(nodeId) =>
            router.push(`/character/${nodeId}` as Parameters<typeof router.push>[0])
          }
          onRecenter={(nodeId) => setFocusSubject(nodeId)}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {sparse ? 'Not enough connections to map yet.' : 'Mapping the universe…'}
          </Text>
        </View>
      )}

      <Text style={[styles.hint, { paddingBottom: insets.bottom + 12 }] as object}>
        Tap to focus · long-press to recenter · Open to visit
      </Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SURFACE.ink },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 8 },
  back: { padding: 6 },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, lineHeight: 28, color: INK_TEXT.primary, flex: 1 } as object,
  legendRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: INK_TEXT.faint },
  hint: { textAlign: 'center', fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.faint, paddingTop: 8 },
});
```

The native screen bloom: the ink background is applied; the accent radial bloom uses `backgroundImage` (web-only). For native, skip the CSS radial (it's a web string); the deep ink + haloed nodes carry the mood. (A native radial would need `expo-linear-gradient`'s radial or an SVG `RadialGradient` — defer; ink + node halos are enough for parity v1.)

- [ ] **Step 2: Typecheck + tests + prettier + commit**

```bash
yarn tsc --noEmit && yarn test:ci
npx prettier --write "app/social-web/[id].tsx"
git add "app/social-web/[id].tsx"
git commit -m "feat(social-web): real native explorer — gestured constellation on ink"
```

---

### Task 6: Verify + push

- [ ] **Step 1:** `yarn test:ci && yarn tsc --noEmit && yarn lint` (errors-only) → green (ignore pre-existing unrelated admin/script errors; confirm none in the new social-web files).
- [ ] **Step 2:** `npx prettier --write` all new/touched files; commit leftovers.
- [ ] **Step 3:** Push (`git push`; `--no-verify` if the hook fails only on unrelated parallel work).
- [ ] **Step 4:** Hand off for screenshots (desktop + iOS Safari + native): open `/social-web/309` — dark canvas with accent bloom, glowing edges, haloed nodes, subject pulsing; pan by drag, zoom by pinch/wheel/buttons, tap a node to focus (others dim), Open to visit, long-press to recenter. Verify header/legend clear the TopBar on web and safe-area on native. Iterate on node spacing/density (adjust `GRAPH`, `R`, node sizes, glow alphas) from the real screenshots.
