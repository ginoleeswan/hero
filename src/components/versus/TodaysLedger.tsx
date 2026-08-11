// src/components/versus/TodaysLedger.tsx — what is left of today, as a bill.
//
// Replaces the chip card on the native Arena hub. The chips were navigation:
// three buttons, two of which opened things already on the screen (the debate
// chip opened the same arena as the showdown above it, the team-battle chip the
// same route as the card below it). A person arriving does not need a third way
// to reach today's debate — they need to know WHAT IS LEFT.
//
// So each line is a piece of state with its own subject, and the debate line
// records what you did rather than repeating the pairing already shown a few
// hundred points above it. The numbers are real: three dailies, in the order
// they are meant to be played.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDailies } from '../../hooks/useDailies';
import type { DailySurface } from '../../lib/db/dailies';
import { COLORS, INK_TEXT } from '../../constants/colors';

type Row = { key: DailySurface; n: string; label: string; note: string; onPress: () => void };

export function TodaysLedger({
  onDebate,
  onPuzzle,
  onTeamBattle,
  debateNote,
  teamNote,
}: {
  onDebate: () => void;
  onPuzzle: () => void;
  /** Omit while today's battle is still resolving — the line hides. */
  onTeamBattle?: () => void;
  /** What you did, not who is fighting: the pairing is already on screen. */
  debateNote: string;
  teamNote: string;
}) {
  const { current, today } = useDailies();

  const rows: Row[] = [
    { key: 'debate', n: '01', label: 'The debate', note: debateNote, onPress: onDebate },
    { key: 'puzzle', n: '02', label: 'Guess the hero', note: 'Six guesses', onPress: onPuzzle },
  ];
  if (onTeamBattle) {
    rows.push({
      key: 'team_battle',
      n: '03',
      label: 'Team battle',
      note: teamNote,
      onPress: onTeamBattle,
    });
  }
  const left = rows.filter((r) => !today[r.key]).length;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {/* Plain on purpose. "Today's card" reads as a fight bill only if you
            are already thinking about boxing; everywhere else "card" is a box
            on a screen. This states the question the person actually has. */}
        <Text style={styles.title}>{left === 0 ? 'All done today' : "What's left today"}</Text>
        <Text style={[styles.streak, current === 0 && styles.streakZero]}>
          {current > 0 ? `Streak ${current}` : 'Start a streak'}
        </Text>
      </View>

      {rows.map((r) => {
        const done = today[r.key];
        return (
          <Pressable
            key={r.key}
            onPress={r.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${r.label}${done ? ', done' : ', open'}`}
            style={({ pressed }) => [styles.line, pressed && styles.pressed]}
          >
            <Text style={styles.n}>{r.n}</Text>
            <View style={styles.body}>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={styles.note} numberOfLines={1}>
                {r.note}
              </Text>
            </View>
            <View style={styles.state}>
              <Text style={[styles.stateText, done && styles.stateDone]}>
                {done ? 'Settled' : 'Open'}
              </Text>
              <Ionicons
                name={done ? 'ellipse-outline' : 'ellipse'}
                size={8}
                color={done ? COLORS.grey : COLORS.orange}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,235,220,0.14)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: INK_TEXT.muted,
  },
  streak: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
  },
  streakZero: { color: INK_TEXT.faint },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,235,220,0.14)',
  },
  pressed: { opacity: 0.6 },
  n: {
    fontFamily: 'Flame-Bold',
    fontSize: 12,
    lineHeight: 16,
    width: 18,
    color: INK_TEXT.faint,
  },
  body: { flex: 1 },
  label: { fontFamily: 'FlameSans-Regular', fontSize: 15, lineHeight: 20, color: COLORS.beige },
  note: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: INK_TEXT.faint,
  },
  state: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stateText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  stateDone: { color: INK_TEXT.faint },
});
