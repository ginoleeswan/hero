// app/category/[slug].web.tsx — Full grid view for a hero category (web)
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSkeletonAnim } from '../../src/components/web/Skeleton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  getCategoryPage,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type CategorySlug,
  type Hero,
  type SortOption,
  type CategoryPublisher,
} from '../../src/lib/db/heroes';
import { heroGridImageSource } from '../../src/constants/heroImages';
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
  'most-iconic',
]);


// ── Skeleton card (matches HeroCard layout) ───────────────────────────────────
function SkeletonCard({ opacity }: { opacity: Animated.Value }) {
  return <Animated.View style={[sk.wrap as object, { opacity }]} />;
}

const sk = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    aspectRatio: '3 / 4',
    backgroundColor: '#ddd5c8',
  } as object,
});

// ── Card ──────────────────────────────────────────────────────────────────────
function HeroCard({ hero, onPress }: { hero: Hero; onPress: () => void }) {
  const source = heroGridImageSource(String(hero.id), hero.image_url, hero.portrait_url, hero.image_md_url);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [card.wrap, hovered && (card.wrapHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition={{ top: 0, left: '50%' }}
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={String(hero.id)}
        transition={typeof source === 'object' && 'uri' in source ? 150 : null}
      />
      <View style={card.overlay as object} />
      <View style={card.bottom}>
        <Text style={card.name as object} numberOfLines={2}>
          {hero.name}
        </Text>
      </View>
    </Pressable>
  );
}

const card = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
    aspectRatio: '3 / 4',
  } as object,
  wrapHover: {
    transform: [{ scale: 1.04 }],
    boxShadow: '0 20px 56px rgba(0,0,0,0.32)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.08) 55%, transparent 100%)',
  } as object,
  bottom: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
  } as object,
});

// ── Screen ────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 48;

