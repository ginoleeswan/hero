import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Text } from '../ui/Text';
import { Image } from 'expo-image';
import { ORANGE_INK } from '../../constants/colors';
import { ImageLightbox } from '../ImageLightbox';

/**
 * Horizontal, edge-to-edge stills rail with a tap-to-open lightbox. `inCard`
 * drops the rail's own header (the card supplies it) and bleeds to the edges.
 */
export function StillsGallery({ stills, inCard }: { stills: string[]; inCard?: boolean }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (stills.length === 0) return null;

  const images = stills.map((url) => ({ url }));
  const stillStyle = Platform.OS === 'web' ? styles.stillWide : styles.still;

  const scroller = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={inCard ? styles.bleed : undefined}
      contentContainerStyle={styles.row}
    >
      {stills.map((url, i) => (
        <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => setLightboxIndex(i)}>
          <Image
            source={{ uri: url }}
            style={stillStyle}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const lightbox =
    lightboxIndex !== null ? (
      <ImageLightbox
        images={images}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    ) : null;

  if (inCard) {
    return (
      <>
        {scroller}
        {lightbox}
      </>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Stills</Text>
      {scroller}
      {lightbox}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  label: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: ORANGE_INK,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: 20,
  },
  row: {
    gap: 10,
    paddingHorizontal: 20,
  },
  bleed: { marginHorizontal: -20 },
  still: {
    width: 192,
    height: 108,
    borderRadius: 10,
  },
  stillWide: {
    width: 280,
    height: 158,
    borderRadius: 10,
  },
});
