import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import type { CategoryFilters, FacetCounts } from '../../../lib/db/categoryFilters';
import { FilterControls } from './FilterControls';

interface Props {
  slug: CategorySlug;
  filters: CategoryFilters;
  counts: FacetCounts | null;
  setFilter: <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;
  onReset: () => void;
  hasActive: boolean;
}

export function FilterRail({ slug, filters, counts, setFilter, onReset, hasActive }: Props) {
  return (
    <View style={s.rail as object}>
      <View style={s.header}>
        <Text style={s.title as object}>Filters</Text>
        {hasActive && (
          <Pressable onPress={onReset} style={s.clear as object}>
            <Text style={s.clearText as object}>Clear all</Text>
          </Pressable>
        )}
      </View>
      <FilterControls slug={slug} filters={filters} counts={counts} setFilter={setFilter} />
    </View>
  );
}

const s = StyleSheet.create({
  rail: {
    width: 240, flexShrink: 0, alignSelf: 'flex-start',
    position: 'sticky', top: 200,
    backgroundColor: COLORS.navy, borderRadius: 14,
    padding: 18, gap: 18,
  } as object,
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.beige } as object,
  clear: { cursor: 'pointer' } as object,
  clearText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange } as object,
});
