import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
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

// The detail card that slides in when a node is focused: portrait, name,
// alignment, its degree in this web, its relationship to the subject, and the
// primary "View dossier" navigation.
export function SocialWebFocusCard({
  node,
  subjectName,
  kind,
  degree,
  accent,
  onView,
  onClose,
}: {
  node: NeighborNode;
  subjectName: string;
  kind: 'enemy' | 'ally' | 'teammate' | null;
  degree: number;
  accent: string;
  onView: () => void;
  onClose: () => void;
}) {
  const align = alignmentLabel(node.alignment);
  return (
    <View style={styles.card}>
      <View style={styles.portrait}>
        <HeroImage
          id={node.id}
          name={node.name}
          imageUrl={node.image_url}
          portraitUrl={node.portrait_url}
          imageMdUrl={node.image_md_url}
          grid
          contentFit="cover"
          contentPosition={{ top: '-15%', left: '50%' }}
          style={StyleSheet.absoluteFill}
          recyclingKey={node.id}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {node.name}
        </Text>
        <View style={styles.meta}>
          {align ? (
            <View style={[styles.badge, { borderColor: align.color + '80' }] as object}>
              <Text style={[styles.badgeText, { color: align.color }] as object}>
                {align.label}
              </Text>
            </View>
          ) : null}
          {kind ? (
            <Text style={[styles.kind, { color: KIND_COLOR[kind] }] as object}>
              {KIND_LABEL[kind]} of {subjectName}
            </Text>
          ) : null}
        </View>
        <Text style={styles.degree}>
          {degree > 0
            ? `${degree} connection${degree === 1 ? '' : 's'} in this web`
            : 'No other links here'}
        </Text>
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
      <Pressable onPress={onClose} style={styles.close} hitSlop={8}>
        <Ionicons name="close" size={16} color={INK_TEXT.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    bottom: 56,
    width: 300,
    maxWidth: '90%',
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(11,24,32,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
  } as object,
  portrait: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  } as object,
  body: { flex: 1, gap: 4 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    lineHeight: 22,
    color: INK_TEXT.primary,
  } as object,
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  badgeText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kind: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  degree: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: INK_TEXT.muted },
  view: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  viewText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },
  close: { position: 'absolute', top: 8, right: 8, padding: 2 },
});
