import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

interface StatBarProps {
  label: string;
  value: string;
  color: string;
}

export function StatBar({ label, value, color }: StatBarProps) {
  const numeric = parseInt(value, 10);
  const fill = isNaN(numeric) ? 0 : Math.min(numeric, 100);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>{numeric}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${fill}%` as unknown as number, backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
  },
  track: {
    height: 8,
    backgroundColor: '#e8ddd0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%' as unknown as number,
    borderRadius: 4,
  },
});
