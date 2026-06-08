// app/(tabs)/search/index.tsx — Search tab.
// • Native iOS search field in the tab bar (role="search" + Stack.SearchBar).
// • Filters: native Stack.Toolbar menus (Publisher + Alignment) on iOS; visible
//   FilterChips rows as the Android/web fallback.
// • Idle: recent searches (AsyncStorage) + Recently Viewed rail + Popular grid.
// • Search engine: alias-aware, typo-tolerant search_heroes RPC (see heroes.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { SearchBarCommands } from 'react-native-screens';
import { COLORS } from '../../../src/constants/colors';
import { PortraitCard } from '../../../src/components/search/PortraitCard';
import { FilterChips, type FilterOption } from '../../../src/components/search/FilterChips';
import { AccentRail } from '../../../src/components/search/AccentRail';
import { HeroPeek, type PeekHero } from '../../../src/components/compare/HeroPeek';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../../src/components/ui/SkeletonProvider';
import {
  searchHeroes,
  rankResults,
  getSearchIdleHeroes,
  filterHeroesByPublisher,
  filterHeroesByAlignment,
  type HeroSearchResult,
  type PublisherFilter,
  type AlignmentFilter,
} from '../../../src/lib/db/heroes';
import { getRecentlyViewed } from '../../../src/lib/db/viewHistory';
import { useAuth } from '../../../src/hooks/useAuth';
import { useRecentSearches } from '../../../src/hooks/useRecentSearches';
import type { FavouriteHero } from '../../../src/types';

const SEARCH_NAVY = '#1a262b';
const GRID_COLUMNS = 2;
const H_PAD = 16;
const GAP = 8;
const IS_IOS = Platform.OS === 'ios';