export default function WebCategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isWide = width >= 1100;   // show description inline
  const isMid  = width >= 900;    // show count label

  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<SortOption>('popular');
  const [publisher, setPublisher] = useState<CategoryPublisher>('all');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const currentPage = useRef(0);
  const hasMore = useRef(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loadingMoreRef = useRef(false);
  const skeletonOpacity = useSkeletonAnim();

  const categorySlug = VALID_SLUGS.has(slug as CategorySlug) ? (slug as CategorySlug) : null;
  const title = categorySlug ? CATEGORY_LABELS[categorySlug] : (slug ?? 'Heroes');
  const description = categorySlug ? CATEGORY_DESCRIPTIONS[categorySlug] : null;

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
        const result = await getCategoryPage(categorySlug, { page, pageSize: PAGE_SIZE, ...opts });
        setHeroes((prev) => {
          if (!append) return result.heroes;
          const seen = new Set(prev.map((h) => h.id));
          return [...prev, ...result.heroes.filter((h) => !seen.has(h.id))];
        });
        setTotal(result.total);
        currentPage.current = page;
        hasMore.current = (page + 1) * PAGE_SIZE < result.total;
      } catch {
        //
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [categorySlug],
  );

  useEffect(() => {
    fetchPage(0, { sort, publisher, search });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/character/${id}`);
    },
    [router],
  );

  const handleSearch = useCallback(
    (text: string) => {
      setSearch(text);
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => fetchPage(0, { sort, publisher, search: text }), 300);
    },
    [fetchPage, sort, publisher],
  );

  const handleSort = useCallback(
    (s: SortOption) => {
      setSort(s);
      fetchPage(0, { sort: s, publisher, search });
    },
    [fetchPage, publisher, search],
  );

  const handlePublisher = useCallback(
    (p: CategoryPublisher) => {
      setPublisher(p);
      fetchPage(0, { sort, publisher: p, search });
    },
    [fetchPage, sort, search],
  );

  // Keep ref in sync — scroll handler reads this to avoid firing multiple fetches
  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);

  // onScroll handler — fires when the user scrolls within the ScrollView container.
  // IntersectionObserver doesn't work here because RNW's ScrollView is a scrollable
  // div, not the document — the observer sees the sentinel as always visible.
  const handleScroll = useCallback(
    ({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }: {
      nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } };
    }) => {
      const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
      if (distanceFromBottom < 400 && hasMore.current && !loadingMoreRef.current) {
        fetchPage(currentPage.current + 1, { sort, publisher, search }, true);
      }
    },
    [fetchPage, sort, publisher, search],
  );

  const countLabel = (() => {
    const s = total !== 1 ? 's' : '';
    if (search.trim()) return `${total} result${s} for "${search.trim()}"`;
    const base = `${total} ${title.toLowerCase()}`;
    if (publisher === 'marvel') return `${base} · Marvel`;
    if (publisher === 'dc') return `${base} · DC`;
    return base;
  })();

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: isDesktop
      ? 'repeat(auto-fill, minmax(180px, 1fr))'
      : 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12,
  };

  const contentPad = isDesktop ? 32 : 16;
  const SORT_OPTS: { key: SortOption; label: string }[] = [
    { key: 'popular', label: 'Popular' },
    { key: 'az', label: 'A–Z' },
  ];
  const PUB_OPTS: { key: CategoryPublisher; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'marvel', label: 'Marvel' },
    { key: 'dc', label: 'DC' },
  ];

  return (
    <View style={styles.root}>
      {/* ── Sticky header — navy ─────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingHorizontal: contentPad }] as object}>
        <View style={styles.headerInner}>
          {/* Row 1 — identity: back · accent · title · description · count */}
          <View style={styles.identityRow}>
            {isDesktop && (
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
                style={({ hovered }: { hovered?: boolean }) =>
                  [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
                }
              >
                <Ionicons name="arrow-back" size={18} color="rgba(245,235,220,0.45)" />
              </Pressable>
            )}
            <View style={styles.accentBar} />
            <Text style={[styles.title, isDesktop && (styles.titleDesktop as object)] as object} numberOfLines={1}>
              {title}
            </Text>
            {isDesktop && isWide && description ? (
              <Text style={styles.descriptionInline as object} numberOfLines={1}>
                {description}
              </Text>
            ) : null}
            <View style={styles.identityRight}>
              {!loading && total > 0 && (
                <View style={styles.countPill}>
                  <Text style={styles.countText as object}>{total.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Row 2 — controls: search · sort segment · publisher chips */}
          <View style={[styles.controlsRow, !isDesktop && (styles.controlsRowMobile as object)] as object}>
            {/* Search */}
            <View style={[styles.searchBar, searchFocused && (styles.searchBarFocused as object)] as object}>
              <Ionicons name="search-outline" size={14} color={searchFocused ? COLORS.orange : 'rgba(245,235,220,0.35)'} />
              <TextInput
                style={styles.searchInput as object}
                placeholder={`Search ${title.toLowerCase()}…`}
                placeholderTextColor="rgba(245,235,220,0.3)"
                value={search}
                onChangeText={handleSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                autoCorrect={false}
              />
            </View>

            {/* Sort — segmented control feel */}
            <View style={styles.segmentGroup as object}>
              {SORT_OPTS.map((o, i) => (
                <Pressable key={o.key} onPress={() => handleSort(o.key)}
                  style={[
                    styles.segment,
                    i === 0 && (styles.segmentFirst as object),
                    i === SORT_OPTS.length - 1 && (styles.segmentLast as object),
                    sort === o.key && (styles.segmentActive as object),
                  ] as object}>
                  <Text style={[styles.segmentText, sort === o.key && (styles.segmentTextActive as object)] as object}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.dividerV as object} />

            {/* Publisher filter chips */}
            <View style={styles.chips as object}>
              {PUB_OPTS.map((o) => (
                <Pressable key={o.key} onPress={() => handlePublisher(o.key)}
                  style={[styles.chip, publisher === o.key && (styles.chipActive as object)] as object}>
                  <Text style={[styles.chipText, publisher === o.key && (styles.chipTextActive as object)] as object}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {loading ? (
        // Initial skeleton grid — same layout as real cards, no layout shift on load
        <View style={[styles.gridWrap, { paddingHorizontal: contentPad }]}>
          <View style={gridStyle as object}>
            {Array.from({ length: 24 }).map((_, i) => (
              <SkeletonCard key={i} opacity={skeletonOpacity} />
            ))}
          </View>
        </View>
      ) : heroes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No heroes found</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          onScroll={handleScroll}
          scrollEventThrottle={200}
        >
          <View style={[styles.gridWrap, { paddingHorizontal: contentPad, paddingBottom: 60 }]}>
            <View style={gridStyle as object}>
              {heroes.map((hero) => (
                <HeroCard key={hero.id} hero={hero} onPress={() => handlePress(String(hero.id))} />
              ))}
              {/* Skeleton cards appended inline while next page loads */}
              {loadingMore && Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={`sk-${i}`} opacity={skeletonOpacity} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },

  // ── Sticky header (navy) ────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.07)',
    paddingTop: 12,
    paddingBottom: 10,
    position: 'sticky',
    top: 64,
    zIndex: 40,
  } as object,
  headerInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    gap: 10,
  } as object,

  // Row 1 — identity
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  } as object,
  identityRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  } as object,
  backBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
    flexShrink: 0,
  } as object,
  backBtnHover: { opacity: 0.5 } as object,
  accentBar: {
    width: 3,
    height: 24,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
    flexShrink: 0,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    lineHeight: 24,
    flexShrink: 0,
  } as object,
  titleDesktop: {
    fontSize: 26,
    lineHeight: 30,
  } as object,
  descriptionInline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.4)',
    flexShrink: 1,
    minWidth: 0,
  } as object,
  countPill: {
    backgroundColor: 'rgba(232,98,26,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(232,98,26,0.3)',
    flexShrink: 0,
  },
  countText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 0.3,
  } as object,

  // Row 2 — controls
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  } as object,
  controlsRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  } as object,

  // Search bar
  searchBar: {
    flex: 1,
    maxWidth: 300,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(245,235,220,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    paddingHorizontal: 11,
    height: 34,
  } as object,
  searchBarFocused: {
    backgroundColor: 'rgba(245,235,220,0.1)',
    borderColor: 'rgba(231,115,51,0.6)',
  } as object,
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.beige,
    outlineStyle: 'none',
  } as object,

  // Sort — segmented control
  segmentGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.12)',
    overflow: 'hidden',
    flexShrink: 0,
  } as object,
  segment: {
    paddingHorizontal: 14,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    backgroundColor: 'rgba(245,235,220,0.05)',
  } as object,
  segmentFirst: {} as object,
  segmentLast: {} as object,
  segmentActive: { backgroundColor: 'rgba(245,235,220,0.15)' } as object,
  segmentText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.5)',
  } as object,
  segmentTextActive: { color: COLORS.beige } as object,

  // Vertical divider between sort and publisher
  dividerV: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(245,235,220,0.1)',
    flexShrink: 0,
  } as object,

  // Publisher filter chips
  chips: { flexDirection: 'row', gap: 5, alignItems: 'center', flexShrink: 0 } as object,
  chip: {
    paddingHorizontal: 12,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(245,235,220,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease, border-color 150ms ease',
  } as object,
  chipActive: {
    backgroundColor: 'rgba(245,235,220,0.15)',
    borderColor: 'rgba(245,235,220,0.25)',
  } as object,
  chipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.5)',
  } as object,
  chipTextActive: { color: COLORS.beige } as object,
  scroll: { flex: 1 },
  gridWrap: { paddingTop: 16, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey },
});
