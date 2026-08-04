// src/components/ui/FloatingBackButton.tsx — a back chevron that doesn't need
// a native header.
//
// Exists because of an iOS 26 behaviour: every screen that HAS a header gets a
// `UIScrollEdgeEffect` over its content ScrollView — a light blur band under
// the header items, on by default (`automatic`). Over a flat dark top it reads
// as a grey scrim across the status bar. The surgical fix,
// `scrollEdgeEffects: { top: 'hidden' }`, is not reachable through
// expo-router's Stack options, and react-native-screens' `<ScrollViewMarker>`
// is a Fabric native component that renders an empty view on any build
// predating it — so it can't be shipped over the air.
//
// A screen whose header carries nothing but a back chevron can simply not have
// a header. This is that chevron. Screens with a `Stack.SearchBar` or a
// `headerRight` still need the real thing.
//
// It carries its own ink disc rather than relying on the surface behind it, so
// one control stays legible over a dark stage and over the beige body it floats
// above once scrolled.
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

export function FloatingBackButton({
  /** Defaults to `router.back()`. */
  onPress,
  /** Extra offset below the safe-area inset. */
  topOffset = 6,
  style,
}: {
  onPress?: () => void;
  topOffset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => [
        styles.back,
        { top: insets.top + topOffset },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name="chevron-back" size={22} color={COLORS.beige} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    position: 'absolute',
    left: 14,
    // 40 is the floor that still reads as a comfortable target with hitSlop on
    // top; the native chevron's own tap area is about the same.
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,24,32,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.22)',
    zIndex: 10,
  },
  pressed: { opacity: 0.7 },
});
