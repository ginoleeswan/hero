// app/(tabs)/search/index.tsx — Search tab. Native iOS search bar (UISearchController)
// in the transparent blurred header drives the query; a custom scope row in the
// list header filters by publisher. Dark navy canvas unifies Search with the
// arena/pick pages. Idle shows Recently Viewed (gold rail) + Popular; typing
// swaps in results. The FlatList is the screen's root scroll view so the native
// large title binds to it correctly (no phantom top gap).
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../../src/constants/colors';
import { PortraitCard } from '../../../src/components/search/PortraitCard';
import { ScopeBar } from '../../../src/components/search/ScopeBar';
import { AccentRail } from '../../../src/components/search/AccentRail';
import { HeroPeek, type PeekHero } from '../../../src/components/compare/HeroPeek';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../../src/components/ui/SkeletonProvider';
import {
  searchHeroes,
  rankResults,
  getSearchIdleHeroes,
  filterHeroesByPublisher,
  type HeroSearchResult,
  type PublisherFilter,
} from '../../../src/lib/db/heroes';
import { getRecentlyViewed } from '../../../src/lib/db/viewHistory';
import { useAuth } from '../../../src/hooks/useAuth';
import type { FavouriteHero } from '../../../src/types';

const SEARCH_NAVY = '#1a262b';
const GRID_COLUMNS = 2;
const H_PAD = 16;
const GAP = 8;

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
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  const [idleHeroes, setIdleHeroes] = useState<HeroSearchResult[]>([]);
  const [idleLoading, setIdleLoading] = useState(true);
  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
  const [searchResults, setSearchResults] = useState<HeroSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [publisherFilter, setPublisherFilter] = useState<PublisherFilter>('All');
  const [navigating, setNavigating] = useState(false);
  const [peek, setPeek] = useState<PeekHero | null>(null);

  const cardWidth = (width - H_PAD * 2 - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const debouncedQuery = useDebounce(query, 300);

  // Wire the native iOS search bar into the screen's query state. No colours are
  // set so iOS renders its default field, which adapts to the (dark) header on
  // its own. Set once on mount — setQuery is stable.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: 'Hero, villain, or real name…',
        hideWhenScrolling: false,
        autoCapitalize: 'none',
        onChangeText: (e: { nativeEvent: { text: string } }) => setQuery(e.nativeEvent.text),
        onCancelButtonPress: () => setQuery(''),
      },
    } as never);
  }, [navigation]);

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
    if (searchResults !== null) return searchResults.slice(0, 100);
    return filterHeroesByPublisher(idleHeroes, publisherFilter);
  }, [idleHeroes, searchResults, publisherFilter]);

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
  const showRecent = isIdle && !query.trim() && recentlyViewed.length > 0;

  const listHeader = (
    <>
      <ScopeBar value={publisherFilter} onChange={setPublisherFilter} />
      {showRecent && (
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
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(231,115,51,0.22)', 'transparent']}
        locations={[0, 0.55]}
        style={styles.glow}
        pointerEvents="none"
      />

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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
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
  list: { flex: 1, backgroundColor: 'transparent' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  content: { paddingHorizontal: H_PAD, paddingTop: 4 },
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
  sectionHeader: { paddingBottom: 8, paddingTop: 4 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
  },
});
