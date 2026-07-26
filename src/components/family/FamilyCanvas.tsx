// src/components/family/FamilyCanvas.tsx
// Pannable / zoomable family tree for native (iOS + Android). Uses
// react-native-reanimated 4 + react-native-gesture-handler for pan + pinch,
// react-native-svg for edges. Co-exists with an outer ScrollView via
// activeOffsetX/Y so vertical page scrolling is not captured.
//
// Writing `sharedValue.value = …` in gesture/callback handlers is the Reanimated
// API, not a React mutation; the compiler's immutability rule can't model shared
// values, so it's disabled for this file.
/* eslint-disable react-hooks/immutability */
import { useMemo, useState, useEffect, useCallback, type ReactElement } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
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
 * so printing it again on the node is pure repetition.
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
  // Only the head needs clearing; the nameplate sits below it.
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
    // The subject takes the same roundel as everyone else, one size up and
    // ringed in ink — a differently-shaped card here broke the row it sits in.
    return (
      <View style={styles.cameoNode}>
        <View style={[styles.headDisc, styles.headDiscHero] as object}>
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
        <View style={[styles.namePlate, styles.namePlateHero] as object}>
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
  // The row gutter already names the generation, so repeating it per node says
  // nothing. It earns its line only where a row mixes relations.
  const role = rowNamesTheRelation(member) ? null : roleLabel(member);
  const dead = member.status === 'deceased';

  // Ring, not card: a traditional family tree is portrait roundels joined by
  // fine rules. Where there is no art the featureless head stands in rather than
  // an initials monogram, which in a dynasty identifies nobody — Aegon I through
  // V collapse to the same letters.
  const face = hasRealArt(member.heroImage) || !!member.heroAvatar;
  // Every head sits on the same disc. Three art sources land here — flat cut-out
  // avatars, circle-cropped comic panels, and featureless silhouettes — and left
  // bare they read as three different languages in one row. The disc is a
  // footprint, not a card: it gives every head the same silhouette and weight.
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

  // The head sits flat on the canvas; the name gets the plate.
  const label = (
    <View style={[styles.namePlate, dead && styles.namePlateDead] as object}>
      <Text style={[styles.nodeName, dead && styles.deadText] as object} numberOfLines={2}>
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
      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.cameoNode}
        onPress={() => {
          onNavigate?.();
          router.push(`/character/${member.heroId}?name=${encodeURIComponent(member.name)}`);
        }}
      >
        {cameo}
        {label}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.cameoNode}>
      {cameo}
      {label}
    </View>
  );
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
  onToggleFullscreen: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
}): ReactElement {
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
      const pad = fullscreen ? 32 : 24;
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

  // activeOffset: a deliberate drag pans the canvas; a vertical flick scrolls the page.
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
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
    <View style={[styles.stage, fullscreen ? styles.stageFlat : styles.stageInline]}>
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
              {/* Generation bands — a ruled ledger banding so thirteen rows of
                  a dynasty each read as a place. Bands rather than hairlines,
                  which would run behind the cut-out heads and show through. */}
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
          <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn} activeOpacity={0.7}>
            <Ionicons name="add" size={18} color={COLORS.black} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut} activeOpacity={0.7}>
            <Ionicons name="remove" size={18} color={COLORS.black} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={recenter} activeOpacity={0.7}>
            <Ionicons name="locate-outline" size={16} color={COLORS.black} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={onToggleFullscreen} activeOpacity={0.7}>
            <Ionicons
              name={fullscreen ? 'contract-outline' : 'expand-outline'}
              size={16}
              color={COLORS.black}
            />
          </TouchableOpacity>
        </View>

        {fullscreen ? (
          <View style={styles.fsTopLeft}>
            <TouchableOpacity style={styles.fsIconBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={COLORS.black} />
            </TouchableOpacity>
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
  if (members.length === 0) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { graph, layout } = useMemo<{ graph: FamilyGraph; layout: FamilyLayout }>(() => {
    const g = buildFamilyGraph(members);
    const l = layoutFamily(g);
    return { graph: g, layout: l };
  }, [members]);

  const linkedCount = members.filter((m) => m.heroId).length;

  return (
    <>
      <View>
        {/* Section header — matches the other native sections: right-aligned navy
          title + navy divider, with a relatives count caption on the left. */}
        <View style={styles.header}>
          <Text style={styles.count}>
            {members.length} {members.length === 1 ? 'relative' : 'relatives'}
            {linkedCount > 0 ? ` · ${linkedCount} on Mythique` : ''}
          </Text>
          <Text style={styles.title}>Family</Text>
        </View>
        <View style={styles.divider} />

        <FamilyStage
          layout={layout}
          heroName={heroName}
          heroImage={heroImage}
          heroAvatar={heroAvatar}
          heroId={heroId}
          fullscreen={false}
          showAxis={false}
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
            showAxis={false}
            onToggleFullscreen={() => setFullscreen(false)}
            onClose={() => setFullscreen(false)}
            onNavigate={() => setFullscreen(false)}
          />
        </View>
      </Modal>
    </>
  );
}

// Separate component so hooks are called at consistent call-site depth
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
      <TouchableOpacity
        activeOpacity={0.75}
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
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.plainNode}>
      <View style={[styles.linkMeta, dead && styles.dead, styles.metaPadLeft]}>
        <Text style={[styles.plainName, { maxWidth: 150 }]} numberOfLines={1}>
          {member.name}
          {dead ? ' ✝' : ''}
        </Text>
        <Text style={styles.roleText} numberOfLines={1}>
          {roleLabel(member)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  // Mirrors the shared `sectionTitle` in app/character/[id].tsx so Family reads
  // like every other section header (Power Stats, In Print, …).
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    textAlign: 'right',
    paddingVertical: 5,
  },
  count: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: '#54606A',
    letterSpacing: 0.3,
    paddingBottom: 7,
  },
  divider: {
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
  stageInline: { height: 360 },
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
  zoomButtonsFs: { top: 48 },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0d6c8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.black,
    lineHeight: 20,
  },

  fsTopLeft: {
    position: 'absolute',
    top: 48,
    left: 14,
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


  // Node visuals
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

  // No card: the flat head and its nameplate sit straight on the canvas.
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
  // Parchment cartouche under each head — carries the name over the dotted
  // ground and gives the row a baseline the loose heads would otherwise lack.
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
  } as object,
  namePlateDead: {
    backgroundColor: '#f1e9dc',
    borderColor: '#ded3c2',
  } as object,
  namePlateHero: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.black,
    borderTopColor: '#4a626a',
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
  },
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

  // Native's plain node had no inner row, so the head needs one.
  plainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
