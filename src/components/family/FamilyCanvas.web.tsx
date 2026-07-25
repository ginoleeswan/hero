// src/components/family/FamilyCanvas.web.tsx
// Pannable / zoomable family tree for web. Uses react-native-reanimated 4 +
// react-native-gesture-handler for pan + pinch, react-native-svg for edges.
//
// Writing `sharedValue.value = …` in gesture/callback handlers is the Reanimated
// API, not a React mutation; the compiler's immutability rule can't model shared
// values, so it's disabled for this file.
/* eslint-disable react-hooks/immutability */
import { useMemo, useState, useEffect, useCallback, type ReactElement } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, Pattern, Circle, Rect } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { COLORS } from '../../constants/colors';
import { HeroAvatar } from '../HeroAvatar';
import { PlaceholderHead } from './PlaceholderHead';
import { headShapeForRole } from '../../lib/family/kinshipGender';
import { buildFamilyGraph } from '../../lib/family/buildFamilyGraph';
import { layoutFamily } from '../../lib/family/layoutFamily';
import type { FamilyMember, FamilyGraph } from '../../lib/family/types';
import type { PositionedNode, FamilyLayout } from '../../lib/family/layoutFamily';

// Node nominal dimensions (must match layoutFamily constants)
const NODE_W = 158;
const NODE_H = 50;

function alignColor(alignment: string | null): string {
  if (alignment === 'good') return COLORS.blue;
  if (alignment === 'bad') return COLORS.red;
  return COLORS.orange;
}

function roleLabel(member: FamilyMember): string {
  if (member.role) return member.role.split(',')[0].trim();
  return member.relation.replace(/_/g, ' ');
}

