// src/components/home/PublisherGrid.tsx
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../../constants/colors';
import { FEATURED_PUBLISHERS, type PublisherBrand } from '../../constants/publishers';
import { BrandLogoView } from '../PublisherBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 10;
const TILE_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;
// Logo height inside a card; width follows each mark's aspect ratio.
// Mirrors the web PublisherPods so native and web read identically.
const LOGO_H = 44;

/**
 * Brand card: a flat logo centered on a dark card — the same minimal treatment
 * as the web Explore pods (see components/web/home/PublisherPods.tsx). The dark
 * surface (on the otherwise-beige page) is what lets monochrome marks like the
 * Image and Dark Horse logos read. Falls back to the name wordmark when a brand
 * has no logo art.
 */
function Tile({ publisher, onPress }: { publisher: PublisherBrand; onPress: () => void }) {
  const { name, color, logo, badgeSize } = publisher;
  const logoWidth = logo && badgeSize ? LOGO_H * (badgeSize.width / badgeSize.height) : 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${name}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {logo && badgeSize ? (
        <BrandLogoView logo={logo} width={logoWidth} height={LOGO_H} />
      ) : (
        <Text style={[styles.wordmark, { color }]} numberOfLines={1}>
          {name}
        </Text>
      )}
    </Pressable>
  );
}

export function PublisherGrid({ onPress }: { onPress: (slug: string) => void }) {
  return (
    <View style={styles.grid}>
      {FEATURED_PUBLISHERS.map((p) => (
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
    minHeight: 88,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: COLORS.deepNavy,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  wordmark: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    letterSpacing: 0.5,
  },
});
