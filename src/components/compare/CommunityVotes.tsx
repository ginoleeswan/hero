// src/components/compare/CommunityVotes.tsx — READ-ONLY fan-vote split for the
// arena. The arena is the result page: it shows who wins (stats + verdict) and
// what the community thinks. Voting happens BEFORE the arena (on the matchup
// cards), never here — so this only displays the tally, it never casts one.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { statSplit } from '../../lib/home/matchupVote';
import type { MatchupTally } from '../../lib/db/matchupVotes';

interface CommunityVotesProps {
  tally: MatchupTally | null;
  /** The viewer's own pick (a hero id), to highlight their side. */
  pickedId: string | null;
  heroAId: string;
  /** 'light' = on the beige scorecard; 'dark' = on the navy mobile block. */
  tone?: 'light' | 'dark';
}

export function CommunityVotes({ tally, pickedId, heroAId, tone = 'light' }: CommunityVotesProps) {
  const dark = tone === 'dark';

  if (!tally || tally.total === 0) {
    return <Text style={[styles.empty, dark && styles.emptyDark]}>No fan votes yet</Text>;
  }

  const { pctA, pctB } = statSplit(tally.votesA, tally.votesB);
  const pickedA = pickedId === heroAId;
  const n = tally.total;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.eyebrow, dark && styles.eyebrowDark]}>FAN VERDICT</Text>
      <View style={[styles.barTrack, dark && styles.barTrackDark]}>
        <View style={[styles.barFillA, { flex: Math.max(pctA, 1) }]} />
        <View style={[styles.barFillB, { flex: Math.max(pctB, 1) }]} />
      </View>
      <View style={styles.barLabels}>
        <Text style={[styles.barPct, { color: COLORS.orange }, pickedA && styles.picked]}>
          {pctA}%
        </Text>
        <Text style={[styles.caption, dark && styles.captionDark]}>
          {n.toLocaleString()} {n === 1 ? 'vote' : 'votes'}
          {pickedId ? ' · you voted' : ''}
        </Text>
        <Text style={[styles.barPct, { color: COLORS.blue }, !pickedA && styles.picked]}>
          {pctB}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 10, alignItems: 'center', width: '100%' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.5)',
  },
  eyebrowDark: { color: COLORS.goldAccent },
  empty: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'rgba(41,60,67,0.4)',
  },
  emptyDark: { color: 'rgba(245,235,220,0.4)' },
  barTrack: {
    flexDirection: 'row',
    width: '100%',
    height: 12,
    borderRadius: 6,
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
    width: '100%',
    gap: 8,
  },
  barPct: { fontFamily: 'Flame-Regular', fontSize: 17, opacity: 0.5 },
  picked: { opacity: 1 },
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
