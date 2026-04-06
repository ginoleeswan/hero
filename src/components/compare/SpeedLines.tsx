import { StyleSheet } from 'react-native';
import Svg, { Line, G } from 'react-native-svg';

interface SpeedLinesProps {
  /** 'left' = lines radiate from left outer edge center; 'right' = from right outer edge */
  side: 'left' | 'right';
  width: number;
  height: number;
  opacity?: number;
}

/**
 * Radial speed lines for one hero panel.
 * 'left': lines originate from (0, height/2) fanning rightward.
 * 'right': lines originate from (width, height/2) fanning leftward.
 */
export function SpeedLines({ side, width, height, opacity = 0.18 }: SpeedLinesProps) {
  const cx = side === 'left' ? 0 : width;
  const cy = height / 2;

  const lines = Array.from({ length: 24 }, (_, i) => {
    const angle = (-90 + i * (180 / 23)) * (Math.PI / 180);
    const length = Math.max(width, height) * 1.5;
    const dx = side === 'left' ? Math.cos(angle) * length : -Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    return { x2: cx + dx, y2: cy + dy };
  });

  const strokeWidths = [1.5, 1, 1.5, 0.8, 1.2, 1.5, 1, 0.8, 1.2, 1.5, 1, 1.5, 0.8,
                        1.2, 1.5, 1, 0.8, 1.2, 1.5, 1, 1.5, 0.8, 1.2, 1.5];

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={StyleSheet.absoluteFill}
    >
      <G opacity={opacity}>
        {lines.map((line, i) => (
          <Line
            key={i}
            x1={cx}
            y1={cy}
            x2={line.x2}
            y2={line.y2}
            stroke="white"
            strokeWidth={strokeWidths[i] ?? 1}
            strokeLinecap="round"
          />
        ))}
      </G>
    </Svg>
  );
}
