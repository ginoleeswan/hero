import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { COLORS } from '../../constants/colors';
import { SHIMMER_MS } from '../../lib/nativeMotion';

/**
 * Placeholder for the team-clash stage while the rosters + verdict resolve. It
 * mirrors ClashArena's silhouette — header (eyebrow, title, score/meter), the
 * two spotlight cards, and the ringside panel — so the real layout paints in
 * place rather than replacing a spinner. A single shared opacity pulses the
 * whole set (one driver, cheap on mobile). Breakpoint matches ClashArena (900).
 */
export function ClashSkeleton({
  topInset = 24,
  bottomInset = 24,
}: {
  topInset?: number;
  bottomInset?: number;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    // SHIMMER_MS, not a local number: this is the same opacity pulse the
    // shared SkeletonProvider runs, and two skeletons breathing at different
    // tempos in one session is a coherence tell.
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SHIMMER_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: SHIMMER_MS, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const cardSize = isWide ? 150 : Math.min(190, (Math.min(width, 540) - 46) / 2);
  const cardH = Math.round((cardSize * 9) / 7);

  return (
    <View style={[styles.stage, { paddingTop: topInset + 14, paddingBottom: bottomInset + 16 }]}>
      <Animated.View style={[styles.inner, pulseStyle]}>
        {/* header */}
        <View style={[styles.bar, styles.eyebrow]} />
        <View style={[styles.bar, styles.title]} />
        <View style={styles.meterRow}>
          <View style={[styles.bar, styles.score]} />
          <View style={[styles.bar, styles.meter]} />
          <View style={[styles.bar, styles.score]} />
        </View>

        {/* duel spotlight pair */}
        <View style={styles.spots}>
          <View style={[styles.card, { width: cardSize, height: cardH }]} />
          <View style={[styles.card, { width: cardSize, height: cardH }]} />
        </View>

        {/* ringside panel */}
        <View style={styles.panel}>
          <View style={[styles.bar, styles.panelKicker]} />
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.statRow}>
              <View style={[styles.bar, styles.statVal]} />
              <View style={[styles.bar, styles.statTrack]} />
              <View style={[styles.bar, styles.statLabel]} />
              <View style={[styles.bar, styles.statTrack]} />
              <View style={[styles.bar, styles.statVal]} />
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const FILL = 'rgba(245,235,220,0.09)';

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: COLORS.deepNavy,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  inner: { width: '100%', maxWidth: 520, alignItems: 'center' },
  bar: { backgroundColor: FILL, borderRadius: 6 },
  eyebrow: { width: 120, height: 12, marginBottom: 12 },
  title: { width: 260, height: 30, borderRadius: 8, marginBottom: 18 },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 460,
    marginBottom: 26,
  },
  score: { width: 44, height: 30 },
  meter: { flex: 1, height: 26, borderRadius: 13 },
  spots: { flexDirection: 'row', gap: 16, marginBottom: 22 },
  card: { backgroundColor: FILL, borderRadius: 14 },
  panel: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.08)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  panelKicker: { width: 90, height: 10, marginBottom: 16 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  statVal: { width: 24, height: 11 },
  statTrack: { flex: 1, height: 9, borderRadius: 5 },
  statLabel: { width: 34, height: 10 },
});
