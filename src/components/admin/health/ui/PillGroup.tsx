// Segmented pill selector for small option sets (batch size, cron cadence).
// `inset` = a beige track whose selected pill turns white (the batch selector);
// `solid` = free-standing beige pills whose selected one turns navy (cron editor).
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { Text } from '../../../ui/Text';
import { COLORS } from '../../../../constants/colors';

export interface PillOption<T> {
  label: string;
  value: T;
}

export function PillGroup<T extends string | number>({
  options,
  value,
  onChange,
  variant = 'inset',
  style,
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (v: T) => void;
  variant?: 'inset' | 'solid';
  style?: ViewStyle | ViewStyle[];
}) {
  const inset = variant === 'inset';
  return (
    <View style={[inset ? styles.track : styles.solidRow, style as ViewStyle]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[
              inset ? styles.insetPill : styles.solidPill,
              on && (inset ? styles.insetOn : styles.solidOn),
            ]}
          >
            <Text
              style={[
                inset ? styles.insetText : styles.solidText,
                on && (inset ? styles.insetTextOn : styles.solidTextOn),
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // inset
  track: { flexDirection: 'row', backgroundColor: '#efe6d6', borderRadius: 10, padding: 3 },
  insetPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  insetOn: { backgroundColor: '#fff' },
  insetText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },
  insetTextOn: { color: COLORS.navy },
  // solid
  solidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  solidPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#efe6d6',
  },
  solidOn: { backgroundColor: COLORS.navy },
  solidText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  solidTextOn: { color: '#fff' },
});
