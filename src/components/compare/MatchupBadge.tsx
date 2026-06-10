import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import type { RelationshipTone } from '../../lib/db/heroes';

const TONE: Record<
  RelationshipTone,
  { color: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  rivalry: { color: '#E8543B', bg: 'rgba(232,84,59,0.14)', border: 'rgba(232,84,59,0.42)', icon: 'flame' },
  dream: { color: COLORS.goldAccent, bg: 'rgba(206,155,51,0.16)', border: 'rgba(206,155,51,0.5)', icon: 'sparkles' },
  family: { color: COLORS.orange, bg: 'rgba(231,115,51,0.14)', border: 'rgba(231,115,51,0.42)', icon: 'people' },
  team: { color: COLORS.blue, bg: 'rgba(21,161,171,0.15)', border: 'rgba(21,161,171,0.45)', icon: 'shield' },
  ally: { color: COLORS.green, bg: 'rgba(106,168,79,0.15)', border: 'rgba(106,168,79,0.45)', icon: 'hand-left' },
};

/**
 * The headline relationship between the two combatants — "Classic Rivalry",
 * "Sibling Rivalry", "Teammates"… — as a tone-coloured pill. Renders nothing when
 * the heroes have no recorded connection.
 */
export function MatchupBadge({
  badge,
  style,
}: {
  badge: { label: string; tone: RelationshipTone } | null | undefined;
  style?: object;
}) {
  if (!badge) return null;
  const t = TONE[badge.tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }, style] as object}>
      <Ionicons name={t.icon} size={12} color={t.color} />
      <Text style={[styles.label, { color: t.color }] as object}>{badge.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    ...Platform.select({
      web: { backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } as object,
      default: {},
    }),
  } as object,
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } as object,
});
