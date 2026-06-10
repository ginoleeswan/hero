import { useState, type ReactElement } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutRectangle } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Svg, { Polyline } from 'react-native-svg';
import { COLORS } from '../../constants/colors';
import { buildFamilyGraph } from '../../lib/family/buildFamilyGraph';
import { connectorPaths, type NodeBox, type ConnLink } from '../../lib/family/connectorPaths';
import type { FamilyMember, GraphNode } from '../../lib/family/types';

const COLLAPSE_AFTER = 6;
const HERO_KEY = '__hero__';

function alignColor(alignment: string | null): string {
  if (alignment === 'good') return COLORS.blue;
  if (alignment === 'bad') return COLORS.red;
  return COLORS.orange;
}

function roleLabel(member: FamilyMember): string {
  if (member.role) return member.role.split(',')[0].trim();
  return member.relation.replace(/_/g, ' ');
}

const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

// ── A single relative node ───────────────────────────────────────────────────
function MemberNode({ member }: { member: FamilyMember }) {
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
        {member.heroImage ? (
          <Image source={{ uri: member.heroImage }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tint }]}>
            <Text style={styles.avatarInitial}>{initial(member.name)}</Text>
          </View>
        )}
        <View style={styles.linkMeta}>
          <Text style={styles.linkName} numberOfLines={1}>
            {member.name}
          </Text>
          <Text style={styles.roleText} numberOfLines={1}>
            {roleLabel(member)}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.plainNode, dead && styles.dead]}>
      <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: '#c9bba3' }]}>
        <Text style={styles.avatarInitial}>{initial(member.name)}</Text>
      </View>
      <View style={styles.linkMeta}>
        <Text style={styles.plainName} numberOfLines={1}>
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

const Spine = () => <View style={styles.spineFallback} />;

