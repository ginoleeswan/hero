// src/components/web/home/CategoryPodGrid.tsx — image-backed "Browse" tiles for
// web. One responsive grid of category doorways, each wearing a representative
// character's art, replaces a dozen look-alike carousels.
import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../../HeroImage';
import { COLORS } from '../../../constants/colors';
import { BROWSE_PODS } from '../../home/CategoryPodGrid';
import type { BrowseCover } from '../../../lib/db/heroes';

export function CategoryPodGrid({
  covers,
  onPress,
}: {
  covers?: Record<string, BrowseCover>;
  onPress: (slug: string) => void;
}) {
  const { width } = useWindowDimensions();
  const pagePad = width < 640 ? 16 : 32;
  return (
    <View style={[g.grid, { marginHorizontal: pagePad }] as object}>
      {BROWSE_PODS.map((p) => {
        const c = covers?.[p.slug];
        return (
          <Pressable
            key={p.slug}
            onPress={() => onPress(p.slug)}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [g.tile, hovered && (g.tileHover as object)] as object
            }
          >
            <HeroImage
              id={p.slug}
              name={c?.name ?? p.label}
              imageUrl={c?.image_url ?? c?.image_md_url}
              portraitUrl={c?.portrait_url}
              grid
              contentFit="cover"
              contentPosition="top"
              style={{ position: 'absolute', inset: 0 } as object}
              recyclingKey={p.slug}
            />
            <LinearGradient
              colors={['transparent', 'rgba(11,24,32,0.5)', 'rgba(11,24,32,0.95)']}
              locations={[0.25, 0.6, 1]}
              style={{ position: 'absolute', inset: 0 } as object}
            />
            <Text style={g.label as object} numberOfLines={2}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const g = StyleSheet.create({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 14,
  } as object,
  tile: {
    height: 168,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    cursor: 'pointer',
    transition: 'transform 180ms ease, box-shadow 180ms ease',
  } as object,
  tileHover: {
    transform: [{ translateY: -4 }],
    boxShadow: '0 20px 46px rgba(0,0,0,0.34)',
  } as object,
  label: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    color: COLORS.beige,
    lineHeight: 26,
    paddingHorizontal: 16,
    paddingBottom: 14,
    textShadow: '0 1px 10px rgba(0,0,0,0.7)',
  } as object,
});
