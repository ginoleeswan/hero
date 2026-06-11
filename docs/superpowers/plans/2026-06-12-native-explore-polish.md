# Native Explore Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the native Explore screen within the carousel model — a cinematic swipeable spotlight, ranked leaderboard rows, per-category editorial rhythm, and scroll micro-interactions.

**Architecture:** A pure `rowStyle(key)` helper centralises per-category styling. `HomeHeroRow` gains `ranked`/`accent`/`feature` props. `SpotlightBanner` is replaced by a `SpotlightCarousel` (paging via the existing `react-native-reanimated-carousel`) of `SpotlightSlide`s. `explore.tsx` wires a `scrollY` Animated.Value that drives spotlight parallax and a scroll-revealed `StickyHeader`.

**Tech Stack:** React Native legacy `Animated` API (matches the existing screen), `react-native-reanimated-carousel` v4, expo-image, expo-haptics, Ionicons, expo-router.

**Spec:** `docs/superpowers/specs/2026-06-12-native-explore-polish-design.md`

**Conventions:** TypeScript, no `any`; functional components; `StyleSheet.create`; fonts Flame-Bold (headings) / FlameSans-Regular / Nunito_* (UI); base colour `COLORS.beige`. Per `CLAUDE.md`, do NOT unit-test full-screen rendering/navigation — only `rowStyle` is unit-tested; the rest is `tsc` + manual.

`COLORS` keys available: `beige, orange, navy, deepNavy, grey, red, yellow, green, skin, blue, black, brown, purple, gold, goldAccent`.

---

## File Structure

- **Create** `src/lib/home/rowStyle.ts` + `__tests__/lib/home/rowStyle.test.ts` (Task 1)
- **Modify** `src/components/home/HomeHeroRow.tsx` — `ranked`/`accent`/`feature` + `RankBadge` (Task 2)
- **Create** `src/components/home/SpotlightSlide.tsx` (Task 3)
- **Create** `src/components/home/SpotlightCarousel.tsx` (Task 4)
- **Create** `src/components/home/StickyHeader.tsx` (Task 5)
- **Modify** `app/(tabs)/explore.tsx`; **Delete** `src/components/home/SpotlightBanner.tsx` (Task 6)

---

### Task 1: `rowStyle` helper (TDD)

**Files:**
- Create: `src/lib/home/rowStyle.ts`
- Test: `__tests__/lib/home/rowStyle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/home/rowStyle.test.ts
import { rowStyle } from '../../../src/lib/home/rowStyle';
import { COLORS } from '../../../src/constants/colors';

describe('rowStyle', () => {
  it('marks leaderboard categories as ranked', () => {
    expect(rowStyle('iconic').ranked).toBe(true);
    expect(rowStyle('strongest').ranked).toBe(true);
    expect(rowStyle('minds').ranked).toBe(true);
    expect(rowStyle('villains').ranked).toBe(false);
  });

  it('makes the first curated row (iconic) the feature row', () => {
    expect(rowStyle('iconic').feature).toBe(true);
    expect(rowStyle('villains').feature).toBe(false);
  });

  it('puts villains, anti-heroes and strongest on dark bands', () => {
    expect(rowStyle('villains').tone).toBe('dark');
    expect(rowStyle('anti').tone).toBe('dark');
    expect(rowStyle('strongest').tone).toBe('dark');
    expect(rowStyle('iconic').tone).toBe('light');
  });

  it('assigns per-category accent colours', () => {
    expect(rowStyle('villains').accent).toBe(COLORS.red);
    expect(rowStyle('dc').accent).toBe(COLORS.blue);
    expect(rowStyle('xmen').accent).toBe(COLORS.purple);
  });

  it('falls back to a sane default for unknown keys', () => {
    const s = rowStyle('totally-unknown');
    expect(s).toEqual({ tone: 'light', accent: COLORS.orange, ranked: false, feature: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest rowStyle.test --ci`
