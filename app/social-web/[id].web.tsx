import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { getHeroNeighborhood } from '../../src/lib/db/heroes/neighborhood';
import { SocialWebGraph } from '../../src/components/web/character/SocialWebGraph';
import { deriveCharacterTheme } from '../../src/lib/accent';

export default function SocialWebExplorer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  // The graph re-centres on focusId without changing the route (entry id stays
  // the URL). Long-pressing a node walks the universe hero to hero.
  const [focusId, setFocusId] = useState<string>(id);
  const { data } = useQuery({
    queryKey: ['neighborhood', focusId, 24],
    queryFn: () => getHeroNeighborhood(focusId, 24),
    staleTime: 5 * 60 * 1000,
  });

  const focusNode = data?.nodes.find((n) => n.id === focusId);
  const theme = useMemo(
    () => deriveCharacterTheme({ publisher: focusNode?.publisher ?? null }),
    [focusNode],
  );

  const size = Math.min(width, height - 140);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.navy} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {focusNode ? `${focusNode.name}'s universe` : 'Universe'}
        </Text>
        <View style={styles.legend}>
          <Legend color={COLORS.red} label="Enemy" />
          <Legend color={COLORS.green} label="Ally" />
          <Legend color={COLORS.blue} label="Team" />
        </View>
      </View>
      <View style={styles.canvas}>
        {data && data.nodes.length > 0 ? (
          <SocialWebGraph
            neighborhood={data}
            subjectId={focusId}
            accent={theme.accent}
            size={size}
            onNodePress={(nodeId) =>
              nodeId === focusId
                ? undefined
                : router.push(`/character/${nodeId}` as Parameters<typeof router.push>[0])
            }
            onNodeLongPress={(nodeId) => setFocusId(nodeId)}
          />
        ) : (
          <Text style={styles.empty}>Mapping the universe…</Text>
        )}
      </View>
      <Text style={styles.hint}>Tap a node to visit · long-press to recenter</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.beige },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  back: { padding: 6 },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    lineHeight: 26,
    color: COLORS.navy,
    flex: 1,
  } as object,
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(41,60,67,0.6)' },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: 'rgba(41,60,67,0.5)' },
  hint: {
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(41,60,67,0.45)',
    paddingBottom: 16,
  },
});
