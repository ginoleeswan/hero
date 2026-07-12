// src/components/versus/YesterdayStrip.tsx — one-line recap of yesterday's
// frozen debate split + its crowned top take, shown under the daily debate
// card. Shared shape (YesterdayDebateStrip) comes from useVersusHub; the web
// arena renders the sibling in components/web/versus.
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { statSplit } from '../../lib/home/matchupVote';
import type { YesterdayDebateStrip } from '../../hooks/useVersusHub';

export function YesterdayStrip({ yesterday }: { yesterday: YesterdayDebateStrip }) {
  const { heroAName, heroBName, finalVotesA, finalVotesB, topTake, yourPick } = yesterday;
  const { pctA, pctB } = statSplit(finalVotesA, finalVotesB);
  const winnerName = finalVotesA >= finalVotesB ? heroAName : heroBName;
  const winnerPct = Math.max(pctA, pctB);
  const loserPct = Math.min(pctA, pctB);

  const yourSideWon =
    yourPick === null
      ? null
      : (yourPick === 'a') === finalVotesA >= finalVotesB;

  return (
    <View style={s.wrap}>
      <Text style={s.line}>
        Yesterday: Team {winnerName} won {winnerPct}/{loserPct}
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
    marginTop: 14,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
  },
  line: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    color: 'rgba(245,235,220,0.7)',
    textAlign: 'center',
  },
  won: { fontFamily: 'Nunito_700Bold', color: COLORS.green },
  lost: { fontFamily: 'Nunito_700Bold', color: 'rgba(245,235,220,0.5)' },
  quote: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(245,235,220,0.55)',
    textAlign: 'center',
    maxWidth: 340,
  },
});
