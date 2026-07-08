// Boxed KPI tile — a big tinted value over a label, flexing to fill a row.
// Shared by the run-history summary and any domain that needs headline numbers.
import { View, Text, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
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
  // Mobile: a smaller basis so three tiles stay on one row (down to 375px-wide
  // phones) instead of wrapping 2-then-1; flexGrow still fills the row evenly.
  const narrow = useWindowDimensions().width < 760;
  return (
    <View style={[styles.tile, narrow && styles.tileNarrow, style as ViewStyle]}>
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
  // 3-up on mobile: 3×96 + 2×8 gap = 320 ≤ the ~315px tile area of a 375px phone.
  tileNarrow: { flexBasis: 96, minWidth: 88, paddingHorizontal: 11 },
  // Tabular figures so KPI rows don't shimmy as values tick.
  value: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },
});
