// src/components/home/PublisherGrid.tsx
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import type { ImageSourcePropType } from 'react-native';
import { COLORS } from '../../constants/colors';
import { PUBLISHERS } from '../../constants/publishers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 10;
const TILE_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
const TILE_H = Math.round(TILE_W * 0.56);

function Tile({
  name,
  color,
  logo,
  onPress,
}: {
  name: string;
  color: string;
  logo?: ImageSourcePropType;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${name}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {logo ? (
        <Image source={logo} contentFit="contain" style={styles.logo} />
      ) : (
        <Text style={[styles.wordmark, { color }]} numberOfLines={1} adjustsFontSizeToFit>
          {name}
        </Text>
      )}
    </Pressable>
  );
}

export function PublisherGrid({ onPress }: { onPress: (slug: string) => void }) {
  return (
    <View style={styles.grid}>
      {PUBLISHERS.map((p) => (
        <Tile
          key={p.slug}
          name={p.name}
          color={p.color}
          logo={p.logo}
          onPress={() => onPress(p.slug)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: H_PAD,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  pressed: { opacity: 0.85 },
  logo: { width: '100%', height: '100%' },
  wordmark: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
