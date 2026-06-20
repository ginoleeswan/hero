// src/components/web/search/SearchBrowse.tsx — the search page's browse surface.
// Apple Games / Apple Music browse pattern: a large featured pair on top
// (Marvel · DC — the headline universes), then a clean uniform grid of the
// remaining category doorways. Search-specific by design: home keeps its own
// flat CategoryPodGrid, so this composes the same card look at two sizes without
// touching the shared component.
import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../../HeroImage';
import { COLORS } from '../../../constants/colors';
import { BROWSE_PODS } from '../../home/CategoryPodGrid';
import type { BrowseCover } from '../../../lib/db/heroes';

const FEATURED_SLUGS = ['marvel', 'dc'];

type Pod = (typeof BROWSE_PODS)[number];

function PodTile({
  pod,
  cover,
  onPress,
  featured,
}: {
  pod: Pod;
  cover?: BrowseCover;
  onPress: (slug: string) => void;
  featured?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const height = featured ? (isMobile ? 184 : 240) : 168;
  return (
    <Pressable
      onPress={() => onPress(pod.slug)}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [t.tile, { height }, hovered && (t.tileHover as object)] as object
      }
    >
      <HeroImage
        id={pod.slug}
        name={cover?.name ?? pod.label}
        imageUrl={cover?.image_url ?? cover?.image_md_url}
        portraitUrl={cover?.portrait_url}
        grid
        contentFit="cover"
        contentPosition={{ top: '32%', left: '50%' }}
        style={{ position: 'absolute', inset: 0 } as object}
        recyclingKey={pod.slug}
      />
      <LinearGradient
        colors={['transparent', 'rgba(11,24,32,0.5)', 'rgba(11,24,32,0.95)']}
        locations={[0.2, 0.58, 1]}
        style={{ position: 'absolute', inset: 0 } as object}
      />
      <View style={t.caption as object}>
        <Text style={t.kicker as object}>{pod.kind}</Text>
        <Text style={[t.label, featured && (t.labelFeatured as object)] as object} numberOfLines={2}>
          {pod.label}
        </Text>
      </View>
    </Pressable>
  );
}

export function SearchBrowse({
  covers,
  onPress,
}: {
  covers?: Record<string, BrowseCover>;
  onPress: (slug: string) => void;
}) {
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const minCol = isMobile ? 150 : 220;

  const featured = BROWSE_PODS.filter((p) => FEATURED_SLUGS.includes(p.slug));
  const rest = BROWSE_PODS.filter((p) => !FEATURED_SLUGS.includes(p.slug));

  return (
    <View>
      <View style={t.featuredRow as object}>
        {featured.map((p) => (
          <PodTile key={p.slug} pod={p} cover={covers?.[p.slug]} onPress={onPress} featured />
        ))}
      </View>
      <Text style={t.sectionLabel as object}>Browse</Text>
      <View
        style={
          [t.grid, { gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))` }] as object
        }
      >
        {rest.map((p) => (
          <PodTile key={p.slug} pod={p} cover={covers?.[p.slug]} onPress={onPress} />
        ))}
      </View>
    </View>
  );
}

const t = StyleSheet.create({
  featuredRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
    marginBottom: 28,
  } as object,
  sectionLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.55)',
    marginBottom: 14,
  } as object,
  grid: {
    display: 'grid',
    gap: 14,
    paddingBottom: 40,
  } as object,
  tile: {
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
  labelFeatured: {
    fontSize: 30,
    lineHeight: 32,
  } as object,
});
