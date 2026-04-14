// app/category/[slug].tsx — Category full-list: featured banner + search + sort/filter + infinite scroll
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getCategoryPage,
  CATEGORY_LABELS,
  type CategorySlug,
  type Hero,
  type SortOption,
  type CategoryPublisher,
} from '../../src/lib/db/heroes';
import { heroImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';

const VALID_SLUGS = new Set<CategorySlug>([
  'popular',
  'villain',
  'xmen',
  'anti-heroes',
  'marvel',
  'dc',
  'strongest',
  'most-intelligent',
]);
const PAGE_SIZE = 30;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = SCREEN_WIDTH >= 768 ? 4 : 3;
const PADDING = 12;
const GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.35);

// ── Hero grid card ────────────────────────────────────────────────────────────
function HeroGridCard({ hero, onPress }: { hero: Hero; onPress: () => void }) {
  const source = heroImageSource(hero.id, hero.image_url, hero.portrait_url);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top center"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={String(hero.id)}
        transition={typeof source === 'object' && 'uri' in source ? 150 : null}
      />
      <LinearGradient
        colors={['transparent', 'rgba(29,45,51,0.88)']}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.cardName} numberOfLines={2}>
        {hero.name}
      </Text>
    </TouchableOpacity>
  );
}

// ── Featured hero banner ──────────────────────────────────────────────────────
function FeaturedBanner({ hero, onPress }: { hero: Hero; onPress: () => void }) {
  const source = heroImageSource(hero.id, hero.image_url, hero.portrait_url);
  return (
    <TouchableOpacity style={styles.featured} onPress={onPress} activeOpacity={0.88}>
      {/* Hero image pinned to right half */}
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top center"
        style={styles.featuredImage}
        cachePolicy="memory-disk"
      />
      {/* Horizontal gradient: solid dark on left → transparent on right */}
      <LinearGradient
        colors={['#0d1e26', '#0d1e26', 'transparent']}
        locations={[0, 0.44, 0.76]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Text content sits on the dark left side */}
      <View style={styles.featuredContent}>
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredBadgeText}>FEATURED</Text>
        </View>
        <Text style={styles.featuredName} numberOfLines={1}>
          {hero.name}
        </Text>
        {(hero.publisher || hero.issue_count) && (
          <Text style={styles.featuredSub}>
            {[
              hero.publisher,
              hero.issue_count ? `${hero.issue_count.toLocaleString()} issues` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Filter bottom sheet ───────────────────────────────────────────────────────
function FilterSheet({
  visible,
  sort,
  publisher,
  onSortChange,
  onPublisherChange,
  onClose,
  bottomInset,
}: {
  visible: boolean;
  sort: SortOption;
  publisher: CategoryPublisher;
  onSortChange: (s: SortOption) => void;
  onPublisherChange: (p: CategoryPublisher) => void;
  onClose: () => void;
  bottomInset: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetContainer}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: bottomInset + 20 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Sort & Filter</Text>

          <Text style={styles.sheetLabel}>SORT BY</Text>
          <View style={styles.sheetPills}>
            {(['popular', 'az'] as SortOption[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.sheetPill, sort === s && styles.sheetPillActive]}
                onPress={() => onSortChange(s)}
              >
                <Text style={[styles.sheetPillText, sort === s && styles.sheetPillTextActive]}>
                  {s === 'popular' ? 'Popular' : 'A–Z'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sheetLabel, { marginTop: 16 }]}>PUBLISHER</Text>
          <View style={styles.sheetPills}>
            {(['all', 'marvel', 'dc'] as CategoryPublisher[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.sheetPill, publisher === p && styles.sheetPillActive]}
                onPress={() => onPublisherChange(p)}
              >
                <Text style={[styles.sheetPillText, publisher === p && styles.sheetPillTextActive]}>
                  {p === 'all' ? 'All' : p === 'marvel' ? 'Marvel' : 'DC'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.sheetDone} onPress={onClose}>
            <Text style={styles.sheetDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const categorySlug = VALID_SLUGS.has(slug as CategorySlug) ? (slug as CategorySlug) : null;
  const title = categorySlug ? CATEGORY_LABELS[categorySlug] : (slug ?? 'Heroes');

  const [sort, setSort] = useState<SortOption>('popular');
  const [publisher, setPublisher] = useState<CategoryPublisher>('all');
  const [search, setSearch] = useState('');
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [featuredHero, setFeaturedHero] = useState<Hero | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const currentPage = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const hasMore = useRef(true);

  // Fetch a page, optionally appending
  const fetchPage = useCallback(
    async (
      page: number,
      opts: { sort: SortOption; publisher: CategoryPublisher; search: string },
      append = false,
    ) => {
      if (!categorySlug) return;
      if (page === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const result = await getCategoryPage(categorySlug, {
          page,
          pageSize: PAGE_SIZE,
          ...opts,
        });
        setHeroes((prev) => (append ? [...prev, ...result.heroes] : result.heroes));
        setTotal(result.total);
        currentPage.current = page;
        hasMore.current = (page + 1) * PAGE_SIZE < result.total;
      } catch {
        // silently fail — stale data is better than a crash
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [categorySlug],
  );

  // Fetch featured hero (top by popularity, respects publisher filter)
  const fetchFeatured = useCallback(
    async (pub: CategoryPublisher) => {
      if (!categorySlug) return;
      try {
        const result = await getCategoryPage(categorySlug, {
          page: 0,
          pageSize: 1,
          sort: 'popular',
          publisher: pub,
          search: '',
        });
        setFeaturedHero(result.heroes[0] ?? null);
      } catch {
        setFeaturedHero(null);
      }
    },
    [categorySlug],
  );

  // Initial load
  useEffect(() => {
    fetchPage(0, { sort, publisher, search });
    fetchFeatured(publisher);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSortChange = useCallback(
    (s: SortOption) => {
      setSort(s);
      fetchPage(0, { sort: s, publisher, search });
    },
    [fetchPage, publisher, search],
  );

  const handlePublisherChange = useCallback(
    (p: CategoryPublisher) => {
      setPublisher(p);
      fetchPage(0, { sort, publisher: p, search });
      fetchFeatured(p);
    },
    [fetchPage, fetchFeatured, sort, search],
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearch(text);
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        fetchPage(0, { sort, publisher, search: text });
      }, 300);
    },
    [fetchPage, sort, publisher],
  );

  const handleEndReached = useCallback(() => {
    if (!hasMore.current || loadingMore || loading) return;
    fetchPage(currentPage.current + 1, { sort, publisher, search }, true);
  }, [loadingMore, loading, fetchPage, sort, publisher, search]);

  const handleHeroPress = useCallback(
    (id: string) => {
      if (navigating) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigating(true);
      router.push(`/character/${id}`);
      setTimeout(() => setNavigating(false), 1000);
    },
    [router, navigating],
  );

  const countLabel = (() => {
    const s = total !== 1 ? 's' : '';
    if (search.trim()) return `${total} result${s} for "${search.trim()}"`;
    const base = `${total} ${title.toLowerCase()}`;
    if (publisher === 'marvel') return `${base} · Marvel`;
    if (publisher === 'dc') return `${base} · DC`;
    return base;
  })();

  const showFeatured = !search.trim() && !!featuredHero;

  const listHeader = useMemo(
    () => (
      <>
        {showFeatured && (
          <FeaturedBanner
            hero={featuredHero!}
            onPress={() => handleHeroPress(String(featuredHero!.id))}
          />
        )}
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Ionicons
            name="search-outline"
            size={15}
            color={searchFocused ? COLORS.orange : COLORS.grey}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${title.toLowerCase()}…`}
            placeholderTextColor={COLORS.grey}
            value={search}
            onChangeText={handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        </View>
        <View style={styles.controlsRow}>
          <View style={styles.segmented}>
            {(['popular', 'az'] as SortOption[]).map((s, i) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.segBtn,
                  i === 0 && styles.segBtnLeft,
                  i === 1 && styles.segBtnRight,
                  sort === s && styles.segBtnActive,
                ]}
                onPress={() => handleSortChange(s)}
              >
                <Text style={[styles.segBtnText, sort === s && styles.segBtnTextActive]}>
                  {s === 'popular' ? 'Popular' : 'A–Z'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, publisher !== 'all' && styles.filterBtnActive]}
            onPress={() => setFilterOpen(true)}
          >
            <Ionicons
              name="funnel-outline"
              size={15}
              color={publisher !== 'all' ? COLORS.beige : COLORS.navy}
            />
            {publisher !== 'all' && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
        <Text style={styles.countLabel}>{countLabel}</Text>
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showFeatured, featuredHero, search, searchFocused, sort, publisher, countLabel],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Fixed header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Ionicons name="arrow-back" size={22} color={COLORS.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.orange} />
        </View>
      ) : (
        <FlatList
          data={heroes}
          keyExtractor={(h) => String(h.id)}
          numColumns={NUM_COLUMNS}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 20 }]}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <HeroGridCard hero={item} onPress={() => handleHeroPress(String(item.id))} />
          )}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No heroes found</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={COLORS.orange} />
              </View>
            ) : null
          }
        />
      )}

      <FilterSheet
        visible={filterOpen}
        sort={sort}
        publisher={publisher}
        onSortChange={(s) => {
          handleSortChange(s);
        }}
        onPublisherChange={(p) => {
          handlePublisherChange(p);
        }}
        onClose={() => setFilterOpen(false)}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.15)',
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy },

  // Featured banner
  featured: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#0d1e26',
  },
  // Image pinned to right ~58% of the banner
  featuredImage: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '58%',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 14,
    left: 14,
  },
  featuredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.orange,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  featuredBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: '#fff',
    letterSpacing: 1,
  },
  featuredName: {
    fontFamily: 'Flame-Bold',
    fontSize: 24,
    color: '#fff',
    lineHeight: 26,
  },
  featuredSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 3,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(29,45,51,0.08)',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
  },
  searchBarFocused: {
    backgroundColor: '#fff',
    borderColor: COLORS.orange,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: COLORS.navy,
  },

  // Controls
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(29,45,51,0.08)',
    borderRadius: 8,
    padding: 2,
    flex: 1,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 6,
  },
  segBtnLeft: { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
  segBtnRight: { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  segBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  segBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey },
  segBtnTextActive: { color: COLORS.navy },
  filterBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(29,45,51,0.08)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: COLORS.navy },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.orange,
    borderWidth: 1.5,
    borderColor: COLORS.beige,
  },

  // Count label
  countLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    letterSpacing: 0.3,
    marginBottom: 10,
  },

  // Grid
  grid: { padding: PADDING },
  row: { gap: GAP, marginBottom: GAP },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    padding: 6,
  },
  cardName: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.beige, lineHeight: 14 },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },

  // Filter sheet
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(29,45,51,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.navy, marginBottom: 16 },
  sheetLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.grey,
    letterSpacing: 1,
    marginBottom: 8,
  },
  sheetPills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sheetPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(29,45,51,0.08)',
  },
  sheetPillActive: { backgroundColor: COLORS.navy },
  sheetPillText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  sheetPillTextActive: { color: COLORS.beige },
  sheetDone: {
    marginTop: 20,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  sheetDoneText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.beige },
});
