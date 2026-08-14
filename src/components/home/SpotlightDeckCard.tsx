// src/components/home/SpotlightDeckCard.tsx — one portrait in the tablet deck.
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';

/** How long the name label takes to cross-fade between active/next/hidden —
 *  mirrors web's `transition: 'opacity 250ms ease'` on `pss.cardName`. */
const NAME_FADE_MS = 250;

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
  next,
  onPress,
}: {
  hero: Hero;
  width: number;
  height: number;
  opacity: number;
  /** The front card opens the character; the rest step forward in the deck. */
  active: boolean;
  /** The card directly behind the active one — web's smaller, dimmer
   *  `cardNameNext` treatment, a preview of what's coming up. */
  next: boolean;
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

  // Web's cardName opacity: 1 active, 0.7 the next card in the deck, 0
  // everything further back — cross-faded rather than snapped.
  const targetNameOpacity = active ? 1 : next ? 0.7 : 0;
  const nameOpacity = useSharedValue(targetNameOpacity);
  useEffect(() => {
    nameOpacity.value = reduced
      ? targetNameOpacity
      : withTiming(targetNameOpacity, { duration: NAME_FADE_MS, easing: Easing.out(Easing.ease) });
  }, [targetNameOpacity, reduced, nameOpacity]);
  const nameAnimatedStyle = useAnimatedStyle(() => ({ opacity: nameOpacity.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={active ? 'link' : 'button'}
      accessibilityLabel={active ? `View ${hero.name}` : `Show ${hero.name}`}
      style={[styles.card, { width, height, opacity }, active && styles.cardActive]}
    >
      {/* The shadow (cardActive, above) has to live on this outer, unclipped
          Pressable — a shadow on a view with `overflow: 'hidden'` gets
          clipped along with everything else, so the art/name/overlay move to
          an inner clipped layer instead. */}
      <View style={styles.clip}>
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
        {/* Scrim under the name — web's `cardOverlay`, a bottom-anchored
            linear-gradient so the name reads over any art. */}
        <LinearGradient
          colors={['rgba(15,20,24,0.95)', 'rgba(15,20,24,0.15)', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.Text
          style={[styles.name, next && styles.nameNext, nameAnimatedStyle]}
          numberOfLines={2}
        >
          {hero.name}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.deepNavy,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  // web's `pss.cardActive` boxShadow — approximated as a single native shadow
  // (RN has no multi-layer box-shadow) plus its Android equivalent.
  cardActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  clip: {
    flex: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  // Matches web's `pss.cardName` — Flame is the display face everywhere.
  name: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    // ~1.28× — clamped (numberOfLines) Flame clips below 1.22×.
    lineHeight: 23,
    color: COLORS.beige,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    zIndex: 2,
  },
  // web's `pss.cardNameNext` — smaller and tucked closer to the corner, a
  // preview rather than a headline.
  nameNext: {
    fontSize: 12,
    lineHeight: 16,
    bottom: 10,
    left: 10,
  },
});