Expected: FAIL — `Cannot find module '.../src/lib/home/rowStyle'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/home/rowStyle.ts
import { COLORS } from '../../constants/colors';

export interface RowStyle {
  tone: 'light' | 'dark';
  accent: string; // accent bar + label colour
  ranked: boolean; // overlay 1·2·3 chart numerals
  feature: boolean; // larger first-row card treatment
}

const DEFAULT: RowStyle = {
  tone: 'light',
  accent: COLORS.orange,
  ranked: false,
  feature: false,
};

// Per-category overrides keyed by the catalog `key` used in explore.tsx.
const MAP: Record<string, Partial<RowStyle>> = {
  iconic: { feature: true, ranked: true, accent: COLORS.orange },
  villains: { tone: 'dark', accent: COLORS.red },
  marvel: { accent: COLORS.red },
  dc: { accent: COLORS.blue },
  anti: { tone: 'dark', accent: COLORS.grey },
  strongest: { tone: 'dark', ranked: true, accent: COLORS.yellow },
  xmen: { accent: COLORS.purple },
  minds: { ranked: true, accent: COLORS.blue },
  new: { accent: COLORS.green },
};

/** Editorial style for a curated Explore row, keyed by its catalog key. */
export function rowStyle(key: string): RowStyle {
  return { ...DEFAULT, ...MAP[key] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest rowStyle.test --ci`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/home/rowStyle.ts __tests__/lib/home/rowStyle.test.ts
git commit -m "feat(explore): rowStyle helper for per-category editorial styling"
```

---

### Task 2: `HomeHeroRow` — ranked / accent / feature

**Files:**
- Modify: `src/components/home/HomeHeroRow.tsx`

Context: read the file first. It exports `HomeHeroRow` with props `{ label?, title, heroes, variant?, tone?, onPress, onViewAll?, disabled? }`. Portrait cards render through `PortraitZoomCard` using `PORTRAIT_CARD_WIDTH`/`PORTRAIT_CARD_HEIGHT` constants and `HeroCard`. The accent bar uses `styles.accentBar` (orange); the label uses `styles.label` (orange).

- [ ] **Step 1: Extend the props**

Add three optional props to `HomeHeroRowProps`:

```tsx
  /** Overlay 1·2·3 chart numerals on the cards (leaderboard rows). */
  ranked?: boolean;
  /** Accent colour for the bar + label (defaults to orange). */
  accent?: string;
  /** Larger first-row card treatment. */
  feature?: boolean;
