import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/** Single shared animation value — call once per skeleton screen so all blocks pulse in sync. */
export function useSkeletonAnim() {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return opacity;
}

interface SkeletonBlockProps {
  opacity: Animated.Value;
  width?: number | string;
  height: number;
  borderRadius?: number;
  /** Use on dark (navy) backgrounds — renders a light translucent block instead. */
  dark?: boolean;
  style?: object;
}

/** A single pulsing rectangle. Pass the shared opacity from useSkeletonAnim(). */
export function SkeletonBlock({
  opacity,
  width = '100%',
  height,
  borderRadius = 6,
  dark = false,
  style,
}: SkeletonBlockProps) {
  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: dark ? 'rgba(245,235,220,0.15)' : '#ddd5c8',
          opacity,
        },
        style,
      ]}
    />
  );
}
