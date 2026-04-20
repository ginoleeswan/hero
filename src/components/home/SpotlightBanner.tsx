// src/components/home/SpotlightBanner.tsx
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { heroImageSource } from '../../constants/heroImages';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function spotlightHeight(insetTop: number): number {
  return insetTop + Math.round(SCREEN_HEIGHT * 0.42);
}

interface SpotlightBannerProps {
  hero: Hero;
  index: number;
  total: number;
  insetTop: number;
  onSearchPress: () => void;
  onHeroPress: () => void;
}

export function SpotlightBanner({
  hero,
  index,
  total,
  insetTop,
  onSearchPress,
  onHeroPress,
}: SpotlightBannerProps) {
  const height = spotlightHeight(insetTop);
  const source = heroImageSource(hero.id, hero.image_url, hero.portrait_url);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onHeroPress} style={[styles.container, { height }]}>
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={hero.id}
        transition={200}
      />
      <LinearGradient
        colors={['transparent', 'rgba(245,235,220,0.6)', COLORS.beige]}
        locations={[0.45, 0.78, 1]}
        style={StyleSheet.absoluteFill}
      />
      <TouchableOpacity
        style={[styles.searchBtn, { top: insetTop + 10 }]}
        onPress={onSearchPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="search" size={20} color={COLORS.beige} />
      </TouchableOpacity>
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
      {total > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: COLORS.navy },
  searchBtn: {
    position: 'absolute',
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(41,60,67,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { position: 'absolute', bottom: 56, left: 16, right: 68 },
  metaLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaName: {
    fontFamily: 'Flame-Bold',
    fontSize: 30,
    color: COLORS.navy,
    lineHeight: 32,
  },
  metaPublisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  dots: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(41,60,67,0.3)',
  },
  dotActive: { width: 14, backgroundColor: COLORS.orange },
});
