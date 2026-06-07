// app/(tabs)/search.tsx — Search tab: live hero search over the app's beige canvas.
// Idle state shows Recently Viewed + Popular; typing swaps in ranked results.
// State persists while the tab stays mounted (query, filter, scroll, results).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { PortraitCard } from '../../src/components/search/PortraitCard';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { HomeHeroRow, type RowHero } from '../../src/components/home/HomeHeroRow';
import {
  searchHeroes,
  rankResults,
  getSearchIdleHeroes,
  type HeroSearchResult,
  type PublisherFilter,
} from '../../src/lib/db/heroes';
import { getRecentlyViewed } from '../../src/lib/db/viewHistory';
import { useAuth } from '../../src/hooks/useAuth';
import type { FavouriteHero } from '../../src/types';

const PUBLISHER_PILLS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];
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

function toRowHero(h: FavouriteHero): RowHero {
  return { id: h.id, name: h.name, image_url: h.image_url, portrait_url: h.portrait_url };
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const inputRef = useRef<TextInput>(null);

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

    return publisherFilter === 'All'
      ? idleHeroes
      : idleHeroes.filter((h) => {
          const pub = (h.publisher ?? '').toLowerCase();
          if (publisherFilter === 'Marvel') return pub.includes('marvel');
          if (publisherFilter === 'DC') return pub.includes('dc');
          return !pub.includes('marvel') && !pub.includes('dc');
        });
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
      {showRecent && (
        <HomeHeroRow
          label="Personal"
          title="Recently Viewed"
          heroes={recentlyViewed.map(toRowHero)}
          variant="thumb"
          onPress={handlePress}
          disabled={navigating}
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

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Search</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color="rgba(245,235,220,0.5)" />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Hero, villain, or real name…"
          placeholderTextColor="rgba(245,235,220,0.4)"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {isSearching ? (
          <ActivityIndicator size="small" color="rgba(245,235,220,0.5)" />
        ) : query.length > 0 ? (
          <TouchableOpacity
            onPress={() => setQuery('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.45)" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsContainer}
        style={styles.pillsScroll}
        keyboardShouldPersistTaps="handled"
      >
        {PUBLISHER_PILLS.map((pill) => {
          const active = publisherFilter === pill;
          return (
            <TouchableOpacity
              key={pill}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => setPublisherFilter(pill)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{pill}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {idleLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} />
        </View>
      ) : displayedHeroes.length === 0 && !isSearching ? (
        <View style={styles.center}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="search-outline" size={30} color={COLORS.orange} />
          </View>
          <Text style={styles.emptyHeadline}>No heroes found</Text>
          <Text style={styles.emptySub}>Try a different search or filter</Text>
        </View>
      ) : (
        <FlatList
          data={displayedHeroes}
          keyExtractor={(h) => h.id}
          numColumns={GRID_COLUMNS}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 120 }]}
          columnWrapperStyle={styles.gridRow}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          renderItem={({ item }) => (
            <PortraitCard
              item={item}
              cardWidth={cardWidth}
              onPress={() => handlePress(item)}
              onLongPress={() => openPeek(item)}
              disabled={navigating}
            />
          )}
        />
      )}

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
  root: { flex: 1, backgroundColor: COLORS.beige },
  title: {
    fontFamily: 'Flame-Bold',
    fontSize: 30,
    color: COLORS.navy,
    paddingHorizontal: H_PAD,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    borderCurve: 'continuous',
    marginHorizontal: H_PAD,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
  },
  pillsScroll: { flexGrow: 0, height: 44, marginBottom: 4 },
  pillsContainer: { paddingHorizontal: H_PAD, paddingVertical: 2, gap: 8, alignItems: 'center' },
  pill: {
    height: 34,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(41,60,67,0.25)',
  },
  pillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  pillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  pillTextActive: { color: COLORS.beige },
  grid: { paddingHorizontal: H_PAD },
  gridRow: { gap: GAP },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff5ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeadline: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy },
  emptySub: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
  sectionHeader: { paddingBottom: 8, paddingTop: 4 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.45)',
  },
});
