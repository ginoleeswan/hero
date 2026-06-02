import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import {
  type CategoryFilters,
  type FacetKey,
  activeFilterList,
  DEFAULT_FILTERS,
} from '../../../lib/db/categoryFilters';

interface Props {
  slug: CategorySlug;
  filters: CategoryFilters;
  setFilter: <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;
}

const RESET_VALUE: Record<FacetKey, CategoryFilters[keyof CategoryFilters]> = {
  publisher: DEFAULT_FILTERS.publisher,
  alignment: DEFAULT_FILTERS.alignment,
  gender: DEFAULT_FILTERS.gender,
  hasStats: DEFAULT_FILTERS.hasStats,
};

export function ActiveFilterChips({ slug, filters, setFilter }: Props) {
  const chips = activeFilterList(slug, filters);
  if (chips.length === 0) return null;
  return (
    <View style={s.row as object}>
      {chips.map((c) => (
        <Pressable
          key={c.key}
          onPress={() => setFilter(c.key as FacetKey, RESET_VALUE[c.key as FacetKey] as never)}
          style={({ hovered }: { hovered?: boolean }) =>
            [s.chip, hovered && (s.chipHover as object)] as object
          }
        >
          <Text style={s.text as object}>{c.label}</Text>
          <Ionicons name="close" size={13} color={COLORS.orange} />
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' } as object,
  // Tuned for the light beige canvas: solid surface, navy text, orange accent.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingLeft: 12,
    paddingRight: 9,
    borderRadius: 15,
    backgroundColor: 'rgba(231,115,51,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.5)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease, border-color 150ms ease',
  } as object,
  chipHover: {
    backgroundColor: 'rgba(231,115,51,0.22)',
    borderColor: 'rgba(231,115,51,0.8)',
  } as object,
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: COLORS.navy,
    letterSpacing: 0.2,
  } as object,
});
