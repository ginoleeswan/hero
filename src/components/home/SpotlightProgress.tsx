// src/components/home/SpotlightProgress.tsx — the billboard's pager: a dot per
// slide, a pill for the one you are on, and the pill is a track that FILLS
// across the autoplay interval.
//
// Dots alone encoded position at whisper volume and said nothing about the
// billboard advancing on its own. A full row of segmented bars said all of it,
// far too loudly — five bright bars competing with the artwork they sit on.
// This keeps the dots' light footing (position and count read at a glance) and
// puts the clock INSIDE the one indicator that is already the loud one.
//
// The dot↔pill change is a morph, not a swap: one shared value tracks the
// active index and every indicator interpolates its own width from the
// distance to it, so the pill grows out of the outgoing dot rather than
// blinking between two states.
//
// Under Reduce Motion the carousel does not autoplay, so a filling pill would
// promise an advance that never comes: it parks fully filled, which reads as
// "you are here" (the withRepeat rule's resting-value logic — park at the
// state that reads as CORRECT).
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';
import { SPOTLIGHT } from './homeGeometry';

const TRACK = 'rgba(245,235,220,0.38)';
const MORPH_MS = 260;

function Indicator({
  index,
  activeSV,
  fill,
}: {
  index: number;
  activeSV: SharedValue<number>;
  fill: SharedValue<number>;
}) {
  // Proximity to the active index: 1 on it, 0 once a whole slide away. During
  // the morph both neighbours hold a fraction, so total width stays steady and
  // the row does not jitter sideways.
  const shellStyle = useAnimatedStyle(() => {
    const t = Math.max(0, 1 - Math.abs(activeSV.value - index));
    return { width: SPOTLIGHT.dotSize + (SPOTLIGHT.dotActiveWidth - SPOTLIGHT.dotSize) * t };
  });

  // Width in measured points, not a percentage — RN cannot animate percentage
  // widths from a shared value, and a bar that jumps to full is a broken clock.
  // Scaled by the same proximity so the fill grows with the pill it lives in.
  const fillStyle = useAnimatedStyle(() => {
    const t = Math.max(0, 1 - Math.abs(activeSV.value - index));
    return { width: t * fill.value * SPOTLIGHT.dotActiveWidth };
  });

  return (
    <Animated.View style={[styles.shell, shellStyle]}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </Animated.View>
  );
}

export function SpotlightProgress({
  count,
  active,
  intervalMs,
}: {
  count: number;
  active: number;
  intervalMs: number;
}) {
  const reduced = useReducedMotion();
  const activeSV = useSharedValue(active);
  const fill = useSharedValue(0);

  // Restart the fill each time the active slide changes. Linear on purpose: a
  // countdown eased would misreport how much time is left.
  useEffect(() => {
    if (reduced) {
      activeSV.value = active;
      fill.value = 1;
      return;
    }
    activeSV.value = withTiming(active, { duration: MORPH_MS });
    fill.value = 0;
    fill.value = withTiming(1, { duration: intervalMs, easing: Easing.linear });
  }, [active, reduced, intervalMs, activeSV, fill]);

  return (
    <View style={styles.row} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <Indicator key={i} index={i} activeSV={activeSV} fill={fill} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPOTLIGHT.dotGap,
  },
  shell: {
    height: SPOTLIGHT.dotSize,
    borderRadius: SPOTLIGHT.dotSize / 2,
    backgroundColor: TRACK,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.orange,
  },
});
