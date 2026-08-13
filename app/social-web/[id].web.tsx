import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SURFACE, INK_TEXT } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { useUniverseScrollLock } from '../../src/hooks/useUniverseScrollLock';
import {
  getHeroNeighborhood,
  subjectBlurb,
  subjectKind,
  subjectRelation,
} from '../../src/lib/db/heroes/neighborhood';
import { nodeDegree } from '../../src/components/character/socialWebFocus';
import UniverseScene, { type UniverseNode } from '../../src/components/character/UniverseScene.dom';
import { SocialWebFocusCard } from '../../src/components/character/SocialWebFocusCard';
import { SocialWebSearch } from '../../src/components/character/SocialWebSearch';
import { NebulaLoader } from '../../src/components/character/NebulaLoader';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { getSharedTitles } from '../../src/lib/db/heroes/sharedTitles';
import { deriveCharacterTheme } from '../../src/lib/accent';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { UniverseTrail, type TrailStop } from '../../src/components/character/UniverseTrail';
import { ShareUniverseButton } from '../../src/components/character/ShareUniverseButton';

export default function SocialWebExplorer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const narrow = useWindowDimensions().width < 760;
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  useUniverseScrollLock();

  const [focusSubject, setFocusSubject] = useState<string>(id);
  const [trail, setTrail] = useState<TrailStop[]>([]);
  // A phone shows the same heads at a fraction of the width, so the same count
  // that reads as a constellation on desktop reads as a crowd here.
  const nodeLimit = narrow ? 14 : 24;
  const neighbourhoodQuery = (heroId: string) => ({
    queryKey: ['neighborhood', heroId, nodeLimit],
    queryFn: () => getHeroNeighborhood(heroId, nodeLimit),
    staleTime: 5 * 60 * 1000,
  });
  const { data, isError, refetch } = useQuery({
    ...neighbourhoodQuery(focusSubject),
    // Hold the outgoing universe on screen while the next one loads. Without
    // this `data` goes undefined the moment you travel, the scene below
    // unmounts, and the WebGL context — with every head and texture in it — is
    // destroyed and rebuilt. There would be nothing left to animate.
    placeholderData: keepPreviousData,
  });
  const queryClient = useQueryClient();
  const subjectNode = data?.nodes.find((n) => n.id === focusSubject);
  const theme = useMemo(
    () => deriveCharacterTheme({ publisher: subjectNode?.publisher ?? null }),
    [subjectNode],
  );

  const [focusId, setFocusId] = useState<string | null>(null);

  /**
   * Move the universe to another character.
   *
   * `setParams` rather than `push`: the address bar has to follow you — a
   * travelled-to universe was previously unlinkable, unrefreshable and
   * unshareable, since the URL kept naming whoever you started on. But pushing
   * a genuine history entry re-creates the screen, and re-creating the screen
   * destroys the WebGL context along with the transition that's the reason to
   * travel at all. So the URL is kept truthful without touching the history
   * stack, and retracing is offered explicitly through the trail instead of
   * through the browser's back button.
   */
  const travelTo = useCallback(
    (nextId: string) => {
      if (nextId === focusSubject) return;
      const leaving = subjectNode?.name;
      if (leaving) {
        setTrail((t) =>
          // Hopping back to somewhere already on the path truncates to it
          // rather than growing a loop of the same two names.
          t.some((s) => s.id === nextId)
            ? t.slice(
                0,
                t.findIndex((s) => s.id === nextId),
              )
            : [...t, { id: focusSubject, name: leaving }].slice(-8),
        );
      }
      setFocusSubject(nextId);
      setFocusId(null);
      router.setParams({ id: nextId });
    },
    [focusSubject, subjectNode, router],
  );

  // A deep link or an in-app navigation can change the route param without
  // going through travelTo; the scene should follow it either way.
  useEffect(() => {
    if (id && id !== focusSubject) setFocusSubject(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const focusNode = (focusId && data?.nodes.find((n) => n.id === focusId)) || null;
  const focusKind = focusNode ? subjectKind(data!.edges, focusSubject, focusNode.id) : null;
  const focusRelation = focusNode ? subjectRelation(data!.edges, focusSubject, focusNode.id) : null;
  const focusBlurb = focusNode ? subjectBlurb(data!.edges, focusSubject, focusNode.id) : null;
  const focusDegree = focusNode ? nodeDegree(data!.edges, focusNode.id) : 0;
  // Fetched per focused pair rather than folded into the neighbourhood, which
  // would compute and ship it for all 24 nodes to show it for one.
  const { data: sharedTitles } = useQuery({
    queryKey: ['sharedTitles', focusSubject, focusId],
    queryFn: () => getSharedTitles(focusSubject, focusId as string, 3),
    enabled: !!focusId,
    staleTime: 30 * 60 * 1000,
  });
  // The scene needs each node's tie to the subject up front — it can't run
  // subjectKind per frame, and DOM component props must be plain JSON.
  const universeNodes: UniverseNode[] = useMemo(
    () =>
      (data?.nodes ?? []).map((n) => ({
        id: n.id,
        name: n.name,
        avatar_url: n.avatar_url,
        portrait_url: n.portrait_url,
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
            // Only on a phone: the desktop band sits below the ring already.
            //
            // The ring should end up centred in the gap between the header and
            // the sheet, not merely somewhere above the sheet. Measured against
            // the whole viewport this was ~0.42 and shoved the top cluster up
            // under the header; the header already owns the first ~115px, so
            // the correction needed is about half that.
            lift={narrow && focusNode ? 0.22 : 0}
            onSelect={async (nodeId: string) => {
              // The empty id is how Escape asks for the dossier to close.
              setFocusId(nodeId || null);
              if (!nodeId) return;
              // Travel is always preceded by selecting the same head — a
              // double-click fires click first, and on touch the first tap of a
              // double tap does too. Warming that character's cast here means
              // the scene usually has it in hand the instant travel starts, so
              // the transition plays out rather than waiting on the network.
              void queryClient.prefetchQuery(neighbourhoodQuery(nodeId));
            }}
            onRecenter={async (nodeId: string) => travelTo(nodeId)}
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

      {/* Full-screen nebula behind the chrome while the neighbourhood loads.
          Gated on isError too, or a failed fetch spins forever. */}
      {!data && !isError ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <NebulaLoader />
        </View>
      ) : null}
      {isError ? (
        <View style={styles.failed as object}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn’t load this universe"
            body="Check your connection and try again."
            action={{ label: 'Try again', onPress: () => void refetch() }}
          />
        </View>
      ) : null}
      <View style={[styles.header, narrow && styles.headerNarrow] as object}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={INK_TEXT.primary} />
        </Pressable>
        {/* No legend: the scene now labels each faction ON its own cluster, which
            is both nearer the thing it names and honest — these toggles were
            never wired to the WebGL scene, so filtering by kind did nothing. */}
        <View style={styles.titleWrap}>
          <Text style={[styles.title, narrow && styles.titleNarrow] as object} numberOfLines={1}>
            {subjectNode ? `${subjectNode.name}'s universe` : 'Universe'}
          </Text>
          <UniverseTrail
            trail={trail}
            current={subjectNode?.name ?? ''}
            max={narrow ? 1 : 3}
            onJump={(i) => travelTo(trail[i].id)}
          />
        </View>
        <View style={styles.actions}>
          {data && !sparse ? (
            <SocialWebSearch
              nodes={data.nodes}
              kindOf={(nid) => subjectKind(data.edges, focusSubject, nid)}
              onPick={(pid) => setFocusId(pid)}
            />
          ) : null}
          <ShareUniverseButton
            heroId={focusSubject}
            name={subjectNode?.name ?? ''}
            compact={narrow}
          />
        </View>
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

      {focusNode && !focusNode.is_subject ? (
        <SocialWebFocusCard
          node={focusNode}
          subject={subjectNode ?? null}
          subjectName={subjectNode?.name ?? ''}
          subjectTeams={subjectNode?.teams ?? null}
          onCompare={() =>
            router.push(
              `/compare/${focusSubject}/${focusNode.id}` as Parameters<typeof router.push>[0],
            )
          }
          kind={focusKind}
          relation={focusRelation}
          blurb={focusBlurb}
          shared={sharedTitles ?? null}
          degree={focusDegree}
          accent={theme.accent}
          onView={() =>
            router.push(`/character/${focusNode.id}` as Parameters<typeof router.push>[0])
          }
          onClose={() => setFocusId(null)}
        />
      ) : null}

      {focusNode ? null : (
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
  failed: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  } as object,
  // 100dvh, not flex:1 of the layout viewport: on iOS Safari the layout viewport
  // is the LARGE one (browser chrome collapsed), so a full-height scene ran
  // taller than the visible area — the page could scroll, which slid this
  // screen's own header up under the fixed TopBar (title landing on top of the
  // logo, Share on top of the avatar) and pushed the focus card's lower half
  // behind the toolbar. dvh is the viewport you can actually see.
  screen: {
    flex: 1,
    height: '100dvh',
    maxHeight: '100dvh',
    backgroundColor: SURFACE.ink,
  } as object,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 16,
    // The TopBar's real height is TOPBAR_HEIGHT + the status-bar inset, so the
    // clearance has to carry the inset too or the header rides up into it.
    paddingTop: `calc(${TOPBAR_HEIGHT + 14}px + env(safe-area-inset-top))`,
    paddingBottom: 8,
  } as object,
  back: { padding: 6 },
  titleWrap: { flex: 1, gap: 3 },
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
    paddingTop: `calc(${TOPBAR_HEIGHT + 8}px + env(safe-area-inset-top))`,
  } as object,
  titleNarrow: { fontSize: 19, lineHeight: 24 } as object,
  // Header controls sit above the scene so the search panel can hang over it.
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 30 } as object,
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