// ── The card ─────────────────────────────────────────────────────────────────
export function FamilyTree({
  heroName,
  members,
}: {
  heroName: string;
  members: FamilyMember[];
}): ReactElement | null {
  const [rowLayouts, setRowLayouts] = useState<Record<string, { x: number; y: number }>>({});
  const [nodeBoxes, setNodeBoxes] = useState<
    Record<string, { rowKey: string; rect: LayoutRectangle }>
  >({});
  const [body, setBody] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (members.length === 0) return null;

  const graph = buildFamilyGraph(members);
  const tier0 = graph.tiers.find((t) => t.tier === 0)?.nodes ?? [];
  const sameGen = tier0.filter((n) => n.member.id !== graph.spouse?.id);
  const linkedCount = members.filter((m) => m.heroId).length;

  const setRow = (key: string) => (e: { nativeEvent: { layout: LayoutRectangle } }) => {
    const { x, y } = e.nativeEvent.layout;
    setRowLayouts((prev) =>
      prev[key]?.x === x && prev[key]?.y === y ? prev : { ...prev, [key]: { x, y } },
    );
  };
  const setNode = (id: string, rowKey: string) => (e: { nativeEvent: { layout: LayoutRectangle } }) => {
    const rect = e.nativeEvent.layout;
    setNodeBoxes((prev) => ({ ...prev, [id]: { rowKey, rect } }));
  };

  // Container-space boxes from the two-level (row → node) measurements.
  const boxes: Record<string, NodeBox> = {};
  for (const [id, b] of Object.entries(nodeBoxes)) {
    const row = rowLayouts[b.rowKey];
    if (!row) continue;
    const top = row.y + b.rect.y;
    boxes[id] = { cx: row.x + b.rect.x + b.rect.width / 2, top, bottom: top + b.rect.height };
  }
  const heroBox = boxes[HERO_KEY];

  // Links: every rendered node except the spouse (which uses the gold tie).
  const links: ConnLink[] = [];
  for (const t of graph.tiers) {
    for (const gn of t.nodes) {
      if (gn.member.id === graph.spouse?.id) continue;
      links.push({ id: gn.member.id, target: gn.connectTo });
    }
  }
  const paths = heroBox ? connectorPaths({ hero: heroBox, boxes, links }) : [];

  // A measured row of nodes with optional label + "+N more" collapse.
  const nodesRow = (key: string, tier: number, label: string, nodes: GraphNode[], collapsible: boolean) => {
    const isOpen = expanded[tier];
    const overflow = collapsible && !isOpen && nodes.length > COLLAPSE_AFTER;
    const shown = overflow ? nodes.slice(0, COLLAPSE_AFTER) : nodes;
    return (
      <View key={key} style={styles.tierBlock}>
        {label ? <Text style={styles.tierLabel}>{label}</Text> : null}
        <View style={styles.tierRow} onLayout={setRow(key)}>
          {shown.map((gn) => (
            <View key={gn.member.id} onLayout={setNode(gn.member.id, key)}>
              <MemberNode member={gn.member} />
            </View>
          ))}
          {overflow ? (
            <Pressable style={styles.moreChip} onPress={() => setExpanded((p) => ({ ...p, [tier]: true }))}>
              <Text style={styles.moreText}>+{nodes.length - COLLAPSE_AFTER} more</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  // Vertical order: ancestors (+2) → parents (+1) → HERO + same-gen → children → grandchildren.
  const rows: ReactElement[] = [];
  for (const t of graph.tiers) {
    if (t.tier === 0) {
      rows.push(heroRow());
      if (sameGen.length > 0) rows.push(nodesRow('samegen', 0, 'Same generation', sameGen, false));
      continue;
    }
    if (t.tier < 0 && !rows.some((r) => r.key === 'hero')) rows.push(heroRow());
    rows.push(nodesRow(`t${t.tier}`, t.tier, t.label, t.nodes, t.collapsedByDefault));
  }
  if (!rows.some((r) => r.key === 'hero')) rows.push(heroRow());

  function heroRow(): ReactElement {
    return (
      <View key="hero" style={styles.tierBlock}>
        <View style={styles.anchorRow} onLayout={setRow('hero')}>
          <View onLayout={setNode(HERO_KEY, 'hero')} style={styles.heroAnchor}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroInitial}>{initial(heroName)}</Text>
            </View>
            <View>
              <Text style={styles.heroName} numberOfLines={1}>
                {heroName}
              </Text>
              <Text style={styles.heroTag}>This hero</Text>
            </View>
          </View>
          {graph.spouse ? (
            <>
              <View style={styles.spouseTie} />
              <MemberNode member={graph.spouse} />
            </>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Family</Text>
        <Text style={styles.count}>
          {members.length} {members.length === 1 ? 'relative' : 'relatives'}
          {linkedCount > 0 ? ` · ${linkedCount} on Mythique` : ''}
        </Text>
      </View>
      <View style={styles.divider} />

      <View
        style={styles.treeBody}
        onLayout={(e) => setBody({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {heroBox && paths.length > 0 ? (
          <Svg style={StyleSheet.absoluteFill} width={body.w} height={body.h} pointerEvents="none">
            {paths.map((p, i) => (
              <Polyline
                key={i}
                points={p.points.map(([x, y]) => `${x},${y}`).join(' ')}
                fill="none"
                stroke="#cdbfa6"
                strokeWidth={2}
              />
            ))}
          </Svg>
        ) : null}
        {rows}
      </View>

      {graph.asides.length > 0 ? (
        <View style={styles.asideBlock}>
          <Text style={styles.tierLabel}>Variants</Text>
          <View style={styles.tierRow}>
            {graph.asides.map((mem) => (
              <MemberNode key={mem.id} member={mem} />
            ))}
          </View>
        </View>
      ) : null}

      {graph.footnotes.length > 0 ? (
        <Text style={styles.footnote}>
          Also: {graph.footnotes.map((mem) => `${mem.name} (${roleLabel(mem)})`).join(', ')}
        </Text>
      ) : null}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eyebrow: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  count: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#b3a791' },
  divider: { height: 1, backgroundColor: '#ede5da', marginTop: 10, marginBottom: 18 },

  treeBody: { position: 'relative' },
  tierBlock: { alignItems: 'center' },
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
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 4 },

  plainNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fbf7ef',
    borderWidth: 1,
    borderColor: '#e7dcc9',
    borderRadius: 13,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
  },
  plainName: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: COLORS.black, fontWeight: '700' },
  dead: { opacity: 0.6 },

  linkNode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#e7dcc9',
    borderRadius: 14,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    position: 'relative',
    boxShadow: '0 1px 3px rgba(41,60,67,0.06)',
  } as object,
  avatar: { width: 34, height: 34, borderRadius: 9 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: 'Flame-Regular', fontSize: 14, color: 'white' },
  linkMeta: { minWidth: 0 },
  linkName: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: COLORS.black, fontWeight: '700' },
  roleText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#a99b84', textTransform: 'capitalize' },
  chevron: { color: '#cdbfa6', fontSize: 15 },
  powerBadge: {
    position: 'absolute',
    top: -7,
    right: -6,
    backgroundColor: COLORS.blue,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    zIndex: 2,
  },
  powerBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: 'white' },

  anchorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16, marginBottom: 4 },
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
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.goldAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitial: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.black },
  heroName: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige },
  heroTag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#8a7e68',
  },
  spouseTie: { width: 18, height: 2, borderRadius: 2, backgroundColor: COLORS.orange },
  spineFallback: { width: 2, height: 16, borderRadius: 2, backgroundColor: '#e2d6c2', alignSelf: 'center' },

  moreChip: {
    justifyContent: 'center',
    backgroundColor: '#f3ece0',
    borderWidth: 1,
    borderColor: '#d8cbb6',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  moreText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#9a8c76' },
  asideBlock: { alignItems: 'center', marginTop: 18 },
  footnote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10.5,
    color: '#b3a791',
    textAlign: 'center',
    marginTop: 16,
  },
});
