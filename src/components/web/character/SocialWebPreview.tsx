import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SURFACE } from '../../../constants/colors';
import { getHeroNeighborhood } from '../../../lib/db/heroes/neighborhood';
import { SocialWebGraph } from '../../character/SocialWebGraph';

// Compact, calm social-web preview below the relationship shelves. A dark
// "portal" panel so the constellation renderer reads on its own terms (the
// character page is beige); the whole thing taps through to the explorer.
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
    queryKey: ['neighborhood', heroId, 6],
    queryFn: () => getHeroNeighborhood(heroId, 6),
    staleTime: 5 * 60 * 1000,
  });
  const [w, setW] = useState(0);
  if (!data || data.nodes.length < 3) return null; // subject + <2 neighbours → skip

  // Square graph must fit the portal's height (300); centre it in the wide panel.
  const size = Math.min(Math.max(w, 280), 300);

  return (
    <Pressable onPress={onExplore} style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Social Web</Text>
        <View style={styles.explore}>
          <Text style={[styles.exploreText, { color: accent }] as object}>Explore the web</Text>
          <Ionicons name="arrow-forward" size={13} color={accent} />
        </View>
      </View>
      <View
        style={[styles.portal, { borderColor: accent + '2b' }] as object}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
      >
        {/* subtle halftone dust — a faint dot grid for texture */}
        <View style={[StyleSheet.absoluteFill, styles.halftone] as object} pointerEvents="none" />
        {/* accent bloom from centre */}
        <View
          style={
            [
              StyleSheet.absoluteFill,
              {
                backgroundImage: `radial-gradient(60% 60% at 50% 50%, ${accent}26, transparent 72%)`,
                pointerEvents: 'none',
              },
            ] as object
          }
        />
        {/* depth vignette — darkens the edges so the portal reads deep */}
        <View style={[StyleSheet.absoluteFill, styles.vignette] as object} pointerEvents="none" />
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
  wrap: { marginTop: 6 },
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
    color: 'rgba(41,60,67,0.55)',
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
    // A soft top-lit gradient over the ink so it isn't a flat slab.
    backgroundImage: 'radial-gradient(120% 90% at 50% 0%, #16303c 0%, #0b1820 60%)',
  } as object,
  halftone: {
    backgroundImage: 'radial-gradient(circle, rgba(245,235,220,0.05) 1px, transparent 1.6px)',
    backgroundSize: '18px 18px',
  } as object,
  vignette: {
    backgroundImage: 'radial-gradient(120% 85% at 50% 45%, transparent 52%, rgba(0,0,0,0.4) 100%)',
  } as object,
});
