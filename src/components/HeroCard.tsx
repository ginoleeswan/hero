import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants/colors';
import { HeroImage } from './HeroImage';

interface HeroCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  portraitUrl?: string | null;
  width: number;
  height: number;
}

/**
 * Presentational portrait card for the home carousels.
 *
 * Uses a native iOS squircle via `borderCurve: 'continuous'` + `overflow:
 * 'hidden'` (no MaskedView) so the layer's real rounded shape is what the
 * Apple Zoom transition snapshots — it morphs cleanly into the detail screen
 * with no rectangular container on the way back.
 *
 * The card keeps an opaque background (so it is solid mid-zoom) but is itself
 * shadow-free; the drop shadow lives on the slot View in HomeHeroRow, OUTSIDE
 * the zoom. Dimensions are passed in explicitly so the card never depends on
 * the Link.AppleZoom wrapper stretching it.
 */
// Memoised: all props are primitives, so the default shallow comparison lets each
// card skip re-rendering when its carousel row re-renders (swipe/scroll/index
// state) but the card's own data is unchanged.
export const HeroCard = memo(function HeroCard({
  id,
  name,
  imageUrl,
  portraitUrl,
  width,
  height,
}: HeroCardProps) {
  return (
    <View collapsable={false} style={[styles.card, { width, height }]}>
      <HeroImage
        id={id}
        name={name}
        imageUrl={imageUrl}
        portraitUrl={portraitUrl}
        contentFit="cover"
        contentPosition="top"
        style={styles.image}
        recyclingKey={id}
      />
      <View style={styles.nameContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  );
});

export const HERO_CARD_RADIUS = 64;

const styles = StyleSheet.create({
  card: {
    borderRadius: HERO_CARD_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
    // Transparent, not navy: the portrait (cover) fills the card at rest, but
    // during the Apple Zoom morph the image can briefly not cover the whole
    // frame. A navy fill flashes as a hard block; transparent lets the row band
    // behind the card show through instead, so any gap blends away.
    backgroundColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  nameContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    paddingBottom: 24,
    paddingTop: 30,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    textShadowColor: 'rgba(0, 0, 0, 1)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 5,
  },
});