const PUBLISHER_OPTIONS: FilterOption<PublisherFilter>[] = [
  { value: 'All', label: 'All' },
  { value: 'Marvel', label: 'Marvel' },
  { value: 'DC', label: 'DC' },
  { value: 'Other', label: 'Other' },
];
const ALIGNMENT_OPTIONS: FilterOption<AlignmentFilter>[] = [
  { value: 'All', label: 'Everyone' },
  { value: 'Heroes', label: 'Heroes' },
  { value: 'Villains', label: 'Villains' },
  { value: 'Anti', label: 'Anti-Heroes' },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const searchRef = useRef<SearchBarCommands>(null);
  const { recent, addRecent, clearRecent } = useRecentSearches();

  const [idleHeroes, setIdleHeroes] = useState<HeroSearchResult[]>([]);
  const [idleLoading, setIdleLoading] = useState(true);
  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
  const [searchResults, setSearchResults] = useState<HeroSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [publisherFilter, setPublisherFilter] = useState<PublisherFilter>('All');
  const [alignmentFilter, setAlignmentFilter] = useState<AlignmentFilter>('All');
  const [navigating, setNavigating] = useState(false);
  const [peek, setPeek] = useState<PeekHero | null>(null);

  const cardWidth = (width - H_PAD * 2 - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const debouncedQuery = useDebounce(query, 300);

  const handleSearchText = useCallback(
    (e: string | { nativeEvent?: { text?: string } }) =>
      setQuery(typeof e === 'string' ? e : (e.nativeEvent?.text ?? '')),
    [],
  );

  // Tap a recent term → re-fill the native field (via ref) and run the search.
  const applyRecent = useCallback((term: string) => {
    Haptics.selectionAsync();
    searchRef.current?.setText(term);
    setQuery(term);
  }, []);

  useEffect(() => {
    getSearchIdleHeroes(30)
      .then(setIdleHeroes)
      .catch(() => {})
      .finally(() => setIdleLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getRecentlyViewed(user.id)
      .then(setRecentlyViewed)
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchResults(null);

    searchHeroes(debouncedQuery, publisherFilter, 100)
      .then((results) => {
        if (!cancelled) setSearchResults(rankResults(results, debouncedQuery));
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, publisherFilter]);

  const displayedHeroes = useMemo(() => {
    const base =
      searchResults !== null
        ? searchResults.slice(0, 100)
        : filterHeroesByPublisher(idleHeroes, publisherFilter);
    return filterHeroesByAlignment(base, alignmentFilter);
  }, [idleHeroes, searchResults, publisherFilter, alignmentFilter]);

  const handlePress = useCallback(
    (item: { id: string; portrait_url?: string | null; image_url?: string | null }) => {
      if (navigating) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigating(true);
      const img = item.portrait_url ?? item.image_url;
      const suffix = img ? `?imageUri=${encodeURIComponent(img)}` : '';
      router.push(`/character/${item.id}${suffix}`);
      setTimeout(() => setNavigating(false), 1000);
    },
    [router, navigating],
  );

  const openPeek = useCallback((item: PeekHero) => {
    Haptics.selectionAsync();
    setPeek(item);
  }, []);

  const isIdle = searchResults === null;
  const idleExtras = isIdle && !query.trim();

  const listHeader = (
    <>
      {!IS_IOS && (
        <View style={styles.chipStack}>
          <FilterChips
            value={publisherFilter}
            options={PUBLISHER_OPTIONS}
            onChange={setPublisherFilter}
            idPrefix="scope"
          />
          <FilterChips
            value={alignmentFilter}
            options={ALIGNMENT_OPTIONS}
            onChange={setAlignmentFilter}
            idPrefix="align"
          />
        </View>
      )}

      {idleExtras && recent.length > 0 && (
        <View style={styles.recentWrap}>
          <View style={styles.recentHead}>
            <Text style={styles.recentLabel}>Recent</Text>
            <Pressable onPress={clearRecent} hitSlop={8}>
              <Text style={styles.recentClear}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.recentChips}>
            {recent.map((term) => (
              <Pressable key={term} style={styles.recentChip} onPress={() => applyRecent(term)}>
                <Ionicons name="time-outline" size={13} color="rgba(245,235,220,0.5)" />
                <Text style={styles.recentChipText} numberOfLines={1}>
                  {term}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {idleExtras && recentlyViewed.length > 0 && (
        <AccentRail
          label="Recently Viewed"
          items={recentlyViewed}
          onPick={(id) => {
            const h = recentlyViewed.find((r) => r.id === id);
            if (h) handlePress(h);
          }}
          onPeek={openPeek}
          accent
        />
      )}

      {!idleLoading && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>
            {isIdle
              ? 'Popular'
              : `${displayedHeroes.length} result${displayedHeroes.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      )}
    </>
  );

  const listEmpty = idleLoading ? (
    <SkeletonProvider>
      <View style={styles.skelGrid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            width={cardWidth}
            height={Math.round(cardWidth * 1.48)}
            borderRadius={10}
          />
        ))}
      </View>
    </SkeletonProvider>
  ) : isSearching ? null : (
    <View style={styles.center}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="search-outline" size={30} color={COLORS.orange} />
      </View>
      <Text style={styles.emptyHeadline}>No heroes found</Text>
      <Text style={styles.emptySub}>Try a different search or filter</Text>
    </View>
  );

  return (
    <View style={styles.root} collapsable={false}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(231,115,51,0.13)', 'transparent']}
        locations={[0, 0.6]}
        style={styles.glow}
        pointerEvents="none"
      />

      <Stack.Header transparent style={{ color: COLORS.beige, shadowColor: 'transparent' }} />
      <Stack.SearchBar
        ref={searchRef}
        placeholder="Hero, villain, or real name…"
        placement="automatic"
        autoCapitalize="none"
        hideWhenScrolling={false}
        barTintColor="rgba(245,235,220,0.12)"
        textColor={COLORS.beige}
        hintTextColor="rgba(245,235,220,0.55)"
        headerIconColor="rgba(245,235,220,0.6)"
        tintColor={COLORS.orange}
        onChangeText={handleSearchText}
        onSearchButtonPress={() => addRecent(query)}
        onCancelButtonPress={() => setQuery('')}
      />

      {/* Native filter menus (iOS) in the header — fills the bar purposefully. */}
      {IS_IOS && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="books.vertical" title="Publisher">
            {PUBLISHER_OPTIONS.map((o) => (
              <Stack.Toolbar.MenuAction
                key={o.value}
                isOn={publisherFilter === o.value}
                onPress={() => setPublisherFilter(o.value)}
              >
                {o.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu icon="theatermasks" title="Alignment">
            {ALIGNMENT_OPTIONS.map((o) => (
              <Stack.Toolbar.MenuAction
                key={o.value}
                isOn={alignmentFilter === o.value}
                onPress={() => setAlignmentFilter(o.value)}
              >
                {o.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}

      <FlatList
        style={styles.list}
        data={displayedHeroes}
        keyExtractor={(h) => h.id}
        numColumns={GRID_COLUMNS}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 150 }]}
        columnWrapperStyle={displayedHeroes.length > 0 ? styles.gridRow : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <PortraitCard
            item={item}
            cardWidth={cardWidth}
            onPress={() => handlePress(item)}
            onLongPress={() => openPeek(item)}
            disabled={navigating}
            onDark
          />
        )}
      />

      <LinearGradient
        colors={['transparent', 'rgba(26,38,43,0.92)']}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      {peek && (
        <HeroPeek
          hero={peek}
          onClose={() => setPeek(null)}
          onFight={() => router.push(`/compare/${peek.id}/pick`)}
          onViewProfile={() => {
            setPeek(null);
            router.push(`/character/${peek.id}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SEARCH_NAVY },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  list: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: H_PAD, paddingTop: 4 },
  chipStack: { marginHorizontal: -H_PAD, paddingTop: 4 },
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingTop: 4 },
  gridRow: { gap: GAP },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 100 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245,235,220,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeadline: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige },
  emptySub: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: 'rgba(245,235,220,0.55)' },
  recentWrap: { paddingTop: 6, paddingBottom: 4 },
  recentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  recentLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.45)',
  },
  recentClear: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 180,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.12)',
  },
  recentChipText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.beige },
  sectionHeader: { paddingBottom: 8, paddingTop: 10 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
  },
});