```

And destructure them in the component signature with defaults:

```tsx
export function HomeHeroRow({
  label,
  title,
  heroes,
  variant = 'portrait',
  tone = 'light',
  ranked = false,
  accent,
  feature = false,
  onPress,
  onViewAll,
  disabled = false,
}: HomeHeroRowProps) {
```

- [ ] **Step 2: Add a `RankBadge` subcomponent**

Above `HomeHeroRow`, add:

```tsx
/** Oversized chart numeral overlaid on a ranked card's corner. */
function RankBadge({ rank }: { rank: number }) {
  return (
    <View style={styles.rankBadge} pointerEvents="none">
      <Text style={styles.rankNumeral}>{rank}</Text>
    </View>
  );
}
```

- [ ] **Step 3: Feature sizing + thread props into the card**

`PortraitZoomCard` currently hardcodes `PORTRAIT_CARD_WIDTH`/`HEIGHT`. Give it optional `width`/`height`/`rank` props so the row can pass a feature size and the rank overlay:

```tsx
function PortraitZoomCard({
  item,
  width = PORTRAIT_CARD_WIDTH,
  height = PORTRAIT_CARD_HEIGHT,
  rank,
}: {
  item: RowHero;
  width?: number;
  height?: number;
  rank?: number;
}) {
```

Inside, replace the hardcoded `PORTRAIT_CARD_WIDTH`/`PORTRAIT_CARD_HEIGHT` usages in the `HeroCard` props and the `cardSlot` style with `width`/`height`:

```tsx
      <Pressable
        style={[styles.cardSlot, { width, height }]}
        ...
      >
        <Animated.View style={[styles.cardVisual, animatedStyle]}>
          <Link.AppleZoom>
            <HeroCard
              id={item.id}
              name={item.name}
              imageUrl={item.image_url}
              portraitUrl={item.portrait_url}
              width={width}
              height={height}
            />
          </Link.AppleZoom>
          {typeof rank === 'number' && <RankBadge rank={rank} />}
        </Animated.View>
      </Pressable>
```

Remove the fixed `width`/`height` from the `cardSlot` style object in `StyleSheet` (they're now inline) — keep its `marginVertical`.

- [ ] **Step 4: Apply accent + feature + ranked in the row render**

In the header, colour the accent bar and label with `accent` when provided:

```tsx
        <View style={[styles.accentBar, accent ? { backgroundColor: accent } : null]} />
```
```tsx
          {!!label && (
            <Text style={[styles.label, accent ? { color: accent } : null]}>{label}</Text>
          )}
```

Compute the feature card size and snap interval, and pass `rank`/size into portrait cards:

```tsx
  const featW = Math.round(PORTRAIT_CARD_WIDTH * 1.18);
  const featH = Math.round(PORTRAIT_CARD_HEIGHT * 1.18);
  const cardW = feature ? featW : PORTRAIT_CARD_WIDTH;
  const cardH = feature ? featH : PORTRAIT_CARD_HEIGHT;
```

In the `FlatList`, update `snapToInterval` and `renderItem`:

```tsx
        snapToInterval={isPortrait ? cardW + 12 : undefined}
        renderItem={({ item, index }) =>
          isPortrait ? (
            <PortraitZoomCard
              item={item}
              width={cardW}
              height={cardH}
              rank={ranked ? index + 1 : undefined}
            />
          ) : (
            <ThumbCard item={item} onPress={() => onPress(item)} disabled={disabled} />
          )
        }
```

- [ ] **Step 5: Add the rank styles**

In `StyleSheet.create`, add:

```tsx
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 12,
  },
  rankNumeral: {
    fontFamily: 'Flame-Bold',
    fontSize: 64,
    lineHeight: 64,
    color: 'rgba(245,235,220,0.92)',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
```

- [ ] **Step 6: Type-check**

Run: `yarn tsc --noEmit`
Expected: no new errors in `HomeHeroRow.tsx` (pre-existing `absoluteFillObject`/`app.config.ts` errors are unrelated).

- [ ] **Step 7: Commit**

```bash
git add src/components/home/HomeHeroRow.tsx
git commit -m "feat(explore): ranked numerals, accent colour, feature size on HomeHeroRow"
```

---

### Task 3: `SpotlightSlide` component

**Files:**
- Create: `src/components/home/SpotlightSlide.tsx`

Context: this is the per-hero visual lifted from `SpotlightBanner.tsx` (read it for the gradient/meta styling), plus a Ken-Burns drift and a CTA pill. `Hero` is imported from `../../lib/db/heroes`. `heroImageSource(id, image_url, portrait_url)` returns an expo-image source.

- [ ] **Step 1: Create the component**

```tsx
// src/components/home/SpotlightSlide.tsx
import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { heroImageSource } from '../../constants/heroImages';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';

export function SpotlightSlide({
  hero,
  height,
  onPress,
}: {
  hero: Hero;
  height: number;
  onPress: () => void;
}) {
  const source = heroImageSource(hero.id, hero.image_url, hero.portrait_url);

  // Slow Ken-Burns drift — a continuous, gentle scale so the portrait feels alive.
  const kb = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(kb, { toValue: 1, duration: 9000, useNativeDriver: true }),
        Animated.timing(kb, { toValue: 0, duration: 9000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [kb]);
  const scale = kb.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.container, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
        <Image
          source={source}
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill}
          cachePolicy="memory-disk"
          recyclingKey={hero.id}
          transition={200}
        />
      </Animated.View>
      <LinearGradient
        colors={['transparent', 'rgba(245,235,220,0.6)', COLORS.beige]}
        locations={[0.45, 0.78, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.meta}>
        <Text style={styles.metaLabel}>Featured Hero</Text>
        <Text style={styles.metaName} numberOfLines={2}>
          {hero.name}
        </Text>
        {!!hero.publisher && (
          <Text style={styles.metaPublisher} numberOfLines={1}>
            {hero.publisher}
          </Text>
        )}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>View hero</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.beige} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: COLORS.navy },
  meta: { position: 'absolute', bottom: 54, left: 16, right: 16 },
  metaLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaName: { fontFamily: 'Flame-Bold', fontSize: 30, color: COLORS.navy, lineHeight: 32 },
  metaPublisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: COLORS.orange,
  },
  ctaText: { fontFamily: 'Nunito_900Black', fontSize: 12.5, color: COLORS.beige },
});
```

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit`
Expected: no new errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/SpotlightSlide.tsx
git commit -m "feat(explore): SpotlightSlide — Ken-Burns drift + View hero CTA"
```

---

### Task 4: `SpotlightCarousel` component

**Files:**
- Create: `src/components/home/SpotlightCarousel.tsx`

Context: owns paging + parallax + autoplay. `react-native-reanimated-carousel`'s default export is `Carousel`. **`explore.tsx` uses Reanimated's `Animated`**, so the parallax here is driven by a Reanimated `SharedValue<number>` via `useAnimatedStyle`. Preserve `spotlightHeight(insetTop)` math (define it here, since `SpotlightBanner.tsx` is being deleted).

- [ ] **Step 1: Create the component**

```tsx
// src/components/home/SpotlightCarousel.tsx
import { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';
import * as Haptics from 'expo-haptics';
import { SpotlightSlide } from './SpotlightSlide';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function spotlightHeight(insetTop: number): number {
  return insetTop + Math.round(SCREEN_HEIGHT * 0.42);
}

export function SpotlightCarousel({
  heroes,
  insetTop,
  scrollY,
  onHeroPress,
}: {
  heroes: Hero[];
  insetTop: number;
  scrollY: SharedValue<number>;
  onHeroPress: (hero: Hero) => void;
}) {
  const height = spotlightHeight(insetTop);
  const [active, setActive] = useState(0);

  // Parallax: the spotlight drifts up at a fraction of scroll speed.
  const parallax = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, height],
          [0, height * 0.25],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  if (heroes.length === 0) return null;

  return (
    <Animated.View style={[styles.wrap, { height }, parallax]}>
      <Carousel
        width={SCREEN_WIDTH}
        height={height}
        data={heroes}
        loop={heroes.length > 1}
        autoPlay={heroes.length > 1}
        autoPlayInterval={6000}
        scrollAnimationDuration={750}
        onSnapToItem={(i: number) => {
          setActive(i);
          Haptics.selectionAsync();
        }}
        renderItem={({ item }: { item: Hero }) => (
          <SpotlightSlide hero={item} height={height} onPress={() => onHeroPress(item)} />
        )}
      />
      {heroes.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {heroes.map((h, i) => (
            <View key={h.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.navy },
  dots: { position: 'absolute', bottom: 28, left: 16, flexDirection: 'row', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(41,60,67,0.3)' },
  dotActive: { width: 14, backgroundColor: COLORS.orange },
});
```

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit`
Expected: no new errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/SpotlightCarousel.tsx
git commit -m "feat(explore): SpotlightCarousel — swipeable autoplay + scroll parallax"
```

---

### Task 5: `StickyHeader` component

**Files:**
- Create: `src/components/home/StickyHeader.tsx`

Context: a thin top bar that fades + slides in once the user scrolls past the spotlight. Absolutely positioned, safe-area aware. Driven by the page `scrollY` and the spotlight `height`.

- [ ] **Step 1: Create the component**

```tsx
// src/components/home/StickyHeader.tsx
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';

export function StickyHeader({
  scrollY,
  revealAt,
  insetTop,
}: {
  scrollY: SharedValue<number>;
  revealAt: number; // scroll offset at which the bar is fully shown
  insetTop: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [revealAt - 80, revealAt], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [revealAt - 80, revealAt],
          [-8, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.bar, { paddingTop: insetTop }, style]}>
      <View style={styles.inner}>
        <Text style={styles.eyebrow}>Discover</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: COLORS.beige,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.12)',
  },
  inner: { height: 44, justifyContent: 'center', paddingHorizontal: 16 },
  eyebrow: { fontFamily: 'Flame-Bold', fontSize: 18, color: COLORS.navy },
});
```

- [ ] **Step 2: Type-check**

Run: `yarn tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/StickyHeader.tsx
git commit -m "feat(explore): StickyHeader revealed on scroll"
```

---

### Task 6: Wire it into `explore.tsx` + delete `SpotlightBanner`

**Files:**
- Modify: `app/(tabs)/explore.tsx`
- Delete: `src/components/home/SpotlightBanner.tsx`

Context: read `explore.tsx` first. It imports `SpotlightBanner` (line ~10), has `SPOTLIGHT_POOL = 5`, a `spotlightIndex` state + a rotation `useEffect`, `spotlightHero`/`spotlightTotal`, an `Animated.ScrollView`, and a `curatedRows` array of `{ key, label, title, heroes, route? }` rendered with `tone={i % 2 === 1 ? 'dark' : 'light'}`.

- [ ] **Step 1: Swap imports**

Replace the `SpotlightBanner` import with the carousel + sticky header + rowStyle:

```tsx
import { SpotlightCarousel, spotlightHeight } from '../../src/components/home/SpotlightCarousel';
import { StickyHeader } from '../../src/components/home/StickyHeader';
import { rowStyle } from '../../src/lib/home/rowStyle';
```

- [ ] **Step 2: Remove the manual rotation, add a Reanimated scrollY**

`explore.tsx` already imports `Animated, { FadeIn }` from `react-native-reanimated`, so use the Reanimated scroll pattern. Update that import to also pull the scroll hooks:

```tsx
import Animated, { FadeIn, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
```

Delete the `spotlightIndex` state, the rotation `useEffect` (the one with `setSpotlightIndex`/`SPOTLIGHT_POOL` interval), and the `spotlightHero`/`spotlightTotal` derivations. Add the shared value + handler + pool near the other hooks:

```tsx
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const spotlightPool = popular.slice(0, SPOTLIGHT_POOL);
```

- [ ] **Step 3: Drive scroll + render the carousel and sticky header**

Add `onScroll={scrollHandler}` to the `Animated.ScrollView` and render the carousel + sticky header. Replace the `<SpotlightBanner .../>` block with `<SpotlightCarousel .../>`:

```tsx
      <StickyHeader scrollY={scrollY} revealAt={spotlightHeight(insets.top) * 0.6} insetTop={insets.top} />
      <Animated.ScrollView
        entering={FadeIn.duration(280)}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
      >
        {spotlightPool.length > 0 && (
          <SpotlightCarousel
            heroes={spotlightPool}
            insetTop={insets.top}
            scrollY={scrollY}
            onHeroPress={handlePress}
          />
        )}
```

- [ ] **Step 4: Apply `rowStyle` to the curated rows**

Replace the `curatedRows.map(...)` render so each row pulls its editorial style:

```tsx
          {curatedRows.map((r) => {
            if (r.heroes.length === 0) return null;
            const rs = rowStyle(r.key);
            return (
              <HomeHeroRow
                key={r.key}
                label={r.label}
                title={r.title}
                tone={rs.tone}
                accent={rs.accent}
                ranked={rs.ranked}
                feature={rs.feature}
                heroes={r.heroes.map(toRowHero)}
                onPress={handlePress}
                onViewAll={r.route ? () => router.push(r.route!) : undefined}
                disabled={navigating}
              />
            );
          })}
```

(The old `tone={i % 2 === 1 ? 'dark' : 'light'}` index alternation is replaced by `rowStyle`; the `i` param is no longer needed.)

- [ ] **Step 5: Delete the old banner**

```bash
git rm src/components/home/SpotlightBanner.tsx
```

Confirm nothing else imports it:

Run: `grep -rn "SpotlightBanner" app src`
Expected: no remaining references.

- [ ] **Step 6: Type-check + tests**

Run: `yarn tsc --noEmit`
Expected: no new errors in `explore.tsx`.
Run: `yarn test:ci`
Expected: all suites pass (incl. `rowStyle.test`).

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/explore.tsx"
git commit -m "feat(explore): cinematic spotlight carousel, editorial rows, sticky header"
```

- [ ] **Step 8: Manual verification**

Run the app (iOS). Confirm: the spotlight **swipes** and auto-advances with a parallax drift and a "View hero" CTA; the **Most Iconic** row is larger (feature) with **1·2·3** numerals; **Strongest**/**Brightest Minds** also show numerals; Villains/Anti-Heroes/Strongest sit on **dark bands**; accent colours vary per category; a **"Discover"** bar fades in once you scroll past the spotlight; a light haptic fires on spotlight slide changes.

---

## Self-Review

**Spec coverage:**
- Cinematic spotlight (carousel + slide + Ken-Burns + CTA + parallax + dots) → Tasks 3, 4, 6. ✓
- Ranked rows → Task 2 (`ranked`/`RankBadge`) + Task 1 (`rowStyle` flags) + Task 6. ✓
- Editorial rhythm (accent, feature, dark bands, via `rowStyle`) → Tasks 1, 2, 6. ✓
- Scroll micro-interactions (scrollY, sticky header, parallax, snap haptic) → Tasks 4, 5, 6. ✓
- Delete `SpotlightBanner` → Task 6. ✓
- `rowStyle` unit-tested → Task 1. ✓

**Placeholder scan:** No TBD/TODO; every code step is complete. The scroll wiring is committed to Reanimated (verified: `explore.tsx` imports `Animated` from `react-native-reanimated`), so `scrollY` is a `SharedValue<number>` end to end (explore → SpotlightCarousel → StickyHeader).

**Type consistency:** `rowStyle(key)` returns `{ tone, accent, ranked, feature }` — exactly the props Task 2 adds to `HomeHeroRow` and Task 6 passes. `spotlightHeight` is defined in `SpotlightCarousel` (Task 4) and imported in `explore.tsx` (Task 6). `SpotlightCarousel` props `{ heroes, insetTop, scrollY, onHeroPress }` match the Task 6 call. `SpotlightSlide` props `{ hero, height, onPress }` match the Task 4 render. `onHeroPress`/`handlePress` take a `Hero`-shaped item (explore's existing `handlePress` accepts `{ id, portrait_url?, image_url? }`, satisfied by `Hero`).
