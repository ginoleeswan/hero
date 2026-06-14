import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { ImageLightbox } from '../ImageLightbox';

export function StillsGallery({ stills, inCard }: { stills: string[]; inCard?: boolean }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (stills.length === 0) return null;

  const images = stills.map((url) => ({ url }));

  if (Platform.OS === 'web') {
    const lightbox =
      lightboxIndex !== null ? (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null;
    const grid = (
      <View style={[webStyles.grid, inCard && webStyles.bare] as object}>
        {stills.map((url, i) => (
          <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => setLightboxIndex(i)}>
            <Image
              source={{ uri: url }}
              style={webStyles.still}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
        ))}
      </View>
    );
    if (inCard) {
      return (
        <>
          {grid}
          {lightbox}
        </>
      );
    }
    return (
      <View style={styles.block}>
        <Text style={styles.label}>Stills</Text>
        {grid}
        {lightbox}
      </View>
    );
  }

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

const webStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },
  bare: { paddingHorizontal: 0 },
  still: {
    width: 256,
    height: 144,
    borderRadius: 8,
  },
});

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
