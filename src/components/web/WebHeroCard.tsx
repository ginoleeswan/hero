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
      style={[styles.card, featured && (styles.featured as object)]}
    >
      <Image source={source} contentFit="cover" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay} />
      {featured && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Featured</Text>
        </View>
      )}
      <View style={styles.nameContainer}>
        <Text style={styles.name} numberOfLines={1}>
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
  } as object,
  featured: {
    gridColumn: 'span 2',
    gridRow: 'span 2',
    height: '100%',
    minHeight: 380,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)',
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
    letterSpacing: 0.5,
  },
  nameContainer: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
  },
  publisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 2,
  },
});
