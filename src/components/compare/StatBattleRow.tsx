import { View, Text, StyleSheet } from 'react-native';
import type { StatResult } from '../../lib/compare';
import { COLORS } from '../../constants/colors';

const BAR_DIM = 'rgba(41,60,67,0.16)';

/**
 * One stat comparison: value | label | value above a single center-split track.
 * Bars grow toward the center seam — left value/bar belong to hero A, right to
 * hero B. Winner (or tie) gets the strong Flame numeral + navy bar; loser dims.
 * Shared verbatim by the native and web compare screens.
 */
export function StatBattleRow({ stat }: { stat: StatResult }) {
  const aStrong = stat.winner !== 'B'; // win or tie → strong
  const bStrong = stat.winner !== 'A';

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.val, aStrong ? styles.valStrong : styles.valDim]}>{stat.valueA}</Text>
        <Text style={styles.label}>{stat.label}</Text>
        <Text style={[styles.val, bStrong ? styles.valStrong : styles.valDim]}>{stat.valueB}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.half, styles.halfLeft]}>
          <View
            style={[
              styles.barLeft,
              { width: `${stat.valueA}%`, backgroundColor: aStrong ? COLORS.navy : BAR_DIM } as object,
            ]}
          />
        </View>
        <View style={styles.half}>
          <View
            style={[
              styles.barRight,
              { width: `${stat.valueB}%`, backgroundColor: bStrong ? COLORS.navy : BAR_DIM } as object,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  val: { fontVariant: ['tabular-nums'] },
  valStrong: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.navy,
  },
  valDim: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: 'rgba(41,60,67,0.4)',
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    color: '#9a9388',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  track: { flexDirection: 'row', height: 9, gap: 6 },
  half: { flex: 1, flexDirection: 'row' },
  halfLeft: { justifyContent: 'flex-end' },
  barLeft: { height: '100%', borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  barRight: { height: '100%', borderTopRightRadius: 5, borderBottomRightRadius: 5 },
});
