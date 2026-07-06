import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SURFACE, INK_TEXT } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { getHeroNeighborhood, subjectKind } from '../../src/lib/db/heroes/neighborhood';
import { nodeDegree, sharedWithSubject } from '../../src/components/character/socialWebFocus';
import { SocialWebCanvas } from '../../src/components/character/SocialWebCanvas';
import { SocialWebFocusCard } from '../../src/components/character/SocialWebFocusCard';
import { SocialWebSearch } from '../../src/components/character/SocialWebSearch';
import { NebulaLoader } from '../../src/components/character/NebulaLoader';
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

  const [activeKinds, setActiveKinds] = useState({ enemy: true, ally: true, teammate: true });
  const [focusId, setFocusId] = useState<string | null>(null);
  const [centerOnId, setCenterOnId] = useState<string | null>(null);
  const focusNode = (focusId && data?.nodes.find((n) => n.id === focusId)) || null;
  const focusKind = focusNode ? subjectKind(data!.edges, focusSubject, focusNode.id) : null;
  const focusDegree = focusNode ? nodeDegree(data!.edges, focusNode.id) : 0;
  const sharedIds = useMemo(
    () =>
      focusId && data ? sharedWithSubject(data.edges, focusSubject, focusId) : new Set<string>(),
    [focusId, data, focusSubject],
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
          <Legend
            color={COLORS.red}
            label="Enemy"
            active={activeKinds.enemy}
            onToggle={() => setActiveKinds((k) => ({ ...k, enemy: !k.enemy }))}
          />
          <Legend
            color={COLORS.green}
            label="Ally"
            active={activeKinds.ally}
            onToggle={() => setActiveKinds((k) => ({ ...k, ally: !k.ally }))}
          />
          <Legend
            color={COLORS.blue}
            label="Team"
            active={activeKinds.teammate}
            onToggle={() => setActiveKinds((k) => ({ ...k, teammate: !k.teammate }))}
          />
        </View>
      </View>

      {data && !sparse ? (
        <SocialWebCanvas
          neighborhood={data}
          subjectId={focusSubject}
          accent={theme.accent}
          focusId={focusId}
          onFocusChange={setFocusId}
          sharedIds={sharedIds}
          activeKinds={activeKinds}
          centerOnId={centerOnId}
          onRecenter={(nodeId) => {
            setFocusSubject(nodeId);
            setFocusId(null);
          }}
        />
      ) : sparse ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Not enough connections to map yet.</Text>
        </View>
      ) : (
        <NebulaLoader />
      )}

      {data && !sparse ? (
        <View style={styles.searchOverlay}>
          <SocialWebSearch
            nodes={data.nodes}
            onPick={(pid) => {
              setFocusId(pid);
              setCenterOnId(pid);
              // allow re-centring the same node on a later pick
              setTimeout(() => setCenterOnId(null), 400);
            }}
          />
        </View>
      ) : null}

      {focusNode && !focusNode.is_subject ? (
        <SocialWebFocusCard
          node={focusNode}
          subjectName={subjectNode?.name ?? ''}
          kind={focusKind}
          degree={focusDegree}
          accent={theme.accent}
          onView={() =>
            router.push(`/character/${focusNode.id}` as Parameters<typeof router.push>[0])
          }
          onClose={() => setFocusId(null)}
        />
      ) : null}

      <Text style={styles.hint}>Tap a node to focus · long-press to recenter</Text>
    </View>
  );
}

function Legend({
  color,
  label,
  active,
  onToggle,
}: {
  color: string;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.legendItem} onPress={onToggle}>
      <View
        style={[
          styles.dot,
          {
            backgroundColor: active ? color : 'transparent',
            borderWidth: active ? 0 : 1.5,
            borderColor: color,
          },
        ]}
      />
      <Text style={[styles.legendText, !active && { opacity: 0.4 }] as object}>{label}</Text>
    </Pressable>
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
  searchOverlay: { position: 'absolute', left: 16, top: TOPBAR_HEIGHT + 60, zIndex: 20 } as object,
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
