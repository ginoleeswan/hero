import { ScrollView, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

const CARD_W = 80;
const CARD_H = 110;

interface Props {
  images: { url: string; caption?: string | null }[];
  onPress: (index: number) => void;
}

export function GalleryStrip({ images, onPress }: Props) {
  if (images.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {images.map((img, i) => (
        <TouchableOpacity
          key={i}
          testID="gallery-card"
          onPress={() => onPress(i)}
          activeOpacity={0.85}
        >
          <View style={styles.card}>
            {img.url ? (
              <Image
                source={{ uri: img.url }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={img.url}
              />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="image-outline" size={22} color={COLORS.grey} />
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingBottom: 4, paddingHorizontal: 2 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.navy + '18',
  },
  image: { width: CARD_W, height: CARD_H },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
