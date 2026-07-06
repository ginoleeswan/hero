import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getHeroNeighborhood } from '../../../lib/db/heroes/neighborhood';
import { SocialWebGraph } from '../../character/SocialWebGraph';

// Compact, calm social-web preview below the relationship shelves. Fetches a
// small neighbourhood; the whole band taps through to the full-screen explorer.
// Renders nothing for heroes with too few relationships (the shelves cover them).
export function SocialWebPreview({
  heroId,
  accent,
  onExplore,
}: {
  heroId: string;
  accent: string;
  onExplore: () => void;
}) {
  const { data } = useQuery({
    queryKey: ['neighborhood', heroId, 8],
    queryFn: () => getHeroNeighborhood(heroId, 8),
    staleTime: 5 * 60 * 1000,
  });
  if (!data || data.nodes.length < 3) return null; // subject + <2 neighbours → skip

  return (
    <Pressable onPress={onExplore} style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Social Web</Text>
        <View style={styles.explore}>
          <Text style={[styles.exploreText, { color: accent }] as object}>Explore the web</Text>
          <Ionicons name="arrow-forward" size={13} color={accent} />
        </View>
      </View>
      <View style={styles.graphWrap}>
        <SocialWebGraph neighborhood={data} subjectId={heroId} accent={accent} size={300} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.55)',
  },
  explore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exploreText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  graphWrap: { alignItems: 'center', paddingVertical: 8 },
});
