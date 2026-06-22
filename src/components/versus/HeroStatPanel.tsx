import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, type SharedValue } from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';
import type { RosterHero } from '../../lib/teamBattle';

const STATS: [string, keyof RosterHero][] = [
  ['INT', 'intelligence'],
  ['STR', 'strength'],
  ['SPD', 'speed'],
  ['DUR', 'durability'],
  ['PWR', 'power'],
  ['CMB', 'combat'],
];

function StatBar({ label, value, tint, p }: { label: string; value: number; tint: string; p: SharedValue<number> }) {
  const v = Math.max(0, Math.min(100, value));
  const style = useAnimatedStyle(() => ({ width: `${v * p.value}%` }));
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: tint }, style]} />
      </View>
      <Text style={styles.num}>{value}</Text>
    </View>
  );
}

/** The selected hero's six powerstats, bars growing on reveal. Keyed by hero id
 *  in the parent so it re-animates each time a different card is tapped. */
export function HeroStatPanel({ hero, tint, animate }: { hero: RosterHero; tint: string; animate: boolean }) {
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    p.value = animate ? withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }) : 1;
  }, [animate, p]);

  return (
    <View style={[styles.panel, { borderLeftColor: tint }]}>
      <Text style={styles.name} numberOfLines={1}>
        {hero.name}
      </Text>
      <View style={styles.grid}>
        {STATS.map(([label, key]) => (
          <StatBar key={label} label={label} value={Number(hero[key]) || 0} tint={tint} p={p} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderLeftWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige, marginBottom: 12, letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  item: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  label: { width: 28, fontFamily: 'Nunito_700Bold', fontSize: 9, color: 'rgba(245,235,220,0.55)', letterSpacing: 0.5 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  num: { width: 22, fontFamily: 'Nunito_700Bold', fontSize: 10, color: COLORS.beige, textAlign: 'right' },
});
