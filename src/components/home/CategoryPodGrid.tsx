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

// A deliberate, finite set — the archetype/team/media/origin/ranking browse
// axes. Publishers are NOT here: every surface that renders this grid shows the
// publisher logo pods (PublisherGrid / PublisherPods) directly above it, so a
// Marvel tile here is a duplicate doorway.
//
// Kept at 12 so the grid never strands a lone tile: 12 divides cleanly by the
// 2-, 3-, and 4-column layouts these tiles render in (native 2-up, web
// 4/3/2-up responsive). Adding or removing one breaks the last row somewhere —
// change this list in threes.
export const BROWSE_PODS: CategoryPod[] = [
  { slug: 'villain', label: 'Villains', kind: 'Archetype' },
  { slug: 'xmen', label: 'X-Men', kind: 'Team' },
  { slug: 'anti-heroes', label: 'Anti-Heroes', kind: 'Archetype' },
  { slug: 'franchise-icons', label: 'Beyond the Comics', kind: 'Crossover' },
  { slug: 'anime', label: 'Anime', kind: 'Media' },
  { slug: 'video-games', label: 'Video Games', kind: 'Media' },
  { slug: 'horror', label: 'Horror', kind: 'Media' },
  { slug: 'magic', label: 'Magic', kind: 'Origin' },
  { slug: 'aliens', label: 'Aliens', kind: 'Origin' },
  { slug: 'mythology', label: 'Gods & Myths', kind: 'Origin' },
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
              // Bias the crop a touch below the top: anchoring hard to the top
              // fills the short tile with headroom/hair and clips the face off the
              // bottom edge. Nudging down brings the face into the frame.
              contentPosition={{ top: '35%', left: '50%' }}
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
    fontFamily: 'Flame-Regular',
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
