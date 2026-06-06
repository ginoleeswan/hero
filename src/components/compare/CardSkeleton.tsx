import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

/**
 * A single pulsing placeholder tile, matching OpponentCard's shape and skeleton
 * tone. Used to fill the picker grid while the roster loads — a skeleton screen
 * reads as faster than a spinner and holds the layout so cards swap in place.
 */
export function CardSkeleton({
  width,
  height,
  fill,
}: {
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  const pulse = useSharedValue(0.6);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 750 }), withTiming(0.6, { duration: 750 })),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        styles.base,
        fill ? (styles.fill as object) : { width, height },
        pulseStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(150deg, #20323a 0%, #2a3f48 50%, #20323a 100%)',
      } as object,
      default: { backgroundColor: '#26393f' },
    }),
  },
  fill: { width: '100%', height: '100%' },
});
