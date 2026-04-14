// app/category/[slug].web.tsx — Full grid view for a hero category (web)
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  getCategoryPage,
  CATEGORY_LABELS,
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
]);

// ── Card ──────────────────────────────────────────────────────────────────────
function HeroCard({ hero, onPress }: { hero: Hero; onPress: () => void }) {
  const source = heroGridImageSource(String(hero.id), hero.image_url, hero.portrait_url);
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
        contentPosition="top center"
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

  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<SortOption>('popular');
  const [publisher, setPublisher] = useState<CategoryPublisher>('all');
  const [search, setSearch] = useState('');
  const currentPage = useRef(0);
  const hasMore = useRef(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const categorySlug = VALID_SLUGS.has(slug as CategorySlug) ? (slug as CategorySlug) : null;
  const title = categorySlug ? CATEGORY_LABELS[categorySlug] : (slug ?? 'Heroes');

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
        setHeroes((prev) => (append ? [...prev, ...result.heroes] : result.heroes));
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

  useEffect(() => { fetchPage(0, { sort, publisher, search }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePress = useCallback((id: string) => { router.push(`/character/${id}`); }, [router]);

  const handleSearch = useCallback(
    (text: string) => {
      setSearch(text);
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => fetchPage(0, { sort, publisher, search: text }), 300);
    },
    [fetchPage, sort, publisher],
  );

  const handleSort = useCallback(
    (s: SortOption) => { setSort(s); fetchPage(0, { sort: s, publisher, search }); },
    [fetchPage, publisher, search],
  );

  const handlePublisher = useCallback(
    (p: CategoryPublisher) => { setPublisher(p); fetchPage(0, { sort, publisher: p, search }); },
    [fetchPage, sort, search],
  );

  const handleLoadMore = useCallback(() => {
    if (!hasMore.current || loadingMore) return;
    fetchPage(currentPage.current + 1, { sort, publisher, search }, true);
  }, [fetchPage, loadingMore, sort, publisher, search]);

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
      {/* Header */}
      <View style={[styles.header, isDesktop && (styles.headerDesktop as object)] as object}>
        <View style={[styles.headerInner, { paddingHorizontal: contentPad }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ hovered }: { hovered?: boolean }) =>
              [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
            }
          >
            <Ionicons name="arrow-back" size={18} color={COLORS.navy} />
            <Text style={styles.backText as object}>Back</Text>
          </Pressable>
          <View style={styles.titleRow}>
            <Text style={styles.title as object}>{title}</Text>
            {!loading && <Text style={styles.count as object}>{countLabel}</Text>}
          </View>
          {/* Search + filters */}
          <View style={styles.controls as object}>
            <View style={styles.searchBar as object}>
              <Ionicons name="search-outline" size={14} color={COLORS.grey} />
              <TextInput
                style={styles.searchInput as object}
                placeholder={`Search ${title.toLowerCase()}…`}
                placeholderTextColor={COLORS.grey}
                value={search}
                onChangeText={handleSearch}
                autoCorrect={false}
              />
            </View>
            <View style={styles.pills as object}>
              {SORT_OPTS.map((o) => (
                <Pressable
                  key={o.key}
                  onPress={() => handleSort(o.key)}
                  style={[styles.pill, sort === o.key && (styles.pillActive as object)] as object}
                >
                  <Text style={[styles.pillText, sort === o.key && (styles.pillTextActive as object)] as object}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
              <View style={styles.pillDivider as object} />
              {PUB_OPTS.map((o) => (
                <Pressable
                  key={o.key}
                  onPress={() => handlePublisher(o.key)}
                  style={[styles.pill, publisher === o.key && (styles.pillActive as object)] as object}
                >
                  <Text style={[styles.pillText, publisher === o.key && (styles.pillTextActive as object)] as object}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.orange} />
        </View>
      ) : heroes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No heroes found</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={[styles.gridWrap, { paddingHorizontal: contentPad, paddingBottom: 60 }]}>
            <View style={gridStyle as object}>
              {heroes.map((hero) => (
                <HeroCard key={hero.id} hero={hero} onPress={() => handlePress(String(hero.id))} />
              ))}
            </View>
            {hasMore.current && (
              <Pressable
                onPress={handleLoadMore}
                style={({ hovered }: { hovered?: boolean }) =>
                  [styles.loadMore, hovered && (styles.loadMoreHover as object)] as object
                }
              >
                {loadingMore ? (
                  <ActivityIndicator color={COLORS.navy} />
                ) : (
                  <Text style={styles.loadMoreText as object}>Load more</Text>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.12)',
    backgroundColor: COLORS.beige,
    paddingVertical: 14,
  },
  headerDesktop: {
    position: 'sticky',
    top: 64,
    zIndex: 40,
  } as object,
  headerInner: { maxWidth: 1200, width: '100%', alignSelf: 'center', gap: 6 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    cursor: 'pointer',
    opacity: 1,
    transition: 'opacity 150ms ease',
  } as object,
  backBtnHover: { opacity: 0.55 } as object,
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  } as object,
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    color: COLORS.navy,
  } as object,
  count: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    letterSpacing: 0.3,
  } as object,
  scroll: { flex: 1 },
  gridWrap: { paddingTop: 24, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' } as object,
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(29,45,51,0.07)', borderRadius: 8,
    paddingHorizontal: 10, height: 34, minWidth: 200,
  } as object,
  searchInput: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.navy } as object,
  pills: { flexDirection: 'row', gap: 6, alignItems: 'center' } as object,
  pill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: 'rgba(29,45,51,0.07)', cursor: 'pointer',
  } as object,
  pillActive: { backgroundColor: COLORS.navy } as object,
  pillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy } as object,
  pillTextActive: { color: COLORS.beige } as object,
  pillDivider: { width: 1, height: 16, backgroundColor: 'rgba(29,45,51,0.15)' } as object,
  loadMore: {
    marginTop: 32, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 10,
    borderRadius: 20, backgroundColor: 'rgba(29,45,51,0.08)', cursor: 'pointer',
  } as object,
  loadMoreHover: { backgroundColor: 'rgba(29,45,51,0.14)' } as object,
  loadMoreText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy } as object,
});
