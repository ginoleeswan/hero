import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface PressScaleProps {
  onPress?: () => void;
  onLongPress?: () => void;
  scale?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  children: React.ReactNode;
}

export function PressScale({
  onPress,
  onLongPress,
  scale = 0.95,
  style,
  disabled = false,
  children,
}: PressScaleProps) {
  const pressed = useSharedValue(false);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(pressed.value ? scale : 1, {
          damping: 18,
          stiffness: 250,
          mass: 0.6,
        }),
      },
    ],
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        pressed.value = true;
      }}
      onPressOut={() => {
        pressed.value = false;
      }}
      disabled={disabled}
      activeOpacity={1}
      style={style}
    >
      <Animated.View style={[{ flex: 1 }, scaleStyle]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}
