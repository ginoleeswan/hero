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
import { hasRealArt } from '../../constants/heroImages';
import { PlaceholderHead } from './PlaceholderHead';
import { headShapeForRole } from '../../lib/family/kinshipGender';
import { buildFamilyGraph } from '../../lib/family/buildFamilyGraph';
import { treeDisplayName } from '../../lib/family/displayName';
import { layoutFamily, ROW_H } from '../../lib/family/layoutFamily';
import type { FamilyMember, FamilyGraph } from '../../lib/family/types';
import type { PositionedNode, FamilyLayout } from '../../lib/family/layoutFamily';

// Node nominal dimensions (must match layoutFamily constants)
// A cameo node is portrait-shaped rather than a list row, so it is much narrower
// than the old 158 — which is what lets a wide generation stay on screen.
const NODE_W = 104;
const NODE_H = 108;
/** Diameter of the portrait roundel — the head is the node, so it leads. */
const CAMEO = 54;
/** The subject's roundel, one size up. */
const HERO_CAMEO = 64;
/** Below this, node names stop being readable — never auto-fit past it. */
const MIN_LEGIBLE_SCALE = 0.85;

function alignColor(alignment: string | null): string {
  if (alignment === 'good') return COLORS.blue;
  if (alignment === 'bad') return COLORS.red;
  return COLORS.orange;
}

/**
 * True when the generation row this member sits in already states the relation,
 * so printing it again on the card is pure repetition. Every step along the
 * bloodline is one of these; a row that mixes relations is not.
 */
function rowNamesTheRelation(member: FamilyMember): boolean {
  return (
    member.relation === 'parent' ||
    member.relation === 'child' ||
    member.relation === 'grandparent' ||
    member.relation === 'grandchild' ||
    member.relation === 'ancestor' ||
    member.relation === 'descendant'
  );
}

/**
 * Connector between two nodes, stopping at their edges rather than their
 * centres. Run centre-to-centre it passes straight behind the art, and now that
 * heads are cut out with no plate behind them the line shows through the face —
 * most obviously on the deceased, who are drawn at reduced opacity.
 */
