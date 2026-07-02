# Character Dossier — Pass 3: Life — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The motion layer for the web character page: animated Power Profile fills with count-ups, scroll-entrance reveals for every section, hover lift on relationship tiles and signature tiles, a desktop section dot-rail, all honoring `prefers-reduced-motion`.

**Architecture:** A shared `PowerStatCell` web component replaces the duplicated desktop/mobile stat-cell markup and owns its own once-only intersection trigger (CSS width transition + rAF count-up). `Reveal` (existing, reduced-motion aware) wraps the main-column sections. A `SectionDotRail` component tracks `nativeID`-anchored sections via IntersectionObserver. Hover states ride the existing `hovered` Pressable pattern + `HOVER_TRANSITION`.

**Tech Stack:** React Native Web, IntersectionObserver, requestAnimationFrame, jest-expo.

**Spec:** `docs/superpowers/specs/2026-07-02-character-dossier-redesign-design.md` §9–§10.

## Global Constraints

- yarn only; `yarn tsc --noEmit` + `yarn test:ci` green before each commit; prettier runs in the pre-push hook, so run `npx prettier --write` on touched files before committing.
- Web screen only (`app/character/[id].web.tsx` + `src/components/web/character/`); `RelatedHeroStrip` is shared with native — hover additions must be no-ops on native (Pressable `hovered` only fires on web).
- Animations fire **once** per page view; `prefers-reduced-motion: reduce` renders final state with no transition (the existing `Reveal` already does this — replicate its check).
- Never Flame-Bold; clamped Flame needs lineHeight ≥ 1.22× fontSize.
- Commit to `main` after each task; push at the end (user asked for pushes).

## Scope deviations (deliberate)

- Gallery frame brighten-on-hover: `GalleryStrip` is shared with native — skipped.
- §9 dot-rail labels: shown on hover via plain title attribute-level treatment (a small floating label View), no tooltip library.

---

### Task 1: `PowerStatCell` — animated fills + count-ups

**Files:**
- Create: `src/components/web/character/PowerStatCell.tsx`
- Test: `__tests__/components/powerStatCell.test.ts`
- Modify: `app/character/[id].web.tsx` (replace both inline stat-cell `STAT_CONFIG.map` bodies; delete now-unused `bandVal`/`bandTrack`/`bandFill`/`bandMedianTick` styles if orphaned)

**Interfaces:**
- Produces: `statDisplayValue(progress: number, target: number): number` (pure, eased count-up mapping, exported for tests) and `PowerStatCell` component:

```ts
{ value: number | null; label: string; color: string; median?: number }
```

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/components/powerStatCell.test.ts
import { statDisplayValue } from '../../src/components/web/character/PowerStatCell';

