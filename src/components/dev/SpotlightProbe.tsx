// src/components/dev/SpotlightProbe.tsx — TEMPORARY diagnostic. Delete once the
// spotlight band is root-caused.
//
// The band above the billboard has survived four fixes, each reasoned from the
// code rather than measured on the device. The audit narrowed it to one
// question that reading cannot answer: what does `scrollY` hold at the moment
// the band is visible?
//
// Only one thing can move the billboard DOWN — `translateY: sy × 0.5` in
// explore's spotlightParallax. So:
//
//   • band present AND sy > 0 while the list is visually at the top
//       → the offset source is wrong (reading a value the list doesn't have).
//   • band present AND sy ≈ 0
//       → the parallax is innocent and something else is offsetting it, and
//         every fix so far has been aimed at the wrong layer.
//
// One screenshot with this overlay showing settles it either way.
//
// __DEV__-gated, so it cannot reach a production build.
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAnimatedReaction, runOnJS, type SharedValue } from 'react-native-reanimated';

export function SpotlightProbe({
  scrollY,
  insetTop,
  spotH,
}: {
  scrollY: SharedValue<number>;
  insetTop: number;
  spotH: number;
}) {
  const [sy, setSy] = useState(0);

  // Round before crossing to JS so the reaction only fires on a whole-point
  // change — this is a debug readout, not a per-frame binding.
  useAnimatedReaction(
    () => Math.round(scrollY.value),
    (v, prev) => {
      if (v !== prev) runOnJS(setSy)(v);
    },
  );

  if (!__DEV__) return null;

  // What the parallax is actually doing with that value right now.
  const shift = sy > 0 ? sy * 0.5 : sy / 2;

  return (
    <View pointerEvents="none" style={[styles.panel, { top: insetTop + 4 }]}>
      <Text style={styles.line}>sy {sy}</Text>
      <Text style={[styles.line, shift > 0.5 && styles.bad]}>shift {shift.toFixed(1)}</Text>
      <Text style={styles.line}>inset {Math.round(insetTop)}</Text>
      <Text style={styles.line}>spotH {Math.round(spotH)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 6,
    zIndex: 9999,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  line: { color: '#7CFC9A', fontSize: 11, fontVariant: ['tabular-nums'] },
  // `shift` is the number of points the billboard is being pushed DOWN. Any
  // positive value here IS the band, in points.
  bad: { color: '#FF6B6B' },
});
