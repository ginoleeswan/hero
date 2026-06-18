// src/components/compare/ArenaVote.tsx — the interactive "Who would win?" vote on
// the Compare arena. The arena is the artifact people SHARE (a /compare/a/b link),
// so the vote has to live here, not only on the home card — otherwise a stranger
// who lands on a shared matchup has nothing to do but read. Logged-out visitors
// vote with no wall (optimistic local reveal via useMatchupVote); the crowd split
// falls back to the stat scorecard until real votes exist.
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { COLORS } from '../../constants/colors';
import { statSplit, statLead } from '../../lib/home/matchupVote';
import { useMatchupVote } from '../../hooks/useMatchupVote';

interface ArenaVoteProps {
  heroAId: string;
  heroBId: string;
  nameA: string;
  nameB: string;
  /** Stat-category wins, for the pre-crowd fallback split. */
  winsA: number;
  winsB: number;
  /** 'light' = on the beige scorecard; 'dark' = on the navy mobile block. */
  tone?: 'light' | 'dark';
}

export function ArenaVote({
  heroAId,
  heroBId,
  nameA,
  nameB,
  winsA,
  winsB,
  tone = 'light',
}: ArenaVoteProps) {
  const { pickedId, tally, loaded, revealed, castVote } = useMatchupVote(heroAId, heroBId);
  const dark = tone === 'dark';

  if (!loaded) return <View style={styles.reserve} />;

  if (!revealed) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.prompt, dark && styles.promptDark]}>Who would win?</Text>
        <View style={styles.voteRow}>
          <VoteButton label={nameA} dark={dark} onPress={() => castVote('a')} />
          <VoteButton label={nameB} dark={dark} onPress={() => castVote('b')} />
        </View>
      </View>
    );
  }

  const usingVotes = !!tally && tally.total > 0;
  const { pctA, pctB } = usingVotes
    ? statSplit(tally!.votesA, tally!.votesB)
    : statSplit(winsA, winsB);
  const caption = usingVotes
    ? `${tally!.total} ${tally!.total === 1 ? 'fan' : 'fans'} voted`
    : statLead(winsA, winsB, nameA, nameB);
  const pickedA = pickedId === heroAId;

  return (
    <View style={styles.wrap}>
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
  reserve: { minHeight: 60 },
  wrap: { alignSelf: 'stretch', gap: 10 },
  prompt: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'rgba(41,60,67,0.55)',
  },
  promptDark: { color: 'rgba(245,235,220,0.6)' },
  voteRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  voteBtn: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  voteBtnLight: {
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderColor: 'rgba(41,60,67,0.16)',
  },
  voteBtnLightHover: {
    backgroundColor: 'rgba(231,115,51,0.12)',
    borderColor: COLORS.orange,
  } as object,
  voteBtnDark: {
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderColor: 'rgba(245,235,220,0.18)',
  },
  voteBtnDarkHover: { backgroundColor: 'rgba(245,235,220,0.14)' } as object,
  voteBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  voteBtnTextDark: { color: COLORS.beige },

  barTrack: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(41,60,67,0.12)',
  },
  barTrackDark: { backgroundColor: 'rgba(245,235,220,0.1)' },
  barFillA: { backgroundColor: COLORS.orange },
  barFillB: { backgroundColor: COLORS.blue },
  barLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: 8,
  },
  barPct: { fontFamily: 'Flame-Regular', fontSize: 15, opacity: 0.55 },
  barPctPicked: { opacity: 1 },
  caption: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.5)',
  },
  captionDark: { color: 'rgba(245,235,220,0.45)' },
});
