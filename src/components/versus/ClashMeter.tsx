import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';

interface Props {
  /** Faction A's share of the power split (0–100); the bar charges toward it. */
  splitA: number;
  tintA: string;
  tintB: string;
  /** When false (reduced motion), the bar sits at its final split immediately. */
  animate: boolean;
  /** Charge begins after this delay (ms) so it lands on the CLASH beat. */
  delay?: number;
}

/** The front line — a single bar that charges from a 50/50 standoff toward the
 *  synergy-adjusted winner. Soft depth (top sheen + lower shade), no hard rim,
 *  and a glowing gold seam where the two sides meet. */
export function ClashMeter({ splitA, tintA, tintB, animate, delay = 0 }: Props) {
  const charge = useSharedValue(animate ? 50 : splitA);

  useEffect(() => {
    charge.value = animate
      ? withDelay(delay, withTiming(splitA, { duration: 820, easing: Easing.out(Easing.cubic) }))
      : splitA;
  }, [splitA, animate, delay, charge]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${charge.value}%` }));
  const seamStyle = useAnimatedStyle(() => ({ left: `${charge.value}%` }));

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tintB }]} />
        <Animated.View style={[styles.fill, { backgroundColor: tintA }, fillStyle]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.05)', 'transparent']}
          locations={[0, 0.5, 1]}
          style={styles.sheen}
          pointerEvents="none"
        />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.22)']} style={styles.shade} pointerEvents="none" />
      </View>
      <Animated.View style={[styles.seam, seamStyle]} pointerEvents="none">
        <View style={styles.knobGlow} />
        <View style={styles.knob} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  track: { width: '100%', height: 26, borderRadius: 13, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  sheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '62%' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%' },
  // The seam sits above the (clipped) track so the knob can overflow its ends.
  seam: { position: 'absolute', top: 0, bottom: 0, width: 0, alignItems: 'center', justifyContent: 'center' },
  knob: {
    width: 2.5,
    height: 34,
    borderRadius: 2,
    backgroundColor: COLORS.goldAccent,
  },
  knobGlow: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.goldAccent,
    opacity: 0.9,
    shadowColor: COLORS.goldAccent,
    shadowOpacity: 1,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 0 },
  },
});
