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
 * Holds the verdict slot. While the AI verdict is generating it shows a quiet
 * pulsing skeleton (no throwaway placeholder copy), then crossfades the quote
 * in once it arrives — one voice, no text-swap jump.
 *
 * `tone="light"` (default) for the navy header; `tone="dark"` for the beige
 * scorecard on the web arena.
 */
export function VerdictReveal({
  verdict,
  tone = 'light',
}: {
  verdict: string | null;
  tone?: 'light' | 'dark';
}) {
  const pulse = useSharedValue(0.35);
  const dark = tone === 'dark';

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.85, { duration: 760, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const skeletonStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (verdict) {
    return (
      <Animated.Text
        entering={FadeIn.duration(450)}
        style={[styles.verdict, dark && styles.verdictDark]}
      >
        {`“${verdict}”`}
      </Animated.Text>
    );
  }

  return (
    <Animated.View style={[styles.skeleton, skeletonStyle]} accessibilityLabel="Generating verdict">
      <View style={[styles.line, dark && styles.lineDark, styles.lineWide]} />
      <View style={[styles.line, dark && styles.lineDark, styles.lineNarrow]} />
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
  verdictDark: { color: COLORS.navy },
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
  lineDark: { backgroundColor: 'rgba(41,60,67,0.14)' },
  lineWide: { width: '82%' },
  lineNarrow: { width: '54%' },
});
