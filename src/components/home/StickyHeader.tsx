// src/components/home/StickyHeader.tsx
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';

export function StickyHeader({
  scrollY,
  revealAt,
  insetTop,
}: {
  scrollY: SharedValue<number>;
  revealAt: number; // scroll offset at which the bar is fully shown
  insetTop: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [revealAt - 80, revealAt], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [revealAt - 80, revealAt],
          [-8, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.bar, { paddingTop: insetTop }, style]}>
      <View style={styles.inner}>
        <Text style={styles.eyebrow}>Discover</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: COLORS.beige,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.12)',
  },
  inner: { height: 44, justifyContent: 'center', paddingHorizontal: 16 },
  eyebrow: { fontFamily: 'Flame-Bold', fontSize: 18, color: COLORS.navy },
});
