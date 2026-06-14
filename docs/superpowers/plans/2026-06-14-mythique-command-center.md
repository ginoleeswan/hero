# Mythique Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the admin Catalog Health page into a dense, multi-domain command center — a persistent dark command rail switches domains, each domain renders as a bento canvas, and a vitals ribbon stays pinned across all of them.

**Architecture:** Pure presentation + architecture refactor. The data layer (`src/lib/db/catalogHealth.ts`) and logic hooks (`src/components/admin/health/hooks.ts`) are unchanged. The 1,741-line `app/admin/health.web.tsx` is decomposed into a thin shell + `CommandShell` chrome + four domain panels + two shared primitives. Tab state becomes domain state.

**Tech Stack:** Expo SDK 56 / React Native (web target via `.web.tsx`), expo-router, @tanstack/react-query, react-native-svg, expo-image, @expo/vector-icons (Ionicons). Tests: jest-expo + @testing-library/react-native.

**Reference spec:** `docs/superpowers/specs/2026-06-14-mythique-command-center-design.md`

**Conventions (from CLAUDE.md):**
- Package manager is **yarn**. Typecheck: `yarn typecheck`. Tests: `yarn test:ci`. Format: `yarn format`.
- `StyleSheet.create` for all styles; no inline style objects (except `StyleSheet.absoluteFill` and the documented web-only `calc()`/`outlineStyle` casts already used in this file).
- Fonts: `Flame-Regular` for display figures, `Nunito_*`/`FlameSans-Regular` for UI. **Never `Flame-Bold`.**
- Use `COLORS` tokens, never raw hex, except for the established dark-chrome literals (`'#10242e'`, and `rgba(...)` overlays) already present in `Masthead.tsx`/`VitalsBar.tsx`.
- Do **not** write full-screen rendering tests (project rule). TDD covers new pure logic only; component work is verified by `yarn typecheck` and a manual run.

**Working colour tokens (already in `src/constants/colors.ts`):** `beige #f5ebdc`, `orange #E77333`, `navy #293C43`, `deepNavy #0b1820`, `green #63A936`, `red #B5302B`, `yellow #F9B222`, `blue #15A1AB`, `gold #b07d00`, `grey #A2A19B`, `black #2D2D2D`.

---

## File structure

```
app/admin/health.web.tsx                         REWRITTEN — thin shell (gate, state, queries/actions, domain router)
src/components/admin/health/
  format.ts                                       MODIFY — add DomainKey/DOMAINS + DENSITY; keep TABS until Task 6 removes it
  density.ts                                       (folded into format.ts — no separate file; see Task 1)
  Panel.tsx                                        CREATE — dense card primitive
  Bento.tsx                                        CREATE — responsive bento grid + Row
  CommandShell.tsx                                 CREATE — dark chrome: TopBar + Rail + BottomTabBar + ribbon/alerts slots
  VitalsBar.tsx                                    MODIFY — dark ribbon skin
  AlertStack.tsx                                   CREATE — extracted alert pills (from health.web.tsx)
  domains/CommandHome.tsx                          CREATE — read-only glance bento
  domains/CatalogDomain.tsx                        CREATE — coverage + queue + heatmap + distributions
  domains/OperationsDomain.tsx                     CREATE — controls + active run + history + log + console
  domains/SpendDomain.tsx                          CREATE — spend detail (from current SpendCard)
  domains/PlaceholderDomain.tsx                    CREATE — "coming soon" empty state
  Masthead.tsx                                     DELETE (Task 7)
  charts.tsx, RunHistory.tsx, atoms.tsx, hooks.ts  REUSED unchanged
__tests__/components/admin/health/
  format.test.ts                                   CREATE — DOMAINS + density invariants
```

---

## Task 1: Domain model + density tokens (pure logic, TDD)

**Files:**
- Modify: `src/components/admin/health/format.ts`
- Test: `__tests__/components/admin/health/format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/admin/health/format.test.ts`:

```ts
import { DOMAINS, primaryDomainKeys, DENSITY } from '../../../../src/components/admin/health/format';

describe('DOMAINS', () => {
  it('lists the four primary domains in rail order, then placeholders', () => {
    expect(DOMAINS.map((d) => d.key)).toEqual([
      'command',
      'catalog',
      'operations',
      'spend',
      'users',
      'traffic',
    ]);
  });

  it('flags exactly the two future domains as placeholders', () => {
    const placeholders = DOMAINS.filter((d) => d.placeholder).map((d) => d.key);
    expect(placeholders).toEqual(['users', 'traffic']);
  });

  it('every domain has a label and an Ionicons name', () => {
    for (const d of DOMAINS) {
      expect(typeof d.label).toBe('string');
      expect(d.label.length).toBeGreaterThan(0);
      expect(typeof d.icon).toBe('string');
    }
  });

  it('primaryDomainKeys excludes placeholders (mobile bottom bar set)', () => {
    expect(primaryDomainKeys()).toEqual(['command', 'catalog', 'operations', 'spend']);
  });
});

describe('DENSITY', () => {
  it('exposes a compact scale used across panels', () => {
    expect(DENSITY.panelPad).toBeLessThanOrEqual(12);
    expect(DENSITY.radius).toBeLessThanOrEqual(12);
    expect(DENSITY.rowH).toBeLessThanOrEqual(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/components/admin/health/format.test.ts`
Expected: FAIL — `DOMAINS`, `primaryDomainKeys`, `DENSITY` are not exported.

- [ ] **Step 3: Add the domain model + density tokens to `format.ts`**

Append to `src/components/admin/health/format.ts` (keep the existing `TabKey`/`TABS` exports for now — they are removed in Task 6):

