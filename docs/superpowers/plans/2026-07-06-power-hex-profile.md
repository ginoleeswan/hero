# Power Profile — Hex ⇄ Bars Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a radar-hexagon view of the six power stats to the Power Profile band, toggleable with the existing animated bar list, defaulting to hex.

**Architecture:** A pure geometry helper maps six 0–100 stat values to hexagon vertices; a shared `react-native-svg` `HexProfile` component renders the character polygon over a ghosted median polygon and animates it open on scroll-into-view (rAF-driven, reduced-motion aware — the same pattern `PowerStatCell` already uses). A segmented control in the band header flips `view` state between hex and the existing `PowerStatCell` bars.

**Tech Stack:** React Native Web, react-native-svg 15.15.4, jest-expo.

**Spec:** `docs/superpowers/specs/2026-07-06-power-hex-profile-design.md`

## Global Constraints

- yarn only; `yarn tsc --noEmit` + `yarn test:ci` green before each commit; run `npx prettier --write` on touched files before committing (pre-push hook checks format).
- Web character screen only (`app/character/[id].web.tsx`, desktop + mobile-web branches). New component in `src/components/character/` (shared, RN-primitive + `react-native-svg` only — native adopts it later).
- Reuse `STAT_CONFIG` + `STAT_MEDIANS` (already in `[id].web.tsx`) and the `theme` accent object.
- Never Flame-Bold; vertex number labels use Flame-Regular (non-clamped display — safe). `StyleSheet.create` only.
- Animations fire once; `prefers-reduced-motion: reduce` renders the settled polygon immediately.
- Commit to `main` after each task.

---

### Task 1: `hexPoints` geometry helper

**Files:**
- Create: `src/components/character/hexGeometry.ts`
- Test: `__tests__/components/hexProfile.test.ts`

**Interfaces:**
- Produces: `hexPoints(values: number[], radius: number): { x: number; y: number }[]` — six values (0–100) → six vertex coordinates relative to center `(0,0)`, first axis at 12 o'clock, going clockwise. A value clamps to `[0,100]`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/components/hexProfile.test.ts
import { hexPoints } from '../../src/components/character/hexGeometry';

const dist = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);

