// src/components/character/SocialWebPortal.tsx — the native doorway into a
// character's universe (/social-web/[id]): a compact, calm constellation
// preview below the relationship shelves, tapping through to the explorer.
// Native sibling of the web SocialWebPreview — that one paints its portal with
// CSS backgroundImage (radial gradients, halftone dust), which RN can't render,
// so this builds the same deep-ink portal from a LinearGradient instead. The
// constellation renderer (SocialWebGraph) is shared, so the two can't drift.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SURFACE, PAPER_TEXT } from '../../constants/colors';
import { getHeroNeighborhood } from '../../lib/db/heroes/neighborhood';
import { SocialWebGraph } from './SocialWebGraph';

export function SocialWebPortal({
  heroId,
  accent,
  onExplore,
}: {
  heroId: string;
  accent: string;
  onExplore: () => void;
}) {
  // Same key shape as the web preview so the explorer's bigger fetch and this
  // one cache independently but consistently.
  const { data } = useQuery({
    queryKey: ['neighborhood', heroId, 6],
    queryFn: () => getHeroNeighborhood(heroId, 6),
    staleTime: 5 * 60 * 1000,
  });
  const [w, setW] = useState(0);

  if (!data || data.nodes.length < 3) return null; // subject + <2 neighbours → skip

  // Square graph must fit the portal's height (300); centre it in the panel.
  const size = Math.min(Math.max(w, 280), 300);

  return (
    <Pressable onPress={onExplore} style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Social Web</Text>
        <View style={styles.explore}>
          <Text style={[styles.exploreText, { color: accent }]}>Explore the universe</Text>
          <Ionicons name="arrow-forward" size={13} color={accent} />
        </View>
      </View>
      <View
        style={[styles.portal, { borderColor: accent + '2b' }]}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
      >
        {/* Top-lit ink so the portal isn't a flat slab (the page is beige). */}
        <LinearGradient
          colors={['#16303c', SURFACE.ink]}
          locations={[0, 0.65]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {w > 0 ? (
          <SocialWebGraph
            neighborhood={data}
            subjectId={heroId}
            accent={accent}
            size={size}
            nodeScale={0.8}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: 6 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
  },
  explore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exploreText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  portal: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 300,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: SURFACE.ink,
  },
});
