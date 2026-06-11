import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../constants/colors';
import { heroImageSource } from '../constants/heroImages';

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
export function HeroCard({ id, name, imageUrl, portraitUrl, width, height }: HeroCardProps) {
  const imageSource = heroImageSource(id, imageUrl, portraitUrl);

  return (
    <View style={[styles.card, { width, height }]}>
      <Image
        source={imageSource}
        contentFit="cover"
        contentPosition="top"
        style={styles.image}
        cachePolicy="memory-disk"
        recyclingKey={id}
        transition={typeof imageSource === 'object' && 'uri' in imageSource ? 200 : null}
      />
      <View style={styles.nameContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  );
}

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
