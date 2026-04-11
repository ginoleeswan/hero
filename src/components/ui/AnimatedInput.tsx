import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '../constants/colors';

type Props = {
  isFocused: boolean;
  children: React.ReactNode;
};

export function AnimatedInput({ isFocused, children }: Props) {
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.012 : 1, { damping: 16, stiffness: 180 });
    shadowOpacity.value = withTiming(isFocused ? 0.18 : 0, { duration: 220 });
  }, [isFocused, scale, shadowOpacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: shadowOpacity.value,
    shadowRadius: 10,
  }));

  return <Animated.View style={animStyle}>{children}</Animated.View>;
}
