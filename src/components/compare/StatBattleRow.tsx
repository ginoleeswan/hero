import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import type { StatResult } from '../../lib/compare';
import { COLORS } from '../../constants/colors';

const BAR_DIM = 'rgba(41,60,67,0.16)';

/**
 * One stat comparison: value | label | value above a single center-split track.
 * Bars grow toward the center seam — left value/bar belong to hero A, right to
 * hero B. Winner (or tie) gets the strong Flame numeral + navy bar; loser dims.
 * Shared verbatim by the native and web compare screens.
 *
 * With `animateIn`, the bars sweep out from the center seam (width 0 → value%)
 * via Reanimated, staggered by `animationDelay` — identical on native and web.
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

  const progress = useSharedValue(animateIn ? 0 : 1);
  useEffect(() => {
    if (!animateIn) return;
    progress.value = withDelay(
      animationDelay,
      withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }),
    );
  }, [animateIn, animationDelay, progress]);

  const barLeftStyle = useAnimatedStyle(() => ({ width: `${stat.valueA * progress.value}%` }));
  const barRightStyle = useAnimatedStyle(() => ({ width: `${stat.valueB * progress.value}%` }));

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.val, styles.valLeft, aStrong ? styles.valStrong : styles.valDim]}>{stat.valueA}</Text>
        <Text style={styles.label}>{stat.label}</Text>
        <Text style={[styles.val, styles.valRight, bStrong ? styles.valStrong : styles.valDim]}>{stat.valueB}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.half, styles.halfLeft]}>
          <Animated.View
            style={[
              styles.barLeft,
              { backgroundColor: aStrong ? COLORS.navy : BAR_DIM },
              barLeftStyle,
            ]}
          />
        </View>
        <View style={styles.half}>
          <Animated.View
            style={[
              styles.barRight,
              { backgroundColor: bStrong ? COLORS.navy : BAR_DIM },
              barRightStyle,
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
