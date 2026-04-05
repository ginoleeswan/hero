import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { heroImageSource } from '../../constants/heroImages';

interface WebHeroCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  featured?: boolean;
  publisher?: string;
  onPress: () => void;
}

export function WebHeroCard({
  id,
  name,
  imageUrl,
  featured = false,
  publisher,
  onPress,
}: WebHeroCardProps) {
  const source = heroImageSource(id, imageUrl);

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [
          styles.card,
          featured && (styles.featured as object),
          hovered && (styles.cardHover as object),
        ] as object
      }
    >
      <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
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
        {featured && publisher ? (
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
    transition: 'transform 180ms ease, box-shadow 180ms ease',
  } as object,
  cardHover: {
    transform: [{ scale: 1.025 }],
    boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
    zIndex: 1,
  } as object,
  featured: {
    gridColumn: 'span 2',
    gridRow: 'span 2',
    height: '100%',
    minHeight: 380,
  } as object,
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
});
