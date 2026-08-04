import { useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../../constants/colors';
import type { CategorySlug } from '../../../lib/db/heroes';
import type { CategoryFilters, FacetCounts } from '../../../lib/db/categoryFilters';
import { FilterControls } from './FilterControls';

interface Props {
  slug: CategorySlug | null;
  filters: CategoryFilters;
  counts: FacetCounts | null;
  setFilter: <K extends keyof CategoryFilters>(k: K, v: CategoryFilters[K]) => void;
  onReset: () => void;
  hasActive: boolean;
  activeCount: number;
  searchPlaceholder: string;
}

export function FilterRail({
  slug,
  filters,
  counts,
  setFilter,
  onReset,
  hasActive,
  activeCount,
  searchPlaceholder,
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
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [s.clear, hovered && (s.clearHover as object)] as object
            }
          >
            <Text style={s.clearText as object}>Clear all</Text>
          </Pressable>
        )}
      </View>

      <View style={s.divider as object} />

      {/* Search — integrated into the control surface */}
      <View style={[s.search, focused && (s.searchFocused as object)] as object}>
        <Ionicons
          name="search"
          size={15}
          color={focused ? COLORS.orange : 'rgba(245,235,220,0.4)'}
        />
        <TextInput
          style={s.searchInput as object}
          placeholder={searchPlaceholder}
          placeholderTextColor={INK_TEXT.placeholder}
          value={filters.search}
          onChangeText={(t) => setFilter('search', t)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
        />
        {filters.search.length > 0 && (
          <Pressable
            onPress={() => setFilter('search', '')}
            style={s.clearX as object}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
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
    width: 256,
    flexShrink: 0,
    alignSelf: 'flex-start',
    position: 'sticky',
    // Clear the sticky category header (~120px tall) with a 16px gap so the rail
    // doesn't kiss the header edge when scrolled.
    top: 136,
    backgroundImage: 'linear-gradient(180deg, rgba(48,69,77,0.96) 0%, rgba(32,47,54,0.98) 100%)',
    backgroundColor: COLORS.navy,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.09)',
    boxShadow: '0 30px 60px -30px rgba(0,0,0,0.65)',
    display: 'flex',
    flexDirection: 'column',
  } as object,
  // The rail itself hugs its content (no fixed/min height, so short filter sets
  // don't leave a dead navy void). Only the scrollable control area is capped —
  // to the space below the sticky top (136) — so a long, expanded list scrolls
  // internally instead of running off-screen.
  scroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: 'calc(100dvh - 300px)',
    overflowY: 'auto',
    scrollbarWidth: 'none', // no desktop scrollbar chrome on mobile web
  } as object,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 19,
    color: COLORS.beige,
    lineHeight: 22,
  } as object,
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px -1px rgba(231,115,51,0.6)',
  } as object,
  badgeText: { fontFamily: 'Nunito_900Black', fontSize: 11, color: '#fff' } as object,
  clear: { cursor: 'pointer', transition: 'opacity 150ms ease' } as object,
  clearHover: { opacity: 0.6 } as object,
  clearText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
    letterSpacing: 0.2,
  } as object,

  divider: {
    height: 1,
    backgroundColor: 'rgba(245,235,220,0.08)',
    // Full rail width (flush to the inner border). The rail has no horizontal
    // padding, so a negative margin here would overflow past the rounded edge.
    marginVertical: 16,
  } as object,

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
    marginHorizontal: 20,
    marginBottom: 4,
    overflow: 'hidden', // clip a long placeholder instead of letting it bleed past the border
  } as object,
  searchFocused: {
    borderColor: 'rgba(231,115,51,0.7)',
    boxShadow: '0 0 0 3px rgba(231,115,51,0.12)',
  } as object,
  searchInput: {
    flex: 1,
    minWidth: 0, // let the field shrink within the rail instead of pushing past it
    fontFamily: 'Nunito_400Regular',
    fontSize: 16, // ≥16: iOS zooms on focus below this
    color: COLORS.beige,
    outlineStyle: 'none',
    outlineWidth: 0,
  } as object,
  clearX: { cursor: 'pointer' } as object,
});
