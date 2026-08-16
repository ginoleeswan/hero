// src/components/ui/RadialBloom.tsx — a soft accent bloom, as a real gradient.
//
// Web paints its atmospheric orbs with `radial-gradient(circle, …)`. Native has
// no such thing in a style, and the two obvious substitutes both fail visibly:
// a flat `backgroundColor` disc stops at a hard edge, and stacking three
// translucent discs leaves seams where they meet (DailyGame's `GLOW` comment
// records that experiment). `react-native-svg`'s RadialGradient is a real
// gradient on every platform, so the bloom fades to nothing.
//
// Static by design. SpotlightGlow does the same thing with a crossfade for the
// deck, and its machinery — two stacked <Svg> layers, separate gradient ids,
// opacity driven on the wrapping view because <Stop> has no host instance — is
// the price of animating. Nothing here animates, so none of that applies.
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export function RadialBloom({
  color,
  size,
  /** Peak opacity at the centre, fading to 0 at the edge. */
  opacity = 0.35,
  style,
}: {
  color: string;
  size: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  // Two <Defs> sharing an id in one native SVG tree collide and one silently
  // wins, so each instance takes its own — the same trap SpotlightGlow hit.
  // useId, not a module counter: a counter incremented during render is state
  // mutated outside React, which double-invoking in StrictMode desynchronises
  // and the hooks lint rejects outright.
  const id = `bloom${useId().replace(/:/g, '')}`;
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.7" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export const bloomStyles = StyleSheet.create({
  absolute: { position: 'absolute' },
});
