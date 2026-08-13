// src/components/home/PublisherGrid.tsx
import { View, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Text } from '../ui/Text';
import { FEATURED_PUBLISHERS, type PublisherBrand } from '../../constants/publishers';
import { PUBLISHER_GRID } from './homeGeometry';
import { BrandLogoView } from '../PublisherBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Shared with HomeSkeleton so the placeholder tiles can't drift from these.
const { hPad: H_PAD, gap: GAP, tileWidth: TILE_W } = PUBLISHER_GRID;
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
  const { name, color, logo, badgeSize, logoTint } = publisher;
  const logoWidth = logo && badgeSize ? LOGO_H * (badgeSize.width / badgeSize.height) : 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${name}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {logo && badgeSize ? (
        <BrandLogoView logo={logo} width={logoWidth} height={LOGO_H} tint={logoTint} />
      ) : (
        <Text style={[styles.wordmark, { color }]} numberOfLines={1}>
          {name}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * `rail` is the same four brands at a fraction of the height.
 *
 * On Explore the grid is a destination — big tiles, plenty of room. On Search
 * it is a SHORTCUT competing for space with the browse pods, and as a
 * two-row grid it forced a choice between burying it under eight pods (a long
 * scroll for a one-tap intent) and putting it on top of them (pushing the
 * richest content below the fold). A rail is neither: it costs one row, so it
 * can sit high without displacing anything.
 */
export function PublisherGrid({
  onPress,
  layout = 'grid',
}: {
  onPress: (slug: string) => void;
  layout?: 'grid' | 'rail';
}) {
  if (layout === 'rail') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {FEATURED_PUBLISHERS.map((p) => (
          <RailChip key={p.slug} publisher={p} onPress={() => onPress(p.slug)} />
        ))}
      </ScrollView>
    );
  }
  return (
    <View style={styles.grid}>
      {FEATURED_PUBLISHERS.map((p) => (
        <Tile key={p.slug} publisher={p} onPress={() => onPress(p.slug)} />
      ))}
    </View>
  );
}

const RAIL_LOGO_H = 22;

function RailChip({ publisher, onPress }: { publisher: PublisherBrand; onPress: () => void }) {
  const { name, color, logo, badgeSize, logoTint } = publisher;
  const logoWidth = logo && badgeSize ? RAIL_LOGO_H * (badgeSize.width / badgeSize.height) : 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${name}`}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      {logo && badgeSize ? (
        <BrandLogoView logo={logo} width={logoWidth} height={RAIL_LOGO_H} tint={logoTint} />
      ) : (
        <Text style={[styles.wordmark, { color }]} numberOfLines={1}>
          {name}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Bleeds to the physical screen edge — see the horizontal-rail rule in
  // CLAUDE.md; the inset lives on the content, not on an ancestor.
  rail: { flexDirection: 'row', gap: GAP, paddingHorizontal: H_PAD, paddingVertical: 2 },
  chip: {
    height: 52,
    minWidth: 104,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(41,60,67,0.5)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: H_PAD,
    paddingTop: PUBLISHER_GRID.paddingTop,
    paddingBottom: PUBLISHER_GRID.paddingBottom,
  },
  // Clean translucent panel (matches the web desktop pods / engage cards).
  tile: {
    width: TILE_W,
    minHeight: PUBLISHER_GRID.tileMinHeight,
    borderRadius: PUBLISHER_GRID.radius,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  wordmark: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0.5,
  },
});
