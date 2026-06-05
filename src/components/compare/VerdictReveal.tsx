import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';

/**
 * Holds the verdict slot in the navy header.
 * While the AI verdict is generating it shows a quiet pulsing skeleton (no
 * throwaway placeholder copy), then crossfades the quote in once it arrives —
 * one voice, no text-swap jump.
 */
export function VerdictReveal({ verdict }: { verdict: string | null }) {
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.85, { duration: 760, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const skeletonStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (verdict) {
    return (
      <Animated.Text entering={FadeIn.duration(450)} style={styles.verdict}>
        {`“${verdict}”`}
      </Animated.Text>
    );
  }

  return (
    <Animated.View
      style={[styles.skeleton, skeletonStyle]}
      accessibilityLabel="Generating verdict"
    >
      <View style={[styles.line, styles.lineWide]} />
      <View style={[styles.line, styles.lineNarrow]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  verdict: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    color: COLORS.beige,
    textAlign: 'center',
    lineHeight: 24,
  },
  skeleton: {
    width: '100%',
    alignItems: 'center',
    gap: 11,
    paddingTop: 4,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(245,235,220,0.16)',
  },
  lineWide: { width: '82%' },
  lineNarrow: { width: '54%' },
});
