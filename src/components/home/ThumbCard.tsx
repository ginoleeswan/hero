// src/components/home/ThumbCard.tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { heroImageSource } from '../../constants/heroImages';
import { COLORS } from '../../constants/colors';

export interface ThumbHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
}

interface ThumbCardProps {
  item: ThumbHero;
  onPress: () => void;
  disabled?: boolean;
}

export function ThumbCard({ item, onPress, disabled = false }: ThumbCardProps) {
  const source = heroImageSource(item.id, item.image_url, item.portrait_url);
  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={item.id}
        transition={null}
      />
      <LinearGradient
        colors={['transparent', 'rgba(29,45,51,0.85)']}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 90,
    height: 58,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  name: {
    position: 'absolute',
    bottom: 5,
    left: 6,
    right: 6,
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.beige,
    lineHeight: 11,
  },
});
