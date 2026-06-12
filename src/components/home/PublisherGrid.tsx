// src/components/home/PublisherGrid.tsx
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import type { ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { PUBLISHERS, type PublisherConfig } from '../../constants/publishers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 12;
const TILE_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
const TILE_H = Math.round(TILE_W * 0.6);

/**
 * Brand tile: a diagonal brand-colour gradient gives each publisher its own
 * identity (Disney+-style shelf), while the logo sits on a white plate so it
 * always reads regardless of the logo's own colours. A soft top sheen adds
 * depth without any imagery.
 */
function Tile({ publisher, onPress }: { publisher: PublisherConfig; onPress: () => void }) {
  const { name, color, colorDark, logo } = publisher;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${name}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={[color, colorDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft sheen across the top edge — gives the tile a glassy lift. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.plate}>
        {logo ? (
          <Image source={logo} contentFit="contain" style={styles.logo} />
        ) : (
          <Text style={[styles.wordmark, { color: colorDark }]} numberOfLines={1} adjustsFontSizeToFit>
            {name}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function PublisherGrid({ onPress }: { onPress: (slug: string) => void }) {
  return (
    <View style={styles.grid}>
      {PUBLISHERS.map((p) => (
        <Tile key={p.slug} publisher={p} onPress={() => onPress(p.slug)} />
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
    paddingTop: 18,
    paddingBottom: 10,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 8px 18px rgba(41,60,67,0.16)',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  // White plate the logo sits on — guaranteed legibility for any logo colours.
  plate: {
    width: '64%',
    height: '58%',
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    boxShadow: '0px 3px 10px rgba(0,0,0,0.22)',
  },
  logo: { width: '100%', height: '100%' },
  wordmark: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.navy,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
