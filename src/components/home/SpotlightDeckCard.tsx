// src/components/home/SpotlightDeckCard.tsx — one portrait in the tablet deck.
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';

// Ken Burns drift on the active plate — mirrors web's `spotlightIn` (opacity
// 0→1, 700ms ease-out) and `spotlightDrift` (scale 1.07→1, 7s ease-out) CSS
// keyframes (`ensurePlateKeyframes` in explore.web.tsx). Keyed on `active`
// rather than mount: an autoplay tick remounts this component (the parent's
// list key changes the front slot's hero+index together), but a direct tap on
// a sliver promotes a hero whose `index` field doesn't change — same React
// key, same instance, only the `active` prop flips — so the effect has to
// replay on that transition too, not just on mount.
const FADE_MS = 700;
const DRIFT_MS = 7000;

export function SpotlightDeckCard({
  hero,
  width,
  height,
  opacity,
  active,
  onPress,
}: {
  hero: Hero;
  width: number;
  height: number;
  opacity: number;
  /** The front card opens the character; the rest step forward in the deck. */
  active: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  // Slivers, and everything under Reduce Motion, park at rest immediately —
  // only a card that is active AND allowed to animate starts pulled back.
  const animate = active && !reduced;
  const fade = useSharedValue(animate ? 0 : 1);
  const scale = useSharedValue(animate ? 1.07 : 1);

  useEffect(() => {
    if (!animate) {
      // Demoted, or Reduce Motion flipped on mid-dwell — settle at rest
      // rather than let an in-flight tween finish on its own schedule.
      fade.value = 1;
      scale.value = 1;
      return;
    }
    fade.value = 0;
    scale.value = 1.07;
    fade.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.ease) });
    scale.value = withTiming(1, { duration: DRIFT_MS, easing: Easing.out(Easing.ease) });
  }, [animate, fade, scale]);

  const artStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={active ? 'link' : 'button'}
      accessibilityLabel={active ? `View ${hero.name}` : `Show ${hero.name}`}
      style={[styles.card, { width, height, opacity }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, artStyle]}>
        <HeroImage
          id={hero.id}
          name={hero.name}
          imageUrl={hero.image_url}
          portraitUrl={hero.portrait_url}
          contentFit="cover"
          // These portraits are a profile head-and-shoulders on a flat field: the
          // face sits in the upper third and the sides are background. Anchoring
          // high keeps the head whole even in a 20pt sliver, and spends the loss
          // on empty colour — the same reasoning as the web plate.
          contentPosition={{ top: '8%', left: '50%' }}
          style={StyleSheet.absoluteFill}
          recyclingKey={hero.id}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
  },
});
