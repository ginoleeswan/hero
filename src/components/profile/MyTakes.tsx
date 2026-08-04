import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, PAPER_TEXT, ORANGE_INK } from '../../constants/colors';
import type { BattleRecord } from '../../lib/db/matchupVotes';
import type { MyTake } from '../../lib/db/takes';

/**
 * "Debate record" — the getBattleRecord numbers as a one-line summary — plus
 * the caller's own posted takes, each with a delete affordance. Sits inside a
 * SectionShell on the profile screen; row layout mirrors ContributionsList's
 * compact-row pattern rather than introducing a new card style.
 */
export function MyTakes({
  battle,
  takes,
  onDelete,
}: {
  battle: BattleRecord | null;
  takes: MyTake[];
  onDelete: (id: string) => void;
}) {
  return (
    <View>
      {!!battle && battle.total > 0 && (
        <View style={styles.record}>
          <Text style={styles.recordLabel}>Debate record</Text>
          <Text style={styles.recordValue}>
            {battle.total} vote{battle.total === 1 ? '' : 's'} · {battle.agreePct}% with the crowd
            {battle.streak > 0 ? ` · ${battle.streak}-day streak` : ''}
          </Text>
        </View>
      )}

      {takes.length === 0 ? (
        <Text style={styles.empty}>
          No takes posted yet — drop one on a matchup you feel strongly about.
        </Text>
      ) : (
        takes.map((t) => (
          <View key={t.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.pair} numberOfLines={1}>
                {t.heroAName} vs {t.heroBName}
              </Text>
              <Text style={styles.body}>{t.body}</Text>
              <Text style={styles.agree}>
                {t.agreeCount} {t.agreeCount === 1 ? 'agreement' : 'agreements'}
              </Text>
            </View>
            <Pressable
              onPress={() => onDelete(t.id)}
              accessibilityLabel="Delete take"
              hitSlop={8}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.deleteBtn,
                hovered && styles.deleteBtnHover,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.grey} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  record: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.08)',
  },
  recordLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: PAPER_TEXT.faint,
    marginBottom: 4,
  },
  recordValue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.navy,
  },
  empty: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: PAPER_TEXT.faint,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.08)',
  },
  rowMain: { flex: 1 },
  pair: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: ORANGE_INK,
    marginBottom: 2,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: COLORS.navy,
    lineHeight: 19,
  },
  agree: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: PAPER_TEXT.faint,
    marginTop: 4,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    cursor: 'pointer',
  } as object,
  deleteBtnHover: { backgroundColor: 'rgba(41,60,67,0.06)' } as object,
});