```ts
// ── Domains (command-center rail; replaces TABS in Task 6) ─────────────────────
export type DomainKey = 'command' | 'catalog' | 'operations' | 'spend' | 'users' | 'traffic';

export interface DomainDef {
  key: DomainKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Future app-wide domains: render a "coming soon" placeholder. */
  placeholder?: boolean;
  /** Show the pending backlog badge on this rail item. */
  badge?: 'pending';
}

export const DOMAINS: DomainDef[] = [
  { key: 'command', label: 'Command', icon: 'grid' },
  { key: 'catalog', label: 'Catalog', icon: 'albums', badge: 'pending' },
  { key: 'operations', label: 'Operations', icon: 'pulse' },
  { key: 'spend', label: 'Spend', icon: 'cash-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline', placeholder: true },
  { key: 'traffic', label: 'Traffic', icon: 'trending-up-outline', placeholder: true },
];

/** Primary (non-placeholder) domain keys — the mobile bottom-bar set. */
export const primaryDomainKeys = (): DomainKey[] =>
  DOMAINS.filter((d) => !d.placeholder).map((d) => d.key);

// ── Density scale (compact command-center spacing/sizing) ──────────────────────
export const DENSITY = {
  panelPad: 12,
  panelPadNarrow: 12,
  radius: 12,
  gap: 10,
  rowH: 28,
  labelSize: 10,
  hintSize: 11,
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest __tests__/components/admin/health/format.test.ts`
Expected: PASS (4 + 1 assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/health/format.ts __tests__/components/admin/health/format.test.ts
git commit -m "feat(admin): command-center domain model + density tokens"
```

---

## Task 2: Shared primitives — Panel + Bento

**Files:**
- Create: `src/components/admin/health/Panel.tsx`
- Create: `src/components/admin/health/Bento.tsx`

No unit test (presentational; verified by typecheck). Provide complete code.

- [ ] **Step 1: Create `Panel.tsx`**

```tsx
// Dense data panel — the command center's standard light card. Title + optional
// hint + optional right-aligned action, then children. One source of truth for
// panel chrome so every domain stays visually in lockstep.
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { COLORS } from '../../../constants/colors';
import { DENSITY } from './format';

export function Panel({
  title,
  hint,
  action,
  children,
  style,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <View style={[styles.panel, style as ViewStyle]}>
      {(title || action) && (
        <View style={styles.head}>
          <View style={styles.headText}>
            {title && <Text style={styles.title}>{title}</Text>}
            {hint && <Text style={styles.hint}>{hint}</Text>}
          </View>
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fffdf8',
    borderRadius: DENSITY.radius,
    padding: DENSITY.panelPad,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.07)',
    shadowColor: '#3a2a14',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: DENSITY.gap,
  },
  headText: { flex: 1, gap: 1 },
  title: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.black, lineHeight: 18 },
  hint: { fontFamily: 'Nunito_400Regular', fontSize: DENSITY.hintSize, color: COLORS.grey },
});
```

- [ ] **Step 2: Create `Bento.tsx`**

```tsx
// Responsive bento grid for the command center. On wide screens children flow in
// rows you compose with <Bento.Row>; on narrow (<760) everything collapses to a
// single vertical stack. Gap is the shared density gap.
import { View, StyleSheet } from 'react-native';
import { type ReactNode } from 'react';
import { DENSITY } from './format';

function Grid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

function Row({ children, narrow }: { children: ReactNode; narrow: boolean }) {
  return <View style={narrow ? styles.rowNarrow : styles.row}>{children}</View>;
}

export const Bento = Object.assign(Grid, { Row });

const styles = StyleSheet.create({
  grid: { gap: DENSITY.gap, width: '100%' },
  row: { flexDirection: 'row', gap: DENSITY.gap, alignItems: 'stretch' },
  rowNarrow: { flexDirection: 'column', gap: DENSITY.gap },
});
```

- [ ] **Step 3: Typecheck**

Run: `yarn typecheck`
Expected: PASS (no errors introduced by the two new files).

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/health/Panel.tsx src/components/admin/health/Bento.tsx
git commit -m "feat(admin): Panel + Bento command-center primitives"
```

---

## Task 3: VitalsBar — dark ribbon skin

**Files:**
- Modify: `src/components/admin/health/VitalsBar.tsx`

Restyle the existing component for the dark pinned ribbon. Keep its props/logic identical; only the `StyleSheet` changes. The component already accepts everything it needs.

- [ ] **Step 1: Replace the `StyleSheet.create` block in `VitalsBar.tsx`**

Replace the entire `const s = StyleSheet.create({ ... })` (lines 137–182) with the dark-ribbon variant below. (Component body above it is unchanged.)

```ts
const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 14,
  },
  barNarrow: { flexWrap: 'wrap', gap: 12, rowGap: 12 },
  cell: { gap: 2, minWidth: 80, justifyContent: 'center' },
  cellWide: { flex: 1, minWidth: 150 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.5)',
  },
  value: { fontFamily: 'Flame-Regular', fontSize: 21, color: '#fff', lineHeight: 23 },
  usage: { fontFamily: 'Flame-Regular', fontSize: 14, marginLeft: 'auto' },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  dot: { width: 8, height: 8, borderRadius: 8 },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginVertical: 2,
  },
  fill: { height: 5, borderRadius: 3 },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.1)' },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.red,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  stopText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },
});
```

Note: the two value-colour overrides inside the component that use `COLORS.navy`/`COLORS.black` for the SPEND/idle text will now sit on a dark field. Change those two inline colour props so they read on dark:
- `s.value` for SPEND uses `{ color: COLORS.navy }` → change to `{ color: '#fff' }` (line ~128).
- The idle RUN value uses `{ color: COLORS.grey }` → keep (grey reads fine on dark).

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/VitalsBar.tsx
git commit -m "feat(admin): dark ribbon skin for VitalsBar"
```

---

## Task 4: AlertStack — extract alert pills

**Files:**
- Create: `src/components/admin/health/AlertStack.tsx`

Extract the `AlertPill` component (currently `health.web.tsx:126-161`) and the alert-rendering block (`health.web.tsx:623-653`) into one self-contained component so the shell can render alerts under the ribbon in every domain. Logic (the `alerts` memo, `alertsOpen`, `leadAlert`, `alertsCollapsed`) stays in the shell and is passed in.

- [ ] **Step 1: Create `AlertStack.tsx`**

```tsx
// Alert pills shown under the vitals ribbon in every domain. The shell owns the
// alert list + collapsed/expanded state; this renders it. On mobile multiple
// alerts collapse to one worst-first banner that expands on tap.
import { View, Text, Pressable, StyleSheet, type ReactNode } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';

