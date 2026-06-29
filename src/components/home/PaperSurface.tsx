// Beige "printed paper" surface for the native Library zone: a halftone ink-dot
// grid (react-native-svg) over beige so the canvas reads as comic stock, not a
// flat fill. The first beige section passes `lip` to get the rounded top + a
// whisper of top-light, forming the seam out of the dark stage above.
import type { ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';

export function PaperSurface({
  children,
  lip = false,
  style,
}: {
  children?: ReactNode;
  lip?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[lip ? s.lip : s.flat, style]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id="halftone" width={18} height={18} patternUnits="userSpaceOnUse">
            <Circle cx={2} cy={2} r={1.1} fill="rgba(41,60,67,0.09)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#halftone)" />
      </Svg>
      {lip && (
        <LinearGradient
          colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
          style={s.light}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  flat: { backgroundColor: COLORS.beige },
  lip: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  light: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
});
