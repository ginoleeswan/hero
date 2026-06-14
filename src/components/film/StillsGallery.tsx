import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { ImageLightbox } from '../ImageLightbox';

export function StillsGallery({ stills }: { stills: string[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (stills.length === 0) return null;

  const images = stills.map((url) => ({ url }));

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Stills</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {stills.map((url, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.85}
            onPress={() => setLightboxIndex(i)}
          >
            <Image
              source={{ uri: url }}
              style={styles.still}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {lightboxIndex !== null ? (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
  },
  row: {
    gap: 8,
    paddingHorizontal: 20,
  },
  still: {
    width: 192,
    height: 108,
    borderRadius: 8,
  },
});
