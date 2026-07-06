// src/components/ui/CardTexture.tsx — native (react-native-svg) twin of
// src/constants/cardTexture.ts: the warm top glow + edge-framed halftone field
// drawn over the poster's gradient and under its content. Absolute-fills its
// parent; pass the card's pixel size.
import Svg, { Rect, Defs, RadialGradient, Stop, Pattern, Circle, Mask, G } from 'react-native-svg';
import { StyleSheet } from 'react-native';
import { TEXTURE } from '../../constants/cardTexture';

export function CardTexture({
  size,
  glow = TEXTURE.glowColor,
}: {
  size: number;
  glow?: string;
}) {
  const t = TEXTURE.dotTile;
  const c = t / 2;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="10%" r="72%">
          <Stop offset="0%" stopColor={glow} stopOpacity={TEXTURE.glowOpacity} />
          <Stop offset="60%" stopColor={glow} stopOpacity={0} />
        </RadialGradient>
        <Pattern id="dots" width={t} height={t} patternUnits="userSpaceOnUse">
          <Circle cx={c} cy={c} r={TEXTURE.dotRadius} fill={TEXTURE.dotColor} />
        </Pattern>
        <RadialGradient id="edge" cx="50%" cy="42%" r="75%">
          <Stop offset="34%" stopColor="#000" />
          <Stop offset="100%" stopColor="#fff" />
        </RadialGradient>
        <Mask id="frame">
          <Rect width={size} height={size} fill="url(#edge)" />
        </Mask>
      </Defs>
      <Rect width={size} height={size} fill="url(#glow)" />
      <G mask="url(#frame)">
        <Rect width={size} height={size} fill="url(#dots)" opacity={TEXTURE.dotOpacity} />
      </G>
    </Svg>
  );
}
