import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';

interface DotGridProps {
  color?: string;
  spacing?: number;
  radius?: number;
}

export function DotGrid({
  color = 'rgba(245,235,220,0.07)',
  spacing = 24,
  radius = 1.5,
}: DotGridProps) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id="dotgrid"
          x="0"
          y="0"
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
        >
          <Circle cx={radius} cy={radius} r={radius} fill={color} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#dotgrid)" />
    </Svg>
  );
}
