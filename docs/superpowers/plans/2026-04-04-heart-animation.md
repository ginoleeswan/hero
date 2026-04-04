# Heart Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static header heart with a floating `HeartButton` component that plays a Twitter-style burst animation (ring + dot scatter + heart pop) using Reanimated 4 when a hero is favourited.

**Architecture:** A new `HeartButton` component owns all animation logic via Reanimated 4 shared values and sub-components (`AnimatedRing`, `AnimatedDot`) that each call `useAnimatedStyle` — avoiding hooks-in-loops. The component is purely presentational; all favourite state stays in `[id].tsx`. The button is positioned absolutely in the character screen's root `View` as a sibling of `heroImageContainer`, avoiding the `overflow: hidden` clip on the image container.

**Tech Stack:** react-native-reanimated 4.2.1, @expo/vector-icons (Ionicons), COLORS palette, jest-expo + @testing-library/react-native

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/HeartButton.tsx` | **Create** | Animated heart button — ring, dots, heart pop |
| `__tests__/components/HeartButton.test.tsx` | **Create** | Behaviour tests for HeartButton |
| `app/character/[id].tsx` | **Modify** | Remove headerRight heart; add HeartButton positioned in root View |

---

## Task 1: Write failing tests for HeartButton

**Files:**
- Create: `__tests__/components/HeartButton.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/HeartButton.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HeartButton } from '../../src/components/HeartButton';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('HeartButton', () => {
  it('renders without crashing when not favourited', () => {
    const { getByTestId } = render(
      <HeartButton favourited={false} loading={false} onPress={() => {}} />,
    );
    expect(getByTestId('heart-button')).toBeTruthy();
  });

  it('renders without crashing when favourited', () => {
    const { getByTestId } = render(
      <HeartButton favourited={true} loading={false} onPress={() => {}} />,
    );
    expect(getByTestId('heart-button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <HeartButton favourited={false} loading={false} onPress={onPress} />,
    );
    fireEvent.press(getByTestId('heart-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when loading', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <HeartButton favourited={false} loading={true} onPress={onPress} />,
    );
    fireEvent.press(getByTestId('heart-button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail with "Cannot find module"**

```bash
bun run test:ci -- --testPathPattern="HeartButton" --verbose
```

Expected: FAIL — `Cannot find module '../../src/components/HeartButton'`

---

## Task 2: Implement HeartButton (static, no animation yet)

**Files:**
- Create: `src/components/HeartButton.tsx`

- [ ] **Step 1: Create HeartButton with static heart, testID wired up**

Create `src/components/HeartButton.tsx`:

```tsx
import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

const BUTTON_SIZE = 52;
const RING_SIZE = 80;
const DOT_SIZE = 6;
const DOT_DISTANCE = 35;

const DOT_ANGLES = [0, 60, 120, 180, 240, 300].map((deg) => (deg * Math.PI) / 180);
const DOT_COLORS = [
  COLORS.red,
  COLORS.orange,
  COLORS.yellow,
  COLORS.blue,
  COLORS.green,
  COLORS.brown,
];

interface HeartButtonProps {
  favourited: boolean;
  loading: boolean;
  onPress: () => void;
}

function AnimatedRing({
  scale,
  opacity,
}: {
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

function AnimatedDot({
  translateX,
  translateY,
  opacity,
  color,
}: {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  opacity: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: opacity.value,
    backgroundColor: color,
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function HeartButton({ favourited, loading, onPress }: HeartButtonProps) {
  const heartScale = useSharedValue(1);

  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  // 6 dot shared values — declared individually (React hooks rules)
  const d0x = useSharedValue(0); const d0y = useSharedValue(0); const d0o = useSharedValue(0);
  const d1x = useSharedValue(0); const d1y = useSharedValue(0); const d1o = useSharedValue(0);
  const d2x = useSharedValue(0); const d2y = useSharedValue(0); const d2o = useSharedValue(0);
  const d3x = useSharedValue(0); const d3y = useSharedValue(0); const d3o = useSharedValue(0);
  const d4x = useSharedValue(0); const d4y = useSharedValue(0); const d4o = useSharedValue(0);
  const d5x = useSharedValue(0); const d5y = useSharedValue(0); const d5o = useSharedValue(0);

  const dots = [
    { x: d0x, y: d0y, o: d0o },
    { x: d1x, y: d1y, o: d1o },
    { x: d2x, y: d2y, o: d2o },
    { x: d3x, y: d3y, o: d3o },
    { x: d4x, y: d4y, o: d4o },
    { x: d5x, y: d5y, o: d5o },
  ];

  useEffect(() => {
    if (favourited) {
      // Heart pop: scale up then settle
      heartScale.value = withSequence(
        withSpring(1.4, { damping: 4 }),
        withSpring(1, { damping: 10 }),
      );

      // Ring: expand from centre and fade out
      ringScale.value = 0;
      ringOpacity.value = 1;
      ringScale.value = withTiming(1, { duration: 400 });
      ringOpacity.value = withSequence(
        withTiming(1, { duration: 50 }),
        withDelay(200, withTiming(0, { duration: 200 })),
      );

      // Dots: fly outward radially with stagger, then fade
      dots.forEach((dot, i) => {
        const tx = DOT_DISTANCE * Math.cos(DOT_ANGLES[i]);
        const ty = DOT_DISTANCE * Math.sin(DOT_ANGLES[i]);
        dot.x.value = 0;
        dot.y.value = 0;
        dot.o.value = 0;
        dot.x.value = withDelay(i * 15, withSpring(tx, { damping: 15 }));
        dot.y.value = withDelay(i * 15, withSpring(ty, { damping: 15 }));
        dot.o.value = withDelay(
          i * 15,
          withSequence(withTiming(1, { duration: 50 }), withDelay(200, withTiming(0, { duration: 200 }))),
        );
      });
    } else {
      // Soft deflate on unfavourite — no burst
      heartScale.value = withSequence(
        withSpring(0.8, { damping: 8 }),
        withSpring(1, { damping: 12 }),
      );
    }
  }, [favourited]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  return (
    <TouchableOpacity
      testID="heart-button"
      onPress={onPress}
      disabled={loading}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.button}
    >
      <AnimatedRing scale={ringScale} opacity={ringOpacity} />

      {dots.map((dot, i) => (
        <AnimatedDot
          key={i}
          translateX={dot.x}
          translateY={dot.y}
          opacity={dot.o}
          color={DOT_COLORS[i]}
        />
      ))}

      <Animated.View style={heartStyle}>
        <Ionicons
          name={favourited ? 'heart' : 'heart-outline'}
          size={24}
          color={favourited ? COLORS.red : 'white'}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: COLORS.red,
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
bun run test:ci -- --testPathPattern="HeartButton" --verbose
```

Expected: PASS — all 4 tests green

- [ ] **Step 3: Commit**

```bash
git add src/components/HeartButton.tsx __tests__/components/HeartButton.test.tsx
git commit -m "feat: add animated HeartButton component with Twitter-style burst"
```

---

## Task 3: Wire HeartButton into the character screen

**Files:**
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Add the import and remove `headerRight`**

At the top of `app/character/[id].tsx`, add the import after the existing component imports:

```tsx
import { HeartButton } from '../../src/components/HeartButton';
```

In the `Stack.Screen` options block (around line 242), remove the entire `headerRight` block:

```tsx
// DELETE this entire block:
headerRight: user
  ? () => (
      <TouchableOpacity
        onPress={toggleFavourite}
        disabled={favLoading}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.headerBtn}
      >
        <Ionicons
          name={favourited ? 'heart' : 'heart-outline'}
          size={22}
          color={favourited ? COLORS.red : undefined}
        />
      </TouchableOpacity>
    )
  : undefined,
```

- [ ] **Step 2: Add HeartButton to the root View**

In the JSX returned by `CharacterScreen`, after the closing `</Animated.ScrollView>` tag and before the closing `</View>`, add:

```tsx
{user && (
  <View style={styles.heartButtonContainer}>
    <HeartButton
      favourited={favourited}
      loading={favLoading}
      onPress={toggleFavourite}
    />
  </View>
)}
```

- [ ] **Step 3: Add the container style**

In the `StyleSheet.create` call, add:

```ts
heartButtonContainer: {
  position: 'absolute',
  top: HERO_IMAGE_HEIGHT - 52 - 20,
  right: 20,
},
```

- [ ] **Step 4: Run the full test suite**

```bash
bun run test:ci
```

Expected: all tests PASS (HeartButton + HeroCard + existing tests)

- [ ] **Step 5: Commit**

```bash
git add app/character/[id].tsx
git commit -m "feat: replace header heart with floating animated HeartButton on character screen"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Ring burst ✓, dot scatter ✓, heart pop ✓, unfavourite deflate ✓, floating position ✓, headerRight removed ✓, props interface matches spec ✓
- [x] **No placeholders:** All steps have complete code
- [x] **Type consistency:** `SharedValue<number>` used throughout, `AnimatedRing`/`AnimatedDot` props match their usage in HeartButton
- [x] **Overflow:** HeartButton sits outside `heroImageContainer` (which has `overflow: hidden`) — positioned as sibling in root View, so particles are not clipped
- [x] **Hooks rules:** `useAnimatedStyle` called in sub-components (`AnimatedRing`, `AnimatedDot`), not in loops in `HeartButton`
