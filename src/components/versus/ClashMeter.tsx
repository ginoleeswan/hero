import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
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
 *  synergy-adjusted winner, with a glowing gold seam where the two sides meet. */
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
      <View style={[styles.track, { backgroundColor: tintB }]}>
        <Animated.View style={[styles.fill, { backgroundColor: tintA }, fillStyle]}>
          <View style={styles.gloss} pointerEvents="none" />
        </Animated.View>
        <Animated.View style={[styles.seam, seamStyle]} pointerEvents="none">
          <View style={styles.knob} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 380, alignSelf: 'center' },
  track: {
    width: '100%',
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  gloss: { position: 'absolute', left: 0, right: 0, top: 0, height: '46%', backgroundColor: 'rgba(255,255,255,0.18)' },
  // The seam is a full-height marker centred on the boundary; the knob is the
  // glowing gold cap that visually divides the two factions.
  seam: { position: 'absolute', top: 0, bottom: 0, width: 0, alignItems: 'center', justifyContent: 'center' },
  knob: {
    width: 4,
    height: 46,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: COLORS.goldAccent,
    shadowColor: COLORS.goldAccent,
    shadowOpacity: 1,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
  },
});
