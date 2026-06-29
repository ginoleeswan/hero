// src/components/home/SpotlightSlide.tsx
import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';

const ALIGN_LABEL: Record<string, string> = { good: 'Hero', bad: 'Villain', neutral: 'Anti-Hero' };

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
  const kb = useSharedValue(0);
  useEffect(() => {
    kb.value = withRepeat(withTiming(1, { duration: 9000 }), -1, true);
  }, [kb]);

  const imageStyle = useAnimatedStyle(() => {
    const kbScale = 1 + kb.value * 0.06;
    // Overscroll zoom: the carousel wrap pins the spotlight to the top on pull-
    // down (so it doesn't slide off), and the portrait scales in place — Apple TV
    // style. Scale clamps to 1 once scrolled normally.
    const sy = scrollY.value;
    const overscroll = sy < 0 ? interpolate(sy, [-height, 0], [1.6, 1], Extrapolation.CLAMP) : 1;
    return { transform: [{ scale: kbScale * overscroll }] };
  });

  // Apple TV / Disney+ billboard: full-bleed portrait, dark gradient base, a
  // centered identity + a prominent CTA. The portrait's face stays crisp; the
  // dark base guarantees the light text reads over any art.
  return (
    <Pressable onPress={onPress} style={[styles.container, { height }]}>
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
  // Anchor the zoom (Ken Burns + overscroll) at the top so it grows downward and
  // the top of the portrait stays pinned to the screen — never cropped/zoomed up.
  imageWrap: { transformOrigin: 'top' },
  // Sits low on the portrait; the dark stage overlaps the fade just below it.
  meta: { position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center' },
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
