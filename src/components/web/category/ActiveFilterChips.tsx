import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import {
  type CategoryFilters, type FacetKey, activeFilterList, DEFAULT_FILTERS,
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
          style={s.chip as object}
        >
          <Text style={s.text as object}>{c.label}</Text>
          <Text style={s.x as object}>×</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' } as object,
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 28,
    paddingHorizontal: 10, borderRadius: 14,
    backgroundColor: 'rgba(231,115,51,0.18)', borderWidth: 1, borderColor: 'rgba(231,115,51,0.4)', cursor: 'pointer',
  } as object,
  text: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange } as object,
  x: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.orange, lineHeight: 15 } as object,
});
