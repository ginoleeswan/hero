// src/components/web/versus/YesterdayStrip.tsx — web sibling of
// components/versus/YesterdayStrip.tsx. Same data shape (YesterdayDebateStrip
// from useVersusHub), sized for the wider stage.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, INK_TEXT } from '../../../constants/colors';
import { statSplit, frozenResult } from '../../../lib/home/matchupVote';
import type { YesterdayDebateStrip } from '../../../hooks/useVersusHub';

export function YesterdayStrip({ yesterday }: { yesterday: YesterdayDebateStrip }) {
  const { heroAName, heroBName, finalVotesA, finalVotesB, topTake, yourPick } = yesterday;
  const { pctA, pctB } = statSplit(finalVotesA, finalVotesB);
  // Shared with the native strip: `>=` crowned whichever side sorted first, so
  // a dead heat read "Team Hulk won 50/50".
  const { tied, aWon, yourSideWon } = frozenResult(finalVotesA, finalVotesB, yourPick);
  const winnerName = aWon ? heroAName : heroBName;
  const winnerPct = Math.max(pctA, pctB);
  const loserPct = Math.min(pctA, pctB);

  return (
    <View style={s.wrap}>
      <Text style={s.line}>
        {tied
          ? `Yesterday: dead heat — ${heroAName} and ${heroBName} split it ${pctA}/${pctB}`
          : `Yesterday: Team ${winnerName} won ${winnerPct}/${loserPct}`}
        {yourSideWon !== null ? (
          <Text style={yourSideWon ? s.won : s.lost}>
            {yourSideWon ? '  · Your side won' : '  · Your side lost'}
          </Text>
        ) : null}
      </Text>
      {topTake ? (
        <Text style={s.quote} numberOfLines={2}>
          “{topTake.body}” — {topTake.displayName ?? 'Anonymous hero'}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginTop: 18,
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 20,
  },
  line: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.7)',
    textAlign: 'center',
  },
  won: { fontFamily: 'Nunito_700Bold', color: COLORS.green },
  lost: { fontFamily: 'Nunito_700Bold', color: INK_TEXT.faint },
  quote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(245,235,220,0.55)',
    textAlign: 'center',
    maxWidth: 420,
  },
});
