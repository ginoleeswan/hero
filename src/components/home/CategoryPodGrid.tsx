// src/components/home/CategoryPodGrid.tsx — the calm "Browse" block. Replaces a
// dozen look-alike catalog carousels with one scannable grid of tiles, each a
// doorway into the category page that already exists. One restrained accent.
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS } from '../../constants/colors';

export interface CategoryPod {
  slug: string;
  label: string;
}

// A deliberate, finite set — the publisher/archetype/stat browse axes.
export const BROWSE_PODS: CategoryPod[] = [
  { slug: 'marvel', label: 'Marvel' },
  { slug: 'dc', label: 'DC' },
  { slug: 'villain', label: 'Villains' },
  { slug: 'xmen', label: 'X-Men' },
  { slug: 'anti-heroes', label: 'Anti-Heroes' },
  { slug: 'franchise-icons', label: 'Beyond the Comics' },
  { slug: 'anime', label: 'Anime' },
  { slug: 'video-games', label: 'Video Games' },
  { slug: 'horror', label: 'Horror' },
  { slug: 'strongest', label: 'Strongest' },
  { slug: 'most-intelligent', label: 'Smartest' },
];

export function CategoryPodGrid({ onPress }: { onPress: (slug: string) => void }) {
  return (
    <View style={s.grid}>
      {BROWSE_PODS.map((p) => (
        <Pressable key={p.slug} style={s.pod} onPress={() => onPress(p.slug)}>
          <View style={s.accent} />
          <Text style={s.label} numberOfLines={1}>
            {p.label}
          </Text>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  pod: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
    paddingHorizontal: 14,
    gap: 10,
  },
  accent: {
    width: 4,
    height: 26,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
  },
  label: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.navy,
  },
  chevron: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: 'rgba(41,60,67,0.35)',
    marginTop: -2,
  },
});
