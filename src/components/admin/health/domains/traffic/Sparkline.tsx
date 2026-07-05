// Tiny inline trend line for a KPI tile — area + stroke, min/max-scaled so the
// shape reads even for small deltas. Fixed-size (no layout measuring) so it drops
// straight into a tile row.
import { View } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';

export function Sparkline({
  values,
  color,
  width = 74,
  height = 26,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pad = 2;
  const xOf = (i: number) => (i / (values.length - 1)) * (width - pad * 2) + pad;
  const yOf = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const line = values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  const area =
    `M${xOf(0).toFixed(1)},${height} ` +
    values.map((v, i) => `L${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ') +
    ` L${xOf(values.length - 1).toFixed(1)},${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Path d={area} fill={color + '22'} />
      <Polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
