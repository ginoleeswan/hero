import {
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
  type AccessibilityRole,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SPRING_PRESS } from '../../lib/nativeMotion';

interface PressScaleProps {
  onPress?: () => void;
  onLongPress?: () => void;
  scale?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Hold-off before the press registers, so a scroll-drag cancels it first.
   *  Most of these cards live in horizontal strips; without it onPressIn fires
   *  the instant a finger lands and the scale flickers while you scroll. */
  delayPressIn?: number;
  /** Accessibility + test props are forwarded: this is the app's standard
   *  tappable card, so a caller must never have to drop a label to adopt it. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  testID?: string;
  children: React.ReactNode;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function PressScale({
  onPress,
  onLongPress,
  scale = 0.95,
  style,
  disabled = false,
  delayPressIn = 120,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  testID,
  children,
}: PressScaleProps) {
  const pressed = useSharedValue(false);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(pressed.value ? scale : 1, SPRING_PRESS),
      },
    ],
  }));

  // One node holds both the caller's style and the children. The old shape
  // (style on the touchable, children in an inner view) silently dropped
  // layout props — a caller's flexDirection/gap/alignItems never reached the
  // children, so every row-styled consumer stacked vertically.
  return (
    <AnimatedTouchable
      onPress={onPress}
      onLongPress={onLongPress}
      delayPressIn={delayPressIn}
      onPressIn={() => {
        pressed.value = true;
      }}
      onPressOut={() => {
        pressed.value = false;
      }}
      disabled={disabled}
      activeOpacity={1}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      testID={testID}
      style={[style, scaleStyle]}
    >
      {children}
    </AnimatedTouchable>
  );
}
