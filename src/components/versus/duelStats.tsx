import { useEffect, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import type { RosterHero } from '../../lib/teamBattle';
import { FACTION_A as TINT_A, FACTION_B as TINT_B } from './factionColors';

export const STATS: [string, keyof RosterHero][] = [
  ['INT', 'intelligence'],
  ['STR', 'strength'],
  ['SPD', 'speed'],
  ['DUR', 'durability'],
  ['PWR', 'power'],
  ['CMB', 'combat'],
];

/** How many of the six stats `x` wins outright against `y`. */
export function statWins(x: RosterHero, y: RosterHero): number {
  return STATS.reduce((n, [, k]) => n + ((Number(x[k]) || 0) > (Number(y[k]) || 0) ? 1 : 0), 0);
}

/** One mirrored stat: A's value grows left, B's grows right; loser side dims. */
function CompareRow({
  label,
  a,
  b,
  p,
}: {
  label: string;
  a: number;
  b: number;
  p: SharedValue<number>;
}) {
  const total = a + b || 1;
  const aWin = a > b;
  const bWin = b > a;
  const aStyle = useAnimatedStyle(() => ({ width: `${(a / total) * 100 * p.value}%` }));
  const bStyle = useAnimatedStyle(() => ({ width: `${(b / total) * 100 * p.value}%` }));
  return (
    <View style={styles.cRow}>
      <Text style={[styles.cVal, styles.right, aWin ? { color: TINT_A } : null]}>{a}</Text>
      <View style={styles.cTrack}>
        <Animated.View
          style={[
            styles.cFill,
            styles.cFillA,
            { backgroundColor: TINT_A, opacity: bWin ? 0.4 : 1 },
            aStyle,
          ]}
        />
      </View>
      <Text style={styles.cLabel}>{label}</Text>
      <View style={styles.cTrack}>
        <Animated.View
          style={[
            styles.cFill,
            styles.cFillB,
            { backgroundColor: TINT_B, opacity: aWin ? 0.4 : 1 },
            bStyle,
          ]}
        />
      </View>
      <Text style={[styles.cVal, bWin ? { color: TINT_B } : null]}>{b}</Text>
    </View>
  );
}

/** Head-to-head stat sheet for the two spotlighted heroes; re-animates on swap.
 *  `footer` (verdict + vote CTA) renders inside the panel under a hairline rule,
 *  matching the hub's ringside card. */
export function HeroVsHero({
  a,
  b,
  aWins,
  bWins,
  animate,
  footer,
}: {
  a: RosterHero;
  b: RosterHero;
  aWins: number;
  bWins: number;
  animate: boolean;
  footer?: ReactNode;
}) {
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) {
      p.value = 0;
      p.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else {
      p.value = 1;
    }
  }, [a.id, b.id, animate, p]);

  return (
    <View style={styles.compare}>
      <Text style={styles.kicker}>Head to head</Text>
      <View style={styles.compareHead}>
        <Text style={[styles.cName, { color: TINT_A }]} numberOfLines={1}>
          {a.name}
        </Text>
        <View style={styles.tally}>
          <Text style={[styles.tallyN, aWins >= bWins ? { color: TINT_A } : null]}>{aWins}</Text>
          <Text style={styles.tallyDash}>–</Text>
          <Text style={[styles.tallyN, bWins >= aWins ? { color: TINT_B } : null]}>{bWins}</Text>
        </View>
        <Text style={[styles.cName, styles.right, { color: TINT_B }]} numberOfLines={1}>
          {b.name}
        </Text>
      </View>
      {STATS.map(([label, key]) => (
        <CompareRow
          key={label}
          label={label}
          a={Number(a[key]) || 0}
          b={Number(b[key]) || 0}
          p={p}
        />
      ))}
      {footer ? (
        <>
          <View style={styles.rule} />
          {footer}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Ringside glass panel — same grammar as the hub's head-to-head card.
  compare: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'rgba(206,155,51,0.9)',
    marginBottom: 10,
  },
  compareHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  cName: { flex: 1, fontFamily: 'Flame-Regular', fontSize: 15 },
  tally: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tallyN: { fontFamily: 'Flame-Regular', fontSize: 18, color: 'rgba(245,235,220,0.5)' },
  tallyDash: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.35)' },
  right: { textAlign: 'right' },
  rule: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: 'rgba(245,235,220,0.08)',
    marginTop: 8,
    marginBottom: 4,
  },
  cRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cVal: { width: 24, fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.55)' },
  cTrack: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  cFill: { position: 'absolute', top: 0, bottom: 0 },
  cFillA: { right: 0, borderTopRightRadius: 5, borderBottomRightRadius: 5 },
  cFillB: { left: 0, borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  cLabel: {
    width: 40,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.78)',
    letterSpacing: 0.4,
  },
});
