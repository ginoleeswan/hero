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
  getCategoryFacetCounts,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type CategorySlug,
  type Hero,
} from '../../src/lib/db/heroes';
import {
  activeFilterList,
  type CategoryFilters,
  type FacetCounts,
} from '../../src/lib/db/categoryFilters';
import { useCategoryFilters } from '../../src/hooks/useCategoryFilters';
import { useWebCanvas } from '../../src/hooks/useWebCanvas';
import { FilterRail } from '../../src/components/web/category/FilterRail';
import { FilterSheet } from '../../src/components/web/category/FilterSheet';
import { ActiveFilterChips } from '../../src/components/web/category/ActiveFilterChips';
import { heroGridImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';

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
    width: '100%', // WebKit won't stretch an aspect-ratio grid item to the track — force the inline size
    borderRadius: 10,
    aspectRatio: '3 / 4',
    backgroundColor: '#ddd5c8',
  } as object,
});

// ── Card ──────────────────────────────────────────────────────────────────────
function HeroCard({
  hero,
  onPress,
  onLongPress,
  onInfo,
}: {
  hero: Hero;
  onPress: () => void;
  onLongPress?: () => void;
  onInfo?: () => void;
}) {
  const source = heroGridImageSource(
    String(hero.id),
    hero.image_url,
    hero.portrait_url,
    hero.image_md_url,
  );
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [card.wrap, hovered && (card.wrapHover as object)] as object
      }
    >
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <>
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
          {onInfo && (
            <Pressable
              onPress={onInfo}
              accessibilityLabel={`About ${hero.name}`}
              pointerEvents={hovered ? 'auto' : 'none'}
              style={({ hovered: chipHovered }: { pressed: boolean; hovered?: boolean }) =>
                [
                  card.infoChip,
                  { opacity: hovered ? 1 : 0 },
                  chipHovered && (card.infoChipHover as object),
                ] as object
              }
            >
              <Ionicons name="information" size={15} color={COLORS.beige} />
            </Pressable>
          )}
        </>
      )}
    </Pressable>
  );
}

const card = StyleSheet.create({
  wrap: {
    width: '100%', // WebKit won't stretch an aspect-ratio grid item to the track — force the inline size
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
  infoChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,14,10,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.4)',
    cursor: 'pointer',
    transition: 'opacity 150ms ease, background-color 150ms ease',
  } as object,
  infoChipHover: { backgroundColor: 'rgba(18,14,10,0.82)' } as object,
});

// ── Screen ────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 48;

