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
