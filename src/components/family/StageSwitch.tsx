// src/components/family/StageSwitch.tsx
// Two looks at one house: the line of one person, or the whole ladder. A switch
// rather than two stacked sections — they answer one question at two scales.
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { STAGE_SWITCH } from '../../constants/houseGeometry';

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
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
              [
                styles.option,
                active && styles.optionActive,
                hovered && !active && (styles.optionHover as object),
                pressed && styles.pressed,
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
  pressed: { opacity: 0.6 },
  track: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 4,
    padding: STAGE_SWITCH.trackPadding,
    borderRadius: 999,
    borderWidth: STAGE_SWITCH.trackBorder,
    borderColor: '#eadfcb',
    backgroundColor: '#fffaf0',
    flexWrap: 'wrap',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingVertical: STAGE_SWITCH.optionPaddingVertical,
    paddingHorizontal: 13,
    cursor: 'pointer',
  } as object,
  optionHover: { backgroundColor: '#f2e7d2' } as object,
  optionActive: { backgroundColor: COLORS.navy },
  // Explicit line box: the skeleton has to know this control's height, and left
  // implicit it was whatever Nunito's own metrics gave.
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    lineHeight: STAGE_SWITCH.labelLine,
    color: '#8d8375',
  },
  labelActive: { color: '#fdf6e8' },
});