function edgePath(a: PositionedNode, b: PositionedNode): string {
  const halfW = NODE_W / 2;
  // Only the head needs clearing; the name sits below it and a line stopping at
  // the full node height would leave a visible gap.
  const halfH = CAMEO / 2 + 6;

  if (Math.abs(a.y - b.y) < 1) {
    const dir = Math.sign(b.x - a.x) || 1;
    return `M${a.x + dir * halfW},${a.y} L${b.x - dir * halfW},${b.y}`;
  }
  const dir = Math.sign(b.y - a.y) || 1;
  const ay = a.y + dir * halfH;
  const by = b.y - dir * halfH;
  const my = (ay + by) / 2;
  return `M${a.x},${ay} L${a.x},${my} L${b.x},${my} L${b.x},${by}`;
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
  heroAvatar,
  heroId,
  onNavigate,
}: {
  node: PositionedNode;
  heroName: string;
  heroImage: string | null;
  heroAvatar: string | null;
  heroId: string | null;
  onNavigate?: () => void;
}): ReactElement {
  const router = useRouter();

  if (node.isHero) {
    // The subject takes the same roundel as everyone else, one size up and ringed
    // in ink. A differently-shaped card here broke the row it sits in and left
    // the hero misaligned against their own siblings.
    return (
      <View style={styles.cameoNode}>
        <View style={[styles.headDisc, styles.headDiscHero]}>
          <HeroAvatar
            id={heroId ?? heroName}
            name={heroName}
            avatarUrl={heroAvatar}
            fallbackUrl={heroImage}
            size={HERO_CAMEO}
            radius={HERO_CAMEO / 2}
            bare
          />
        </View>
        <View style={[styles.namePlate, styles.namePlateHero]}>
          <Text style={styles.heroName} numberOfLines={2}>
            {heroName}
          </Text>
        </View>
      </View>
    );
  }

  const member = node.member;
  if (!member) return <View />;

  const shownName = treeDisplayName(member.name, heroName);
  // The row gutter already names the generation, so repeating "3× Great-Grandson"
  // on every card in that row says nothing. It earns its line only where a row
  // holds several different relations — the hero's own generation mixes wives,
  // brothers and cousins — or where the relation isn't a step along the bloodline.
  const role = rowNamesTheRelation(member) ? null : roleLabel(member);

  const dead = member.status === 'deceased';
  // A cameo above the name, the way printed genealogies set a portrait medallion.
  // The face is the fastest thing to recognise in a tree of fifty, and it also
  // makes each node narrow enough that siblings sit near each other instead of
  // being flung to opposite sides of the canvas.
  //
  // Where a character has no art, the featureless head stands in rather than the
  // initials monogram: in a dynasty the initials collide almost completely —
  // Aegon I through V, Aerys I and II, Viserys I and II — so a monogram
  // identifies nobody, while a silhouette at least reads as a person and is the
  // convention these charts have always used for a face nobody recorded.
  const face = hasRealArt(member.heroImage) || !!member.heroAvatar;
  // Every head sits on the same disc. Three art sources land here — flat cut-out
  // avatars, circle-cropped comic panels, and featureless silhouettes — and left
  // bare they read as three different languages in one row: some with a hard
  // circular edge, some with hair straying off into the canvas. The disc is a
  // footprint, not a card: barely visible on its own, but it gives every head
  // the same silhouette and the same optical weight.
  const cameo = (
    <View style={styles.headDisc}>
      {face ? (
        <HeroAvatar
          id={member.heroId ?? member.name}
          name={member.name}
          avatarUrl={member.heroAvatar}
          fallbackUrl={member.heroImage}
          size={CAMEO}
          radius={CAMEO / 2}
          bare
        />
      ) : (
        <PlaceholderHead shape={headShapeForRole(member.role)} size={CAMEO} />
      )}
    </View>
  );

  // The head sits flat on the canvas; the name gets the plate. A cartouche is
  // how these charts have always carried a name, and it's what keeps small text
  // legible over the dotted ground without boxing in the portrait.
  const label = (
    <View style={[styles.namePlate, dead && styles.namePlateDead]}>
      {/* A rule struck through the name, not a dagger appended to it: the mark
          belongs to the typography rather than being a symbol the reader has to
          learn, and it never competes with the name for width. */}
      <Text style={[styles.nodeName, dead && styles.deadText]} numberOfLines={2}>
        {shownName}
      </Text>
      {role ? (
        <Text style={styles.roleText} numberOfLines={1}>
          {role}
        </Text>
      ) : null}
    </View>
  );

  if (member.heroId) {
    return (
      <Pressable
        style={styles.cameoNode}
        onPress={() => {
          onNavigate?.();
          router.push(`/character/${member.heroId}?name=${encodeURIComponent(member.name)}`);
        }}
      >
        {cameo}
        {label}
      </Pressable>
    );
  }

  return <View style={styles.cameoNode}>{cameo}{label}</View>;
}

