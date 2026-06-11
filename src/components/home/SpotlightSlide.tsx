// src/components/home/SpotlightSlide.tsx
import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
  // the image nor mis-fires — the carousel owns the horizontal gesture. The whole
  // portrait is the tap target, so no explicit button is needed.
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

      {/* Fade-to-beige scrim, kept low so it backs the identity without washing
          the portrait's face. */}
      <LinearGradient
        colors={['transparent', 'rgba(245,235,220,0.7)', COLORS.beige]}
        locations={[0.66, 0.88, 1]}
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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: COLORS.navy },
  meta: { position: 'absolute', bottom: 46, left: 16, right: 16 },
  metaLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaName: { fontFamily: 'Flame-Regular', fontSize: 32, color: COLORS.navy, lineHeight: 34 },
  metaPublisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
});
