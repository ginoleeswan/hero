// src/components/versus/TodaysLedger.tsx — what is left of today, in one row.
//
// It replaced a card of chips that were pure navigation: three buttons, two of
// which opened things already on the screen. A person arriving does not need a
// third way to reach today's debate — they need to know WHAT IS LEFT. That part
// has not changed; each tile is a piece of state that happens to be tappable.
//
// What changed is the shape. As three full-width lines it was ~165pt of stacked
// rows for three booleans, which pushed "Make a fight" — the act this tab exists
// for — most of a screen down. Three states belong side by side: the row reads
// as one glance ("two open, one settled") instead of three sequential reads, and
// costs about 90pt less.
//
// The per-line notes are the deliberate cost. A tile roughly 125pt wide cannot
// carry "Sinister Six vs Young Avengers" legibly, and padding it out to fit
// would give back the space this exists to save. The notes survive where they
// still do work: in the accessibility label, which is read aloud in full.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDailies } from '../../hooks/useDailies';
import type { DailySurface } from '../../lib/db/dailies';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { RADIUS } from '../../design';
import { SUBHEAD } from '../../constants/arenaType';

type Tile = {
  key: DailySurface;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Spoken, not drawn — the detail a 125pt tile has no room for. */
  note: string;
  onPress: () => void;
};

export function TodaysLedger({
  onDebate,
  onPuzzle,
  onTeamBattle,
  debateNote,
  teamNote,
}: {
  onDebate: () => void;
  onPuzzle: () => void;
  /** Omit while today's battle is still resolving — the tile hides. */
  onTeamBattle?: () => void;
  debateNote: string;
  teamNote: string;
}) {
  const { current, today, tracked } = useDailies();

  const tiles: Tile[] = [
    {
      key: 'debate',
      label: 'Debate',
      icon: 'chatbubbles',
      note: debateNote,
      onPress: onDebate,
    },
    {
      key: 'puzzle',
      label: 'Guess',
      icon: 'help-circle',
      note: 'Six guesses',
      onPress: onPuzzle,
    },
  ];
  if (onTeamBattle) {
    tiles.push({
      key: 'team_battle',
      label: 'Team battle',
      icon: 'people',
      note: teamNote,
      onPress: onTeamBattle,
    });
  }
  const left = tiles.filter((t) => !today[t.key]).length;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {/* Plain on purpose. "Today's card" reads as a fight bill only if you
            are already thinking about boxing; everywhere else "card" is a box
            on a screen. This states the question the person actually has. */}
        <Text style={styles.title}>{left === 0 ? 'All done today' : "What's left today"}</Text>
        {/* Logged out, today's ticks are real but no streak is being kept —
            "Start a streak" would be a button-shaped lie, since playing every
            surface would still leave it at zero. Say what is actually true. */}
        <Text style={[styles.streak, (!tracked || current === 0) && styles.streakZero]}>
          {!tracked ? 'Sign in to keep a streak' : current > 0 ? `Streak ${current}` : 'Day one'}
        </Text>
      </View>

      <View style={styles.row}>
        {tiles.map((t) => {
          const done = today[t.key];
          return (
            <Pressable
              key={t.key}
              onPress={t.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${t.label}. ${t.note}. ${done ? 'Settled' : 'Open'}`}
              style={({ pressed }) => [styles.tile, done && styles.tileDone, pressed && styles.dim]}
            >
              <Ionicons
                name={done ? 'checkmark-circle' : t.icon}
                size={19}
                color={done ? COLORS.grey : COLORS.orange}
              />
              <Text style={styles.label} numberOfLines={1}>
                {t.label}
              </Text>
              <Text style={[styles.state, done && styles.stateDone]}>
                {done ? 'Settled' : 'Open'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,235,220,0.14)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  title: { ...SUBHEAD, color: INK_TEXT.muted },
  streak: { ...SUBHEAD, color: COLORS.goldAccent },
  streakZero: { color: INK_TEXT.faint },

  row: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: RADIUS.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,115,51,0.34)',
    backgroundColor: 'rgba(231,115,51,0.07)',
  },
  // Settled tiles recede: the row is about what is LEFT, so the open ones
  // should be the ones carrying colour.
  tileDone: {
    borderColor: 'rgba(245,235,220,0.14)',
    backgroundColor: 'rgba(41,60,67,0.34)',
  },
  dim: { opacity: 0.6 },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.beige },
  state: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  stateDone: { color: INK_TEXT.faint },
});
