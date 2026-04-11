import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';

type Props = {
  isFocused: boolean;
  children: React.ReactNode;
};

export function AnimatedInput({ isFocused, children }: Props) {
  const shadowOpacity = useSharedValue(0);

  useEffect(() => {
    shadowOpacity.value = withTiming(isFocused ? 0.22 : 0, { duration: 200 });
  }, [isFocused, shadowOpacity]);

  const animStyle = useAnimatedStyle(() => ({
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: shadowOpacity.value,
    shadowRadius: 12,
    elevation: isFocused ? 4 : 0,
  }));

  return <Animated.View style={animStyle}>{children}</Animated.View>;
}