// ── Interactive stage: gutter + pannable/zoomable viewport ───────────────────
function FamilyStage({
  layout,
  heroName,
  heroImage,
  heroAvatar,
  heroId,
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
  heroAvatar: string | null;
  heroId: string | null;
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
      // Fit the whole tree when it fits, but stop shrinking at a legible floor.
      // A recorded dynasty is thirteen generations tall: fitting all of it puts
      // every name below reading size and lands the viewport in the middle of
      // some remote descendant.
      const s = Math.min(fullscreen ? 2.2 : 1.2, Math.max(MIN_LEGIBLE_SCALE, fit));

      // Anchor on the hero, not the midpoint of the bounds — you should open on
      // the character whose page this is, with their immediate family around
      // them, and pan out to the rest.
      //
      // RN scales around the element CENTRE, so a point p lands at
      // centre + (p − centre) · s. Solving for the translate that puts the hero
      // at the viewport centre gives the term below; for p = centre it reduces
      // to the old viewportCentre − boundsCentre.
      const hero = layout.nodes.find((n) => n.isHero);
      const hx = hero?.x ?? bw / 2;
      const hy = hero?.y ?? bh / 2;
      return {
        tx: vpW / 2 - bw / 2 - (hx - bw / 2) * s,
        ty: vpH / 2 - bh / 2 - (hy - bh / 2) * s,
        scale: s,
      };
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
              {/* Generation bands. Thirteen rows of a dynasty are hard to hold
                  in the eye; a ruled ledger banding makes each one a place.
                  Bands rather than rules because a hairline would run behind
                  the cut-out heads and show through their faces. */}
              {layout.rows.map((row, i) =>
                i % 2 === 1 ? (
                  <Rect
                    key={`band-${row.tier}`}
                    x={0}
                    y={row.y - ROW_H / 2}
                    width={layout.bounds.width}
                    height={ROW_H}
                    fill="#f3ece0"
                    opacity={0.55}
                  />
                ) : null,
              )}
              {layout.edges.map((edge, i) => {
                // Same-generation dashes were fragments of line drifting between
                // heads; the band now carries "these belong together".
                if (edge.kind === 'sibling') return null;
                const a = nodeMap.get(edge.fromId);
                const b = nodeMap.get(edge.toId);
                if (!a || !b) return null;
                const d = edgePath(a, b);
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
                  heroAvatar={heroAvatar}
                  heroId={heroId}
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

      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function FamilyCanvas({
  heroName,
  heroImage = null,
  heroAvatar = null,
  heroId = null,
  members,
}: {
  heroName: string;
  heroImage?: string | null;
  heroAvatar?: string | null;
  heroId?: string | null;
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
          heroAvatar={heroAvatar}
          heroId={heroId}
          fullscreen={false}
          showAxis={isDesktop}
          compact={!isDesktop}
          onToggleFullscreen={() => setFullscreen(true)}
        />

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
            heroAvatar={heroAvatar}
            heroId={heroId}
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
  return (
    <Animated.Text style={[styles.axisLabel, animStyle]} numberOfLines={1}>
      {row.label}
    </Animated.Text>
  );
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
    // Wide enough for "2× great-grandchildren" on one line. At 92px with
    // uppercase tracking every deep row broke mid-word — "GRANDCHILD / REN".
    width: 132,
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
    left: 12,
    right: 8,
    fontFamily: 'Nunito_700Bold',
    // Sentence case, no tracking: a generation name is a phrase, not a system
    // label, and uppercase + letterspacing is what made it too wide to fit.
    fontSize: 10.5,
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
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    lineHeight: 16,
    color: COLORS.beige,
    textAlign: 'center',
  },
  heroTag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 7,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#8a7e68',
  },

  // No card: the roundel and the name sit straight on the canvas.
  cameoNode: {
    width: NODE_W,
    alignItems: 'center',
    gap: 6,
  } as object,
  // The common footprint every head sits on, whatever its art source.
  headDisc: {
    width: CAMEO,
    height: CAMEO,
    borderRadius: CAMEO / 2,
    backgroundColor: 'rgba(41,60,67,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as object,
  headDiscHero: {
    width: HERO_CAMEO,
    height: HERO_CAMEO,
    borderRadius: HERO_CAMEO / 2,
    backgroundColor: 'rgba(41,60,67,0.10)',
  } as object,
  // Parchment cartouche under each head. Carries the name over the dotted
  // ground, and gives the row a baseline the loose heads would otherwise lack.
  namePlate: {
    // Fixed width, not hugging the text: plates that shrink-wrap turn a row into
    // a picket fence of different-width tags.
    width: NODE_W - 6,
    alignItems: 'center',
    backgroundColor: '#f7edd9',
    borderWidth: 1,
    borderColor: '#e3d4b6',
    borderTopColor: '#fbf5e7',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    boxShadow: '0 1px 2px rgba(41,60,67,0.10)',
  } as object,
  namePlateDead: {
    backgroundColor: '#f1e9dc',
    borderColor: '#ded3c2',
  } as object,
  namePlateHero: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.black,
    borderTopColor: '#4a626a',
    boxShadow: '0 2px 8px rgba(41,60,67,0.22)',
  } as object,
  nodeName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    lineHeight: 14,
    color: COLORS.black,
    fontWeight: '700',
    textAlign: 'center',
  },
  deadText: {
    color: '#8d8375',
    textDecorationLine: 'line-through',
    textDecorationColor: '#bcae97',
  } as object,
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
