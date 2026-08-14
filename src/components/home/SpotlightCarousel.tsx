// src/components/home/SpotlightCarousel.tsx
import { useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useReducedMotion, type SharedValue } from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';
import * as Haptics from 'expo-haptics';
import { SpotlightSlide } from './SpotlightSlide';
import { SpotlightProgress } from './SpotlightProgress';
import { SpotlightDeck, TABLET_TAB_CLEARANCE } from './SpotlightDeck';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';
import { SPOTLIGHT } from './homeGeometry';
import { spotlightHeightFor } from '../../constants/layout';
import { spotlightLayout } from '../../constants/spotlightLayout';

// One clock for the carousel AND its progress fill — a pill timed against a
// different number than the advance is a clock that lies.
const AUTOPLAY_MS = 6000;

/** Above this the billboard is a deck of correctly-proportioned cards rather
 *  than one full-bleed crop. It is `spotlightLayout`'s own stacked threshold,
 *  not `BREAKPOINTS.tablet` (700) — this number is tuned to the card
 *  arithmetic, and a 20pt band where the page is "tablet" but the billboard is
 *  still a phone billboard costs nothing. */
export const SPOTLIGHT_DECK_MIN_WIDTH = 720;

export function usesSpotlightDeck(width: number): boolean {
  return width >= SPOTLIGHT_DECK_MIN_WIDTH;
}

/**
 * A tall billboard (Apple TV / Disney+) so the portrait reads big — below the
 * deck threshold.
 *
 * Takes the window rather than reading it at import: on a tablet in portrait,
 * half the height is a near-square slab that eats the entire fold, so the
 * height is also capped against the width. See constants/layout.ts.
 *
 * Above the threshold the answer comes from `spotlightLayout` instead, so the
 * skeleton and the feed agree on the deck's stage without either restating it.
 */
export function spotlightHeight(width: number, height: number, insetTop: number): number {
  // The deck is cards, not full-bleed art — a card clipped by the status bar
  // (0–44pt) or iPadOS's floating top tab pill (~19–71pt) reads as broken, so
  // the stage grows to clear both. See TABLET_TAB_CLEARANCE.
  if (usesSpotlightDeck(width)) {
    return spotlightLayout(width).stageHeight + insetTop + TABLET_TAB_CLEARANCE;
  }
  return spotlightHeightFor(width, height, insetTop);
}

export function SpotlightCarousel({
  heroes,
  insetTop,
  scrollY,
  onHeroPress,
  showLip = true,
}: {
  heroes: Hero[];
  insetTop: number;
  scrollY: SharedValue<number>;
  onHeroPress: (hero: Hero) => void;
  /** The rounded beige lip into the sheet. Off when a dark zone follows the
   *  billboard (the seam moves to the first beige section instead). */
  showLip?: boolean;
}) {
  const { width: winW, height: winH } = useWindowDimensions();
  const height = spotlightHeight(winW, winH, insetTop);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();

  if (heroes.length === 0) return null;

  // Tablet widths get the deck. The phone path below is untouched: it is tuned,
  // shipped, and the defect this branch fixes does not exist at phone widths.
  if (usesSpotlightDeck(winW)) {
    return (
      <View style={[styles.wrap, { height }]}>
        <SpotlightDeck heroes={heroes} insetTop={insetTop} onHeroPress={onHeroPress} />
        {showLip && <View style={styles.lip} pointerEvents="none" />}
      </View>
    );
  }

  // No transform on the wrap — it scrolls uniformly with the page so the beige
  // lip stays glued to the content sheet below. The pull-down zoom lives on the
  // slide image (scrollY), and the page-level shift handles the overscroll pin.
  return (
    <View style={[styles.wrap, { height }]}>
      <Carousel
        width={winW}
        height={height}
        data={heroes}
        loop={heroes.length > 1}
        autoPlay={heroes.length > 1 && !reduced}
        autoPlayInterval={AUTOPLAY_MS}
        scrollAnimationDuration={750}
        onSnapToItem={(i: number) => {
          setActive(i);
          // Only on a user-driven swipe — an unattended auto-advance shouldn't
          // buzz the device, and under Reduce Motion there's no auto-advance.
          if (!reduced) Haptics.selectionAsync();
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
        <View style={styles.progress} pointerEvents="none">
          <SpotlightProgress count={heroes.length} active={active} intervalMs={AUTOPLAY_MS} />
        </View>
      )}

      {/* Rounded beige lip — a clean, deliberate edge from the dark billboard
          into the beige content page (echoes the character screen). Off when a
          dark stage follows; then the seam lives on the first beige section. */}
      {showLip && <View style={styles.lip} pointerEvents="none" />}
    </View>
  );
}

const LIP_HEIGHT = 24;

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.deepNavy },
  progress: {
    position: 'absolute',
    bottom: SPOTLIGHT.dotsBottom,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
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
