// src/components/search/FilterChips.tsx — Apple-style segmented filter row.
// Generic over a string-union value (used for both the publisher scope and the
// alignment facet). Lives on the dark search canvas.
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

export function FilterChips<T extends string>({
  value,
  options,
  onChange,
  idPrefix = 'chip',
}: {
  value: T;
  options: FilterOption<T>[];
  onChange: (v: T) => void;
  /** testID prefix → `${idPrefix}-${value}` per chip. */
  idPrefix?: string;
}) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            testID={`${idPrefix}-${opt.value}`}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(opt.value);
            }}
            style={[styles.seg, active && styles.segActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  seg: {
    paddingHorizontal: 14,
    height: 30,
    justifyContent: 'center',
    borderRadius: 15,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(245,235,220,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.14)',
  },
  segActive: { backgroundColor: COLORS.beige, borderColor: COLORS.beige },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.62)' },
  labelActive: { color: COLORS.navy },
});
