import { Fragment, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { HeroAvatar } from '../HeroAvatar';
import { monogram } from '../RelatedHeroStrip';
import { layoutOrbital } from '../../lib/graph/orbitalLayout';
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

// Solar-system renderer: the subject at the centre, everyone else orbiting in the
// band for their relationship — teammates closest, then allies, then enemies.
// The orbit says the relationship, so the subject's edges aren't drawn at all;
// only neighbour-to-neighbour ties appear, and only for the node you point at.
// Nodes fade/bloom outward from centre once on mount; the subject halo pulses.
export function SocialWebGraph({
  neighborhood,
  subjectId,
  accent,
  size,
  focusId = null,
  sharedIds,
  activeKinds,
  nodeScale = 1,
  onNodePress,
  onNodeLongPress,
}: {
  neighborhood: Neighborhood;
  subjectId: string;
  accent: string;
  size: number;
  focusId?: string | null;
  sharedIds?: Set<string>;
  activeKinds?: { enemy: boolean; ally: boolean; teammate: boolean };
  /** Shrink nodes (e.g. for the compact preview) without changing layout. */
  nodeScale?: number;
  onNodePress?: (id: string) => void;
  onNodeLongPress?: (id: string) => void;
}) {
  const kinds = activeKinds ?? { enemy: true, ally: true, teammate: true };
  const { nodes, edges } = neighborhood;
  const { positions, bands } = useMemo(
    () =>
      layoutOrbital(
        nodes.map((n) => ({
          id: n.id,
          isSubject: n.is_subject,
          kind: n.is_subject ? null : subjectKind(edges, subjectId, n.id),
          fame: n.fame_score ?? 0,
        })),
        subjectId,
      ),
    [nodes, edges, subjectId],
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

  // Web hover (no-op on native): drives the node lift + name-chip reveal.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  // Living subject edges: a dash offset loops so energy appears to flow along
  // the subject's connections (the second, gated loop).
  const dash = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion()) return;
    dash.value = withRepeat(withTiming(-10, { duration: 900, easing: Easing.linear }), -1, false);
  }, [dash]);
  const dashProps = useAnimatedProps(() => ({ strokeDashoffset: dash.value }));
  const AnimatedLine = useMemo(() => Animated.createAnimatedComponent(Line), []);
  const flow = !reducedMotion();

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Orbit rings. Each band's radius IS its relationship, so these replace
            the subject's edges entirely rather than sitting behind them. */}
        {bands.map((band) => (
          <Circle
            key={band.kind}
            cx={cx}
            cy={cy}
            r={band.r * R}
            fill="none"
            stroke={(KIND_COLOR[band.kind] ?? COLORS.grey) + (kinds[band.kind] ? '2e' : '10')}
            strokeWidth={1}
            strokeDasharray="2 7"
            opacity={entrance}
          />
        ))}
        {edges.map((e, i) => {
          if (!kinds[e.kind]) return null;
          const incident = e.from === subjectId || e.to === subjectId;
          // The subject's own ties are now said by the orbit a character sits in,
          // so drawing them would repeat the ring in line form. What the rings
          // can't show is how the neighbours relate to EACH OTHER — so those are
          // the only edges left, and only for the node you're pointing at.
          const active = hoveredId ?? focusId;
          const onActive = active ? e.from === active || e.to === active : false;
          if (incident || !onActive) return null;

          const a = at(e.from);
          const b = at(e.to);
          const lit = isEdgeLit(e, focusId);
          const color = KIND_COLOR[e.kind] ?? COLORS.grey;
          const alpha = lit ? '99' : '12';
          const glowA = lit ? '22' : '08';
          return (
            <Fragment key={i}>
              {/* wide low-alpha glow underlay */}
              <Line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color + glowA}
                strokeWidth={4}
                opacity={entrance}
              />
              {/* crisp core */}
              <Line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color + alpha}
                strokeWidth={1}
                opacity={entrance}
              />
              {/* living energy flow along the revealed ties */}
              {lit && flow ? (
                <AnimatedLine
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={color + 'aa'}
                  strokeWidth={1.4}
                  strokeDasharray="2 8"
                  animatedProps={dashProps}
                  opacity={entrance}
                />
              ) : null}
            </Fragment>
          );
        })}
      </Svg>
      {nodes.map((n) => {
        const p = at(n.id);
        const fame = n.fame_score ?? 0;
        // Wide fame spread (34→64) rather than the old near-uniform 40→52, so the
        // eye gets anchors and the field reads as a hierarchy instead of a swarm.
        const d = Math.round((n.is_subject ? 78 : 34 + 30 * (fame / 100)) * nodeScale);
        const kind = n.is_subject ? null : subjectKind(edges, subjectId, n.id);
        const ring = n.is_subject ? accent : kind ? KIND_COLOR[kind] : COLORS.grey;
        // With an avatar the cut-out head IS the node: no disc, no ring, no fill.
        // The edges already carry the kind colour, so the ring was redundant once
        // the silhouette became legible. Portrait/monogram nodes keep the disc,
        // since a square crop needs the circle to read as a node at all.
        const headOnly = !!n.avatar_url;
        const lit = isNodeLit(n.id, focusId, connected);
        // A node whose only tie to the subject is a filtered-out kind fades away.
        const filtered = kind ? !kinds[kind] : false;
        // entrance: lerp from centre outward
        const ex = cx + (p.x - cx) * entrance;
        const ey = cy + (p.y - cy) * entrance;
        const isFocused = focusId === n.id;
        const isShared = sharedIds?.has(n.id) ?? false;
        const hovered = hoveredId === n.id;
        const showChip = n.is_subject || isFocused || hovered;
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
                  opacity: filtered ? 0.15 * entrance : lit ? entrance : 0.2 * entrance,
                },
              ] as object
            }
            pointerEvents={filtered ? 'none' : 'box-none'}
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
                      width: d + (isShared ? 16 : 12),
                      height: d + (isShared ? 16 : 12),
                      borderRadius: (d + (isShared ? 16 : 12)) / 2,
                      backgroundColor: ring + (isFocused || isShared ? '55' : '1f'),
                      left: isShared ? -8 : -6,
                      top: isShared ? -8 : -6,
                    },
                  ] as object
                }
                pointerEvents="none"
              />
            )}
            <Pressable
              onPress={() => onNodePress?.(n.id)}
              onLongPress={() => onNodeLongPress?.(n.id)}
              onHoverIn={() => setHoveredId(n.id)}
              onHoverOut={() => setHoveredId((c) => (c === n.id ? null : c))}
              style={
                [
                  headOnly ? styles.headNode : styles.node,
                  {
                    width: d,
                    height: d,
                    transform: [{ scale: hovered ? 1.08 : 1 }],
                    transition: 'transform 160ms ease',
                  },
                  headOnly
                    ? null
                    : {
                        borderRadius: d / 2,
                        borderColor: ring,
                        borderWidth: n.is_subject ? 3 : 2,
                      },
                ] as object
              }
            >
              {headOnly ? (
                // No face-shifting needed: it's already a centred head drawn for
                // this size. Sized past the node box because the art carries its
                // own margin — at 1:1 the head would read smaller than the discs
                // it sits beside.
                <HeroAvatar
                  id={n.id}
                  name={n.name}
                  avatarUrl={n.avatar_url}
                  size={Math.round(d * 1.3)}
                  bare
                />
              ) : n.portrait_url || n.image_md_url || n.image_url ? (
                <HeroImage
                  id={n.id}
                  name={n.name}
                  imageUrl={n.image_url}
                  portraitUrl={n.portrait_url}
                  imageMdUrl={n.image_md_url}
                  grid
                  contentFit="cover"
                  // Shift the portrait up so the face (not the hair) fills the
                  // circle — negative top pulls the image up, revealing the chin.
                  contentPosition={{ top: '28%', left: '50%' }}
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
            {showChip ? <NameChip name={n.name} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function NameChip({ name }: { name: string }) {
  return (
    <View style={styles.nameChip} pointerEvents="none">
      <Text style={styles.nameChipText} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nodeWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' } as object,
  nameChip: {
    position: 'absolute',
    bottom: -20,
    alignSelf: 'center',
    maxWidth: 120,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(11,24,32,0.9)',
  } as object,
  nameChipText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 10, color: INK_TEXT.primary },
  halo: { position: 'absolute' } as object,
  node: { overflow: 'hidden', backgroundColor: COLORS.navy } as object,
  // Head-only nodes must not clip: the art is sized past the node box so the
  // head reads at the same weight as a disc node, and overflow is the point.
  // drop-shadow (not boxShadow) follows the PNG's alpha, so the rim traces the
  // silhouette rather than a square. Two passes: a faint warm halo that lifts
  // near-black heads (Batman, Venom, Black Panther) off the ink, and a soft dark
  // shadow that keeps pale heads from floating.
  headNode: {
    alignItems: 'center',
    justifyContent: 'center',
    filter: 'drop-shadow(0 0 5px rgba(245,235,220,0.28)) drop-shadow(0 2px 5px rgba(0,0,0,0.55))',
  } as object,
  mono: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.navy },
  monoText: { fontFamily: 'Flame-Regular', fontSize: 16, lineHeight: 20 } as object,
});
