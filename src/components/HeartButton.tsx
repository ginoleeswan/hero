import React, { useCallback, useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

const BUTTON_SIZE = 52;
const RING_SIZE = 80;
const DOT_SIZE = 6;
const DOT_DISTANCE = 35;

const DOT_ANGLES = [0, 60, 120, 180, 240, 300].map((deg) => (deg * Math.PI) / 180);
const DOT_COLORS = [
  COLORS.red,
  COLORS.orange,
  COLORS.yellow,
  COLORS.blue,
  COLORS.green,
  COLORS.brown,
];

interface HeartButtonProps {
  favourited: boolean;
  loading: boolean;
  onPress: () => void;
}

function AnimatedRing({
  scale,
  opacity,
}: {
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

function AnimatedDot({
  translateX,
  translateY,
  opacity,
  color,
}: {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  opacity: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: opacity.value,
    backgroundColor: color,
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function HeartButton({ favourited, loading, onPress }: HeartButtonProps) {
  const userPressedRef = useRef(false);
  const heartScale = useSharedValue(1);

  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  // 6 dot shared values — declared individually (React hooks rules)
  const d0x = useSharedValue(0); const d0y = useSharedValue(0); const d0o = useSharedValue(0);
  const d1x = useSharedValue(0); const d1y = useSharedValue(0); const d1o = useSharedValue(0);
  const d2x = useSharedValue(0); const d2y = useSharedValue(0); const d2o = useSharedValue(0);
  const d3x = useSharedValue(0); const d3y = useSharedValue(0); const d3o = useSharedValue(0);
  const d4x = useSharedValue(0); const d4y = useSharedValue(0); const d4o = useSharedValue(0);
  const d5x = useSharedValue(0); const d5y = useSharedValue(0); const d5o = useSharedValue(0);

  const dots = [
    { x: d0x, y: d0y, o: d0o },
    { x: d1x, y: d1y, o: d1o },
    { x: d2x, y: d2y, o: d2o },
    { x: d3x, y: d3y, o: d3o },
    { x: d4x, y: d4y, o: d4o },
    { x: d5x, y: d5y, o: d5o },
  ];

  const handlePress = useCallback(() => {
    userPressedRef.current = true;
    onPress();
  }, [onPress]);

  useEffect(() => {
    if (!userPressedRef.current) return;
    userPressedRef.current = false;

    if (favourited) {
      // Heart pop: scale up then settle
      heartScale.value = withSequence(
        withSpring(1.4, { damping: 20, stiffness: 400, mass: 0.3 }),
        withSpring(1, { damping: 20, stiffness: 400, mass: 0.3 }),
      );

      // Ring: expand from centre and fade out
      ringScale.value = 0;
      ringOpacity.value = 1;
      ringScale.value = withTiming(1, { duration: 400 });
      ringOpacity.value = withSequence(
        withTiming(1, { duration: 50 }),
        withDelay(200, withTiming(0, { duration: 200 })),
      );

      // Dots: fly outward radially with stagger, then fade
      dots.forEach((dot, i) => {
        const tx = DOT_DISTANCE * Math.cos(DOT_ANGLES[i]);
        const ty = DOT_DISTANCE * Math.sin(DOT_ANGLES[i]);
        dot.x.value = 0;
        dot.y.value = 0;
        dot.o.value = 0;
        dot.x.value = withDelay(i * 15, withSpring(tx, { damping: 15 }));
        dot.y.value = withDelay(i * 15, withSpring(ty, { damping: 15 }));
        dot.o.value = withDelay(
          i * 15,
          withSequence(withTiming(1, { duration: 50 }), withDelay(200, withTiming(0, { duration: 200 }))),
        );
      });
    } else {
      // Soft deflate on unfavourite — no burst
      heartScale.value = withSequence(
        withSpring(0.8, { damping: 20, stiffness: 400, mass: 0.3 }),
        withSpring(1, { damping: 20, stiffness: 400, mass: 0.3 }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Reanimated shared values are stable refs — intentionally omitted from deps
  }, [favourited]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  return (
    <View style={styles.burstContainer}>
      <AnimatedRing scale={ringScale} opacity={ringOpacity} />

      {dots.map((dot, i) => (
        <AnimatedDot
          key={i}
          translateX={dot.x}
          translateY={dot.y}
          opacity={dot.o}
          color={DOT_COLORS[i]}
        />
      ))}

      <TouchableOpacity
        testID="heart-button"
        onPress={handlePress}
        disabled={loading}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.button}
      >
        <Animated.View style={heartStyle}>
          <Ionicons
            name={favourited ? 'heart' : 'heart-outline'}
            size={24}
            color={favourited ? COLORS.red : 'white'}
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  burstContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 3,
    borderColor: COLORS.red,
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
