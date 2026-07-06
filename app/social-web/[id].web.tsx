import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SURFACE, INK_TEXT } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { getHeroNeighborhood } from '../../src/lib/db/heroes/neighborhood';
import { SocialWebCanvas } from '../../src/components/character/SocialWebCanvas';
import { deriveCharacterTheme } from '../../src/lib/accent';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';

export default function SocialWebExplorer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  const [focusSubject, setFocusSubject] = useState<string>(id);
  const { data } = useQuery({
    queryKey: ['neighborhood', focusSubject, 24],
    queryFn: () => getHeroNeighborhood(focusSubject, 24),
    staleTime: 5 * 60 * 1000,
  });
  const subjectNode = data?.nodes.find((n) => n.id === focusSubject);
  const theme = useMemo(
    () => deriveCharacterTheme({ publisher: subjectNode?.publisher ?? null }),
    [subjectNode],
  );

  const sparse = data && data.nodes.length < 3;

  return (
    <View style={styles.screen}>
      {/* accent bloom from centre */}
      <View
        style={
          [
            StyleSheet.absoluteFill,
            {
              backgroundImage: `radial-gradient(60% 50% at 50% 48%, ${theme.accentDeep}4d, transparent 72%)`,
              pointerEvents: 'none',
            },
          ] as object
        }
      />
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={20} color={INK_TEXT.primary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {subjectNode ? `${subjectNode.name}'s universe` : 'Universe'}
        </Text>
        <View style={styles.legend}>
          <Legend color={COLORS.red} label="Enemy" />
          <Legend color={COLORS.green} label="Ally" />
          <Legend color={COLORS.blue} label="Team" />
        </View>
      </View>

      {data && !sparse ? (
        <SocialWebCanvas
          neighborhood={data}
          subjectId={focusSubject}
          accent={theme.accent}
          onNavigate={(nodeId) =>
            router.push(`/character/${nodeId}` as Parameters<typeof router.push>[0])
          }
          onRecenter={(nodeId) => setFocusSubject(nodeId)}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {sparse ? 'Not enough connections to map yet.' : 'Mapping the universe…'}
          </Text>
        </View>
      )}

      <Text style={styles.hint}>Tap a node to focus · long-press to recenter · Open to visit</Text>
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
  screen: { flex: 1, backgroundColor: SURFACE.ink },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: TOPBAR_HEIGHT + 14,
    paddingBottom: 8,
  },
  back: { padding: 6 },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    lineHeight: 28,
    color: INK_TEXT.primary,
    flex: 1,
  } as object,
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.muted },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: INK_TEXT.faint },
  hint: {
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: INK_TEXT.faint,
    paddingVertical: 14,
  },
});
