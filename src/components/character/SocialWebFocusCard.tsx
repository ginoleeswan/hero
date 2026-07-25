import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { describeRelationship } from '../../lib/graph/relationshipReason';
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
 * The dossier that slides in when a node is focused.
 *
 * It leads with the full painterly portrait rather than the flat icon: the icon
 * is built to be legible at 40px in the graph, and this is the one moment the
 * character gets room to actually look like themselves.
 *
 * Below the identity it answers "why is this person here" — the shared rosters
 * that justify the tie, which is the only honest explanation the data supports
 * (see describeRelationship). The relationship's colour lives in the
 * kind pill, where it labels something, rather than as decoration.
 */
export function SocialWebFocusCard({
  node,
  subjectName,
  subjectTeams,
  kind,
  degree,
  accent,
  onView,
  onClose,
}: {
  node: NeighborNode;
  subjectName: string;
  /** The centre character's rosters, for the shared-team explanation. */
  subjectTeams?: string[] | null;
  kind: 'enemy' | 'ally' | 'teammate' | null;
  degree: number;
  accent: string;
  onView: () => void;
  onClose: () => void;
}) {
  const align = alignmentLabel(node.alignment);
  const tint = kind ? KIND_COLOR[kind] : accent;
  const { sharedTeams, summary } = describeRelationship(
    kind,
    subjectName,
    subjectTeams ?? null,
    node.teams ?? null,
    degree,
  );

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.portrait, { borderColor: tint + '66' }] as object}>
          <HeroImage
            id={node.id}
            name={node.name}
            imageUrl={node.image_url}
            portraitUrl={node.portrait_url}
            imageMdUrl={node.image_md_url}
            grid
            contentFit="cover"
            contentPosition={{ top: '22%', left: '50%' }}
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
              <View style={[styles.kindPill, { backgroundColor: tint + '26' }] as object}>
                <Text style={[styles.kindText, { color: tint }] as object}>{KIND_LABEL[kind]}</Text>
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
        <View style={styles.teams}>
          {sharedTeams.slice(0, 4).map((t) => (
            <View key={t} style={styles.teamChip}>
              <Ionicons name="people" size={10} color={INK_TEXT.muted} />
              <Text style={styles.teamText} numberOfLines={1}>
                {t}
              </Text>
            </View>
          ))}
          {sharedTeams.length > 4 ? (
            <Text style={styles.teamMore}>+{sharedTeams.length - 4}</Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={onView}
        style={
          [styles.view, { backgroundColor: accent + '22', borderColor: accent + '55' }] as object
        }
      >
        <Text style={[styles.viewText, { color: accent }] as object}>View dossier</Text>
        <Ionicons name="chevron-forward" size={13} color={accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    bottom: 56,
    width: 330,
    maxWidth: '90%',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(11,24,32,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
    backdropFilter: 'blur(12px)',
  } as object,
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  portrait: {
    width: 78,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: COLORS.navy,
  } as object,
  identity: { flex: 1, gap: 5, paddingRight: 18 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 19,
    lineHeight: 24,
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
    opacity: 0.88,
  } as object,
  teams: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  teamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(245,235,220,0.08)',
  } as object,
  teamText: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: INK_TEXT.muted, flexShrink: 1 },
  teamMore: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: INK_TEXT.muted },
  view: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  viewText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },
  close: { position: 'absolute', top: 0, right: 0, padding: 2 },
});
