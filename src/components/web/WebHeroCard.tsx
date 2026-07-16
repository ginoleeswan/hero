import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { brandForPublisher } from '../../constants/publishers';
import { BrandLogoView } from '../PublisherBadge';
import { PRESS_TRANSITION, pressTransform } from './pressStyles';
import { EASE_OUT_EXPO, MOTION } from '../../lib/motion';
import { useHeroMorph } from '../../hooks/useHeroMorph';

// Logo height used on the featured card; width follows the art's aspect ratio.
const LOGO_H = 22;

interface WebHeroCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  portraitUrl?: string | null;
  featured?: boolean;
  publisher?: string;
  onPress: () => void;
  /** Morph the card art into the detail portrait on tap. Default true; opt out
   *  for cards that don't navigate to /character (or inside modals). */
  morph?: boolean;
}

export function WebHeroCard({
  id,
  name,
  imageUrl,
  portraitUrl,
  featured = false,
  publisher,
  onPress,
  morph = true,
}: WebHeroCardProps) {
  const brand = featured ? brandForPublisher(publisher) : undefined;
  const logoWidth =
    brand?.logo && brand.badgeSize ? LOGO_H * (brand.badgeSize.width / brand.badgeSize.height) : 0;
  const { morphName, run } = useHeroMorph(
    { id, name, image_url: imageUrl, portrait_url: portraitUrl, publisher },
    morph,
  );
  return (
    <Pressable
      onPress={() => run(onPress)}
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.card,
          featured && (styles.featured as object),
          hovered && !pressed && (styles.cardHover as object),
          pressTransform({ hovered, pressed }),
        ] as object
      }
    >
      <View
        style={
          [
            styles.imageWrap,
            morphName ? ({ viewTransitionName: morphName } as object) : null,
          ] as object
        }
      >
        <HeroImage
          id={id}
          name={name}
          imageUrl={imageUrl}
          portraitUrl={portraitUrl}
          contentFit="cover"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          recyclingKey={id}
        />
      </View>
      <View style={[styles.overlay, featured && (styles.overlayFeatured as object)] as object} />
      {featured && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Featured</Text>
        </View>
      )}
      <View style={styles.nameContainer as object}>
        <Text
          style={[styles.name, featured && styles.nameFeatured]}
          numberOfLines={featured ? 2 : 1}
        >
          {name}
        </Text>
        {featured && brand?.logo && brand.badgeSize ? (
          <View style={[styles.logoChip, brand.logoOnLight && styles.logoChipLight]}>
            <BrandLogoView
              logo={brand.logo}
              width={logoWidth}
              height={LOGO_H}
              tint={brand.logoTint}
            />
          </View>
        ) : featured && publisher ? (
          <Text style={styles.publisher} numberOfLines={1}>
            {publisher}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    overflow: 'hidden',
    height: 180,
    cursor: 'pointer',
    transition: `${PRESS_TRANSITION}, box-shadow ${MOTION.base}ms ${EASE_OUT_EXPO}`,
  } as object,
  cardHover: {
    boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
    zIndex: 1,
  } as object,
  // Isolates the portrait art as the morph target — only the image is
  // snapshotted, so the overlay gradient and name don't smear during the morph.
  imageWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  } as object,
  featured: {
    gridColumn: 'span 2',
    gridRow: 'span 2',
    height: '100%',
    minHeight: 380,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 60%)',
  } as object,
  overlayFeatured: {
    backgroundImage:
      'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
  } as object,
  badge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: COLORS.orange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nameContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    textShadow: '-1px 1px 5px rgba(0,0,0,1)',
  } as object,
  nameFeatured: {
    fontSize: 28,
    lineHeight: 32,
  },
  publisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logoChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(18,24,28,0.42)',
  } as object,
  logoChipLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
});
