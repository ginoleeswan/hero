// One actionable line on the "Needs attention" board — a count, what it means,
// and a tap that deep-links to the lane that can clear it. Sits inside a Well.
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../../constants/colors';

export function AttentionRow({
  icon,
  tint,
  count,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  count: number | string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.icon, { backgroundColor: tint + '1a' }]}>
        <Ionicons name={icon} size={15} color={tint} />
      </View>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={14} color="rgba(41,60,67,0.3)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // paddingVertical 8 + 28px icon = 44pt tap target.
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  icon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  count: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.black,
    minWidth: 30,
    fontVariant: ['tabular-nums'],
  },
  label: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
});
