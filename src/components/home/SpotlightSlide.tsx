// src/components/home/SpotlightSlide.tsx
import { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolation,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';
import { SPOTLIGHT } from './homeGeometry';
import { ALIGNMENT_LABELS } from '../../lib/characterTaxonomy';

// Wording lives in src/lib/characterTaxonomy.ts — five surfaces render this
// same chip and they had drifted.
const ALIGN_LABEL = ALIGNMENT_LABELS;

export function SpotlightSlide({
  hero,
  height,
  scrollY,
  onPress,
}: {
  hero: Hero;
  height: number;
  scrollY: SharedValue<number>;
  onPress: () => void;
}) {
  const align = hero.alignment ? ALIGN_LABEL[hero.alignment.toLowerCase().trim()] : undefined;
  const sub = [hero.publisher, align].filter(Boolean).join('   ·   ');

  // Slow Ken-Burns drift — a continuous, gentle scale so the portrait feels alive.
  // Under Reduce Motion it never starts; kb stays at 0 (unscaled).
  const reduced = useReducedMotion();
  const kb = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    kb.value = withRepeat(withTiming(1, { duration: 9000 }), -1, true);
  }, [kb, reduced]);

  const imageStyle = useAnimatedStyle(() => {
    const kbScale = 1 + kb.value * 0.06;
    // Overscroll zoom: the carousel wrap pins the spotlight to the top on pull-
    // down (so it doesn't slide off), and the portrait scales in place — Apple TV
    // style. Scale clamps to 1 once scrolled normally.
    const sy = scrollY.value;
    const overscroll = sy < 0 ? interpolate(sy, [-height, 0], [1.6, 1], Extrapolation.CLAMP) : 1;
    const s = kbScale * overscroll;
    // Anchor the zoom to the slide's TOP edge by arithmetic, not by
    // `transformOrigin: 'top'`.
    //
    // A scale is applied about the view's centre, so at scale s the top edge
    // rises by (s−1)·height/2; translating down by exactly that pins it. The
    // style property was supposed to do this, but each slide runs its own Ken
    // Burns phase, and on device the slides sat at visibly DIFFERENT heights
    // from one another — two of them side by side mid-swipe with their art
    // starting at different y. That can only happen if the origin is not being
    // honoured and every slide is scaling about its centre by its own amount.
    //
    // Computing the offset makes the anchor deterministic and identical on
    // every platform, instead of depending on a style property whose support
    // we cannot verify from here.
    return { transform: [{ translateY: ((s - 1) * height) / 2 }, { scale: s }] };
  });

  // Apple TV / Disney+ billboard: full-bleed portrait, dark gradient base, a
  // centered identity + a prominent CTA. The portrait's face stays crisp; the
  // dark base guarantees the light text reads over any art.
  return (
    <Pressable
      onPress={onPress}
      style={[styles.container, { height }]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${hero.name}`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.imageWrap, imageStyle]}>
        <HeroImage
          id={hero.id}
          name={hero.name}
          imageUrl={hero.image_url}
          portraitUrl={hero.portrait_url}
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill}
          recyclingKey={hero.id}
        />
      </Animated.View>

      <LinearGradient
        // Land the base on exactly COLORS.deepNavy (#0b1820) so the billboard
        // fuses seamlessly into the dark stage below it.
        colors={['transparent', 'rgba(11,24,32,0.12)', 'rgba(11,24,32,0.85)', COLORS.deepNavy]}
        locations={[0.26, 0.46, 0.76, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.meta}>
        {/* No chevron, deliberately (it was briefly ported from the web
            spotlight). On native a full-bleed content card IS the affordance —
            the App Store's Today cards and Apple TV's billboard carry none —
            and the glyph was noise on the most composed frame in the app. Web
            keeps its chevron because an editorial headline under a cursor is a
            different convention. The audience for whom tappability is not
            visible gets it properly instead: the accessibility name below. */}
        <Text style={styles.name} numberOfLines={1}>
          {hero.name}
        </Text>
        {!!sub && (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: COLORS.deepNavy },
  // Full-bleed: the portrait's own top edge sits at the screen top, so the art's
  // built-in headroom seats the head just below the status bar. The zoom is
  // top-anchored by the translate in imageStyle — deliberately NOT by
  // `transformOrigin`, which was not holding the slides to a common top edge.
  imageWrap: {},
  // Sits low on the portrait; the dark stage overlaps the fade just below it.
  meta: {
    position: 'absolute',
    bottom: SPOTLIGHT.metaBottom,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 38,
    color: COLORS.beige,
    // Flame's glyphs need ~1.3× or the bottoms clip; keep numberOfLines at 1.
    lineHeight: 50,
    paddingBottom: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  sub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: 'rgba(245,235,220,0.72)',
    letterSpacing: 0.4,
    marginTop: 7,
    textAlign: 'center',
  },
});
