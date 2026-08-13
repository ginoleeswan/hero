// src/components/versus/YesterdayStrip.tsx — yesterday's frozen result, as a
// ticket rather than a sentence.
//
// It was a centred line of prose ("Yesterday: Team Joker won 100/0 · Your side
// won") stacked under two more centred lines of prose. Three sentences at
// near-identical weight is not a hierarchy — it is a paragraph, and the reader
// has to actually read all of it to find out that none of it needed reading.
//
// A result has a natural shape: a split, a winner, and whether you were on it.
// Drawing the split as a bar states it faster than "100/0" does, the winner is
// the only name that needs to be there, and "you called it" is a marker rather
// than a clause. Left-aligned, because a ticket is a record and records are
// read from the left; the centred prose was competing with the CTA above it for
// the same axis.
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { RADIUS } from '../../design';
import { statSplit, frozenResult } from '../../lib/home/matchupVote';
import type { YesterdayDebateStrip } from '../../hooks/useVersusHub';

export function YesterdayStrip({ yesterday }: { yesterday: YesterdayDebateStrip }) {
  const { heroAName, heroBName, finalVotesA, finalVotesB, topTake, yourPick } = yesterday;
  const { pctA, pctB } = statSplit(finalVotesA, finalVotesB);
  // A dead heat is its own result, and the better story. Crowning the side that
  // happened to sort first ("Team Hulk won 50/50") states a contradiction in
  // five words — and it is the outcome most likely to be looked at twice. The
  // rule lives in frozenResult so the web sibling cannot drift off it again.
  const { tied, aWon, yourSideWon } = frozenResult(finalVotesA, finalVotesB, yourPick);
  const winnerName = aWon ? heroAName : heroBName;
  const winnerPct = Math.max(pctA, pctB);

  return (
    <View style={s.wrap}>
      {/* The split, drawn. Two bars in the fighters' own accents, the winner's
          side full-strength — the number beside it is corroboration, not the
          only way to find out who took it. */}
      <View style={s.bar}>
        <View style={[s.fillA, { flex: Math.max(pctA, 1) }, !tied && !aWon && s.faded]} />
        <View style={[s.fillB, { flex: Math.max(pctB, 1) }, !tied && aWon && s.faded]} />
      </View>

      <View style={s.body}>
        <Text style={s.eyebrow}>Yesterday</Text>
        <Text style={s.result} numberOfLines={1}>
          {tied ? 'Dead heat' : `${winnerName} took it · ${winnerPct}%`}
        </Text>
        {topTake ? (
          <Text style={s.quote} numberOfLines={1}>
            “{topTake.body}”
          </Text>
        ) : null}
      </View>

      {yourSideWon !== null ? (
        <Text style={[s.badge, yourSideWon ? s.won : s.lost]}>
          {yourSideWon ? 'You called it' : 'You missed it'}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    alignSelf: 'stretch',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(41,60,67,0.42)',
  },
  // Vertical, so it reads as the edge of the ticket rather than as a progress
  // bar for something on this screen — yesterday is finished.
  bar: { width: 4, height: 34, borderRadius: RADIUS.xs, overflow: 'hidden' },
  fillA: { backgroundColor: COLORS.orange },
  fillB: { backgroundColor: COLORS.blue },
  faded: { opacity: 0.3 },
  body: { flex: 1, gap: 1 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
  result: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.beige },
  quote: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: INK_TEXT.faint },
  badge: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  won: { color: COLORS.green },
  lost: { color: INK_TEXT.faint },
});
