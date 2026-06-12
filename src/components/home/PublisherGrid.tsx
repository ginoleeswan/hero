// src/components/home/PublisherGrid.tsx
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../../constants/colors';
import { PUBLISHERS } from '../../constants/publishers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 10;
const TILE_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
const TILE_H = Math.round(TILE_W * 0.56);

function Tile({ name, color, onPress }: { name: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${name}`}
      style={({ pressed }) => [styles.tile, { borderColor: `${color}55` }, pressed && styles.pressed]}
    >
      {/* Brand-coloured wordmark (stand-in for the publisher logo). */}
      <Text style={[styles.wordmark, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {name}
      </Text>
    </Pressable>
  );
}

export function PublisherGrid({ onPress }: { onPress: (slug: string) => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.accentBar} />
        <View>
          <Text style={styles.label}>Browse the universes</Text>
          <Text style={styles.title}>Publishers</Text>
        </View>
      </View>
      <View style={styles.grid}>
        {PUBLISHERS.map((p) => (
          <Tile key={p.slug} name={p.name} color={p.color} onPress={() => onPress(p.slug)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 16 },
  header: {
    paddingHorizontal: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 11,
  },
  accentBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.orange },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.navy, lineHeight: 28 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: H_PAD,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pressed: { opacity: 0.85 },
  wordmark: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