// ── Canvas node visual ───────────────────────────────────────────────────────
function CanvasNode({
  node,
  heroName,
  heroImage,
  onNavigate,
}: {
  node: PositionedNode;
  heroName: string;
  heroImage: string | null;
  onNavigate?: () => void;
}): ReactElement {
  const router = useRouter();

  if (node.isHero) {
    return (
      <View style={[styles.heroAnchor, !heroImage && styles.heroAnchorNoImg]}>
        {heroImage ? (
          <Image source={{ uri: heroImage }} style={styles.heroAvatar} contentFit="cover" />
        ) : null}
        <View>
          <Text style={styles.heroName} numberOfLines={1}>
            {heroName}
          </Text>
          <Text style={styles.heroTag}>THIS CHARACTER</Text>
        </View>
      </View>
    );
  }

  const member = node.member;
  if (!member) return <View />;

  if (member.heroId) {
    const tint = alignColor(member.heroAlignment);
    return (
      <Pressable
        style={[styles.linkNode, { borderColor: tint + '66' }]}
        onPress={() => {
          onNavigate?.();
          router.push(`/character/${member.heroId}?name=${encodeURIComponent(member.name)}`);
        }}
      >
        {member.heroPower != null && member.heroPower > 0 ? (
          <View style={styles.powerBadge}>
            <Text style={styles.powerBadgeText}>{member.heroPower}</Text>
          </View>
        ) : null}
        <HeroAvatar
          id={member.heroId}
          name={member.name}
          avatarUrl={member.heroAvatar}
          fallbackUrl={member.heroImage}
          size={30}
          radius={8}
          bare
        />
        <View style={styles.linkMeta}>
          <Text style={[styles.linkName, { maxWidth: 150 }]} numberOfLines={1}>
            {member.name}
          </Text>
          <Text style={styles.roleText} numberOfLines={1}>
            {roleLabel(member)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color="#cdbfa6" />
      </Pressable>
    );
  }

  const dead = member.status === 'deceased';
  return (
    <View style={styles.plainNode}>
      <View style={[styles.nodeInner, dead && styles.dead]}>
        {/* Unmatched relatives have no character behind them, so they get a
            featureless head instead of an empty slot — otherwise a tree reads as
            a few pictures scattered through a list of plain text. */}
        <PlaceholderHead shape={headShapeForRole(member.role)} size={26} />
        <View style={styles.linkMeta}>
          <Text style={[styles.plainName, { maxWidth: 150 }]} numberOfLines={1}>
            {member.name}
            {dead ? ' ✝' : ''}
          </Text>
          <Text style={styles.roleText} numberOfLines={1}>
            {roleLabel(member)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────
function Legend({ large = false }: { large?: boolean }): ReactElement {
  const txt = [styles.legendText, large && styles.legendTextLarge];
  const dot = (bg: string) => [
    styles.legendDot,
    large && styles.legendDotLarge,
    { backgroundColor: bg },
  ];
  return (
    <View style={[styles.legend, large && styles.legendLarge]}>
      <View style={styles.legendItem}>
        <View style={dot('#c3b59c')} />
        <Text style={txt}>Bloodline</Text>
      </View>
      <Text style={[styles.legendSep, large && styles.legendTextLarge]}>·</Text>
      <View style={styles.legendItem}>
        <View style={dot('#E0A335')} />
        <Text style={txt}>Marriage</Text>
      </View>
      <Text style={[styles.legendSep, large && styles.legendTextLarge]}>·</Text>
      <View style={styles.legendItem}>
        <View style={[styles.legendDash, large && styles.legendDashLarge]} />
        <Text style={txt}>Same generation</Text>
      </View>
    </View>
  );
}

// ── Interactive stage: gutter + pannable/zoomable viewport ───────────────────
function FamilyStage({
  layout,
  heroName,
  heroImage,
  fullscreen,
  showAxis,
  compact = false,
  onToggleFullscreen,
  onClose,
  onNavigate,
}: {
  layout: FamilyLayout;
  heroName: string;
  heroImage: string | null;
  fullscreen: boolean;
  showAxis: boolean;
  compact?: boolean;
  onToggleFullscreen: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
}): ReactElement {
  // Touch devices pinch/pan the canvas; the ± buttons are desktop chrome.
  const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const computeCenter = useCallback(
    (vpW: number, vpH: number) => {
      if (vpW === 0) return null;
      const { width: bw, height: bh } = layout.bounds;
      const pad = fullscreen ? 40 : 24;
      const fit = Math.min((vpW - pad) / bw, (vpH - pad) / bh);
      const s = Math.min(fullscreen ? 2.2 : 1.2, Math.max(0.45, fit));
      // RN scales transforms around the element CENTRE, so centring is just
      // viewportCentre − boundsCentre (no scale factor in the translate).
      return { tx: vpW / 2 - bw / 2, ty: vpH / 2 - bh / 2, scale: s };
    },
    [layout, fullscreen],
  );
  const recenter = useCallback(() => {
    const c = computeCenter(vp.w, vp.h);
    if (!c) return;
    tx.value = c.tx;
    ty.value = c.ty;
    scale.value = c.scale;
  }, [computeCenter, vp.w, vp.h, tx, ty, scale]);

  useEffect(() => {
    if (vp.w === 0) return;
    recenter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.w, vp.h, layout]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    });
  const pinch = Gesture.Pinch().onUpdate((e) => {
    scale.value = Math.min(2, Math.max(0.5, e.scale));
  });
  const gesture = Gesture.Simultaneous(pan, pinch);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const nodeMap = useMemo(() => {
    const m = new Map<string, PositionedNode>();
    for (const n of layout.nodes) m.set(n.id, n);
    return m;
  }, [layout.nodes]);

  const zoomIn = () => {
    scale.value = Math.min(2, scale.value + 0.15);
  };
  const zoomOut = () => {
    scale.value = Math.max(0.5, scale.value - 0.15);
  };

  return (
    <View
      style={[
        styles.stage,
        fullscreen ? styles.stageFlat : compact ? styles.stageInlineCompact : styles.stageInline,
      ]}
    >
      {showAxis ? (
        <View style={styles.axisGutter} pointerEvents="none">
          {layout.rows.map((row) => (
            <AxisLabel
              key={row.tier}
              row={row}
              scale={scale}
              ty={ty}
              boundsH={layout.bounds.height}
            />
          ))}
        </View>
      ) : null}
      <View
        style={styles.viewport}
        onLayout={(e) => setVp({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {vp.w > 0 ? (
          <Svg width={vp.w} height={vp.h} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <Pattern
                id="famDots"
                x={0}
                y={0}
                width={24}
                height={24}
                patternUnits="userSpaceOnUse"
              >
                <Circle cx={1} cy={1} r={1} fill="#ece1cd" />
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width={vp.w} height={vp.h} fill="url(#famDots)" />
          </Svg>
        ) : null}
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                top: 0,
                width: layout.bounds.width,
                height: layout.bounds.height,
              },
              canvasStyle,
            ]}
          >
            <Svg
              width={layout.bounds.width}
              height={layout.bounds.height}
              style={StyleSheet.absoluteFill}
            >
              {layout.edges.map((edge, i) => {
                const a = nodeMap.get(edge.fromId);
                const b = nodeMap.get(edge.toId);
                if (!a || !b) return null;
                const my = (a.y + b.y) / 2;
                const d = `M${a.x},${a.y} L${a.x},${my} L${b.x},${my} L${b.x},${b.y}`;
                if (edge.kind === 'bloodline') {
                  return <Path key={i} d={d} stroke="#c3b59c" strokeWidth={2} fill="none" />;
                }
                if (edge.kind === 'marriage') {
                  return <Path key={i} d={d} stroke="#E0A335" strokeWidth={2} fill="none" />;
                }
                return (
                  <Path
                    key={i}
                    d={d}
                    stroke="#e2d6c2"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fill="none"
                  />
                );
              })}
            </Svg>

            {layout.nodes.map((node) => (
              <View
                key={node.id}
                style={{
                  position: 'absolute',
                  left: node.x - NODE_W / 2,
                  top: node.y - NODE_H / 2,
                  width: NODE_W,
                  alignItems: 'center',
                }}
              >
                <CanvasNode
                  node={node}
                  heroName={heroName}
                  heroImage={heroImage}
                  onNavigate={onNavigate}
                />
              </View>
            ))}
          </Animated.View>
        </GestureDetector>

        <View style={[styles.zoomButtons, fullscreen && styles.zoomButtonsFs]}>
          {/* ± buttons are pointer affordances — touch pinches instead. */}
          {canHover ? (
            <>
              <Pressable style={styles.zoomBtn} onPress={zoomIn}>
                <Ionicons name="add" size={18} color={COLORS.black} />
              </Pressable>
              <Pressable style={styles.zoomBtn} onPress={zoomOut}>
                <Ionicons name="remove" size={18} color={COLORS.black} />
              </Pressable>
            </>
          ) : null}
          <Pressable style={styles.zoomBtn} onPress={recenter}>
            <Ionicons name="locate-outline" size={16} color={COLORS.black} />
          </Pressable>
          <Pressable style={styles.zoomBtn} onPress={onToggleFullscreen}>
            <Ionicons
              name={fullscreen ? 'contract-outline' : 'expand-outline'}
              size={16}
              color={COLORS.black}
            />
          </Pressable>
        </View>

        {fullscreen ? (
          <View style={styles.fsTopLeft}>
            <Pressable style={styles.fsIconBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.black} />
            </Pressable>
            {heroImage ? (
              <Image source={{ uri: heroImage }} style={styles.fsTitleAvatar} contentFit="cover" />
            ) : null}
            <Text style={styles.fsTitleText}>{heroName}</Text>
          </View>
        ) : null}

        {fullscreen ? (
          <View style={styles.fsLegend}>
            <Legend large />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function FamilyCanvas({
  heroName,
  heroImage = null,
  members,
}: {
  heroName: string;
  heroImage?: string | null;
  members: FamilyMember[];
}): ReactElement | null {
  const [fullscreen, setFullscreen] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 700;

  if (members.length === 0) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { graph, layout } = useMemo<{ graph: FamilyGraph; layout: FamilyLayout }>(() => {
    const g = buildFamilyGraph(members);
    const l = layoutFamily(g);
    return { graph: g, layout: l };
  }, [members]);

  const linkedCount = members.filter((m) => m.heroId).length;

  const relativesCount = (
    <>
      {members.length} {members.length === 1 ? 'relative' : 'relatives'}
      {linkedCount > 0 ? ` · ${linkedCount} on Mythique` : ''}
    </>
  );

  return (
    <>
      <View style={isDesktop ? styles.card : undefined}>
        {isDesktop ? (
          <>
            {/* Card chrome */}
            <View style={styles.header}>
              <Text style={styles.eyebrow}>Family</Text>
              <Text style={styles.count}>{relativesCount}</Text>
            </View>
            <View style={styles.divider} />
          </>
        ) : (
          <>
            {/* Mobile: the page's section-title grammar — right-aligned
              "Family · N" over the rule, matching "Gallery · N". */}
            <View style={styles.mHeader}>
              <Text style={styles.mTitle}>Family · {members.length}</Text>
            </View>
            <View style={styles.mDivider} />
          </>
        )}

        <FamilyStage
          layout={layout}
          heroName={heroName}
          heroImage={heroImage}
          fullscreen={false}
          showAxis={isDesktop}
          compact={!isDesktop}
          onToggleFullscreen={() => setFullscreen(true)}
        />

        <Legend />

        {/* Asides (variants) */}
        {graph.asides.length > 0 ? (
          <View style={styles.asideBlock}>
            <Text style={styles.tierLabel}>Variants</Text>
            <View style={styles.tierRow}>
              {graph.asides.map((mem) => (
                <AsideMemberNode key={mem.id} member={mem} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Footnotes */}
        {graph.footnotes.length > 0 ? (
          <Text style={styles.footnote}>
            Also: {graph.footnotes.map((mem) => `${mem.name} (${roleLabel(mem)})`).join(', ')}
          </Text>
        ) : null}
      </View>

      <Modal
        visible={fullscreen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={styles.fsRoot}>
          <FamilyStage
            layout={layout}
            heroName={heroName}
            heroImage={heroImage}
            fullscreen
            showAxis={isDesktop}
            onToggleFullscreen={() => setFullscreen(false)}
            onClose={() => setFullscreen(false)}
            onNavigate={() => setFullscreen(false)}
          />
        </View>
      </Modal>
    </>
  );
}

// Separate component so hooks are called at consistent call-site depth.
// The canvas scales around its CENTRE, so a row at canvas-y `row.y` lands on
// screen at ty + row.y*scale + (boundsH/2)*(1-scale) — match that here.
function AxisLabel({
  row,
  scale,
  ty: tyVal,
  boundsH,
}: {
  row: { tier: number; label: string; y: number };
  scale: ReturnType<typeof useSharedValue<number>>;
  ty: ReturnType<typeof useSharedValue<number>>;
  boundsH: number;
}): ReactElement {
  const animStyle = useAnimatedStyle(() => ({
    top: tyVal.value + row.y * scale.value + (boundsH / 2) * (1 - scale.value) - 8,
  }));
  return <Animated.Text style={[styles.axisLabel, animStyle]}>{row.label}</Animated.Text>;
}

// Inline member node for asides section (outside the canvas)
function AsideMemberNode({ member }: { member: FamilyMember }): ReactElement {
  const router = useRouter();
  const dead = member.status === 'deceased';

  if (member.heroId) {
    const tint = alignColor(member.heroAlignment);
    return (
      <Pressable
        style={[styles.linkNode, { borderColor: tint + '66' }]}
        onPress={() =>
          router.push(`/character/${member.heroId}?name=${encodeURIComponent(member.name)}`)
        }
      >
        {member.heroPower != null && member.heroPower > 0 ? (
          <View style={styles.powerBadge}>
            <Text style={styles.powerBadgeText}>{member.heroPower}</Text>
          </View>
        ) : null}
        <HeroAvatar
          id={member.heroId}
          name={member.name}
          avatarUrl={member.heroAvatar}
          fallbackUrl={member.heroImage}
          size={30}
          radius={8}
          bare
        />
        <View style={styles.linkMeta}>
          <Text style={[styles.linkName, { maxWidth: 150 }]} numberOfLines={1}>
            {member.name}
          </Text>
          <Text style={styles.roleText} numberOfLines={1}>
            {roleLabel(member)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color="#cdbfa6" />
      </Pressable>
    );
  }

  return (
    <View style={styles.plainNode}>
      <View style={[styles.nodeInner, dead && styles.dead]}>
        <View style={[styles.linkMeta, styles.metaPadLeft]}>
          <Text style={[styles.plainName, { maxWidth: 150 }]} numberOfLines={1}>
            {member.name}
            {dead ? ' ✝' : ''}
          </Text>
          <Text style={styles.roleText} numberOfLines={1}>
            {roleLabel(member)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    boxShadow: '0 6px 22px rgba(41,60,67,0.06)',
  } as object,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  eyebrow: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  count: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#b3a791' },
  divider: {
    height: 1,
    backgroundColor: '#ede5da',
    marginTop: 10,
    marginBottom: 18,
  },

  // Mobile header — mirrors the native FamilyCanvas + the other mobile sections.
  mHeader: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline' },
  mTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    textAlign: 'right',
    paddingVertical: 5,
  },
  mCount: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: '#54606A',
    letterSpacing: 0.3,
    paddingBottom: 7,
  },
  mDivider: {
    height: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 30,
    marginBottom: 16,
  },

  stage: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ede5da',
    overflow: 'hidden',
  },
  stageInline: { height: 460 },
  stageInlineCompact: { height: 360 },
  stageFlat: { flex: 1, borderWidth: 0, borderRadius: 0 },
  fsRoot: { flex: 1, backgroundColor: '#fdf9f4' },
  axisGutter: {
    width: 92,
    backgroundColor: '#f6efe4',
    borderRightWidth: 1,
    borderRightColor: '#ece3d4',
    overflow: 'hidden',
    position: 'relative',
  } as object,
  viewport: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    cursor: 'grab',
    backgroundColor: '#fdf9f4',
  } as object,
  axisLabel: {
    position: 'absolute',
    left: 10,
    right: 6,
    fontFamily: 'Nunito_700Bold',
    fontSize: 8.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#a99b84',
  },

  zoomButtons: {
    position: 'absolute',
    top: 10,
    right: 10,
    gap: 6,
  },
  zoomButtonsFs: { top: 16 },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0d6c8',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(41,60,67,0.08)',
  } as object,
  zoomBtnText: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.black,
    lineHeight: 20,
  },

  fsTopLeft: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 5,
  },
  fsIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0d6c8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsTitleAvatar: { width: 34, height: 34, borderRadius: 9 },
  fsTitleText: { fontFamily: 'Flame-Regular', fontSize: 17, color: COLORS.black },
  fsLegend: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: 'center',
    zIndex: 5,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  legendLarge: {
    gap: 16,
    paddingVertical: 9,
    paddingHorizontal: 18,
    backgroundColor: 'white',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#ece3d4',
    boxShadow: '0 2px 10px rgba(41,60,67,0.06)',
  } as object,
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDotLarge: { width: 11, height: 11, borderRadius: 6 },
  legendDashLarge: { width: 20, height: 3, borderTopWidth: 3 },
  legendTextLarge: { fontSize: 12.5, color: '#5e5447' },
  legendDash: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#cbbfa9',
    borderStyle: 'dashed',
    borderTopWidth: 2,
    borderTopColor: '#cbbfa9',
  },
  legendSep: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: '#b3a791' },
  legendText: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: '#7a6f5c' },

  // Node visuals (shared with inline nodes below the canvas)
  heroAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: COLORS.black,
    borderRadius: 15,
    paddingVertical: 8,
    paddingLeft: 9,
    paddingRight: 18,
  },
  heroAvatar: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: COLORS.goldAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitial: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.black },
  heroName: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.beige },
  heroTag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#8a7e68',
  },

  linkNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#e7dcc9',
    borderRadius: 14,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 10,
    position: 'relative',
    boxShadow: '0 1px 3px rgba(41,60,67,0.06)',
  } as object,
  avatar: { width: 30, height: 30, borderRadius: 8 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: 'Flame-Regular', fontSize: 12, color: 'white' },
  linkMeta: { minWidth: 0, flex: 1 },
  linkName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.black,
    fontWeight: '700',
  },
  roleText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: '#a99b84',
    textTransform: 'capitalize',
  },
  chevron: { color: '#cdbfa6', fontSize: 14 },
  powerBadge: {
    position: 'absolute',
    top: -6,
    right: -5,
    backgroundColor: COLORS.blue,
    borderRadius: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 2,
  },
  powerBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 8, color: 'white' },

  plainNode: {
    backgroundColor: '#fbf7ef',
    borderWidth: 1,
    borderColor: '#e7dcc9',
    borderRadius: 13,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 10,
  },
  nodeInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaPadLeft: { paddingLeft: 5 },
  heroAnchorNoImg: { paddingLeft: 16 },
  plainName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.black,
    fontWeight: '700',
  },
  dead: { opacity: 0.55 },

  tierLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#a99b84',
    marginBottom: 9,
    marginTop: 16,
    textAlign: 'center',
  },
  tierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 4,
  },
  asideBlock: { alignItems: 'center', marginTop: 18 },
  footnote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10.5,
    color: '#b3a791',
    textAlign: 'center',
    marginTop: 16,
  },
});
