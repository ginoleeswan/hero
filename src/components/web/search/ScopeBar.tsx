import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, INK_TEXT } from '../../../constants/colors';

export type SearchScope = 'all' | 'characters' | 'teams' | 'films' | 'universes';

export const SEARCH_SCOPES: { key: SearchScope; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'characters', label: 'Characters' },
  { key: 'teams', label: 'Teams' },
  { key: 'films', label: 'Films' },
  { key: 'universes', label: 'Universes' },
];

// Segmented scope filter — narrow the palette to one type. Cycle with Tab
// (handled by the palette). The active pill carries a warm tint.
export function ScopeBar({
  scope,
  onScope,
}: {
  scope: SearchScope;
  onScope: (s: SearchScope) => void;
}) {
  return (
    <View style={styles.bar as object}>
      {SEARCH_SCOPES.map((s) => {
        const active = s.key === scope;
        return (
          <Pressable
            key={s.key}
            onPress={() => onScope(s.key)}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [
                styles.pill,
                active && (styles.pillActive as object),
                !active && hovered && (styles.pillHover as object),
              ] as object
            }
          >
            <Text style={[styles.label, active && (styles.labelActive as object)] as object}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.08)',
  } as object,
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  pillActive: { backgroundColor: 'rgba(231,115,51,0.18)' } as object,
  pillHover: { backgroundColor: 'rgba(245,235,220,0.06)' } as object,
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: INK_TEXT.faint,
    letterSpacing: 0.2,
  } as object,
  labelActive: { color: COLORS.orange } as object,
});
