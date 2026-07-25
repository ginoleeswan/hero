import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { HeroAvatar } from '../HeroAvatar';
import { deriveCharacterTheme, accentButtonColors } from '../../lib/accent';
import { describeRelationship } from '../../lib/graph/relationshipReason';
import { topStatEdges, matchupVerdict } from '../../lib/graph/statEdge';
import type { NeighborNode } from '../../lib/db/heroes/neighborhood';

const KIND_LABEL: Record<string, string> = {
  enemy: 'Enemy',
  ally: 'Ally',
  teammate: 'Teammate',
};
const KIND_COLOR: Record<string, string> = {
  enemy: COLORS.red,
  ally: COLORS.green,
  teammate: COLORS.blue,
};

function alignmentLabel(a: string | null): { label: string; color: string } | null {
  const v = (a ?? '').toLowerCase();
  if (v === 'good') return { label: 'Hero', color: COLORS.blue };
  if (v === 'bad') return { label: 'Villain', color: COLORS.red };
  if (v === 'neutral') return { label: 'Anti-Hero', color: COLORS.orange };
  return null;
}

/**
 * The dossier that opens when a node is focused.
 *
 * Three deliberate choices:
 *
 * It leads with the full painterly portrait, not the flat icon. The icon exists
 * to read at 40px in the graph; this is the one moment the character gets room
 * to actually look like themselves.
 *
 * It is themed by THAT character's own accent, pulled from their portrait's
 * blurhash, so opening Joker and opening Superman feel like different events
 * rather than the same panel with the name swapped.
 *
 * And it answers three questions in the order people ask them: who is this, why
 * are they in this web, and could they take the subject in a fight. The last one
 * is the whole point of the app, so it ends in the Arena rather than a dead end.
 */
