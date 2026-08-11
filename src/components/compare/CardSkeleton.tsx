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
  useReducedMotion,
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
  tone = 'dark',
}: {
  width?: number;
  height?: number;
  fill?: boolean;
  /** 'light' = soft ink tint for beige sheets (solid navy slabs read harsh there). */
  tone?: 'dark' | 'light';
}) {
  const [measured, setMeasured] = useState(typeof width === 'number' ? width : 0);
  const x = useSharedValue(0);
  // Under Reduce Motion the sweep is not slowed or parked, it is NOT DRAWN. A
  // travelling highlight held still is a bright band sitting at one edge of the
  // block, which reads as a rendering defect rather than as a placeholder.
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!measured || reduced) return;
    x.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    return () => cancelAnimation(x);
  }, [measured, x, reduced]);

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
      style={[
        styles.base,
        tone === 'light' && styles.baseLight,
        fill ? (styles.fill as object) : { width, height },
      ]}
    >
      <View style={[styles.nameBar, tone === 'light' && styles.nameBarLight]} />
      {measured > 0 && !reduced && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { width: measured }, sweepStyle]}
        >
          <LinearGradient
            colors={
              tone === 'light'
                ? ['transparent', 'rgba(255,255,255,0.45)', 'transparent']
                : ['transparent', 'rgba(245,235,220,0.10)', 'transparent']
            }
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
  baseLight: { backgroundColor: 'rgba(41,60,67,0.10)' },
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
  nameBarLight: { backgroundColor: 'rgba(41,60,67,0.14)' },
});
