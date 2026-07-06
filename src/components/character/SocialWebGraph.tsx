import { Fragment, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { monogram } from '../RelatedHeroStrip';
import { layoutNeighborhood } from '../../lib/graph/forceLayout';
import { subjectKind, type Neighborhood } from '../../lib/db/heroes/neighborhood';
import { connectedIds, isEdgeLit, isNodeLit } from './socialWebFocus';

const KIND_COLOR: Record<string, string> = {
  enemy: COLORS.red,
  ally: COLORS.green,
  teammate: COLORS.blue,
};

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

// Dark-constellation renderer: glowing kind-tinted edges + haloed portrait
// nodes on deep ink. Focus dims everything not connected to the focused node.
// Nodes fade/bloom outward from centre once on mount; the subject halo pulses.
export function SocialWebGraph({
  neighborhood,
  subjectId,
  accent,
  size,
  focusId = null,
  onNodePress,
  onNodeLongPress,
  onNodeOpen,
}: {
  neighborhood: Neighborhood;
  subjectId: string;
  accent: string;
  size: number;
  focusId?: string | null;
  onNodePress?: (id: string) => void;
  onNodeLongPress?: (id: string) => void;
  onNodeOpen?: (id: string) => void;
}) {
  const { nodes, edges } = neighborhood;
  const positions = useMemo(
    () =>
      layoutNeighborhood(
        nodes.map((n) => ({ id: n.id, isSubject: n.is_subject })),
        edges,
      ),
    [nodes, edges],
  );
  const connected = useMemo(
    () => (focusId ? connectedIds(edges, focusId) : new Set<string>()),
    [edges, focusId],
  );

  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 48;
  const at = (id: string) => {
    const p = positions.get(id) ?? { x: 0, y: 0 };
    return { x: cx + p.x * R, y: cy + p.y * R };
  };

  // Mount entrance: 0→1, re-keyed when the subject (neighbourhood) changes.
  const [entrance, setEntrance] = useState(() => (reducedMotion() ? 1 : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setEntrance(1);
      return;
    }
    setEntrance(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 600, 1);
      setEntrance(1 - (1 - p) ** 3);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [subjectId]);

  // Subject halo pulse (the one loop).
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion()) return;
    pulse.value = withRepeat(
      withTiming(1.18, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {edges.map((e, i) => {
          const a = at(e.from);
          const b = at(e.to);
          const lit = isEdgeLit(e, focusId);
          const incident = e.from === subjectId || e.to === subjectId;
          const color = KIND_COLOR[e.kind] ?? COLORS.grey;
          const alpha = !lit ? '12' : incident ? 'ee' : '99';
          const glowA = !lit ? '08' : incident ? '3a' : '22';
          return (
            <Fragment key={i}>
              {/* wide low-alpha glow underlay */}
              <Line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color + glowA}
                strokeWidth={incident ? 6 : 4}
                opacity={entrance}
              />
              {/* crisp core */}
              <Line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color + alpha}
                strokeWidth={incident ? 1.8 : 1}
                opacity={entrance}
              />
            </Fragment>
          );
        })}
      </Svg>
      {nodes.map((n) => {
        const p = at(n.id);
        const fame = n.fame_score ?? 0;
        const d = n.is_subject ? 72 : Math.round(40 + 12 * (fame / 100));
        const kind = n.is_subject ? null : subjectKind(edges, subjectId, n.id);
        const ring = n.is_subject ? accent : kind ? KIND_COLOR[kind] : COLORS.grey;
        const lit = isNodeLit(n.id, focusId, connected);
        // entrance: lerp from centre outward
        const ex = cx + (p.x - cx) * entrance;
        const ey = cy + (p.y - cy) * entrance;
        const isFocused = focusId === n.id;
        return (
          <View
            key={n.id}
            style={
              [
                styles.nodeWrap,
                {
                  left: ex - d / 2,
                  top: ey - d / 2,
                  width: d,
                  height: d,
                  opacity: lit ? entrance : 0.2 * entrance,
                },
              ] as object
            }
            pointerEvents="box-none"
          >
            {/* halo */}
            {n.is_subject ? (
              <Animated.View
                style={
                  [
                    styles.halo,
                    {
                      width: d + 20,
                      height: d + 20,
                      borderRadius: (d + 20) / 2,
                      backgroundColor: ring + '2e',
                      left: -10,
                      top: -10,
                    },
                    pulseStyle,
                  ] as object
                }
                pointerEvents="none"
              />
            ) : (
              <View
                style={
                  [
                    styles.halo,
                    {
                      width: d + 12,
                      height: d + 12,
                      borderRadius: (d + 12) / 2,
                      backgroundColor: ring + (isFocused ? '3a' : '1f'),
                      left: -6,
                      top: -6,
                    },
                  ] as object
                }
                pointerEvents="none"
              />
            )}
            <Pressable
              onPress={() => onNodePress?.(n.id)}
              onLongPress={() => onNodeLongPress?.(n.id)}
              style={
                [
                  styles.node,
                  {
                    width: d,
                    height: d,
                    borderRadius: d / 2,
                    borderColor: ring,
                    borderWidth: n.is_subject ? 3 : 2,
                  },
                ] as object
              }
            >
              {n.portrait_url || n.image_md_url || n.image_url ? (
                <HeroImage
                  id={n.id}
                  name={n.name}
                  imageUrl={n.image_url}
                  portraitUrl={n.portrait_url}
                  imageMdUrl={n.image_md_url}
                  grid
                  contentFit="cover"
                  contentPosition="top"
                  style={{ width: d, height: d }}
                  recyclingKey={n.id}
                />
              ) : (
                <View style={styles.mono}>
                  <Text style={[styles.monoText, { color: ring }] as object}>
                    {monogram(n.name)}
                  </Text>
                </View>
              )}
            </Pressable>
            {/* Open affordance on the focused node */}
            {isFocused && !n.is_subject ? (
              <Pressable
                onPress={() => onNodeOpen?.(n.id)}
                style={[styles.openChip, { borderColor: ring }] as object}
              >
                <Text style={styles.openText}>Open</Text>
                <Ionicons name="chevron-forward" size={11} color={INK_TEXT.primary} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nodeWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' } as object,
  halo: { position: 'absolute' } as object,
  node: { overflow: 'hidden', backgroundColor: COLORS.navy } as object,
  mono: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy },
  monoText: { fontFamily: 'Flame-Regular', fontSize: 16, lineHeight: 20 } as object,
  openChip: {
    position: 'absolute',
    bottom: -26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(11,24,32,0.85)',
  } as object,
  openText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 10, color: INK_TEXT.primary },
});
