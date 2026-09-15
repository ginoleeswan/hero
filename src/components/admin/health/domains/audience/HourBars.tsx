// "When do they come" — a compact column chart of visitors per hour of day (or
// per weekday). Pure layout: 24 (or 7) equal columns, the tallest at full
// height, labels every few columns so the phone width stays readable.
import { View, StyleSheet } from 'react-native';
import { Text } from '../../../../ui/Text';
import { COLORS } from '../../../../../constants/colors';

export function HourBars({
  values,
  labels,
  labelEvery = 1,
  height = 72,
  tint = COLORS.blue,
}: {
  values: number[];
  labels: string[];
  labelEvery?: number;
  height?: number;
  tint?: string;
}) {
  const max = Math.max(1, ...values);
  const peak = values.indexOf(max);
  return (
    <View style={s.wrap}>
      <View style={[s.bars, { height }]}>
        {values.map((v, i) => (
          <View key={i} style={s.col}>
            <View
              style={[
                s.bar,
                { height: `${Math.max(v > 0 ? 6 : 2, Math.round((v / max) * 100))}%` },
                { backgroundColor: i === peak && v > 0 ? COLORS.orange : tint },
                v === 0 && s.barEmpty,
              ]}
            />
          </View>
        ))}
      </View>
      <View style={s.labels}>
        {labels.map((l, i) => (
          <Text key={i} style={s.label} numberOfLines={1}>
            {i % labelEvery === 0 ? l : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 4 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  barEmpty: { backgroundColor: 'rgba(41,60,67,0.12)' },
  labels: { flexDirection: 'row', gap: 3 },
  label: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 9,
    color: COLORS.grey,
    textAlign: 'center',
  },
});