export function SocialWebFocusCard({
  node,
  subject,
  subjectName,
  subjectTeams,
  kind,
  degree,
  accent,
  mutuals = [],
  onView,
  onCompare,
  onPickMutual,
  onClose,
}: {
  node: NeighborNode;
  /** The centre character, for the head-to-head. */
  subject?: NeighborNode | null;
  subjectName: string;
  subjectTeams?: string[] | null;
  kind: 'enemy' | 'ally' | 'teammate' | null;
  degree: number;
  /** Page accent — the fallback when this character has no usable colour. */
  accent: string;
  /** Characters connected to BOTH ends, rendered as faces. */
  mutuals?: NeighborNode[];
  onView: () => void;
  onCompare?: () => void;
  onPickMutual?: (id: string) => void;
  onClose: () => void;
}) {
  const narrow = useWindowDimensions().width < 760;
  const faceCap = narrow ? 5 : 6;
  const align = alignmentLabel(node.alignment);
  const kindColor = kind ? KIND_COLOR[kind] : accent;

  // The character's own colour, not the page's — this is what makes each card
  // feel like a different moment instead of one reused panel.
  const theme = useMemo(
    () =>
      deriveCharacterTheme({
        portrait_blurhash: node.portrait_blurhash,
        publisher: node.publisher,
      }),
    [node.portrait_blurhash, node.publisher],
  );
  const tint = theme.accent || accent;
  // The filled button paints a per-character colour, so its label can't assume a
  // fixed ink. This nudges the fill's lightness (hue and saturation untouched)
  // until the chosen ink clears WCAG AA — some mid tones fail against BOTH black
  // and beige, so swapping the text colour alone would not be enough.
  const button = useMemo(() => accentButtonColors(tint), [tint]);

  const { sharedTeams, summary } = describeRelationship(
    kind,
    subjectName,
    subjectTeams ?? null,
    node.teams ?? null,
    degree,
  );

  const edges = useMemo(
    () => topStatEdges(subject ?? null, node, narrow ? 2 : 3),
    [subject, node, narrow],
  );
  const verdict = matchupVerdict(
    subject?.powerstats_total ?? null,
    node.powerstats_total ?? null,
    node.name,
    subjectName,
  );

  return (
    <View style={[styles.card, narrow && styles.cardNarrow] as object}>
      {/* The character's colour as a soft wash from the top, so the card takes on
          their identity without a border or a stripe doing the talking. */}
      <View
        style={
          [
            StyleSheet.absoluteFill,
            { backgroundImage: `linear-gradient(160deg, ${tint}2e, transparent 62%)` },
          ] as object
        }
        pointerEvents="none"
      />

      <View style={styles.head}>
        <View style={styles.portrait}>
          <HeroImage
            id={node.id}
            name={node.name}
            imageUrl={node.image_url}
            portraitUrl={node.portrait_url}
            imageMdUrl={node.image_md_url}
            blurhash={node.portrait_blurhash}
            grid
            contentFit="cover"
            contentPosition={{ top: '20%', left: '50%' }}
            style={StyleSheet.absoluteFill}
            recyclingKey={node.id}
          />
        </View>

        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={2}>
            {node.name}
          </Text>
          <View style={styles.meta}>
            {kind ? (
              <View style={[styles.kindPill, { backgroundColor: kindColor + '26' }] as object}>
                <Text style={[styles.kindText, { color: kindColor }] as object}>
                  {KIND_LABEL[kind]}
                </Text>
              </View>
            ) : null}
            {align ? (
              <View style={[styles.badge, { borderColor: align.color + '80' }] as object}>
                <Text style={[styles.badgeText, { color: align.color }] as object}>
                  {align.label}
                </Text>
              </View>
            ) : null}
          </View>
          {node.publisher ? (
            <Text style={styles.publisher} numberOfLines={1}>
              {node.publisher}
            </Text>
          ) : null}
        </View>

        <Pressable onPress={onClose} style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={16} color={INK_TEXT.muted} />
        </Pressable>
      </View>

      {summary ? <Text style={styles.reason}>{summary}</Text> : null}

      {sharedTeams.length > 0 ? (
        <View style={styles.chips}>
          {sharedTeams.slice(0, 3).map((t) => (
            <View key={t} style={styles.chip}>
              <Ionicons name="people" size={10} color={INK_TEXT.muted} />
              <Text style={styles.chipText} numberOfLines={1}>
                {t}
              </Text>
            </View>
          ))}
          {sharedTeams.length > 3 ? (
            <Text style={styles.chipMore}>+{sharedTeams.length - 3}</Text>
          ) : null}
        </View>
      ) : null}

      {edges.length > 0 ? (
        <View style={styles.stats}>
          <Text style={styles.sectionLabel}>Where they differ</Text>
          {edges.map((e) => {
            const total = Math.max(e.subject + e.node, 1);
            const nodeShare = (e.node / total) * 100;
            const winning = e.delta > 0;
            return (
              <View key={e.label} style={styles.statRow}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {e.label}
                </Text>
                {/* One split bar rather than two: the meeting point IS the
                    comparison, so the gap is legible at a glance. */}
                <View style={styles.bar}>
                  <View
                    style={
                      [
                        styles.barFill,
                        { width: `${nodeShare}%`, backgroundColor: winning ? tint : tint + '55' },
                      ] as object
                    }
                  />
                </View>
                <Text
                  style={[styles.statDelta, { color: winning ? tint : INK_TEXT.muted }] as object}
                >
                  {e.delta > 0 ? `+${e.delta}` : e.delta}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {mutuals.length > 0 ? (
        <View style={styles.mutuals}>
          <Text style={styles.sectionLabel}>Both know</Text>
          <View style={styles.faces}>
            {mutuals.slice(0, faceCap).map((m) => (
              <Pressable key={m.id} onPress={() => onPickMutual?.(m.id)} style={styles.face}>
                <HeroAvatar
                  id={m.id}
                  name={m.name}
                  avatarUrl={m.avatar_url}
                  fallbackUrl={m.portrait_url ?? m.image_md_url ?? m.image_url}
                  size={28}
                  radius={14}
                />
              </Pressable>
            ))}
            {mutuals.length > faceCap ? (
              <Text style={styles.chipMore}>+{mutuals.length - faceCap}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onView}
          style={[styles.primary, { backgroundColor: button.background }] as object}
        >
          <Text style={[styles.primaryText, { color: button.ink }] as object}>View dossier</Text>
          <Ionicons name="chevron-forward" size={13} color={button.ink} />
        </Pressable>
        {onCompare ? (
          <Pressable onPress={onCompare} style={styles.secondary}>
            <Ionicons name="flash" size={12} color={INK_TEXT.primary} />
            <Text style={styles.secondaryText}>{verdict ?? 'Settle it'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    bottom: 56,
    width: 340,
    maxWidth: '90%',
    gap: 11,
    padding: 15,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(11,24,32,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
    backdropFilter: 'blur(14px)',
  } as object,
  // Full-bleed on a phone, and lifted clear of the floating browser toolbar
  // that would otherwise cut the action row in half.
  cardNarrow: {
    left: 12,
    right: 12,
    width: 'auto',
    maxWidth: 'none',
    bottom: 'calc(16px + env(safe-area-inset-bottom))',
    padding: 13,
    gap: 9,
  } as object,
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  portrait: {
    width: 76,
    height: 94,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  } as object,
  identity: { flex: 1, gap: 5, paddingRight: 18 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    lineHeight: 25,
    color: INK_TEXT.primary,
  } as object,
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  kindPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  kindText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  badgeText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  publisher: { fontFamily: 'FlameSans-Regular', fontSize: 11, color: INK_TEXT.muted },
  reason: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: 19,
    color: INK_TEXT.primary,
    opacity: 0.9,
  } as object,
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(245,235,220,0.08)',
  } as object,
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: INK_TEXT.muted, flexShrink: 1 },
  chipMore: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: INK_TEXT.muted },

  sectionLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: INK_TEXT.muted,
  },
  stats: { gap: 5 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: INK_TEXT.primary,
    width: 74,
  } as object,
  bar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.10)',
  } as object,
  barFill: { height: '100%', borderRadius: 3 } as object,
  statDelta: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    width: 30,
    textAlign: 'right',
  } as object,

  mutuals: { gap: 6 },
  faces: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  face: { borderRadius: 14, overflow: 'hidden' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  primaryText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.20)',
  },
  secondaryText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: INK_TEXT.primary },
  close: { position: 'absolute', top: 0, right: 0, padding: 2 } as object,
});
