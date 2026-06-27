// app/(tabs)/search/index.tsx — Search tab.
// • Native iOS search field in the tab bar (role="search" + Stack.SearchBar).
// • Filters: native Stack.Toolbar menu (Publisher + Alignment) on iOS; FilterChips
//   rows as the Android/web fallback.
// • One publisher-aware fetch path: empty query → top heroes for the selected
//   publisher (DB-side); non-empty → alias/typo-tolerant search_heroes RPC.
// • Idle extras: "Search" heading, recent searches, Recently Viewed rail.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { SearchBarCommands } from 'react-native-screens';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS } from '../../../src/constants/colors';
import { PortraitCard } from '../../../src/components/search/PortraitCard';
import { UniverseResultRow } from '../../../src/components/search/UniverseResultRow';
import { FilterChips, type FilterOption } from '../../../src/components/search/FilterChips';
import { AccentRail } from '../../../src/components/search/AccentRail';
import { CategoryPodGrid } from '../../../src/components/home/CategoryPodGrid';
import { HeroPeek, type PeekHero } from '../../../src/components/compare/HeroPeek';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../../src/components/ui/SkeletonProvider';
import type { PublisherFilter, AlignmentFilter } from '../../../src/lib/db/heroes';
import { searchUniverses } from '../../../src/lib/db/universes';
import { useHeroSearchInfinite, prefetchHeroSearch } from '../../../src/lib/query/heroQueries';
import { getRecentlyViewed } from '../../../src/lib/db/viewHistory';
import { useAuth } from '../../../src/hooks/useAuth';
import { useRecentSearches } from '../../../src/hooks/useRecentSearches';
import { useBrowseCovers } from '../../../src/hooks/useBrowseCovers';
import type { FavouriteHero } from '../../../src/types';

const SEARCH_NAVY = '#1a262b';
const GRID_COLUMNS = 2;
const H_PAD = 16;
const GAP = 8;
const IS_IOS = Platform.OS === 'ios';
const PUBLISHERS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];

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
  const queryClient = useQueryClient();
  const { recent, addRecent, clearRecent } = useRecentSearches();
  const browseCovers = useBrowseCovers();

  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
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
    if (!user?.id) return;
    getRecentlyViewed(user.id)
      .then(setRecentlyViewed)
      .catch(() => {});
  }, [user?.id]);

  // Cached, paginated, publisher+alignment-aware fetch (keepPreviousData →
  // instant-feeling switches; infinite scroll for deep browsing).
  const { data, isPending, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useHeroSearchInfinite(debouncedQuery, publisherFilter, alignmentFilter);

  // Warm every publisher's first browse page on mount so the first switch is cached.
  useEffect(() => {
    PUBLISHERS.forEach((p) => prefetchHeroSearch(queryClient, p));
  }, [queryClient]);

  const displayedHeroes = useMemo(() => data?.pages.flat() ?? [], [data]);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  const handleCategoryPress = useCallback(
    (slug: string) => {
      Haptics.selectionAsync();
      router.push(`/category/${slug}`);
    },
    [router],
  );

  // Universe hits come from the in-memory brand registry (pure, instant) — so
  // typing "disney"/"mattel" surfaces the universe above the hero grid. Mirrors
  // the web search's Universes section; routes to /universe/[slug].
  const universes = useMemo(() => searchUniverses(debouncedQuery.trim(), 6), [debouncedQuery]);

  const isIdle = !debouncedQuery.trim();
  const showIdleExtras = !query.trim();
  // When idle, the screen is a browse surface (recent · recently viewed · the
  // category pods) — not a results grid. Suppress the hero list so the pods read
  // as the primary doorway instead of competing with a "Popular" wall.
  const listData = isIdle ? [] : displayedHeroes;

  const listHeader = (
    <>
      <Text style={styles.screenTitle}>Search</Text>

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

      {showIdleExtras && recent.length > 0 && (
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

      {showIdleExtras && recentlyViewed.length > 0 && (
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

      {showIdleExtras && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Browse</Text>
          </View>
          {/* CategoryPodGrid owns its 16px gutter (tiles sized from the screen
              width), so cancel the list's content padding to align it edge-to-edge. */}
          <View style={styles.browseGrid}>
            <CategoryPodGrid covers={browseCovers} onPress={handleCategoryPress} />
          </View>
        </>
      )}

      {!isIdle && universes.length > 0 && (
        <View style={styles.universeSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Universes</Text>
          </View>
          {universes.map((u) => (
            <UniverseResultRow
              key={u.slug}
              universe={u}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/universe/${u.slug}` as Parameters<typeof router.push>[0]);
              }}
            />
          ))}
        </View>
      )}

      {!isIdle && !isPending && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>
            {`${displayedHeroes.length} result${displayedHeroes.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      )}
    </>
  );

  const listEmpty = isIdle ? null : isPending ? (
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
  ) : isFetching ? null : (
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

      {/* Native filter menus (iOS) on the right — fills the header bar. */}
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
        data={listData}
        keyExtractor={(h) => h.id}
        numColumns={GRID_COLUMNS}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={COLORS.orange} />
            </View>
          ) : null
        }
        onEndReachedThreshold={0.6}
        onEndReached={loadMore}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 150 }]}
        columnWrapperStyle={listData.length > 0 ? styles.gridRow : undefined}
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
  screenTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    color: COLORS.beige,
    marginTop: 2,
    marginBottom: 12,
  },
  chipStack: { marginHorizontal: -H_PAD, paddingBottom: 2 },
  browseGrid: { marginHorizontal: -H_PAD, paddingBottom: 4 },
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingTop: 4 },
  gridRow: { gap: GAP },
  footer: { paddingVertical: 24, alignItems: 'center' },
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
  recentWrap: { paddingTop: 2, paddingBottom: 4 },
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
  universeSection: { paddingBottom: 6 },
  sectionHeader: { paddingBottom: 8, paddingTop: 6 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
  },
});
