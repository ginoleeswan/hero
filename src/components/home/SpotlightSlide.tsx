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

  // A solid beige caption zone holds the text, so contrast never depends on what
  // part of the portrait is behind a word. The portrait stays crisp above it.
  const captionH = Math.round(height * 0.26);

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

  // Pressable (not TouchableOpacity): a tap navigates, a swipe neither dims nor
  // mis-fires. The whole spotlight is the tap target — no explicit button needed.
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

      {/* Short blend joining the crisp portrait to the solid caption below it. */}
      <LinearGradient
        colors={['transparent', COLORS.beige]}
        locations={[0, 1]}
        style={[styles.blend, { bottom: captionH }]}
      />

      {/* Solid caption — guaranteed dark-on-beige contrast. */}
      <View style={[styles.caption, { height: captionH }]}>
        <Text style={styles.metaLabel}>Featured Hero</Text>
        <Text style={styles.metaName} numberOfLines={1}>
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
  blend: { position: 'absolute', left: 0, right: 0, height: 88 },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.beige,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  metaLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaName: { fontFamily: 'Flame-Regular', fontSize: 32, color: COLORS.navy, lineHeight: 36 },
  metaPublisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
});