export default function WebCategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isWide = width >= 1100; // show description inline

  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [counts, setCounts] = useState<FacetCounts | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const currentPage = useRef(0);
  const hasMore = useRef(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loadingMoreRef = useRef(false);
  const skeletonOpacity = useSkeletonAnim();

  const categorySlug = VALID_SLUGS.has(slug as CategorySlug) ? (slug as CategorySlug) : null;
  const title = categorySlug ? CATEGORY_LABELS[categorySlug] : (slug ?? 'Heroes');
  const description = categorySlug ? CATEGORY_DESCRIPTIONS[categorySlug] : null;

  const { filters, setFilter, reset } = useCategoryFilters(categorySlug ?? 'popular');
  const activeChips = activeFilterList(categorySlug ?? 'popular', filters);

  const fetchPage = useCallback(
    async (page: number, f: CategoryFilters, append = false) => {
      if (!categorySlug) return;
      if (page === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const result = await getCategoryPage(categorySlug, { page, pageSize: PAGE_SIZE, ...f });
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

  // Refetch page 0 + facet counts whenever filters change. Search is debounced;
  // facet selections apply immediately.
  useEffect(() => {
    if (!categorySlug) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => {
        fetchPage(0, filters);
        getCategoryFacetCounts(categorySlug, filters)
          .then(setCounts)
          .catch(() => setCounts(null));
      },
      filters.search ? 300 : 0,
    );
    return () => clearTimeout(searchTimer.current);
  }, [categorySlug, filters, fetchPage]);

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/character/${id}`);
    },
    [router],
  );

  const [peek, setPeek] = useState<PeekHero | null>(null);

  // Keep ref in sync — scroll handler reads this to avoid firing multiple fetches
  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  // Document scroll so the grid (a plain View, like the skeleton) bleeds
  // edge-to-edge under the iOS Safari toolbar. Beige canvas reads continuous to
  // the bottom past the 100dvh fold.
  useWebCanvas(COLORS.beige);

  // Infinite load now rides the document scroll (the nested ScrollView is gone),
  // so measure against the window rather than a ScrollView's nativeEvent.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (distanceFromBottom < 400 && hasMore.current && !loadingMoreRef.current) {
        fetchPage(currentPage.current + 1, filters, true);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [fetchPage, filters]);

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: isDesktop
      ? 'repeat(auto-fill, minmax(180px, 1fr))'
      : 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12,
  };

  const contentPad = isDesktop ? 32 : 16;

  const grid = (
    <View style={gridStyle as object}>
      {heroes.map((hero) => (
        <HeroCard
          key={hero.id}
          hero={hero}
          onPress={() => handlePress(String(hero.id))}
          onLongPress={() => setPeek(hero)}
          onInfo={() => setPeek(hero)}
        />
      ))}
      {loadingMore &&
        Array.from({ length: 12 }).map((_, i) => (
          <SkeletonCard key={`sk-${i}`} opacity={skeletonOpacity} />
        ))}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* ── Sticky header — navy ─────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingHorizontal: contentPad }] as object}>
        <View style={styles.headerInner}>
          {/* Row 1 — identity: accent · title · description · count */}
          <View style={styles.identityRow}>
            <View style={styles.accentBar} />
            <Text
              style={[styles.title, isDesktop && (styles.titleDesktop as object)] as object}
              numberOfLines={1}
            >
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

          {/* Row 2 — mobile only: full-width search + Filters button.
              On desktop the search lives inside the filter rail. */}
          {!isDesktop && (
            <View style={[styles.controlsRow, styles.controlsRowMobile as object] as object}>
              <View
                style={
                  [
                    styles.searchBar,
                    styles.searchBarMobile as object,
                    searchFocused && (styles.searchBarFocused as object),
                  ] as object
                }
              >
                <Ionicons
                  name="search-outline"
                  size={15}
                  color={searchFocused ? COLORS.orange : 'rgba(245,235,220,0.35)'}
                />
                <TextInput
                  style={styles.searchInput as object}
                  placeholder={`Search ${title.toLowerCase()}…`}
                  placeholderTextColor="rgba(245,235,220,0.3)"
                  value={filters.search}
                  onChangeText={(t) => setFilter('search', t)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  autoCorrect={false}
                />
              </View>

              <Pressable
                onPress={() => setSheetOpen(true)}
                style={
                  [
                    styles.filterBtn,
                    activeChips.length > 0 && (styles.filterBtnActive as object),
                  ] as object
                }
              >
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={activeChips.length > 0 ? COLORS.orange : COLORS.beige}
                />
                <Text
                  style={
                    [
                      styles.filterBtnText,
                      activeChips.length > 0 && (styles.filterBtnTextActive as object),
                    ] as object
                  }
                >
                  Filters
                </Text>
                {activeChips.length > 0 && (
                  <View style={styles.filterBadge as object}>
                    <Text style={styles.filterBadgeText as object}>{activeChips.length}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* ── Mobile-only active-filters strip ──────────────────────────────────
          On desktop the rail is always visible and already shows active state,
          so chips here would only duplicate it. On mobile the filter UI is
          hidden in a sheet, so this scrollable strip is how active filters and
          one-tap removal stay visible. */}
      {!isDesktop && categorySlug && activeChips.length > 0 && (
        <View style={[styles.activeStrip, { paddingHorizontal: contentPad }] as object}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeStripContent as object}
          >
            <ActiveFilterChips slug={categorySlug} filters={filters} setFilter={setFilter} />
            <Pressable
              onPress={reset}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [styles.stripClear, hovered && (styles.stripClearHover as object)] as object
              }
            >
              <Text style={styles.stripClearText as object}>Clear all</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* ── Content: desktop = rail + grid; mobile = grid only ── */}
      <View style={[styles.contentRow, { paddingHorizontal: contentPad }] as object}>
        {isDesktop && categorySlug && (
          <FilterRail
            slug={categorySlug}
            filters={filters}
            counts={counts}
            setFilter={setFilter}
            onReset={reset}
            hasActive={activeChips.length > 0}
            activeCount={activeChips.length}
            searchPlaceholder={`Search ${title.toLowerCase()}…`}
          />
        )}
        <View style={styles.contentMain as object}>
          {loading ? (
            <View style={styles.gridWrap}>
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
            // Plain View (no nested ScrollView) so the grid flows in the
            // document scroll and bleeds under the iOS toolbar, like the skeleton.
            <View style={[styles.gridWrap, { paddingBottom: 0 }] as object}>{grid}</View>
          )}
        </View>
      </View>

      {/* Mobile filter sheet */}
      {categorySlug && (
        <FilterSheet
          open={sheetOpen}
          slug={categorySlug}
          filters={filters}
          counts={counts}
          setFilter={setFilter}
          onReset={reset}
          onClose={() => setSheetOpen(false)}
          total={total}
          hasActive={activeChips.length > 0}
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

  // ── Sticky header (navy) ────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.07)',
    paddingTop: TOPBAR_HEIGHT + 12,
    paddingBottom: 14,
    position: 'sticky',
    top: 0,
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

  // Row 2 — controls (mobile only: search + Filters button on one row)
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  } as object,
  controlsRowMobile: {
    gap: 8,
  } as object,

  // Mobile search bar — dark inset to match the filter surface
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.12)',
    paddingHorizontal: 13,
    height: 44,
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
  } as object,
  searchBarMobile: { flex: 1, minHeight: 44 } as object,
  searchBarFocused: {
    borderColor: 'rgba(231,115,51,0.7)',
    boxShadow: '0 0 0 3px rgba(231,115,51,0.12)',
  } as object,
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 14.5,
    color: COLORS.beige,
    outlineStyle: 'none',
    outlineWidth: 0,
  } as object,

  // Mobile "Filters" button (opens the bottom sheet)
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(245,235,220,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.16)',
    cursor: 'pointer',
    flexShrink: 0,
  } as object,
  filterBtnActive: {
    backgroundColor: 'rgba(231,115,51,0.14)',
    borderColor: 'rgba(231,115,51,0.5)',
  } as object,
  filterBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.beige } as object,
  filterBtnTextActive: { color: COLORS.orange } as object,
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  } as object,
  filterBadgeText: { fontFamily: 'Nunito_900Black', fontSize: 11, color: '#fff' } as object,

  // ── Mobile active-filters strip ─────────────────────────────────────────────
  activeStrip: {
    paddingTop: 12,
  } as object,
  activeStripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 16,
  } as object,
  stripClear: {
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 6,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
    flexShrink: 0,
  } as object,
  stripClearHover: { opacity: 0.6 } as object,
  stripClearText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: COLORS.orange,
    letterSpacing: 0.2,
  } as object,

  // Content layout — desktop rail + grid (centered, max width)
  contentRow: {
    flexDirection: 'row',
    gap: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    flex: 1,
    paddingTop: 16,
  } as object,
  contentMain: { flex: 1, minWidth: 0 } as object,

  // Beige background that grows with the grid: in document-scroll mode the
  // flex:1 ancestors stay bounded to 100dvh (RNW Views set min-height:0), so the
  // grid spills below the fold. gridWrap is a plain View (flexShrink:0), so it
  // grows to the full grid height — its beige fill backs every card, including
  // the ones that scroll under the toolbar, instead of the navy body showing.
  gridWrap: { paddingTop: 16, backgroundColor: COLORS.beige } as object,
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey },
});