describe('hexPoints', () => {
  it('returns six vertices', () => {
    expect(hexPoints([50, 50, 50, 50, 50, 50], 100)).toHaveLength(6);
  });
  it('equal values → regular hexagon (all vertices equidistant from center)', () => {
    const pts = hexPoints([100, 100, 100, 100, 100, 100], 100);
    for (const p of pts) expect(dist(p)).toBeCloseTo(100, 5);
  });
  it('first axis points straight up (12 o clock)', () => {
    const pts = hexPoints([100, 0, 0, 0, 0, 0], 100);
    expect(pts[0].x).toBeCloseTo(0, 5);
    expect(pts[0].y).toBeCloseTo(-100, 5); // SVG y grows downward, so up is negative
  });
  it('a zero value sits at the center', () => {
    const pts = hexPoints([0, 100, 100, 100, 100, 100], 100);
    expect(dist(pts[0])).toBeCloseTo(0, 5);
  });
  it('scales linearly with value (50 → half radius)', () => {
    const pts = hexPoints([50, 50, 50, 50, 50, 50], 100);
    for (const p of pts) expect(dist(p)).toBeCloseTo(50, 5);
  });
  it('clamps out-of-range values', () => {
    const pts = hexPoints([200, -20, 0, 0, 0, 0], 100);
    expect(dist(pts[0])).toBeCloseTo(100, 5);
    expect(dist(pts[1])).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Run it** — `yarn jest __tests__/components/hexProfile.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/components/character/hexGeometry.ts

/**
 * Map six 0–100 stat values to hexagon vertex coordinates relative to the
 * center (0,0). First axis points straight up (12 o'clock); the rest follow
 * clockwise. SVG y grows downward, so "up" is negative y.
 */
export function hexPoints(values: number[], radius: number): { x: number; y: number }[] {
  return values.map((v, i) => {
    const t = Math.min(100, Math.max(0, v)) / 100;
    const angle = -Math.PI / 2 + (i * Math.PI) / 3; // -90° + i·60°
    return { x: t * radius * Math.cos(angle), y: t * radius * Math.sin(angle) };
  });
}

/** Serialize points to an SVG `points` string, offset by a center. */
export function toSvgPoints(pts: { x: number; y: number }[], cx: number, cy: number): string {
  return pts.map((p) => `${cx + p.x},${cy + p.y}`).join(' ');
}
```

- [ ] **Step 4: Run it** — PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/character/hexGeometry.ts __tests__/components/hexProfile.test.ts
git commit -m "feat(character): hexPoints geometry for the radar power profile"
```

---

### Task 2: `HexProfile` component

**Files:**
- Create: `src/components/character/HexProfile.tsx`
- Test: (none new — geometry is covered; the component is a view layer)

**Interfaces:**
- Consumes: `hexPoints`, `toSvgPoints` (Task 1).
- Produces: `HexProfile` component — props `{ stats: { key: string; value: number | null; label: string; color: string }[]; medians: Record<string, number>; accent: string; size?: number }`. Renders a settled hexagon; animates open once on scroll-into-view.

- [ ] **Step 1: Implement the component**

```tsx
// src/components/character/HexProfile.tsx
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { hexPoints, toSvgPoints } from './hexGeometry';

const DURATION_MS = 750;

const reducedMotion = () =>
  typeof window === 'undefined' ||
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

// The six power stats as a radar hexagon: the character polygon (accent-filled)
// over a ghosted catalog-median polygon. Springs open from center on first
// scroll-into-view; reduced motion renders settled. Shared react-native-svg so
// native can adopt it later.
export function HexProfile({
  stats,
  medians,
  accent,
  size = 260,
}: {
  stats: { key: string; value: number | null; label: string; color: string }[];
  medians: Record<string, number>;
  accent: string;
  size?: number;
}) {
  const ref = useRef<View>(null);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 34; // leave room for vertex labels

  const values = stats.map((s) => s.value ?? 0);
  const medianValues = stats.map((s) => medians[s.key] ?? 0);

  const [progress, setProgress] = useState(() => (reducedMotion() ? 1 : 0));
  const played = useRef(reducedMotion());

  useEffect(() => {
    if (played.current) return;
    const el = ref.current as unknown as HTMLElement | null;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setProgress(1);
      played.current = true;
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || played.current) return;
        played.current = true;
        io.disconnect();
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
          const p = Math.min((now - start) / DURATION_MS, 1);
          const eased = 1 - (1 - p) ** 3;
          setProgress(eased);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const heroPts = toSvgPoints(hexPoints(values.map((v) => v * progress), R), cx, cy);
  const medianPts = toSvgPoints(hexPoints(medianValues, R), cx, cy);
  const gridPts = toSvgPoints(hexPoints([100, 100, 100, 100, 100, 100], R), cx, cy);
  const axisEnds = hexPoints([100, 100, 100, 100, 100, 100], R);
  const labelPts = hexPoints([100, 100, 100, 100, 100, 100], R + 20);

  return (
    <View ref={ref} style={styles.wrap}>
      <Svg width={size} height={size}>
        {/* outer guide hexagon */}
        <Polygon points={gridPts} fill="none" stroke="rgba(41,60,67,0.10)" strokeWidth={1} />
        {/* axis spokes */}
        {axisEnds.map((p, i) => (
          <Line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + p.x}
            y2={cy + p.y}
            stroke="rgba(41,60,67,0.08)"
            strokeWidth={1}
          />
        ))}
        {/* ghosted median hexagon */}
        <Polygon points={medianPts} fill="none" stroke="rgba(41,60,67,0.28)" strokeWidth={1.5} strokeDasharray="3 3" />
        {/* character polygon */}
        <Polygon points={heroPts} fill={accent + '26'} stroke={accent} strokeWidth={2} />
        {/* vertex dots */}
        {hexPoints(values.map((v) => v * progress), R).map((p, i) => (
          <Circle key={i} cx={cx + p.x} cy={cy + p.y} r={3} fill={stats[i].color} />
        ))}
      </Svg>
      {/* vertex number + label overlay (RN Text, positioned at label points) */}
      {labelPts.map((p, i) => (
        <View
          key={stats[i].key}
          style={[styles.label, { left: cx + p.x, top: cy + p.y }] as object}
        >
          <Text style={[styles.value, { color: stats[i].color }] as object}>
            {stats[i].value == null ? '—' : Math.round(values[i] * progress)}
          </Text>
          <Text style={styles.name}>{stats[i].label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', position: 'relative' },
  // Each label is centered on its vertex point via translate.
  label: { position: 'absolute', alignItems: 'center', transform: [{ translateX: '-50%' as unknown as number }, { translateY: '-50%' as unknown as number }] } as object,
  value: { fontFamily: 'Flame-Regular', fontSize: 18, lineHeight: 22 } as object,
  name: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#A2A19B',
  },
});
```

Note on label centering: RNW supports `%` translate; if the `'-50%'` transform misbehaves on native later, swap to measuring or a fixed pixel offset. For this web pass verify the labels sit centered on their vertices in the screenshot; nudge `R + 20` / font sizes if a label clips the container — increase `size`'s label margin (`size/2 - 34`) rather than letting text overflow.

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit` → clean (filter to `HexProfile`/`hexGeometry` if the tree has unrelated errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/character/HexProfile.tsx
git commit -m "feat(character): HexProfile radar visualization (svg, animate-on-reveal)"
```

---

### Task 3: Wire the Hex ⇄ Bars toggle into the Power Profile band

**Files:**
- Modify: `app/character/[id].web.tsx` (desktop band header + body ~L955–1120; mobile band ~L1885–2000)

**Interfaces:**
- Consumes: `HexProfile` (Task 2), existing `PowerStatCell`, `STAT_CONFIG`, `STAT_MEDIANS`, `theme`.

- [ ] **Step 1: Import + add view state**

Add `import { HexProfile } from '../../src/components/character/HexProfile';`. In `WebCharacterScreen`, near the other view state, add:

```tsx
const [statsView, setStatsView] = useState<'hex' | 'bars'>('hex');
```

- [ ] **Step 2: Build the segmented control**

Add a small helper component near the top of the file (after imports, module scope):

```tsx
function StatsViewToggle({
  view,
  onChange,
  accent,
}: {
  view: 'hex' | 'bars';
  onChange: (v: 'hex' | 'bars') => void;
  accent: string;
}) {
  const opt = (v: 'hex' | 'bars', label: string) => (
    <Pressable
      onPress={() => onChange(v)}
      style={
        [
          styles.segBtn,
          view === v && { backgroundColor: accent + '1f', borderColor: accent + '3d' },
        ] as object
      }
    >
      <Text style={[styles.segText, view === v && { color: accent }] as object}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.segWrap}>
      {opt('hex', 'Hex')}
      {opt('bars', 'Bars')}
    </View>
  );
}
```

Styles (near the stat styles):

```ts
segWrap: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(41,60,67,0.05)', borderRadius: 999, padding: 3 },
segBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'transparent' },
segText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 11, letterSpacing: 0.4, color: 'rgba(41,60,67,0.5)' },
```

- [ ] **Step 3: Place the toggle in the band header (desktop)**

In the desktop `statCardHeader` right-side group (near the Compare button / AI badge, ~L955–1024), render `{!statsEditing && !statsGenerating ? <StatsViewToggle view={statsView} onChange={setStatsView} accent={theme.accent} /> : null}` — before the Compare button so the row reads `[Hex|Bars]  Compare  95`.

- [ ] **Step 4: Swap the band body by view (desktop)**

The non-editing band body currently renders `<View style={styles.statBand}>{STAT_CONFIG.map(... PowerStatCell ...)}</View>`. Wrap it:

```tsx
{statsView === 'hex' ? (
  <HexProfile
    stats={STAT_CONFIG.map(({ key, label, color }) => {
      const raw = parseInt((stats.powerstats as Record<string, string>)[key] ?? '0', 10);
      return { key, label, color, value: isNaN(raw) ? null : raw };
    })}
    medians={STAT_MEDIANS}
    accent={theme.accent}
  />
) : (
  <View style={styles.statBand}>
    {/* existing STAT_CONFIG.map → PowerStatCell, unchanged */}
  </View>
)}
```

The footer (median legend + percentile badge + Compare) stays outside this ternary, shared by both views.

- [ ] **Step 5: Mirror on mobile-web**

The mobile Power Profile block (~L1885–2000) gets the same treatment: toggle in its `mStatTitleRow`, body swapped hex/bars. Use a smaller `size` for the hexagon on mobile — pass `size={Math.min(300, width - 80)}` (the screen already reads `width` from `useWindowDimensions`). Keep the mobile percentile badge footer shared.

- [ ] **Step 6: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` → clean/green. `npx prettier --write "app/character/[id].web.tsx"`.

```bash
git add "app/character/[id].web.tsx"
git commit -m "feat(character): Power Profile hex/bars toggle (hex default)"
```

---

### Task 4: Verification sweep

- [ ] **Step 1:** `yarn test:ci && yarn tsc --noEmit` → green (ignore pre-existing unrelated admin/script errors from parallel work; confirm none are in `HexProfile`/`hexGeometry`/`[id].web.tsx`).
- [ ] **Step 2:** Hand off for device screenshots (desktop + iOS Safari) of `/character/643` and a spiky-stat villain (e.g. Joker — intelligence 100, strength 10 → a dramatic hexagon): hex draws open on scroll, median ghost visible, toggle flips to bars cleanly, reduced-motion renders settled. Do NOT start a dev server. Iterate on feedback, then this feature is done; native adoption of `HexProfile` is a later follow-up.