describe('statDisplayValue', () => {
  it('starts at 0 and ends exactly at the target', () => {
    expect(statDisplayValue(0, 94)).toBe(0);
    expect(statDisplayValue(1, 94)).toBe(94);
  });
  it('eases out — past halfway progress the value exceeds half the target', () => {
    expect(statDisplayValue(0.5, 100)).toBeGreaterThan(50);
  });
  it('is monotonic and integer-valued', () => {
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const v = statDisplayValue(Math.min(p, 1), 87);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
```

- [ ] **Step 2: Run** `yarn jest __tests__/components/powerStatCell.test.ts` — FAIL (module not found).

- [ ] **Step 3: Implement**

```tsx
// src/components/web/character/PowerStatCell.tsx
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

/** Eased (cubic ease-out) count-up mapping: progress 0→1 becomes 0→target. */
export function statDisplayValue(progress: number, target: number): number {
  const eased = 1 - (1 - progress) ** 3;
  return Math.round(target * eased);
}

const DURATION_MS = 750;

function usePlayOnce(): [React.RefObject<View | null>, boolean] {
  const ref = useRef<View>(null);
  const [play, setPlay] = useState(() =>
    typeof window === 'undefined' ||
    typeof IntersectionObserver === 'undefined' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? true
      : false,
  );
  const [armed] = useState(!play); // false when we rendered final state immediately
  useEffect(() => {
    if (!armed || play) return;
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) {
      setPlay(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlay(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed, play]);
  return [ref, play];
}

// One Power Profile stat: big Flame number counts up while the bar sweeps to
// its fill, both on first scroll-into-view. Median tick marks the catalog
// midpoint. Reduced motion renders the final state immediately.
export function PowerStatCell({
  value,
  label,
  color,
  median,
}: {
  value: number | null;
  label: string;
  color: string;
  median?: number;
}) {
  const [ref, play] = usePlayOnce();
  const target = value ?? 0;
  const fill = Math.min(target, 100);
  const [display, setDisplay] = useState(value === null ? 0 : 0);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (!play || animatedRef.current) return;
    animatedRef.current = true;
    if (
      typeof window === 'undefined' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      setDisplay(statDisplayValue(progress, target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, target]);

  return (
    <View ref={ref} style={styles.cell}>
      <Text style={[styles.val, { color }] as object}>{value === null ? '—' : display}</Text>
      <View style={styles.track}>
        <View
          style={
            [
              styles.fill,
              {
                width: play ? `${fill}%` : '0%',
                minWidth: play && fill > 0 ? 5 : 0,
                backgroundColor: color,
                transition: 'width 750ms cubic-bezier(0.16, 1, 0.3, 1)',
              },
            ] as object
          }
        />
        {median != null ? (
          <View style={[styles.medianTick, { left: `${median}%` }] as object} />
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', gap: 8 },
  val: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 32 } as object,
  track: {
    width: '88%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(41,60,67,0.10)',
    overflow: 'hidden',
  } as object,
  fill: { height: '100%', borderRadius: 3 } as object,
  medianTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(41,60,67,0.35)',
  } as object,
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.55)',
  },
});
```

Copy the `label` style values from the screen's existing `bandLabel` entry first (`rg -n "bandLabel:" -A 7`) so the cell is pixel-identical to today's static version.

- [ ] **Step 4: Run the test** — PASS (3 tests).

- [ ] **Step 5: Wire into both stat bands**

Desktop `STAT_CONFIG.map` body (non-skeleton branch) becomes:

```tsx
const raw = parseInt((stats.powerstats as Record<string, string>)[key] ?? '0', 10);
return (
  <PowerStatCell
    key={key}
    value={isNaN(raw) ? null : raw}
    label={label}
    color={color}
    median={STAT_MEDIANS[key]}
  />
);
```

Mobile `row.map` body: identical call. Keep both skeleton branches (they use `bandCell` layout — keep `bandCell` style if still referenced by skeletons; delete `bandVal`/`bandTrack`/`bandFill`/`bandMedianTick` only when `rg` shows zero remaining references).

- [ ] **Step 6: Verify + commit**

`yarn tsc --noEmit && yarn test:ci`, `npx prettier --write` touched files.

```bash
git add src/components/web/character/PowerStatCell.tsx __tests__/components/powerStatCell.test.ts "app/character/[id].web.tsx"
git commit -m "feat(character): Power Profile bars sweep + numbers count up on reveal"
```

---

### Task 2: Section reveals

**Files:**
- Modify: `app/character/[id].web.tsx` only.

- [ ] **Step 1: Import** `import { Reveal } from '../../src/components/web/Reveal';`

- [ ] **Step 2: Wrap the desktop main-column sections** — each top-level block inside `mainCol` *below* the Power Profile band (bio pull-quote, abilities card, relationships card, LegendBand, On Screen card, In Print card, links footer) gets wrapped:

```tsx
<Reveal>
  <PullQuoteBio … />
</Reveal>
```

Do NOT wrap the Power Profile band (its bars animate themselves; double-motion reads jittery) and do NOT wrap skeleton branches (wrap only the loaded-content JSX — where a ternary renders skeleton vs content, put `<Reveal>` inside the content branch).

- [ ] **Step 3: Wrap the mobile sheet sections** — same rule for the `mSheet` children below the Power Profile block (bio, signature tiles block, AbilitiesSection, LegendBand block, relationships section, On Screen, covers rail, gallery, dossier, links footer).

- [ ] **Step 4: Verify + commit**

`yarn tsc --noEmit && yarn test:ci`, prettier, then:

```bash
git add "app/character/[id].web.tsx"
git commit -m "feat(character): sections rise into view once as the dossier scrolls"
```

---

### Task 3: Hover lift — relationship tiles + signature tiles

**Files:**
- Modify: `src/components/RelatedHeroStrip.tsx` (TouchableOpacity → Pressable with hovered lift; shared with native — `hovered` is web-only so native behavior is unchanged, but keep `activeOpacity` feel by mapping `pressed` to opacity)
- Modify: `src/components/web/character/SignaturePowers.tsx` (hover tint)

- [ ] **Step 1: RelatedHeroStrip cards**

Replace the card `TouchableOpacity` with:

```tsx
<Pressable
  key={hero.id}
  onPress={() => onPressHero(hero)}
  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
    [
      styles.card,
      cardEdge,
      hovered && styles.cardHover,
      pressed && { opacity: 0.85 },
    ] as object
  }
  accessibilityRole="button"
  accessibilityLabel={`View ${hero.name}`}
>
```

(import `Pressable` from react-native; drop `TouchableOpacity` import if now unused — the `+N more` tile can switch to Pressable the same way). New styles:

```ts
cardHover: {
  transform: [{ translateY: -3 }],
  boxShadow: '0px 10px 22px rgba(41,60,67,0.30)',
} as object,
```

And add `transition: HOVER_TRANSITION` (import from `../constants/colors`) into the base `card` style so the lift eases.

- [ ] **Step 2: Signature tiles** — in `SignaturePowers.tsx`, tiles are static Views; give them a subtle web-only hover by adding `transition: HOVER_TRANSITION` to the base tile style and converting the tile `View` to `Pressable` is NOT wanted (they aren't tappable) — instead keep Views and skip hover here if it implies affordance. **Decision: skip tile hover (not interactive); no change to SignaturePowers.** Remove this file from the task if nothing else changes.

- [ ] **Step 3: Verify + commit**

`yarn tsc --noEmit && yarn test:ci`, prettier, then:

```bash
git add src/components/RelatedHeroStrip.tsx
git commit -m "feat(character): relationship tiles lift on hover"
```

---

### Task 4: Desktop section dot-rail

**Files:**
- Create: `src/components/web/character/SectionDotRail.tsx`
- Modify: `app/character/[id].web.tsx` (assign `nativeID`s to desktop section wrappers; render the rail on desktop only)

**Interfaces:**
- Produces: `SectionDotRail` component `{ sections: { id: string; label: string }[]; accent: string }`.

- [ ] **Step 1: Implement the component**

```tsx
// src/components/web/character/SectionDotRail.tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

// Quiet fixed dot-rail on the far left of the desktop dossier: one dot per
// section, active dot tracks scroll, click jumps. Labels appear on hover only.
export function SectionDotRail({
  sections,
  accent,
}: {
  sections: { id: string; label: string }[];
  accent: string;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        // The section closest to the top of the viewport that is visible wins.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <View style={styles.rail} pointerEvents="box-none">
      {sections.map((s) => {
        const isActive = active === s.id;
        return (
          <Pressable
            key={s.id}
            onPress={() => jump(s.id)}
            onHoverIn={() => setHovered(s.id)}
            onHoverOut={() => setHovered(null)}
            style={styles.dotHit}
            accessibilityRole="button"
            accessibilityLabel={`Jump to ${s.label}`}
          >
            <View
              style={
                [
                  styles.dot,
                  {
                    backgroundColor: isActive ? accent : 'rgba(41,60,67,0.25)',
                    transform: [{ scale: isActive ? 1.35 : 1 }],
                    transition: 'background-color 200ms ease, transform 200ms ease',
                  },
                ] as object
              }
            />
            {hovered === s.id ? (
              <View style={styles.labelBubble}>
                <Text style={styles.labelText}>{s.label}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'fixed',
    left: 14,
    top: '50%',
    transform: [{ translateY: '-50%' as unknown as number }],
    gap: 14,
    zIndex: 40,
    alignItems: 'center',
  } as object,
  dotHit: { padding: 5, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 } as object,
  labelBubble: {
    position: 'absolute',
    left: 24,
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  } as object,
  labelText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.beige },
});
```

- [ ] **Step 2: Anchor the sections** — in the desktop branch, add `nativeID` to the five wrappers (RNW renders it as the DOM `id`): the Power Profile band (`nativeID="sec-power"`), the abilities card wrapper (`"sec-abilities"`), the relationships card (`"sec-relations"`), the LegendBand wrapper (wrap in `<View nativeID="sec-legend">` since LegendBand doesn't take nativeID), the In Print card (`"sec-print"`). Where a section is already wrapped in `<Reveal>`, put the `nativeID` on a plain wrapper View around the Reveal.

- [ ] **Step 3: Render the rail** — in the desktop branch, next to `bodyDesktopNew` (as a sibling, outside the columns), gate on wide viewports:

```tsx
{width >= 1180 ? (
  <SectionDotRail
    accent={theme.accent}
    sections={[
      { id: 'sec-power', label: 'Power' },
      { id: 'sec-abilities', label: 'Abilities' },
      { id: 'sec-relations', label: 'Relations' },
      { id: 'sec-legend', label: 'Legend' },
      { id: 'sec-print', label: 'In Print' },
    ]}
  />
) : null}
```

(Sections that render conditionally — e.g. no relationships — will simply never activate; acceptable.)

- [ ] **Step 4: Verify + commit**

`yarn tsc --noEmit && yarn test:ci`, prettier, then:

```bash
git add src/components/web/character/SectionDotRail.tsx "app/character/[id].web.tsx"
git commit -m "feat(character): desktop dot-rail tracks and jumps the dossier sections"
```

---

### Task 5: Sweep, push, screenshot handoff

- [ ] **Step 1:** `yarn test:ci && yarn tsc --noEmit && yarn lint` (errors-only gate) → green; `rg -n "bandVal|bandTrack|bandFill|bandMedianTick" "app/character/[id].web.tsx"` → delete orphans.
- [ ] **Step 2:** `npx prettier --write "app/character/[id].web.tsx" src/components/web/character/*.tsx src/components/RelatedHeroStrip.tsx`, commit leftovers if any, `git push`.
- [ ] **Step 3:** Hand off for device screenshots (desktop + iOS Safari): scroll `/character/643` top-to-bottom — bars sweep once, sections rise once, dot-rail tracks; reload with reduced-motion enabled (macOS: System Settings → Accessibility → Display → Reduce motion) — everything renders instantly with no animation.
