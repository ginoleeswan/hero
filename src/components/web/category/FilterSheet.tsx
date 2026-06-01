import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import type { CategoryFilters, FacetCounts } from '../../../lib/db/categoryFilters';
import { FilterControls } from './FilterControls';

interface Props {
  open: boolean;
  slug: CategorySlug;
  filters: CategoryFilters;
  counts: FacetCounts | null;
  setFilter: <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;
  onReset: () => void;
  onClose: () => void;
  total: number;
}

export function FilterSheet({ open, slug, filters, counts, setFilter, onReset, onClose, total }: Props) {
  if (!open) return null;
  return (
    <View style={s.overlay as object}>
      <Pressable style={s.scrim as object} onPress={onClose} />
      <View style={s.sheet as object}>
        <View style={s.grab as object} />
        <View style={s.header}>
          <Text style={s.title as object}>Filters</Text>
          <Pressable onPress={onReset}><Text style={s.clearText as object}>Clear all</Text></Pressable>
        </View>
        <ScrollView style={s.body} contentContainerStyle={s.bodyContent as object}>
          <FilterControls slug={slug} filters={filters} counts={counts} setFilter={setFilter} />
        </ScrollView>
        <Pressable onPress={onClose} style={s.apply as object}>
          <Text style={s.applyText as object}>Show {total.toLocaleString()} result{total !== 1 ? 's' : ''}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, justifyContent: 'flex-end' } as object,
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' } as object,
  sheet: {
    backgroundColor: COLORS.navy, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, maxHeight: '80%', gap: 14,
  } as object,
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(245,235,220,0.25)' } as object,
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.beige } as object,
  clearText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange } as object,
  body: { flexGrow: 0 },
  bodyContent: { paddingVertical: 4 } as object,
  apply: { height: 48, borderRadius: 12, backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as object,
  applyText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff' } as object,
});
