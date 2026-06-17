// Boxed KPI tile — a big tinted value over a label, flexing to fill a row.
// Shared by the run-history summary and any domain that needs headline numbers.
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { COLORS } from '../../../../constants/colors';

export function StatTile({
  label,
  value,
  tint = COLORS.navy,
  style,
}: {
  label: string;
  value: string;
  tint?: string;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <View style={[styles.tile, style as ViewStyle]}>
      <Text style={[styles.value, { color: tint }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 110,
    backgroundColor: '#faf6ee',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    gap: 2,
  },
  value: { fontFamily: 'Flame-Regular', fontSize: 24, lineHeight: 26 },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },
});
