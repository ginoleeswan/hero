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
  const isMobile = width < 640;
  const pagePad = isMobile ? 16 : 32;
  // Mobile: a lower column-min gives two columns on a phone (instead of one
  // full-width letterbox banner per tile), so tiles stay near-square and the
  // character's face frames instead of being cropped to the scalp.
  const minCol = isMobile ? 150 : 220;
  return (
    <View
      style={
        [
          g.grid,
          {
            marginHorizontal: pagePad,
            gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`,
          },
        ] as object
      }
    >
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
              contentPosition={{ top: 0, left: '50%' }}
              style={{ position: 'absolute', inset: 0 } as object}
              recyclingKey={p.slug}
            />
            <LinearGradient
              colors={['transparent', 'rgba(11,24,32,0.5)', 'rgba(11,24,32,0.95)']}
              locations={[0.2, 0.58, 1]}
              style={{ position: 'absolute', inset: 0 } as object}
            />
            <View style={g.caption as object}>
              <Text style={g.kicker as object}>{p.kind}</Text>
              <Text style={g.label as object} numberOfLines={2}>
                {p.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const g = StyleSheet.create({
  grid: {
    display: 'grid',
    // gridTemplateColumns is set inline (responsive column-min); see component.
    gap: 14,
    marginBottom: 52, // match the carousel rows' section rhythm before the next chapter
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
  caption: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 3,
  } as object,
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: COLORS.orange,
    textShadow: '0 1px 6px rgba(0,0,0,0.8)',
  } as object,
  label: {
    fontFamily: 'Flame-Regular',
    fontSize: 23,
    color: COLORS.beige,
    lineHeight: 25,
    textShadow: '0 1px 10px rgba(0,0,0,0.7)',
  } as object,
});
