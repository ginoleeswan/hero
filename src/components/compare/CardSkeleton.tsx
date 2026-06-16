import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

/**
 * A pulsing placeholder tile matching OpponentCard's shape. A soft highlight
 * sweeps across (left → right) and a faint bar hints at the card's name label,
 * so the loading grid reads as the real roster forming rather than dead boxes.
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
  const [measured, setMeasured] = useState(typeof width === 'number' ? width : 0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (!measured) return;
    x.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(x);
  }, [measured, x]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -measured + x.value * measured * 2 }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== measured) setMeasured(w);
  };

  return (
    <View
      onLayout={fill ? onLayout : undefined}
      style={[styles.base, fill ? (styles.fill as object) : { width, height }]}
    >
      <View style={styles.nameBar} />
      {measured > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { width: measured }, sweepStyle]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(245,235,220,0.10)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#223843',
  },
  fill: { width: '100%', height: '100%' },
  nameBar: {
    position: 'absolute',
    bottom: 11,
    left: 11,
    width: '52%',
    height: 9,
    borderRadius: 4,
    backgroundColor: 'rgba(245,235,220,0.10)',
  },
});
