// src/components/home/SpotlightSlide.tsx
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
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

  // Pressable (not TouchableOpacity): a tap navigates, but a swipe neither dims
  // the image nor mis-fires — the carousel owns the horizontal gesture.
  return (
    <Pressable onPress={onPress} style={[styles.container, { height }]}>
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

      {/* Top scrim — keeps the status bar legible over bright art. */}
      <LinearGradient
        colors={['rgba(15,23,27,0.5)', 'transparent']}
        locations={[0, 1]}
        style={styles.topScrim}
      />
      {/* Bottom scrim — a cinematic dark base for the identity; the portrait
          itself stays crisp (no wash). */}
      <LinearGradient
        colors={['transparent', 'rgba(15,23,27,0.5)', 'rgba(15,23,27,0.92)']}
        locations={[0.34, 0.68, 1]}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: COLORS.navy },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 130 },
  // Sits above the rounded beige lip + dots that the carousel overlays.
  meta: { position: 'absolute', bottom: 74, left: 18, right: 18 },
  metaLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  metaName: {
    fontFamily: 'Flame-Bold',
    fontSize: 34,
    color: COLORS.beige,
    lineHeight: 36,
    textShadowColor: 'rgba(10,15,18,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  metaPublisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.62)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 5,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: COLORS.orange,
  },
  ctaText: { fontFamily: 'Nunito_900Black', fontSize: 13, color: COLORS.beige },
});
