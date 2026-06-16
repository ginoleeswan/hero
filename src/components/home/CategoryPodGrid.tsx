// src/components/home/CategoryPodGrid.tsx — the "Browse" block. Image-backed
// category tiles in a real two-up grid (each wears a representative character's
// art), so browse reads as premium as the rest of the page — not a text menu.
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { BrowseCover } from '../../lib/db/heroes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 12;
const TILE_W = Math.floor((SCREEN_WIDTH - H_PAD * 2 - GAP) / 2);
const TILE_H = Math.round(TILE_W * 0.82);

export interface CategoryPod {
  slug: string;
  label: string;
  /** The browse axis this doorway belongs to — shown as a small kicker so a
   *  publisher tile reads differently from a media or ranking tile. */
  kind: string;
}

// A deliberate, finite set — the publisher/archetype/media/ranking browse axes.
export const BROWSE_PODS: CategoryPod[] = [
  { slug: 'marvel', label: 'Marvel', kind: 'Publisher' },
  { slug: 'dc', label: 'DC', kind: 'Publisher' },
  { slug: 'villain', label: 'Villains', kind: 'Archetype' },
  { slug: 'xmen', label: 'X-Men', kind: 'Team' },
  { slug: 'anti-heroes', label: 'Anti-Heroes', kind: 'Archetype' },
  { slug: 'franchise-icons', label: 'Beyond the Comics', kind: 'Crossover' },
  { slug: 'anime', label: 'Anime', kind: 'Media' },
  { slug: 'video-games', label: 'Video Games', kind: 'Media' },
  { slug: 'horror', label: 'Horror', kind: 'Media' },
  { slug: 'strongest', label: 'Strongest', kind: 'Ranking' },
  { slug: 'most-intelligent', label: 'Smartest', kind: 'Ranking' },
];

export function CategoryPodGrid({
  covers,
  onPress,
}: {
  covers?: Record<string, BrowseCover>;
  onPress: (slug: string) => void;
}) {
  return (
    <View style={s.grid}>
      {BROWSE_PODS.map((p) => {
        const c = covers?.[p.slug];
        return (
          <Pressable key={p.slug} style={s.tile} onPress={() => onPress(p.slug)}>
            <HeroImage
              id={p.slug}
              name={c?.name ?? p.label}
              imageUrl={c?.image_url ?? c?.image_md_url}
              portraitUrl={c?.portrait_url}
              grid
              contentFit="cover"
              contentPosition="top"
              style={StyleSheet.absoluteFill as object}
              recyclingKey={p.slug}
            />
            <LinearGradient
              colors={['transparent', 'rgba(11,24,32,0.55)', 'rgba(11,24,32,0.94)']}
              locations={[0.25, 0.6, 1]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={s.label} numberOfLines={2}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: H_PAD,
    paddingTop: 4,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  label: {
    fontFamily: 'Flame-Bold',
    fontSize: 19,
    color: COLORS.beige,
    lineHeight: 21,
    paddingHorizontal: 12,
    paddingBottom: 11,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
});
