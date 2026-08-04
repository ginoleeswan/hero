// app/social-web/[id].tsx — the native universe explorer, rendering the SAME
// three.js scene as the web one (UniverseScene is a 'use dom' component, so it
// runs in a WebView here) — one constellation, no drift between platforms.
// The old native screen drew its own flat SVG canvas; this replaces it with
// the full web experience: orbit/pinch, focus dossiers, travel with a trail,
// in-scene faction labels, search, and share.
//
// Mirrors [id].web.tsx with native chrome: safe-area header instead of the
// TopBar clearance, LinearGradient edge fades instead of CSS backgroundImage,
// and RN's share sheet inside ShareUniverseButton.
import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SURFACE, INK_TEXT } from '../../src/constants/colors';
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
import { getSharedTitles } from '../../src/lib/db/heroes/sharedTitles';
import { deriveCharacterTheme } from '../../src/lib/accent';
import { UniverseTrail, type TrailStop } from '../../src/components/character/UniverseTrail';
import { ShareUniverseButton } from '../../src/components/character/ShareUniverseButton';

// A phone shows the same heads at a fraction of a desktop's width — the web
// screen uses this same count in its narrow branch.
const NODE_LIMIT = 14;

export default function SocialWebExplorerNative() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [focusSubject, setFocusSubject] = useState<string>(id);
  const [trail, setTrail] = useState<TrailStop[]>([]);
  const neighbourhoodQuery = (heroId: string) => ({
    queryKey: ['neighborhood', heroId, NODE_LIMIT],
    queryFn: () => getHeroNeighborhood(heroId, NODE_LIMIT),
    staleTime: 5 * 60 * 1000,
  });
  const { data } = useQuery({
    ...neighbourhoodQuery(focusSubject),
    // Hold the outgoing universe on screen while the next one loads — without
    // this the scene unmounts on travel and the WebGL context is destroyed.
    placeholderData: keepPreviousData,
  });
  const queryClient = useQueryClient();
  const subjectNode = data?.nodes.find((n) => n.id === focusSubject);
  const theme = useMemo(
    () => deriveCharacterTheme({ publisher: subjectNode?.publisher ?? null }),
    [subjectNode],
  );

  const [focusId, setFocusId] = useState<string | null>(null);

  // Travel keeps the route param truthful without pushing a history entry —
  // a push would re-create the screen and destroy the WebGL context mid-
  // transition. Retracing is offered through the trail instead.
  const travelTo = useCallback(
    (nextId: string) => {
      if (nextId === focusSubject) return;
      const leaving = subjectNode?.name;
      if (leaving) {
        setTrail((t) =>
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

  // A deep link can change the route param without going through travelTo.
  useEffect(() => {
    if (id && id !== focusSubject) setFocusSubject(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const focusNode = (focusId && data?.nodes.find((n) => n.id === focusId)) || null;
  const focusKind = focusNode ? subjectKind(data!.edges, focusSubject, focusNode.id) : null;
  const focusRelation = focusNode ? subjectRelation(data!.edges, focusSubject, focusNode.id) : null;
  const focusBlurb = focusNode ? subjectBlurb(data!.edges, focusSubject, focusNode.id) : null;
  const focusDegree = focusNode ? nodeDegree(data!.edges, focusNode.id) : 0;
  const { data: sharedTitles } = useQuery({
    queryKey: ['sharedTitles', focusSubject, focusId],
    queryFn: () => getSharedTitles(focusSubject, focusId as string, 3),
    enabled: !!focusId,
    staleTime: 30 * 60 * 1000,
  });
  // The scene needs each node's tie to the subject up front — DOM component
  // props must be plain JSON.
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
      <StatusBar style="light" />

      {/* Faint accent floor under the subject — the native stand-in for the
          web's tight radial bloom (stacked discs, no blur cost). */}
      <View style={styles.bloomWrap} pointerEvents="none">
        <View
          style={[styles.bloom, styles.bloomOuter, { backgroundColor: theme.accentDeep + '14' }]}
        />
        <View
          style={[styles.bloom, styles.bloomCore, { backgroundColor: theme.accentDeep + '1f' }]}
        />
      </View>

      {/* Full-bleed scene: canvas centre and screen centre must be the same
          point, so chrome paints over it rather than boxing it. */}
      {data && !sparse ? (
        <View style={StyleSheet.absoluteFill}>
          <UniverseScene
            dom={{
              scrollEnabled: false,
              matchContents: false,
              style: { width: '100%', height: '100%', borderWidth: 0 },
            }}
            subjectId={focusSubject}
            nodes={universeNodes}
            edges={data.edges}
            focusId={focusId}
            // Phone: centre the ring in the gap between header and dossier
            // sheet while one is up (same constant as the web narrow branch).
            lift={focusNode ? 0.22 : 0}
            onSelect={async (nodeId: string) => {
              setFocusId(nodeId || null);
              if (!nodeId) return;
              // Warm the tapped character's cast so travel starts instantly.
              void queryClient.prefetchQuery(neighbourhoodQuery(nodeId));
            }}
            onRecenter={async (nodeId: string) => travelTo(nodeId)}
          />
        </View>
      ) : null}

      {/* Ink fades so the title and hint have ground to stand on while heads
          pass behind the chrome — gradients, not solid bars. */}
      <LinearGradient
        colors={[SURFACE.ink + 'f2', SURFACE.ink + 'b8', SURFACE.ink + '00']}
        locations={[0, 0.45, 1]}
        style={[styles.topFade, { height: insets.top + 150 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[SURFACE.ink + '00', SURFACE.ink + 'd9']}
        style={styles.bottomFade}
        pointerEvents="none"
      />

      {/* Full-screen nebula while the neighbourhood loads */}
      {!data ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <NebulaLoader />
        </View>
      ) : null}

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(`/character/${focusSubject}`)
          }
          style={styles.back}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={INK_TEXT.primary} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {subjectNode ? `${subjectNode.name}'s universe` : 'Universe'}
          </Text>
          <UniverseTrail
            trail={trail}
            current={subjectNode?.name ?? ''}
            max={1}
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
          <ShareUniverseButton heroId={focusSubject} name={subjectNode?.name ?? ''} compact />
        </View>
      </View>

      {sparse ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Not enough connections to map yet.</Text>
        </View>
      ) : (
        // Spacer holds the header up and the hint down without swallowing the
        // drag-to-orbit gesture on the scene beneath.
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
        <Text style={[styles.hint, { paddingBottom: insets.bottom + 14 }]}>
          Drag to orbit · pinch to zoom · tap a head · double-tap to travel
        </Text>
      )}
    </View>
  );
}

const BLOOM = 340;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SURFACE.ink },
  bloomWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloom: { position: 'absolute', borderRadius: BLOOM },
  bloomOuter: { width: BLOOM, height: BLOOM * 0.82 },
  bloomCore: { width: BLOOM * 0.6, height: BLOOM * 0.5 },
  topFade: { position: 'absolute', left: 0, right: 0, top: 0 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  back: { padding: 6 },
  titleWrap: { flex: 1, gap: 3 },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 19,
    lineHeight: 24,
    color: INK_TEXT.primary,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 30 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: INK_TEXT.faint },
  hint: {
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: INK_TEXT.faint,
    paddingTop: 14,
  },
});
