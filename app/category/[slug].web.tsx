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
import { Ionicons } from '@expo/vector-icons';
import {
  getCategoryPage,
  getUniversePage,
  getCategoryFacetCounts,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type CategorySlug,
  type Hero,
} from '../../src/lib/db/heroes';
import { publisherBySlug } from '../../src/constants/publishers';
import { SeoHead } from '../../src/components/web/SeoHead';
import {
  activeFilterList,
  type CategoryFilters,
  type FacetCounts,
} from '../../src/lib/db/categoryFilters';
import { useCategoryFilters } from '../../src/hooks/useCategoryFilters';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { FilterRail } from '../../src/components/web/category/FilterRail';
import { FilterSheet } from '../../src/components/web/category/FilterSheet';
import { ActiveFilterChips } from '../../src/components/web/category/ActiveFilterChips';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS, SURFACE, SURFACE_GRADIENT, SEAM_COLOR } from '../../src/constants/colors';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { BrowseBanner } from '../../src/components/web/category/BrowseBanner';

// Publishers (marvel/dc/image/dark-horse) are NOT here — they're universes now,
// served by /universe/[slug] (this same screen, resolved via the registry).
const VALID_SLUGS = new Set<CategorySlug>([
  'popular',
  'villain',
  'xmen',
  'anti-heroes',
  'strongest',
  'most-intelligent',
  'most-iconic',
  'franchise-icons',
  'anime',
  'video-games',
  'horror',
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
          <HeroImage
            id={String(hero.id)}
            name={hero.name}
            imageUrl={hero.image_url}
            portraitUrl={hero.portrait_url}
            imageMdUrl={hero.image_md_url}
            grid
            contentFit="cover"
            contentPosition={{ top: 0, left: '50%' }}
            style={StyleSheet.absoluteFill}
            recyclingKey={String(hero.id)}
            transition={150}
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
    // Scrim in canvas ink (not navy): every card's lower third melts toward the
    // gallery floor, giving the grid a shared footer that quiets the per-card art
    // colours (the "patchwork") and keeps the white name legible over any art.
    backgroundImage:
      'linear-gradient(to top, rgba(11,24,32,0.98) 0%, rgba(11,24,32,0.6) 26%, rgba(11,24,32,0.12) 48%, transparent 70%)',
  } as object,
  bottom: { position: 'absolute', bottom: 12, left: 12, right: 12 },
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
  // Non-category slugs are universes (publisher/studio/franchise): a registered
  // brand routes by its ILIKE query, otherwise the raw name.
  const brand = !categorySlug ? publisherBySlug(slug) : undefined;
  const universeTerm = !categorySlug && slug ? (brand?.query ?? decodeURIComponent(slug)) : null;
  const title = categorySlug ? CATEGORY_LABELS[categorySlug] : (brand?.name ?? slug ?? 'Heroes');
  const description = categorySlug ? CATEGORY_DESCRIPTIONS[categorySlug] : null;

  const { filters, setFilter, reset } = useCategoryFilters(categorySlug);
  const activeChips = activeFilterList(categorySlug, filters);
  // Both category and universe pages get the filter UI (universe omits publisher).
  const browsable = !!categorySlug || !!universeTerm;

  const fetchPage = useCallback(
    async (page: number, f: CategoryFilters, append = false) => {
      if (!categorySlug && !universeTerm) return;
      if (page === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const result = categorySlug
          ? await getCategoryPage(categorySlug, { page, pageSize: PAGE_SIZE, ...f })
          : await getUniversePage(universeTerm!, { page, pageSize: PAGE_SIZE, ...f });
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
    [categorySlug, universeTerm],
  );

  // Refetch page 0 + facet counts whenever filters change. Search is debounced;
  // facet selections apply immediately. Universe pages have no facet counts.
  useEffect(() => {
    if (!categorySlug && !universeTerm) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => {
        fetchPage(0, filters);
        if (categorySlug) {
          getCategoryFacetCounts(categorySlug, filters)
            .then(setCounts)
            .catch(() => setCounts(null));
        } else {
          setCounts(null);
        }
      },
      filters.search ? 300 : 0,
    );
    return () => clearTimeout(searchTimer.current);
  }, [categorySlug, universeTerm, filters, fetchPage]);

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/character/${id}`);
    },
    [router],
  );

  // Banner montage: always lead with the universe's most-popular hero, then a
  // random handful from the rest of the top tier — recognizable but varied, and
  // re-rolled each visit. Stable across pagination (keyed on the top hero only).
  const [montageUrls, setMontageUrls] = useState<string[]>([]);
  const topHeroId = heroes[0]?.id;
  useEffect(() => {
    if (heroes.length === 0) {
      setMontageUrls([]);
      return;
    }
    const pool = heroes.slice(1, 24);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setMontageUrls(
      [heroes[0], ...pool.slice(0, 5)]
        .map((h) => h.portrait_url ?? h.image_url)
        .filter((u): u is string => !!u),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topHeroId]);

  const [peek, setPeek] = useState<PeekHero | null>(null);

  // Keep ref in sync — scroll handler reads this to avoid firing multiple fetches
  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  // Ink-topped over a beige canvas, declared together. The grid bleeds
  // edge-to-edge under the iOS Safari toolbar and reads continuous to the bottom
  // past the 100dvh fold.
  // Browse pages are a dark "gallery": deepNavy canvas so the colourful cards
  // (navy `band`) lift off it — universe + category alike. Other pages stay beige.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

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
      ? 'repeat(auto-fill, minmax(160px, 1fr))'
      : 'repeat(auto-fill, minmax(108px, 1fr))',
    gap: 15,
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
      <SeoHead
        title={`${title} | Mythique`}
        description={description ?? `Browse ${title} on Mythique — the superhero encyclopedia.`}
        path={categorySlug ? `/category/${slug}` : `/universe/${slug}`}
      />
      {/* Faction banner — registered universes get a brand-coloured stage with
          their marquee hero. Categories + unregistered universes keep the slim
          header below. Scrolls away; the sticky header carries the title after. */}
      {brand && (
        <BrowseBanner
          title={title}
          color={brand.color}
          colorDark={brand.colorDark}
          total={total}
          leadName={heroes[0]?.name}
          logo={brand.logo}
          badgeSize={brand.badgeSize}
          logoTint={brand.logoTint}
          heroImageUrls={montageUrls}
          compact={!isDesktop}
          sticky={isDesktop}
        />
      )}
      {/* ── Sticky header ────────────────────────────────────────────────────────
          The faction banner is the identity for universes, so on desktop it
          fully replaces this bar; on mobile we keep it for the search + filter
          controls but drop its (duplicate) title row. */}
      {(!isDesktop || !brand) && (
        <View
          style={
            [
              styles.header,
              { paddingHorizontal: contentPad },
              // Universe (mobile): the banner is the masthead, so this bar is just
              // controls — drop the big nav-clearance top padding and stick it
              // right below the nav instead, so it isn't an awkward tall slab.
              brand ? (styles.headerControlsOnly as object) : undefined,
            ] as object
          }
        >
          <View style={styles.headerInner}>
            {/* Row 1 — identity (categories only; universes use the banner, which
                collapses to a sticky bar on scroll). */}
            {!brand && (
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
              </View>
            )}

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
                  <Ionicons name="search" size={16} color={COLORS.orange} />
                  <TextInput
                    style={styles.searchInput as object}
                    placeholder={`Search ${title}…`}
                    placeholderTextColor="rgba(245,235,220,0.4)"
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
      )}

      {/* ── Mobile-only active-filters strip ──────────────────────────────────
          On desktop the rail is always visible and already shows active state,
          so chips here would only duplicate it. On mobile the filter UI is
          hidden in a sheet, so this scrollable strip is how active filters and
          one-tap removal stay visible. */}
      {!isDesktop && browsable && activeChips.length > 0 && (
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
      <View
        style={
          [
            styles.contentRow,
            { paddingHorizontal: contentPad },
            // Mobile: pull the grid up close under the floating deck (the deck's
            // own paddingBottom already gives a little air).
            !isDesktop ? ({ paddingTop: 6 } as object) : undefined,
            // Guarantee enough scroll room for the logo to fully detach + park,
            // even when the grid and filter rail are both short.
            brand && isDesktop ? ({ minHeight: 'calc(100vh - 60px)' } as object) : undefined,
          ] as object
        }
      >
        {isDesktop && browsable && (
          <FilterRail
            slug={categorySlug}
            filters={filters}
            counts={counts}
            setFilter={setFilter}
            onReset={reset}
            hasActive={activeChips.length > 0}
            activeCount={activeChips.length}
            searchPlaceholder={`Search ${title}…`}
          />
        )}
        <View style={styles.contentMain as object}>
          {/* Result count + active filters live with the grid on desktop, where
              they're actionable — not orphaned in the header corner. */}
          {isDesktop && browsable && (
            <View style={styles.resultsBar as object}>
              <Text style={styles.resultsCount as object}>
                {loading
                  ? 'Searching…'
                  : `${total.toLocaleString()} ${total === 1 ? 'result' : 'results'}`}
              </Text>
              {activeChips.length > 0 && (
                <View style={styles.resultsBarFilters as object}>
                  <ActiveFilterChips slug={categorySlug} filters={filters} setFilter={setFilter} />
                  <Pressable
                    onPress={reset}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [
                        styles.resultsClear,
                        hovered && (styles.resultsClearHover as object),
                      ] as object
                    }
                  >
                    <Text style={styles.resultsClearText as object}>Clear all</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
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
              <Ionicons name="search-outline" size={34} color="rgba(29,45,51,0.25)" />
              <Text style={styles.empty}>
                {activeChips.length > 0 ? 'No heroes match these filters' : 'No heroes found'}
              </Text>
              {activeChips.length > 0 && (
                <Pressable
                  onPress={reset}
                  style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                    [styles.emptyClear, hovered && (styles.emptyClearHover as object)] as object
                  }
                >
                  <Ionicons name="close" size={15} color={COLORS.beige} />
                  <Text style={styles.emptyClearText as object}>Clear filters</Text>
                </Pressable>
              )}
            </View>
          ) : (
            // Plain View (no nested ScrollView) so the grid flows in the
            // document scroll and bleeds under the iOS toolbar, like the skeleton.
            <View style={[styles.gridWrap, { paddingBottom: 0 }] as object}>{grid}</View>
          )}
        </View>
      </View>

      {/* Mobile filter sheet */}
      {browsable && (
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
  // Grows with content (not `flex: 1`, which clamps to one viewport and breaks
  // the sticky controls bar past the first screen of scroll — the document, not
  // this View, is the scroller).
  root: { minHeight: '100vh' as unknown as number, backgroundColor: SURFACE.ink },

  // ── Sticky header (ink→navy gradient) ───────────────────────────────────────
  header: {
    // Ink→navy gradient over a navy base: deepNavy under the status bar easing
    // into navy where the title/search sit — depth without a flat slab. The
    // generous top padding keeps the fade well clear of the title.
    backgroundColor: COLORS.navy,
    backgroundImage: SURFACE_GRADIENT.stage,
    // Seam: a warm orange hairline + the soft drop below read as an engineered
    // page edge where the dark band meets the beige grid scrolling under it.
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
    paddingTop: TOPBAR_HEIGHT + 18,
    paddingBottom: 18,
    position: 'sticky',
    top: 0,
    zIndex: 40,
    boxShadow: '0 14px 28px -20px rgba(0,0,0,0.7)',
  } as object,
  // Universe mobile: controls-only bar — fully transparent (the chips carry the
  // navy glass). Sticks just below the floating nav so it reads as one surface.
  headerControlsOnly: {
    paddingTop: 6,
    paddingBottom: 4,
    // Pinned position: tuck right under the nav (a touch higher than its own
    // height) so the deck sits close to the topbar on scroll, not floating below.
    top: TOPBAR_HEIGHT - 8,
    // Pull the controls up so they straddle the banner's bottom edge (floating
    // control deck) and the grid shifts up with them. Negative margin only sets
    // the resting position — sticky still pins the bar at the nav on scroll.
    marginTop: -34,
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    borderBottomWidth: 0,
    boxShadow: 'none',
  } as object,
  headerInner: {
    maxWidth: 1680,
    width: '100%',
    alignSelf: 'center',
    gap: 14,
  } as object,

  // Row 1 — identity
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    color: 'rgba(245,235,220,0.58)',
    flexShrink: 1,
    minWidth: 0,
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

  // Mobile search bar — navy glass chip (frosted dark) with light text, so it
  // belongs with the dark topbar while floating over the cards on scroll.
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(41,60,67,0.6)',
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    paddingHorizontal: 13,
    height: 46,
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
  } as object,
  searchBarMobile: { flex: 1, minHeight: 46 } as object,
  searchBarFocused: {
    borderColor: 'rgba(231,115,51,0.8)',
    boxShadow: '0 0 0 3px rgba(231,115,51,0.16)',
  } as object,
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 14.5,
    color: COLORS.beige,
    outlineStyle: 'none',
    outlineWidth: 0,
  } as object,

  // Mobile "Filters" button (opens the bottom sheet) — matching navy glass.
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(41,60,67,0.6)',
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    cursor: 'pointer',
    flexShrink: 0,
  } as object,
  filterBtnActive: {
    backgroundColor: 'rgba(231,115,51,0.2)',
    borderColor: 'rgba(231,115,51,0.6)',
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

  // Content layout — desktop rail + grid (centered, max width).
  // flexGrow:1 + flexShrink:0 (not flex:1) so the row grows to the full grid
  // height instead of being capped at one viewport by RNW's min-height:0. The
  // sticky rail's containing block is this row, so it must span the whole
  // scrollable content for the rail to stay stuck past the first fold — while
  // flexGrow still fills the viewport when the grid is short.
  contentRow: {
    flexDirection: 'row',
    gap: 24,
    maxWidth: 1680,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
    flexShrink: 0,
    paddingTop: 16,
  } as object,
  contentMain: { flex: 1, minWidth: 0 } as object,

  // Beige background that grows with the grid: in document-scroll mode the
  // flex:1 ancestors stay bounded to 100dvh (RNW Views set min-height:0), so the
  // grid spills below the fold. gridWrap is a plain View (flexShrink:0), so it
  // grows to the full grid height — its beige fill backs every card, including
  // the ones that scroll under the toolbar, instead of the navy body showing.
  gridWrap: { paddingTop: 4, backgroundColor: SURFACE.ink } as object,

  // ── Desktop results bar (count + active filters, above the grid) ─────────────
  resultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    minHeight: 30,
  } as object,
  resultsCount: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.55)',
    letterSpacing: 0.2,
  } as object,
  resultsBarFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  } as object,
  resultsClear: {
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 4,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  resultsClearHover: { opacity: 0.6 } as object,
  resultsClearText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: COLORS.orange,
    letterSpacing: 0.2,
  } as object,

  // ── Empty state ──────────────────────────────────────────────────────────────
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 80 },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey },
  emptyClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: COLORS.orange,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  emptyClearHover: { opacity: 0.85 } as object,
  emptyClearText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13.5,
    color: COLORS.beige,
    letterSpacing: 0.2,
  } as object,
});
