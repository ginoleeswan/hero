import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { StatResult } from '../../lib/compare';
import { COLORS } from '../../constants/colors';

const BAR_DIM = 'rgba(41,60,67,0.16)';

/**
 * One stat comparison: value | label | value above a single center-split track.
 * Bars grow toward the center seam — left value/bar belong to hero A, right to
 * hero B. Winner (or tie) gets the strong Flame numeral + navy bar; loser dims.
 * Shared verbatim by the native and web compare screens.
 */
export function StatBattleRow({
  stat,
  animateIn,
  animationDelay = 0,
}: {
  stat: StatResult;
  animateIn?: boolean;
  animationDelay?: number;
}) {
  const aStrong = stat.winner !== 'B'; // win or tie → strong
  const bStrong = stat.winner !== 'A';

  const [ready, setReady] = useState(!animateIn);
  useEffect(() => {
    if (!animateIn) return;
    const id = setTimeout(() => setReady(true), 16);
    return () => clearTimeout(id);
  }, [animateIn]);

  const barTransition = Platform.select({
    web: {
      transition: `width 540ms cubic-bezier(0.16,1,0.3,1) ${animationDelay}ms`,
    } as object,
    default: {},
  });

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.val, styles.valLeft, aStrong ? styles.valStrong : styles.valDim]}>{stat.valueA}</Text>
        <Text style={styles.label}>{stat.label}</Text>
        <Text style={[styles.val, styles.valRight, bStrong ? styles.valStrong : styles.valDim]}>{stat.valueB}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.half, styles.halfLeft]}>
          <View
            style={[
              styles.barLeft,
              barTransition,
              { width: ready ? `${stat.valueA}%` : '0%', backgroundColor: aStrong ? COLORS.navy : BAR_DIM } as object,
            ]}
          />
        </View>
        <View style={styles.half}>
          <View
            style={[
              styles.barRight,
              barTransition,
              { width: ready ? `${stat.valueB}%` : '0%', backgroundColor: bStrong ? COLORS.navy : BAR_DIM } as object,
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
    marginBottom: 6,
  },
  val: { fontVariant: ['tabular-nums'], flex: 1 },
  valLeft: { textAlign: 'left' },
  valRight: { textAlign: 'right' },
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
