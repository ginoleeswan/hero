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
  // A tall billboard (Apple TV / Disney+) so the portrait reads big.
  return insetTop + Math.round(SCREEN_HEIGHT * 0.5);
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

  // Normal-scroll parallax drift (clamps to 0 on overscroll; the page-level
  // content shift handles pinning the whole page during pull-down).
  const parallax = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, height], [0, height * 0.25], Extrapolation.CLAMP) },
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
          <SpotlightSlide
            hero={item}
            height={height}
            scrollY={scrollY}
            onPress={() => onHeroPress(item)}
          />
        )}
      />
      {heroes.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {heroes.map((h, i) => (
            <View key={h.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Rounded beige lip — a clean, deliberate edge from the dark billboard
          into the beige content page (echoes the character screen). */}
      <View style={styles.lip} pointerEvents="none" />
    </Animated.View>
  );
}

const LIP_HEIGHT = 24;

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.navy },
  dots: {
    position: 'absolute',
    bottom: LIP_HEIGHT + 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(245,235,220,0.4)' },
  dotActive: { width: 14, backgroundColor: COLORS.orange },
  lip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: LIP_HEIGHT,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
  },
});
