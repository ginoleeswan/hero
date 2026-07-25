import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SURFACE, INK_TEXT } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { getHeroNeighborhood, subjectKind } from '../../src/lib/db/heroes/neighborhood';
import { nodeDegree, sharedWithSubject } from '../../src/components/character/socialWebFocus';
import UniverseScene, { type UniverseNode } from '../../src/components/character/UniverseScene.dom';
import { SocialWebFocusCard } from '../../src/components/character/SocialWebFocusCard';
import { SocialWebSearch } from '../../src/components/character/SocialWebSearch';
import { NebulaLoader } from '../../src/components/character/NebulaLoader';
import { deriveCharacterTheme } from '../../src/lib/accent';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';

export default function SocialWebExplorer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const narrow = useWindowDimensions().width < 760;
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  const [focusSubject, setFocusSubject] = useState<string>(id);
  // A phone shows the same heads at a fraction of the width, so the same count
  // that reads as a constellation on desktop reads as a crowd here.
  const nodeLimit = narrow ? 14 : 24;
  const { data } = useQuery({
    queryKey: ['neighborhood', focusSubject, nodeLimit],
    queryFn: () => getHeroNeighborhood(focusSubject, nodeLimit),
    staleTime: 5 * 60 * 1000,
  });
  const subjectNode = data?.nodes.find((n) => n.id === focusSubject);
  const theme = useMemo(
    () => deriveCharacterTheme({ publisher: subjectNode?.publisher ?? null }),
    [subjectNode],
  );

  const [focusId, setFocusId] = useState<string | null>(null);
  const focusNode = (focusId && data?.nodes.find((n) => n.id === focusId)) || null;
  const focusKind = focusNode ? subjectKind(data!.edges, focusSubject, focusNode.id) : null;
  const focusDegree = focusNode ? nodeDegree(data!.edges, focusNode.id) : 0;
  // Characters connected to BOTH ends — the card renders them as faces, which
  // is the most legible answer to "how do these two actually overlap".
  const mutuals = useMemo(() => {
    if (!focusId || !data) return [];
    const ids = sharedWithSubject(data.edges, focusSubject, focusId);
    return data.nodes.filter((n) => ids.has(n.id) && !n.is_subject && n.id !== focusId);
  }, [focusId, data, focusSubject]);

  // The scene needs each node's tie to the subject up front — it can't run
  // subjectKind per frame, and DOM component props must be plain JSON.
  const universeNodes: UniverseNode[] = useMemo(
    () =>
      (data?.nodes ?? []).map((n) => ({
        id: n.id,
        name: n.name,
        avatar_url: n.avatar_url,
        portrait_url: n.portrait_url,
        image_md_url: n.image_md_url,
        image_url: n.image_url,
        fame_score: n.fame_score,
        is_subject: n.is_subject,
        kind: n.is_subject ? null : subjectKind(data!.edges, focusSubject, n.id),
      })),
    [data, focusSubject],
  );

  const sparse = data && data.nodes.length < 3;

  return (
    <View style={styles.screen}>
      {/* Accent bloom from centre. Deliberately faint and tight: at 4d across
          60% of the screen it summed with the per-head haloes into the formless
          cloud that made the middle of the scene unreadable. It's a floor for
          the subject to stand on, not a light source. */}
      <View
        style={
          [
            StyleSheet.absoluteFill,
            {
              backgroundImage: `radial-gradient(38% 32% at 50% 50%, ${theme.accentDeep}26, transparent 70%)`,
              pointerEvents: 'none',
            },
          ] as object
        }
      />
      {/* The universe is full-bleed behind the chrome. It has to be: the scene
          centres the subject in ITS canvas, so if the canvas were only the box
          below the header, the main head would sit well below the middle of the
          screen. Full-bleed makes canvas centre and screen centre the same
          point. Chrome renders after this, so it paints on top. */}
      {data && !sparse ? (
        <View style={StyleSheet.absoluteFill}>
          <UniverseScene
            // Pin the iframe to its box; left to size itself it grew wider than
            // the viewport and scrolled the whole document sideways.
            dom={{
              scrollEnabled: false,
              matchContents: false,
              style: { width: '100%', height: '100%', borderWidth: 0 },
            }}
            subjectId={focusSubject}
            nodes={universeNodes}
            edges={data.edges}
            focusId={focusId}
            onSelect={async (nodeId: string) => setFocusId(nodeId)}
            onRecenter={async (nodeId: string) => {
              setFocusSubject(nodeId);
              setFocusId(null);
            }}
          />
        </View>
      ) : null}

      {/* Now that heads pass behind the chrome, the title and legend need ground
          to stand on — a short ink fade at each edge, not a solid bar, so the
          scene still reads as full-bleed. */}
      <View
        style={
          [
            { position: 'absolute', left: 0, right: 0, top: 0, height: 190 },
            {
              backgroundImage: `linear-gradient(${SURFACE.ink}f2, ${SURFACE.ink}b8 45%, transparent)`,
              pointerEvents: 'none',
            },
          ] as object
        }
      />
      <View
        style={
          [
            { position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 },
            {
              backgroundImage: `linear-gradient(transparent, ${SURFACE.ink}d9)`,
              pointerEvents: 'none',
            },
          ] as object
        }
      />

      {/* Full-screen nebula behind the chrome while the neighbourhood loads */}
      {!data ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <NebulaLoader />
        </View>
      ) : null}
      <View style={[styles.header, narrow && styles.headerNarrow] as object}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={20} color={INK_TEXT.primary} />
        </Pressable>
        {/* No legend: the scene now labels each faction ON its own cluster, which
            is both nearer the thing it names and honest — these toggles were
            never wired to the WebGL scene, so filtering by kind did nothing. */}
        <Text style={[styles.title, narrow && styles.titleNarrow] as object} numberOfLines={1}>
          {subjectNode ? `${subjectNode.name}'s universe` : 'Universe'}
        </Text>
      </View>

      {sparse ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Not enough connections to map yet.</Text>
        </View>
      ) : (
        // A flex spacer holds the header up and the hint down. It sits OVER the
        // full-bleed scene, so it must not swallow the drag-to-orbit gesture.
        <View style={{ flex: 1 }} pointerEvents="none" />
      )}

      {data && !sparse ? (
        <View style={[styles.searchOverlay, narrow && styles.searchOverlayNarrow] as object}>
          <SocialWebSearch nodes={data.nodes} onPick={(pid) => setFocusId(pid)} />
        </View>
      ) : null}

      {focusNode && !focusNode.is_subject ? (
        <SocialWebFocusCard
          node={focusNode}
          subject={subjectNode ?? null}
          subjectName={subjectNode?.name ?? ''}
          subjectTeams={subjectNode?.teams ?? null}
          mutuals={mutuals}
          onCompare={() =>
            router.push(
              `/compare/${focusSubject}/${focusNode.id}` as Parameters<typeof router.push>[0],
            )
          }
          onPickMutual={(mid) => setFocusId(mid)}
          kind={focusKind}
          degree={focusDegree}
          accent={theme.accent}
          onView={() =>
            router.push(`/character/${focusNode.id}` as Parameters<typeof router.push>[0])
          }
          onClose={() => setFocusId(null)}
        />
      ) : null}

      {narrow && focusNode ? null : (
        <Text style={[styles.hint, narrow && styles.hintNarrow] as object}>
          {narrow
            ? 'Drag to orbit · pinch to zoom · tap a head'
            : 'Drag to orbit · click a head to focus · double-click to travel there'}
        </Text>
      )}
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
  // Narrow: with the legend gone the title has the row to itself, so it stays
  // in-line with the back arrow instead of stacking.
  headerNarrow: {
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 8,
    paddingTop: TOPBAR_HEIGHT + 8,
  } as object,
  titleNarrow: { fontSize: 19, lineHeight: 24 } as object,
  searchOverlay: { position: 'absolute', left: 16, top: TOPBAR_HEIGHT + 60, zIndex: 20 } as object,
  searchOverlayNarrow: { top: TOPBAR_HEIGHT + 54, right: 16 } as object,
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: INK_TEXT.faint },
  hint: {
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: INK_TEXT.faint,
    paddingVertical: 14,
  },
  // Mobile Safari's toolbar floats over the bottom of the viewport, which was
  // slicing this line in half. The safe-area inset is what clears it.
  hintNarrow: {
    paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
  } as object,
});
