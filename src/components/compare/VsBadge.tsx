import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

interface VsBadgeProps {
  size?: number;
}

/**
 * Comic book starburst VS badge.
 * Yellow/gold 12-point starburst polygon behind white "VS" text with black outline.
 * Decorative mini lightning bolts (×2) and stars (×4) scatter around the burst.
 */
export function VsBadge({ size = 80 }: VsBadgeProps) {
  const R = size / 2;
  const r = R * 0.62;
  const cx = R;
  const cy = R;
  const points = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * 15 - 90) * (Math.PI / 180);
    const radius = i % 2 === 0 ? R : r;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(' ');

  return (
    <View style={[styles.container, { width: size + 40, height: size + 40 }]}>
      <View style={styles.burst}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Polygon points={points} fill="rgba(255,213,79,0.3)" scale={1.15} origin={`${R},${R}`} />
          <Polygon points={points} fill="#f5a623" stroke="#1a1a1a" strokeWidth={2} />
          <Polygon points={points} fill="#ffe066" scale={0.7} origin={`${R},${R}`} />
        </Svg>
        <View style={styles.vsTextWrap} pointerEvents="none">
          <Text style={styles.vsText}>VS</Text>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  burst: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsTextWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: '#1a1a1a',
    letterSpacing: 2,
  },
});
