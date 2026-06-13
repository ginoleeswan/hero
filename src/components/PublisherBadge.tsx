// src/components/PublisherBadge.tsx
// The publisher mark shown over a hero's card art: a brand logo on a faint
// frosted chip, or a text pill for publishers we don't have a logo for. Every
// card overlay (native search, web featured) renders through this so a hero
// brands identically everywhere. Branding is resolved via the publisher
// registry — see constants/publishers.ts.
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { brandForPublisher } from '../constants/publishers';

export function PublisherBadge({ publisher }: { publisher: string | null | undefined }) {
  const brand = brandForPublisher(publisher);

  if (brand?.logo && brand.badgeSize) {
    return (
      <View style={styles.badge}>
        <Image
          source={brand.logo}
          style={{ width: brand.badgeSize.width, height: brand.badgeSize.height }}
          contentFit="contain"
        />
      </View>
    );
  }

  if (publisher) {
    return (
      <View style={styles.pill}>
        <Text style={styles.pillText} numberOfLines={1}>
          {publisher}
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  // Logos float on a faint frosted chip so they read on light artwork too.
  badge: {
    position: 'absolute',
    top: 9,
    left: 9,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(18,24,28,0.42)',
  },
  pill: {
    position: 'absolute',
    top: 9,
    left: 9,
    backgroundColor: 'rgba(18,24,28,0.5)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
