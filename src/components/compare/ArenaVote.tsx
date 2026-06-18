// src/components/compare/ArenaVote.tsx — the commit-then-reveal heart of the
// arena. The debate is the hero: BEFORE voting we ask "Who would win?" and show
// nothing else (no winner, no stats, no spoiler verdict). AFTER the user commits,
// the parent reveals the tale of the tape + verdict, and this block reframes the
// result around THEIR pick (vs the crowd, or vs the stat tape at cold-start).
//
// Controlled: the arena owns the vote state (useMatchupVote) so it can gate the
// portrait glow / stat rows / verdict on `revealed`. This renders only the
// ask / result band.
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { COLORS } from '../../constants/colors';
import { statSplit, type MatchupSide } from '../../lib/home/matchupVote';
import type { MatchupTally } from '../../lib/db/matchupVotes';

interface ArenaVoteProps {
  revealed: boolean;
  pickedId: string | null;
  tally: MatchupTally | null;
  heroAId: string;
  nameA: string;
  nameB: string;
  /** Stat-category wins, for the cold-start "tale of the tape" framing. */
  winsA: number;
  winsB: number;
  onVote: (side: MatchupSide) => void;
  /** 'light' = on the beige scorecard; 'dark' = on the navy mobile block. */
  tone?: 'light' | 'dark';
}

export function ArenaVote({
  revealed,
  pickedId,
  tally,
  heroAId,
  nameA,
  nameB,
  winsA,
  winsB,
  onVote,
  tone = 'light',
}: ArenaVoteProps) {
  const dark = tone === 'dark';

  // ── The ask ──────────────────────────────────────────────────────
  if (!revealed) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.eyebrow, dark && styles.eyebrowDark]}>SETTLE THE DEBATE</Text>
        <Text style={[styles.question, dark && styles.questionDark]}>Who would win?</Text>
        <View style={styles.voteRow}>
          <VoteButton label={nameA} dark={dark} onPress={() => onVote('a')} />
          <VoteButton label={nameB} dark={dark} onPress={() => onVote('b')} />
        </View>
        <Text style={[styles.hint, dark && styles.hintDark]}>
          Cast your vote to see the tale of the tape
        </Text>
      </View>
    );
  }

  // ── The reveal — framed around the viewer's own pick ─────────────
  const pickedA = pickedId === heroAId;
  const usingVotes = !!tally && tally.total > 0;
  const { pctA, pctB } = usingVotes
    ? statSplit(tally!.votesA, tally!.votesB)
    : statSplit(winsA, winsB);

  let caption: string;
  if (usingVotes) {
    const myPct = pickedA ? pctA : pctB;
    const n = tally!.total;
    caption =
      myPct >= 50
        ? `You're with the majority · ${n} ${n === 1 ? 'vote' : 'votes'}`
        : `You're backing the underdog · ${n} ${n === 1 ? 'vote' : 'votes'}`;
  } else if (winsA === winsB) {
    caption = 'Dead even on the tape';
  } else {
    const tapeLeansA = winsA > winsB;
    const tapeAgrees = (tapeLeansA && pickedA) || (!tapeLeansA && !pickedA);
    caption = tapeAgrees ? 'The tale of the tape agrees' : "You're going against the tape";
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.eyebrow, dark && styles.eyebrowDark]}>
        YOUR PICK · {(pickedA ? nameA : nameB).toUpperCase()}
      </Text>
      <View style={[styles.barTrack, dark && styles.barTrackDark]}>
        <View style={[styles.barFillA, { flex: Math.max(pctA, 1) }]} />
        <View style={[styles.barFillB, { flex: Math.max(pctB, 1) }]} />
      </View>
      <View style={styles.barLabels}>
        <Text style={[styles.barPct, { color: COLORS.orange }, pickedA && styles.barPctPicked]}>
          {pctA}%
        </Text>
        <Text style={[styles.caption, dark && styles.captionDark]}>{caption}</Text>
        <Text style={[styles.barPct, { color: COLORS.blue }, !pickedA && styles.barPctPicked]}>
          {pctB}%
        </Text>
      </View>
    </View>
  );
}

function VoteButton({
  label,
  dark,
  onPress,
}: {
  label: string;
  dark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Vote for ${label}`}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.voteBtn,
          dark ? styles.voteBtnDark : styles.voteBtnLight,
          hovered && (dark ? styles.voteBtnDarkHover : styles.voteBtnLightHover),
        ] as object
      }
    >
      <Text style={[styles.voteBtnText, dark && styles.voteBtnTextDark]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 10, alignItems: 'center' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.5)',
  },
  eyebrowDark: { color: COLORS.goldAccent },
  question: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.navy,
    textAlign: 'center',
    marginBottom: 4,
  },
  questionDark: { color: COLORS.beige },
  // width:'100%' (not alignSelf:'stretch') — under a centering parent RN-web
  // otherwise shrinks the row to content width and clips long names ("Superm…").
  voteRow: { flexDirection: 'row', gap: 10, width: '100%' },
  voteBtn: {
    flex: 1,
    minWidth: 0,
    borderRadius: 26,
    paddingVertical: 13,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  voteBtnLight: { backgroundColor: 'rgba(41,60,67,0.05)', borderColor: 'rgba(41,60,67,0.18)' },
  voteBtnLightHover: {
    backgroundColor: 'rgba(231,115,51,0.12)',
    borderColor: COLORS.orange,
  } as object,
  voteBtnDark: { backgroundColor: 'rgba(245,235,220,0.08)', borderColor: 'rgba(245,235,220,0.22)' },
  voteBtnDarkHover: {
    backgroundColor: 'rgba(231,115,51,0.18)',
    borderColor: COLORS.orange,
  } as object,
  voteBtnText: { fontFamily: 'Nunito_900Black', fontSize: 14, color: COLORS.navy },
  voteBtnTextDark: { color: COLORS.beige },
  hint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(41,60,67,0.45)',
    marginTop: 2,
  },
  hintDark: { color: 'rgba(245,235,220,0.45)' },

  barTrack: {
    flexDirection: 'row',
    width: '100%',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(41,60,67,0.12)',
    marginTop: 2,
  },
  barTrackDark: { backgroundColor: 'rgba(245,235,220,0.1)' },
  barFillA: { backgroundColor: COLORS.orange },
  barFillB: { backgroundColor: COLORS.blue },
  barLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  barPct: { fontFamily: 'Flame-Regular', fontSize: 17, opacity: 0.5 },
  barPctPicked: { opacity: 1 },
  caption: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.55)',
  },
  captionDark: { color: 'rgba(245,235,220,0.5)' },
});
