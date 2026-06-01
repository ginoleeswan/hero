import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  activeCount: number;
  searchPlaceholder: string;
}

export function FilterRail({
  slug, filters, counts, setFilter, onReset, hasActive, activeCount, searchPlaceholder,
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.rail as object}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.titleWrap}>
          <Text style={s.title as object}>Filters</Text>
          {activeCount > 0 && (
            <View style={s.badge as object}>
              <Text style={s.badgeText as object}>{activeCount}</Text>
            </View>
          )}
        </View>
        {hasActive && (
          <Pressable
            onPress={onReset}
            style={({ hovered }: { hovered?: boolean }) => [s.clear, hovered && (s.clearHover as object)] as object}
          >
            <Text style={s.clearText as object}>Clear all</Text>
          </Pressable>
        )}
      </View>

      <View style={s.divider as object} />

      {/* Search — integrated into the control surface */}
      <View style={[s.search, focused && (s.searchFocused as object)] as object}>
        <Ionicons name="search" size={15} color={focused ? COLORS.orange : 'rgba(245,235,220,0.4)'} />
        <TextInput
          style={s.searchInput as object}
          placeholder={searchPlaceholder}
          placeholderTextColor="rgba(245,235,220,0.32)"
          value={filters.search}
          onChangeText={(t) => setFilter('search', t)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
        />
        {filters.search.length > 0 && (
          <Pressable onPress={() => setFilter('search', '')} style={s.clearX as object}>
            <Ionicons name="close-circle" size={15} color="rgba(245,235,220,0.4)" />
          </Pressable>
        )}
      </View>

      <ScrollView style={s.scroll as object} scrollEnabled nestedScrollEnabled>
        <FilterControls slug={slug} filters={filters} counts={counts} setFilter={setFilter} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  rail: {
    width: 256, flexShrink: 0, alignSelf: 'flex-start',
    position: 'sticky', top: 120,
    backgroundImage: 'linear-gradient(180deg, rgba(48,69,77,0.96) 0%, rgba(32,47,54,0.98) 100%)',
    backgroundColor: COLORS.navy,
    borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(245,235,220,0.09)',
    boxShadow: '0 30px 60px -30px rgba(0,0,0,0.65)',
    display: 'flex', flexDirection: 'column', maxHeight: '70vh',
  } as object,
  scroll: {
    flex: 1, paddingHorizontal: 20, paddingVertical: 16,
    overflowY: 'auto',
  } as object,
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { fontFamily: 'Flame-Regular', fontSize: 19, color: COLORS.beige, lineHeight: 22 } as object,
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: COLORS.orange, alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px -1px rgba(231,115,51,0.6)',
  } as object,
  badgeText: { fontFamily: 'Nunito_900Black', fontSize: 11, color: '#fff' } as object,
  clear: { cursor: 'pointer', transition: 'opacity 150ms ease' } as object,
  clearHover: { opacity: 0.6 } as object,
  clearText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange, letterSpacing: 0.2 } as object,

  divider: { height: 1, backgroundColor: 'rgba(245,235,220,0.08)', marginHorizontal: -20, marginVertical: 16 } as object,

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    height: 40, paddingHorizontal: 12, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1, borderColor: 'rgba(245,235,220,0.1)',
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
    marginHorizontal: 20, marginBottom: 4,
  } as object,
  searchFocused: {
    borderColor: 'rgba(231,115,51,0.7)',
    boxShadow: '0 0 0 3px rgba(231,115,51,0.12)',
  } as object,
  searchInput: {
    flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 13.5,
    color: COLORS.beige, outlineStyle: 'none', outlineWidth: 0,
  } as object,
  clearX: { cursor: 'pointer' } as object,
});
