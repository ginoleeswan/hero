// src/components/family/StageSwitch.tsx
// Two looks at one house: the line of one person, or the whole ladder.
//
// A switch rather than two stacked sections, because they answer the same
// question at two scales and stacking them would make the page twice as long to
// say one thing twice.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

export type StageView = 'line' | 'house';

const OPTIONS: {
  value: StageView;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { value: 'line', label: 'The line', icon: 'file-tree-outline' },
  { value: 'house', label: 'Every generation', icon: 'format-list-group' },
];

export function StageSwitch({
  value,
  onChange,
}: {
  value: StageView;
  onChange: (next: StageView) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [
                styles.option,
                active && styles.optionActive,
                hovered && !active && (styles.optionHover as object),
              ] as object
            }
          >
            <MaterialCommunityIcons
              name={option.icon}
              size={15}
              color={active ? '#fdf6e8' : '#8d8375'}
            />
            <Text style={[styles.label, active && styles.labelActive] as object}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 4,
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#eadfcb',
    backgroundColor: '#fffaf0',
    flexWrap: 'wrap',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
    cursor: 'pointer',
  } as object,
  optionHover: { backgroundColor: '#f2e7d2' } as object,
  optionActive: { backgroundColor: COLORS.navy },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: '#8d8375' },
  labelActive: { color: '#fdf6e8' },
});
