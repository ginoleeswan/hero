// src/components/home/SpotlightProgress.tsx — the billboard's segmented,
// timed progress indicator, ported from the web spotlight.
//
// The dots this replaces encoded one thing (position) at whisper volume. A
// segment per slide encodes three: where you are, how many there are, and —
// because the active segment FILLS across the autoplay interval — that the
// billboard advances on its own and when. Nothing else on the screen says any
// of that.
//
// Under Reduce Motion the carousel does not autoplay, so a filling bar would
// promise an advance that never comes: the active segment parks fully filled,
// which reads as "you are here" (the withRepeat rule's resting-value logic —
// park at the state that reads as CORRECT).
import { useEffect, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';
import { SPOTLIGHT } from './homeGeometry';

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
  const [segW, setSegW] = useState(0);
  const fill = useSharedValue(0);

  // Restart the fill each time the active slide changes. Linear on purpose: a
  // countdown eased would misreport how much time is left.
  useEffect(() => {
    if (reduced) {
      fill.value = 1;
      return;
    }
    fill.value = 0;
    fill.value = withTiming(1, { duration: intervalMs, easing: Easing.linear });
  }, [active, reduced, intervalMs, fill]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setSegW((w - SPOTLIGHT.segGap * (count - 1)) / count);
  };

  // Width in measured points, not a percentage — RN cannot animate percentage
  // widths from a shared value, and a bar that jumps to full is a broken clock.
  const fillStyle = useAnimatedStyle(() => ({ width: fill.value * segW }));

  return (
    <View style={styles.row} onLayout={onLayout} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.track}>
          {i < active ? <View style={styles.done} /> : null}
          {i === active && segW > 0 ? <Animated.View style={[styles.done, fillStyle]} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPOTLIGHT.segGap,
    width: '100%',
    maxWidth: SPOTLIGHT.segMaxW,
    alignSelf: 'center',
  },
  track: {
    flex: 1,
    height: SPOTLIGHT.segH,
    borderRadius: SPOTLIGHT.segH / 2,
    backgroundColor: 'rgba(245,235,220,0.28)',
    overflow: 'hidden',
  },
  done: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.orange,
  },
});