export type Alert = { tone: 'red' | 'gold'; text: string };

function AlertPill({
  tone,
  text,
  onPress,
  trailing,
  numberOfLines,
}: {
  tone: 'red' | 'gold';
  text: string;
  onPress?: () => void;
  trailing?: ReactNode;
  numberOfLines?: number;
}) {
  const base = tone === 'red' ? COLORS.red : COLORS.yellow;
  const style = [styles.alert, { backgroundColor: base + '18', borderColor: base + '44' }];
  const inner = (
    <>
      <Ionicons
        name={tone === 'red' ? 'alert-circle' : 'warning'}
        size={16}
        color={tone === 'red' ? COLORS.red : COLORS.gold}
      />
      <Text style={styles.alertText} numberOfLines={numberOfLines}>
        {text}
      </Text>
      {trailing}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={style}>
      {inner}
    </Pressable>
  ) : (
    <View style={style}>{inner}</View>
  );
}

export function AlertStack({
  alerts,
  narrow,
  open,
  onOpen,
  onClose,
}: {
  alerts: Alert[];
  narrow: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  if (alerts.length === 0) return null;
  const lead = alerts.find((a) => a.tone === 'red') ?? alerts[0];
  const collapsed = narrow && !open && alerts.length > 1;

  if (collapsed) {
    return (
      <AlertPill
        tone={lead.tone}
        text={lead.text}
        numberOfLines={1}
        onPress={onOpen}
        trailing={
          <>
            <View style={styles.count}>
              <Text style={styles.countText}>+{alerts.length - 1}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
          </>
        }
      />
    );
  }
  return (
    <View style={styles.wrap}>
      {alerts.map((a, i) => (
        <AlertPill key={i} tone={a.tone} text={a.text} />
      ))}
      {narrow && alerts.length > 1 && (
        <Pressable onPress={onClose} style={styles.collapse}>
          <Ionicons name="chevron-up" size={14} color={COLORS.grey} />
          <Text style={styles.collapseText}>Show less</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  alertText: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  count: {
    backgroundColor: 'rgba(41,60,67,0.1)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.navy },
  collapse: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', paddingVertical: 4 },
  collapseText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },
});
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/AlertStack.tsx
git commit -m "feat(admin): extract AlertStack component"
```

---

## Task 5: CommandShell — dark chrome

**Files:**
- Create: `src/components/admin/health/CommandShell.tsx`

The dark frame: top bar (brand + mini overall gauge + refresh), a left rail (desktop) / bottom tab bar (mobile) for domain switching, and slots for the pinned vitals ribbon, alerts, and the active domain's content. It owns no data — everything comes via props/children.

- [ ] **Step 1: Create `CommandShell.tsx`**

```tsx
// Dark command-center chrome. Renders the pinned top bar (brand + overall gauge +
// refresh), the domain switcher (left rail on desktop, bottom tab bar on mobile),
// and slots for the vitals ribbon, alerts, and the active domain content.
import { View, Text, Pressable, ActivityIndicator, StyleSheet, type ReactNode } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { TOPBAR_HEIGHT } from '../web/TopBar';
import { DOMAINS, type DomainKey } from './format';
import { Gauge } from './charts';

const CHROME_TOP = '#10242e'; // matches the retired Masthead gradient start

function RailItem({
  def,
  on,
  badge,
  onPress,
}: {
  def: (typeof DOMAINS)[number];
  on: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={def.placeholder ? false : undefined}
      style={[styles.railItem, on && styles.railItemOn, def.placeholder && styles.railItemDim]}
      accessibilityLabel={def.label}
    >
      <Ionicons name={def.icon} size={20} color={on ? '#fff' : 'rgba(255,255,255,0.6)'} />
      {badge != null && badge > 0 && (
        <View style={styles.railBadge}>
          <Text style={styles.railBadgeText}>{badge > 999 ? `${Math.round(badge / 1000)}k` : badge}</Text>
        </View>
      )}
      <Text style={[styles.railLabel, on && styles.railLabelOn]}>{def.label}</Text>
    </Pressable>
  );
}

export function CommandShell({
  domain,
  onDomain,
  overall,
  pending,
  refreshing,
  onRefresh,
  narrow,
  ribbon,
  alerts,
  children,
}: {
  domain: DomainKey;
  onDomain: (k: DomainKey) => void;
  overall: number;
  pending: number;
  refreshing: boolean;
  onRefresh: () => void;
  narrow: boolean;
  ribbon?: ReactNode;
  alerts?: ReactNode;
  children: ReactNode;
}) {
  const primary = DOMAINS.filter((d) => !d.placeholder);
  const future = DOMAINS.filter((d) => d.placeholder);

  return (
    <View style={styles.page}>
      {/* Top bar — full-bleed dark band fusing with the floating nav */}
      <LinearGradient
        colors={[CHROME_TOP, COLORS.deepNavy]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.top}
      >
        <View style={styles.topInner}>
          <View style={styles.brandCol}>
            <Text style={styles.kicker}>MYTHIQUE · COMMAND CENTER</Text>
            <Text style={styles.brand}>{DOMAINS.find((d) => d.key === domain)?.label}</Text>
          </View>
          <View style={styles.topRight}>
            <Pressable onPress={onRefresh} hitSlop={8} style={styles.refresh}>
              {refreshing ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
              ) : (
                <Ionicons name="refresh" size={15} color="rgba(255,255,255,0.85)" />
              )}
            </Pressable>
            <Gauge value={overall} size={narrow ? 56 : 64} />
          </View>
        </View>
      </LinearGradient>

      {/* Body: rail (desktop) + content */}
      <LinearGradient colors={[COLORS.deepNavy, '#081218']} style={styles.bodyBg}>
        <View style={[styles.body, narrow && styles.bodyNarrow]}>
          {!narrow && (
            <View style={styles.rail}>
              {primary.map((d) => (
                <RailItem
                  key={d.key}
                  def={d}
                  on={domain === d.key}
                  badge={d.badge === 'pending' ? pending : undefined}
                  onPress={() => onDomain(d.key)}
                />
              ))}
              <View style={styles.railDivider} />
              {future.map((d) => (
                <RailItem key={d.key} def={d} on={domain === d.key} onPress={() => onDomain(d.key)} />
              ))}
              <View style={{ flex: 1 }} />
            </View>
          )}

          <View style={styles.content}>
            {ribbon}
            {alerts}
            {children}
          </View>
        </View>
      </LinearGradient>

      {/* Mobile bottom tab bar */}
      {narrow && (
        <View style={styles.btab}>
          {primary.map((d) => {
            const on = domain === d.key;
            const badge = d.badge === 'pending' ? pending : undefined;
            return (
              <Pressable key={d.key} onPress={() => onDomain(d.key)} style={styles.btabItem}>
                <View style={[styles.btabIconWrap, on && styles.btabIconWrapOn]}>
                  <Ionicons name={d.icon} size={22} color={on ? COLORS.orange : '#fff'} />
                  {badge != null && badge > 0 && (
                    <View style={styles.btabBadge}>
                      <Text style={styles.btabBadgeText}>
                        {badge > 999 ? `${Math.round(badge / 1000)}k` : badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.btabLabel, on && styles.btabLabelOn]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.deepNavy, minHeight: '100%' as unknown as number },
  top: {
    width: '100%',
    paddingTop: (`calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 12px)` as unknown) as number,
    paddingBottom: 12,
  },
  topInner: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  brandCol: { gap: 2 },
  kicker: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 2.4, color: COLORS.orange },
  brand: { fontFamily: 'Flame-Regular', fontSize: 26, color: '#fff', lineHeight: 29 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refresh: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bodyBg: { flex: 1, width: '100%' },
  body: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    alignItems: 'flex-start',
  },
  bodyNarrow: { flexDirection: 'column', paddingHorizontal: 12, paddingTop: 12, gap: 12 },
  rail: {
    width: 84,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    paddingVertical: 10,
    gap: 4,
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  railItem: { alignItems: 'center', gap: 3, paddingVertical: 9, marginHorizontal: 8, borderRadius: 11 },
  railItemOn: { backgroundColor: COLORS.orange },
  railItemDim: { opacity: 0.4 },
  railLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  railLabelOn: { color: '#fff' },
  railDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 6, marginHorizontal: 14 },
  railBadge: {
    position: 'absolute',
    top: 4,
    right: 16,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingHorizontal: 5,
    minWidth: 16,
    alignItems: 'center',
  },
  railBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff' },
  content: { flex: 1, gap: 12, minWidth: 0 },

  // Mobile bottom tab bar (fixed)
  btab: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    flexDirection: 'row',
    backgroundColor: CHROME_TOP,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 9,
    paddingBottom: `calc(env(safe-area-inset-bottom) + 9px)`,
    transform: 'translateZ(0)',
  } as object,
  btabItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  btabIconWrap: { paddingHorizontal: 16, paddingVertical: 3, borderRadius: 999 },
  btabIconWrapOn: { backgroundColor: COLORS.orange + '22' },
  btabLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  btabLabelOn: { color: COLORS.orange },
  btabBadge: {
    position: 'absolute',
    top: -5,
    right: 6,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingHorizontal: 5,
    minWidth: 16,
    alignItems: 'center',
  },
  btabBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff' },
});
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: PASS. (`TOPBAR_HEIGHT` import path matches the one in `Masthead.tsx`: `../web/TopBar`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/CommandShell.tsx
git commit -m "feat(admin): CommandShell dark chrome (top bar + rail + bottom bar)"
```

---

## Task 6: Domain panels + shell rewrite

This is the large move. Build the four domain panels + the placeholder, then rewrite `health.web.tsx` into a thin shell that wires queries/actions into `CommandShell` and routes to the active domain. Do the panels first (they compile against existing types), then the shell last so the app is only briefly inconsistent.

**Files:**
- Create: `src/components/admin/health/domains/SpendDomain.tsx`
- Create: `src/components/admin/health/domains/PlaceholderDomain.tsx`
- Create: `src/components/admin/health/domains/CommandHome.tsx`
- Create: `src/components/admin/health/domains/CatalogDomain.tsx`
- Create: `src/components/admin/health/domains/OperationsDomain.tsx`
- Rewrite: `app/admin/health.web.tsx`

### 6a — SpendDomain

- [ ] **Step 1: Create `domains/SpendDomain.tsx`**

Move the existing `SpendCard` component and its `spend_s` styles + the `money` helper out of `health.web.tsx` (currently `health.web.tsx:309-384` for `money`+`SpendCard`; its `spend_s` StyleSheet lives further down in the same file — search for `const spend_s = StyleSheet.create`). Wrap the body in `Panel`. Signature:

```tsx
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import type { GeminiSpend } from '../../../../lib/db/catalogHealth';
import { Panel } from '../Panel';

const money = (n: number, cur?: string) =>
  cur && cur !== 'USD' ? `${n.toFixed(2)} ${cur}` : `$${n.toFixed(2)}`;

export function SpendDomain({ spend, loading, narrow }: { spend?: GeminiSpend; loading: boolean; narrow: boolean }) {
  // ... body identical to the current SpendCard, but: replace the outer
  // <View style={[styles.card, ...]}>...<Text style={styles.cardTitle}>Gemini / GCP Spend</Text>
  // with <Panel title="Gemini / GCP Spend" hint="BigQuery billing export · last 28 days"> ... </Panel>
  // Keep the empty/loading/available branches and the spend_s styles verbatim.
}
```

Paste the `spend_s` StyleSheet from `health.web.tsx` into this file unchanged. The `narrow` prop is retained for API symmetry though the dense panel no longer needs `cardNarrow`.

- [ ] **Step 2: Typecheck** — Run: `yarn typecheck` — Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/domains/SpendDomain.tsx
git commit -m "feat(admin): SpendDomain panel"
```

### 6b — PlaceholderDomain

- [ ] **Step 1: Create `domains/PlaceholderDomain.tsx`**

```tsx
// "Coming soon" empty state for future app-wide domains (Users, Traffic).
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';

export function PlaceholderDomain({ label, icon, blurb }: { label: string; icon: keyof typeof Ionicons.glyphMap; blurb: string }) {
  return (
    <Panel>
      <View style={styles.wrap}>
        <Ionicons name={icon} size={34} color={COLORS.grey} />
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.blurb}>{blurb}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>COMING SOON</Text>
        </View>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.black },
  blurb: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey, textAlign: 'center', maxWidth: 360 },
  badge: { marginTop: 6, backgroundColor: COLORS.orange + '1a', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 1, color: COLORS.orange },
});
```

- [ ] **Step 2: Typecheck** — Run: `yarn typecheck` — Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/domains/PlaceholderDomain.tsx
git commit -m "feat(admin): PlaceholderDomain for future domains"
```

### 6c — CatalogDomain

Move the Backfill (`health.web.tsx:885-1036`: Coverage card + Backfill queue) **and** the Overview distributions/heatmap blocks (`health.web.tsx:1080-1195`: Alignment, Power distribution, Largest publishers, Coverage-by-publisher) into one domain. The `CoverageRow`, `PublisherTable`, `HeatPill`, `PublisherCard` helpers (`health.web.tsx:163-307`) move into this file (they are only used here).

- [ ] **Step 1: Create `domains/CatalogDomain.tsx`** with this prop interface and structure:

```tsx
import { View, Text, Pressable, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { Donut, BarRow } from '../charts';
import { pct, healthColor, METRICS, WORKLIST_LABEL } from '../format';
import {
  GAP_PAGE_SIZE,
  type CatalogHealth,
  type CoverageMetric,
  type GapPage,
  type Distributions,
  type PublisherCoverage,
} from '../../../../lib/db/catalogHealth';

export function CatalogDomain({
  h,
  gaps,
  gapsLoading,
  dist,
  metric,
  setMetric,
  page,
  setPage,
  pubFilter,
  setPubFilter,
  pickPublisher,
  anim,
  narrow,
}: {
  h?: CatalogHealth;
  gaps?: GapPage;
  gapsLoading: boolean;
  dist?: Distributions;
  metric: CoverageMetric;
  setMetric: (m: CoverageMetric) => void;
  page: number;
  setPage: (fn: (p: number) => number) => void;
  pubFilter: string | null;
  setPubFilter: (p: string | null) => void;
  pickPublisher: (publisher: string) => void;
  anim: Animated.Value;
  narrow: boolean;
}) {
  // 1. Coverage panel  (move CoverageRow block from health.web.tsx:888-916)
  // 2. Backfill queue panel (move queue block from health.web.tsx:919-1034)
  // 3. Distributions row: Alignment (Donut/BarRow) + Power distribution (from :1080-1168)
  // 4. Coverage-by-publisher heatmap (PublisherTable/PublisherCard, from :1171-1195)
  // Compose with <Bento> / <Bento.Row narrow={narrow}> and wrap each card in <Panel>.
}
```

Move the helper components `CoverageRow`, `PublisherTable`, `HeatPill`, `PublisherCard` into this file. Replace their `styles.card`/`styles.cardNarrow` wrappers with `Panel`. Keep all interaction wiring (`setMetric`, `setPage`, `pickPublisher`, `setPubFilter`) identical. The local styles object holds the moved style rules (`covRow*`, `pub*`, `heat*`, `tab*`, `gapRow*`, `pager*`, `filterChip*`, `barList`, `histRow`/`histCol`/`histBar`, `donutWrap`, `legend*`). Copy those exact style rules from `health.web.tsx`'s `styles` into this file's local `StyleSheet.create`.

- [ ] **Step 2: Typecheck** — Run: `yarn typecheck` — Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/domains/CatalogDomain.tsx
git commit -m "feat(admin): CatalogDomain (coverage + queue + distributions + heatmap)"
```

### 6d — OperationsDomain

Move the Operations blocks (`health.web.tsx:659-883`: ops actions card, run history card, activity log + hero console columns). The `SpendCard` that was previously in the Operations tab is now its own Spend domain, so it is NOT included here.

- [ ] **Step 1: Create `domains/OperationsDomain.tsx`** with this interface:

```tsx
export function OperationsDomain({
  h,
  runs,
  runsTotal,
  runsLoading,
  runsFetching,
  onLoadMore,
  log,
  toast,
  clearLog,
  heroQuery,
  setHeroQuery,
  heroResults,
  heroSearchLoading,
  batchSize,
  setBatchSize,
  busy,
  cronOn,
  onRunDrain,
  onRetryFailed,
  onToggleCron,
  onReenrich,
  narrow,
}: {
  h: CatalogHealth;
  runs: EnrichmentRun[];
  runsTotal: number;
  runsLoading: boolean;
  runsFetching: boolean;
  onLoadMore: () => void;
  log: LogEntry[];
  toast: string | null;
  clearLog: () => void;
  heroQuery: string;
  setHeroQuery: (q: string) => void;
  heroResults: AdminHeroResult[];
  heroSearchLoading: boolean;
  batchSize: number;
  setBatchSize: (n: number) => void;
  busy: string | null;
  cronOn: boolean;
  onRunDrain: () => void;
  onRetryFailed: () => void;
  onToggleCron: () => void;
  onReenrich: (id: string, name: string) => void;
  narrow: boolean;
}) {
  // Panel 1: "Operations" — size selector + Run batch + Retry failed + Auto-drain toggle
  //          (move from health.web.tsx:659-743; drop the active-run/stop — that lives in the ribbon)
  // Panel 2: "Run history" — <RunHistory .../> (move from :746-761)
  // Panel 3 (Bento.Row): "Activity log" + "Hero console" (move from :769-883)
  // Wrap each in <Panel>; replace styles.card with Panel; copy the relevant ops* / log* / hc* / heroSearch* styles.
}
```

Imports: `RunHistory` from `../RunHistory`, `Chip` from `../atoms`, `LOG_TONE_COLOR`, `logClock` from `../format`, `Image` from `expo-image`, `useRouter` from `expo-router`, types from `../../../../lib/db/catalogHealth` and `../format`. Copy the exact style rules used by these blocks (`opsHead`, `opsBody`, `opsActions`, `sizeSel`, `sizePill*`, `actBtn`/`actPrimary`/`actGhost`/`actOn`/`actDim`/`actGrow`, `toast*`, `logHead`, `logPanel*`, `logRow`/`logTime`/`logDot`/`logText`, `miniBtn*`, `runsEmpty`, `heroSearch*`, `hc*`, `thumbBlank`, `cols`/`colsNarrow`/`opsHalf`) from `health.web.tsx` into a local `StyleSheet`.

- [ ] **Step 2: Typecheck** — Run: `yarn typecheck` — Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/domains/OperationsDomain.tsx
git commit -m "feat(admin): OperationsDomain (controls + history + log + console)"
```

### 6e — CommandHome

The read-only glance. Composes existing primitives only — no new data. Deep-links via callbacks.

- [ ] **Step 1: Create `domains/CommandHome.tsx`**

```tsx
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { Bento } from '../Bento';
import { Gauge, Donut, BarRow, CompletenessChart } from '../charts';
import { pct, METRICS } from '../format';
import type { CatalogHealth, GapPage, Distributions, HealthSnapshot } from '../../../../lib/db/catalogHealth';

export function CommandHome({
  h,
  overall,
  snaps,
  dist,
  gaps,
  anim,
  narrow,
  onJump,        // (metric?) => void  — go to Catalog backfill
  onOpenSpend,   // () => void
}: {
  h: CatalogHealth;
  overall: number;
  snaps: HealthSnapshot[];
  dist?: Distributions;
  gaps?: GapPage;
  anim: Animated.Value;
  narrow: boolean;
  onJump: (metric?: import('../../../../lib/db/catalogHealth').CoverageMetric) => void;
  onOpenSpend: () => void;
}) {
  // Bento:
  //   Row 1: Panel(gauge + coverage bars, weakest-first, tappable -> onJump(metric))
  //          Panel("Completeness", CompletenessChart from snaps, or overall% empty state)
  //   Row 2: Panel("Backfill queue", top 4 gaps.heroes preview, row -> router.push(/character/:id),
  //                 header action "View all" -> onJump())
  //          Panel("Alignment", Donut + legend from dist.alignment)
  //          Panel("Spend", small bars, pressable -> onOpenSpend())
  // Build coverage bars inline reusing the bar markup pattern (label + track + fill),
  // animating width with `anim` exactly like the current CoverageRow.
}
```

Coverage bar fill animation: reuse the pattern from the current `CoverageRow` —
`anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${p}%`] })`.

- [ ] **Step 2: Typecheck** — Run: `yarn typecheck` — Expected: PASS.
- [ ] **Step 3: Commit**

```bash
git add src/components/admin/health/domains/CommandHome.tsx
git commit -m "feat(admin): CommandHome glance bento"
```

### 6f — Rewrite `health.web.tsx` into the thin shell

- [ ] **Step 1: Rewrite `app/admin/health.web.tsx`**

Replace the file with the shell below. It keeps every hook call, the admin gate, the alert memo, the run→log streaming effect, the enter/anim drivers, and the derived ops values — but renders through `CommandShell` + a domain switch. `tab`/`TabKey` is replaced by `domain`/`DomainKey`; the `SkeletonCards`, `BottomTabBar`, `AlertPill`, `CoverageRow`, `PublisherTable`, `HeatPill`, `PublisherCard`, `SpendCard`, `money` definitions are deleted (moved to their new homes).

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/hooks/useAuth';
import { getProfile } from '../../src/lib/db/profiles';
import { useWebCanvas } from '../../src/hooks/useWebCanvas';
import { useChromeColor } from '../../src/contexts/WebChromeContext';
import { LogoLoader } from '../../src/components/ui/LogoLoader';
import { COLORS } from '../../src/constants/colors';
import { type CoverageMetric, type EnrichmentRun } from '../../src/lib/db/catalogHealth';
import { DRAIN_CRON, CV_HOURLY_CAP, pct, METRICS, type DomainKey } from '../../src/components/admin/health/format';
import { CommandShell } from '../../src/components/admin/health/CommandShell';
import { VitalsBar } from '../../src/components/admin/health/VitalsBar';
import { AlertStack, type Alert } from '../../src/components/admin/health/AlertStack';
import { CommandHome } from '../../src/components/admin/health/domains/CommandHome';
import { CatalogDomain } from '../../src/components/admin/health/domains/CatalogDomain';
import { OperationsDomain } from '../../src/components/admin/health/domains/OperationsDomain';
import { SpendDomain } from '../../src/components/admin/health/domains/SpendDomain';
import { PlaceholderDomain } from '../../src/components/admin/health/domains/PlaceholderDomain';
import { useActivityLog, useCatalogActions, useCatalogQueries } from '../../src/components/admin/health/hooks';

export default function AdminHealthScreen() {
  useWebCanvas(COLORS.deepNavy);
  useChromeColor('#10242e');
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const narrow = winW < 760;
  const { user, loading: authLoading } = useAuth();

  const [metric, setMetric] = useState<CoverageMetric>('portrait');
  const [page, setPage] = useState(0);
  const [domain, setDomain] = useState<DomainKey>('command');
  const [heroQuery, setHeroQuery] = useState('');
  const [batchSize, setBatchSize] = useState(25);
  const [pubFilter, setPubFilter] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(30);

  const profileQ = useQuery({ queryKey: ['profile', user?.id], queryFn: () => getProfile(user!.id), enabled: !!user });
  const gateResolved = !authLoading && (!user || profileQ.isSuccess || profileQ.isError);
  const isAdmin = !!profileQ.data?.is_admin;
  useEffect(() => {
    if (gateResolved && !isAdmin) router.replace('/explore');
  }, [gateResolved, isAdmin, router]);

  const { healthQ, gapsQ, runsQ, cronQ, heroSearchQ, pingQ, usageQ, distQ, snapsQ, spendQ } = useCatalogQueries({
    enabled: gateResolved && isAdmin,
    metric,
    page,
    pubFilter,
    heroQuery,
    historyLimit,
  });

  const drainJob = cronQ.data?.find((j) => j.jobname === DRAIN_CRON);
  const cronOn = !!drainJob?.active;
  const { log, toast, flash, logEvent, clearLog } = useActivityLog();
  const { busy, refreshing, onRunDrain, onRetryFailed, onStop, onSnapshot, onReenrich, onToggleCron, onRefresh } =
    useCatalogActions({ batchSize, cronOn, flash });

  const pickPublisher = (publisher: string) => {
    setPubFilter(publisher);
    setPage(0);
    setDomain('catalog');
  };
  const goToBackfill = (m: CoverageMetric = 'portrait') => {
    setMetric(m);
    setPage(0);
    setPubFilter(null);
    setDomain('catalog');
  };

  const h = healthQ.data;
  const overall = useMemo(() => {
    if (!h || h.total === 0) return 0;
    const ps = METRICS.map((m) => pct(h.metrics[m.key], h.total));
    return Math.round(ps.reduce((a, b) => a + b, 0) / ps.length);
  }, [h]);

  const anim = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!h) return;
    Animated.stagger(90, [
      Animated.timing(enter, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: false }),
    ]).start();
  }, [h, anim, enter]);

  // Run → activity-log streaming (UNCHANGED — copy the effect verbatim from the
  // current file: health.web.tsx:467-497, incl. seenRuns/runLogPrimed refs).
  // ... paste seenRuns/runLogPrimed refs + the useEffect here unchanged ...

  const alerts = useMemo<Alert[]>(() => {
    const usage = usageQ.data ?? 0;
    const recent = runsQ.data?.runs ?? [];
    const a: Alert[] = [];
    if (pingQ.data === 'limited')
      a.push({ tone: 'gold', text: 'ComicVine is rate-limited right now — drains will mostly retry.' });
    else if (usage >= CV_HOURLY_CAP * 0.8)
      a.push({ tone: 'gold', text: `ComicVine usage high — ${usage}/${CV_HOURLY_CAP} calls this hour.` });
    if ((h?.cvStatus.failed ?? 0) > 0)
      a.push({ tone: 'red', text: `${h!.cvStatus.failed} hero(es) marked failed — Retry failed in Operations.` });
    if (recent[0]?.status === 'error') a.push({ tone: 'red', text: 'The last run errored — see Operations.' });
    return a;
  }, [pingQ.data, usageQ.data, runsQ.data, h]);

  useEffect(() => {
    if (alerts.length <= 1) setAlertsOpen(false);
  }, [alerts.length]);

  if (!gateResolved || !isAdmin) return <LogoLoader />;

  // Derived ops values (UNCHANGED — copy from current file: health.web.tsx:524-556,
  // cvUsage/cvPctUsed/cvColor/runs/activeRun/etaLabel/perMin etc.)
  // ... paste those derivations here unchanged ...

  const ribbon = h ? (
    <VitalsBar
      narrow={narrow}
      pending={h.cvStatus.pending ?? 0}
      etaLabel={etaLabel}
      cvPing={pingQ.data}
      cvUsage={cvUsage}
      cvColor={cvColor}
      cvPctUsed={cvPctUsed}
      activeRun={activeRun}
      stopping={busy === 'stop'}
      onStop={onStop}
      cronOn={cronOn}
      drainJob={drainJob}
      spend={spendQ.data}
    />
  ) : null;

  const alertSlot = (
    <AlertStack
      alerts={alerts}
      narrow={narrow}
      open={alertsOpen}
      onOpen={() => setAlertsOpen(true)}
      onClose={() => setAlertsOpen(false)}
    />
  );

  return (
    <Animated.View style={[styles.root, { opacity: enter }]}>
      <CommandShell
        domain={domain}
        onDomain={setDomain}
        overall={overall}
        pending={h?.cvStatus.pending ?? 0}
        refreshing={refreshing}
        onRefresh={onRefresh}
        narrow={narrow}
        ribbon={ribbon}
        alerts={alertSlot}
      >
        {h && domain === 'command' && (
          <CommandHome
            h={h}
            overall={overall}
            snaps={snapsQ.data ?? []}
            dist={distQ.data}
            gaps={gapsQ.data}
            anim={anim}
            narrow={narrow}
            onJump={goToBackfill}
            onOpenSpend={() => setDomain('spend')}
          />
        )}
        {h && domain === 'catalog' && (
          <CatalogDomain
            h={h}
            gaps={gapsQ.data}
            gapsLoading={gapsQ.isLoading}
            dist={distQ.data}
            metric={metric}
            setMetric={setMetric}
            page={page}
            setPage={setPage}
            pubFilter={pubFilter}
            setPubFilter={setPubFilter}
            pickPublisher={pickPublisher}
            anim={anim}
            narrow={narrow}
          />
        )}
        {h && domain === 'operations' && (
          <OperationsDomain
            h={h}
            runs={runsQ.data?.runs ?? []}
            runsTotal={runsQ.data?.total ?? 0}
            runsLoading={runsQ.isLoading}
            runsFetching={runsQ.isFetching}
            onLoadMore={() => setHistoryLimit((l) => l + 30)}
            log={log}
            toast={toast}
            clearLog={clearLog}
            heroQuery={heroQuery}
            setHeroQuery={setHeroQuery}
            heroResults={heroSearchQ.data ?? []}
            heroSearchLoading={heroSearchQ.isLoading}
            batchSize={batchSize}
            setBatchSize={setBatchSize}
            busy={busy}
            cronOn={cronOn}
            onRunDrain={onRunDrain}
            onRetryFailed={onRetryFailed}
            onToggleCron={onToggleCron}
            onReenrich={onReenrich}
            narrow={narrow}
          />
        )}
        {domain === 'spend' && <SpendDomain spend={spendQ.data} loading={spendQ.isLoading} narrow={narrow} />}
        {domain === 'users' && (
          <PlaceholderDomain label="Users" icon="people-outline" blurb="User accounts, sessions, and engagement signals will live here." />
        )}
        {domain === 'traffic' && (
          <PlaceholderDomain label="Traffic" icon="trending-up-outline" blurb="Page views, search, and traffic analytics will live here." />
        )}
      </CommandShell>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
```

Add `useWindowDimensions` to the `react-native` import. Paste the three "UNCHANGED" blocks (run→log effect + its refs, and the derived ops values) verbatim from the current file at the marked spots. The `onSnapshot`/Snapshot-now control belongs to CommandHome's completeness panel header — pass `onSnapshot` + `busy` into `CommandHome` if you keep the snapshot button there (optional; if omitted, drop the import). For this plan, include snapshot in `CommandHome` by adding `onSnapshot` + `snapshotting={busy==='snapshot'}` props mirroring the current Completeness card header action.

- [ ] **Step 2: Typecheck** — Run: `yarn typecheck` — Expected: PASS (every removed local component is now imported; no unused symbols).

- [ ] **Step 3: Run the unit suite** — Run: `yarn test:ci` — Expected: PASS (hooks + format tests green; nothing else touched).

- [ ] **Step 4: Commit**

```bash
git add app/admin/health.web.tsx
git commit -m "feat(admin): rewrite health screen as Command Center shell + domain router"
```

---

## Task 7: Cleanup + verification

**Files:**
- Delete: `src/components/admin/health/Masthead.tsx`
- Modify: `src/components/admin/health/format.ts` (remove dead `TABS`/`TabKey`)

- [ ] **Step 1: Confirm `Masthead` and `TABS` are unreferenced**

Run: `grep -rn "Masthead\|TABS\|TabKey" src app __tests__`
Expected: only the definitions in `format.ts` (TABS/TabKey) and the `Masthead.tsx` file itself — no live importers. If any importer remains, it was missed in Task 6; fix before deleting.

- [ ] **Step 2: Delete Masthead and dead exports**

```bash
git rm src/components/admin/health/Masthead.tsx
```
Then remove the `TabKey` type and `TABS` constant from `format.ts` (the `DOMAINS` model replaced them).

- [ ] **Step 3: Typecheck + tests + format**

Run: `yarn typecheck && yarn test:ci && yarn format`
Expected: typecheck PASS, tests PASS, prettier writes no meaningful diffs beyond formatting.

- [ ] **Step 4: Manual verification (web)**

Run: `yarn web`, open `/admin/health` as an admin. Verify:
- Top bar (brand + overall gauge + refresh), dark rail with 4 active + 2 dimmed domains, pinned vitals ribbon, alerts under it.
- Rail switches Command / Catalog / Operations / Spend; Users/Traffic show "coming soon".
- Command home: gauge + coverage (tap → Catalog), completeness trend, queue preview, alignment, spend.
- Catalog: coverage→queue, queue pagination, publisher heatmap drill-down → Catalog filtered.
- Operations: run batch, retry failed, auto-drain toggle, run history load-more, activity log, hero console search + re-fetch.
- Resize below 760px: rail → bottom tab bar, bento → single column, ribbon wraps.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(admin): retire Masthead + TABS after Command Center migration"
```

---

## Self-review notes (author)

- **Spec coverage:** IA (Task 1 + 5 + 6), skin (Tasks 3/5), density (Task 1 + Panel/Bento Task 2), component split (Tasks 2–6), responsive (Task 5/6), preserved capabilities (Task 6 panels move every block; only the active-run/stop moves into the ribbon, which already renders it), future domains (Task 6b/6f). Spend-as-own-domain and read-only Command home are both honoured.
- **Data layer untouched:** `hooks.ts`/`catalogHealth.ts` unchanged; verified by reusing `useCatalogQueries`/`useCatalogActions`/`useActivityLog` as-is.
- **Type consistency:** `DomainKey` used identically in `format.ts`, `CommandShell`, and the shell. `onJump(metric?)` matches the old Masthead signature consumed by CommandHome. `setPage`/`setMetric`/`setPubFilter` signatures match the shell's `useState` setters.
- **Known latitude:** exact style-rule moves in Tasks 6c/6d/6e are described by source line ranges + new wrappers rather than re-pasting ~600 lines; the executor copies the named style rules verbatim from the current `styles` object. This is a mechanical extraction, not new design.
```
