// app/category/[slug].web.tsx — Full grid view for a hero category (web)
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { useSkeletonGlow } from '../../src/components/web/Skeleton';
import { useLocalSearchParams, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getUniverseMontage,
  getCategoryMontage,
  getFranchiseMontage,
  getCategoryFacetCounts,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type CategorySlug,
  type Hero,
} from '../../src/lib/db/heroes';
import {
  useCategoryHeroes,
  useUniverseHeroes,
  useFranchiseHeroes,
} from '../../src/lib/query/heroQueries';
import { flattenCategoryPages } from '../../src/lib/query/heroCache';
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

// ── Skeleton card (mirrors HeroCard: same shape + a faint name-bar hint) ───────
// Surface-navy fill with a calm unison breath (see useSkeletonGlow); the card
// silhouette + name line make it read as a deliberate placeholder for the real
// card, so the swap to content is seamless.
function SkeletonCard() {
  const ref = useSkeletonGlow(true);
  return (
    <View ref={ref} style={sk.wrap as object}>
      <View style={sk.nameBar as object} />
    </View>
  );
}

const sk = StyleSheet.create({
  wrap: {
    width: '100%', // WebKit won't stretch an aspect-ratio grid item to the track — force the inline size
    borderRadius: 10,
    aspectRatio: '3 / 4',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 12,
  } as object,
  // Hints the hero name that sits bottom-left on the real card.
  nameBar: {
    width: '64%',
    height: 11,
    borderRadius: 4,
    backgroundColor: 'rgba(245,235,220,0.12)',
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
            blurhash={hero.portrait_blurhash}
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
export default function WebCategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isWide = width >= 1100; // show description inline

  const [counts, setCounts] = useState<FacetCounts | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Reveal the grid by fading it up OVER an opaque skeleton (which then unmounts)
  // — no double-transparency dip, no hard "pop".
  const gridFade = useRef(new Animated.Value(0)).current;
  const [skelMounted, setSkelMounted] = useState(true);

  const pathname = usePathname();
  // /franchise/[slug] carries the franchise display name (URL-encoded) and
  // matches heroes.franchise exactly; /category and /universe behave as before.
  const isFranchise = pathname?.startsWith('/franchise') ?? false;
  const franchiseTerm = isFranchise && slug ? decodeURIComponent(slug) : null;
  const categorySlug =
    !isFranchise && VALID_SLUGS.has(slug as CategorySlug) ? (slug as CategorySlug) : null;
  // Non-category, non-franchise slugs are universes (publisher/studio): a
  // registered brand routes by its ILIKE query, otherwise the raw name.
  const isUniverse = !isFranchise && !categorySlug;
  const brand = isUniverse ? publisherBySlug(slug) : undefined;
  const universeTerm = isUniverse && slug ? (brand?.query ?? decodeURIComponent(slug)) : null;
  const title = categorySlug
    ? CATEGORY_LABELS[categorySlug]
    : (franchiseTerm ?? brand?.name ?? slug ?? 'Heroes');
  const description = categorySlug ? CATEGORY_DESCRIPTIONS[categorySlug] : null;
  // Every browse page leads with a masthead banner — the consistent pattern:
  // a registered brand gets the logo stage; everything else (categories,
  // unregistered universes, franchises) gets the editorial stage (headline +
  // roster montage). The banner is always the identity, so the slim header
  // below is controls-only.
  const hasBanner = !!categorySlug || !!universeTerm || !!franchiseTerm;

  const { filters, setFilter, reset } = useCategoryFilters(categorySlug);
  const activeChips = activeFilterList(categorySlug, filters);
  // Category, universe, and franchise pages all get the filter UI.
  const browsable = !!categorySlug || !!universeTerm || !!franchiseTerm;

  // Debounce the search box into the query key so we don't refetch per keystroke;
  // facet selections (no search text) apply immediately. Mirrors the native screen.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), filters.search ? 300 : 0);
    return () => clearTimeout(t);
  }, [filters.search]);
  const queryFilters: CategoryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  // One infinite list is active; the other is disabled (null source) and idle.
  // React Query owns pagination + caching, so revisiting (e.g. back from a
  // character) restores the loaded grid + scroll instead of refetching page 0.
  const categoryQuery = useCategoryHeroes(categorySlug, queryFilters);
  const universeQuery = useUniverseHeroes(universeTerm, queryFilters);
  const franchiseQuery = useFranchiseHeroes(franchiseTerm, queryFilters);
  const activeQuery = categorySlug ? categoryQuery : isFranchise ? franchiseQuery : universeQuery;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = activeQuery;

  const heroes = flattenCategoryPages(activeQuery.data);
  const total = activeQuery.data?.pages[0]?.total ?? 0;
  const loading = activeQuery.isPending;
  const loadingMore = isFetchingNextPage;

  // Facet counts come from a category-keyed RPC; universe pages have none.
  useEffect(() => {
    if (!categorySlug) {
      setCounts(null);
      return;
    }
    let cancelled = false;
    getCategoryFacetCounts(categorySlug, queryFilters)
      .then((c) => {
        if (!cancelled) setCounts(c);
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [categorySlug, queryFilters]);

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/character/${id}`);
    },
    [router],
  );

  // Banner montage: always lead with the universe's most-popular hero, then a
  // random handful from the rest of the top tier — recognizable but varied, and
  // re-rolled each visit. Fetched on its OWN tiny query keyed on the slug, so the
  // portraits start loading immediately — not gated on the full, filterable grid
  // page (and unaffected by filter changes). Each carries a BlurHash for an
  // instant placeholder.
  const [montage, setMontage] = useState<{ uri: string; blurhash?: string | null }[]>([]);
  // Build the shuffled banner montage from a montage-row source (lead hero first,
  // then a varied handful from the top tier — re-rolled each visit).
  const buildMontage = useCallback(
    (
      rows: {
        portrait_url: string | null;
        image_url: string | null;
        portrait_blurhash: string | null;
      }[],
    ) => {
      if (rows.length === 0) return [];
      const pool = rows.slice(1, 24);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return [rows[0], ...pool.slice(0, 5)]
        .map((h) => ({ uri: h.portrait_url ?? h.image_url, blurhash: h.portrait_blurhash }))
        .filter((m): m is { uri: string; blurhash: string | null } => !!m.uri);
    },
    [],
  );

  // Editorial (category) montage — same instant-loading pattern as the universe
  // one, but sourced from the category's top heroes (full colour in the banner).
  const [catMontage, setCatMontage] = useState<{ uri: string; blurhash?: string | null }[]>([]);
  useEffect(() => {
    if (!categorySlug) {
      setCatMontage([]);
      return;
    }
    let cancelled = false;
    getCategoryMontage(categorySlug)
      .then((rows) => {
        if (!cancelled) setCatMontage(buildMontage(rows));
      })
      .catch(() => {
        if (!cancelled) setCatMontage([]);
      });
    return () => {
      cancelled = true;
    };
  }, [categorySlug, buildMontage]);

  useEffect(() => {
    if (!universeTerm) {
      setMontage([]);
      return;
    }
    let cancelled = false;
    getUniverseMontage(universeTerm)
      .then((rows) => {
        if (!cancelled) setMontage(buildMontage(rows));
      })
      .catch(() => {
        if (!cancelled) setMontage([]);
      });
    return () => {
      cancelled = true;
    };
  }, [universeTerm, buildMontage]);

  // Franchise montage — same instant-loading pattern, sourced from the franchise
  // roster. Lets brand-less franchise pages lead with the editorial banner too.
  const [franchiseMontage, setFranchiseMontage] = useState<
    { uri: string; blurhash?: string | null }[]
  >([]);
  useEffect(() => {
    if (!franchiseTerm) {
      setFranchiseMontage([]);
      return;
    }
    let cancelled = false;
    getFranchiseMontage(franchiseTerm)
      .then((rows) => {
        if (!cancelled) setFranchiseMontage(buildMontage(rows));
      })
      .catch(() => {
        if (!cancelled) setFranchiseMontage([]);
      });
    return () => {
      cancelled = true;
    };
  }, [franchiseTerm, buildMontage]);

  // Drive the reveal. When page-0 data lands, fade the grid up over the opaque
  // skeleton, then unmount the skeleton; on a fresh load (re)arm it.
  const gridReady = !loading && heroes.length > 0;
  useEffect(() => {
    if (gridReady) {
      gridFade.setValue(0);
      Animated.timing(gridFade, { toValue: 1, duration: 320, useNativeDriver: true }).start(
        ({ finished }) => finished && setSkelMounted(false),
      );
    } else {
      gridFade.setValue(0);
      setSkelMounted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridReady]);

  const [peek, setPeek] = useState<PeekHero | null>(null);

  // Ink-topped over a beige canvas, declared together. The grid bleeds
  // edge-to-edge under the iOS Safari toolbar and reads continuous to the bottom
  // past the 100dvh fold.
  // Browse pages are a dark "gallery": deepNavy canvas so the colourful cards
  // (navy `band`) lift off it — universe + category alike. Other pages stay beige.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  // Infinite load rides the document scroll (the nested ScrollView is gone), so
  // measure against the window rather than a ScrollView's nativeEvent. React
  // Query gates concurrent fetches via hasNextPage/isFetchingNextPage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (distanceFromBottom < 400 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
      {loadingMore && Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
    </View>
  );

  return (
    <View style={styles.root}>
      <SeoHead
        title={`${title} | Mythique`}
        description={description ?? `Browse ${title} on Mythique — every universe, every icon.`}
        path={categorySlug ? `/category/${slug}` : `/universe/${slug}`}
      />
      {/* Masthead banner. Registered universes get a brand-coloured stage with a
          logo + marquee hero; categories get the editorial stage (display
          headline + thesis + full-colour roster). Unregistered universes keep the
          slim header below. Scrolls away; the headline detaches + parks. */}
      {brand ? (
        <BrowseBanner
          title={title}
          color={brand.color}
          colorDark={brand.colorDark}
          total={total}
          leadName={heroes[0]?.name}
          logo={brand.logo}
          badgeSize={brand.badgeSize}
          logoTint={brand.logoTint}
          montage={montage}
          compact={!isDesktop}
          sticky={isDesktop}
        />
      ) : hasBanner ? (
        // Consistent fallback: categories, unregistered universes, and franchises
        // all lead with the editorial stage (headline + roster montage).
        <BrowseBanner
          editorial
          title={title}
          description={description}
          total={total}
          unitLabel={categorySlug ? 'RESULT' : 'CHARACTER'}
          montage={categorySlug ? catMontage : franchiseTerm ? franchiseMontage : montage}
          compact={!isDesktop}
          sticky={isDesktop}
        />
      ) : null}
      {/* ── Sticky header ────────────────────────────────────────────────────────
          The faction banner is the identity for universes, so on desktop it
          fully replaces this bar; on mobile we keep it for the search + filter
          controls but drop its (duplicate) title row. */}
      {(!isDesktop || !hasBanner) && (
        <View
          style={
            [
              styles.header,
              { paddingHorizontal: contentPad },
              // Banner pages (mobile): the masthead is the identity, so this bar is
              // just controls — drop the big nav-clearance top padding and stick it
              // right below the nav instead, so it isn't an awkward tall slab.
              hasBanner ? (styles.headerControlsOnly as object) : undefined,
            ] as object
          }
        >
          <View style={styles.headerInner}>
            {/* Row 1 — identity (banner-less pages only; banner pages use the
                masthead, which collapses to a sticky bar on scroll). */}
            {!hasBanner && (
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
            // Guarantee enough scroll room for the headline to fully detach +
            // park, even when the grid and filter rail are both short.
            hasBanner && isDesktop ? ({ minHeight: 'calc(100vh - 60px)' } as object) : undefined,
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
          {!loading && heroes.length === 0 ? (
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
            // Plain View (no nested ScrollView) so the grid flows in the document
            // scroll and bleeds under the iOS toolbar, like the skeleton. The
            // skeleton overlay crossfades out over the grid as data lands.
            <View style={[styles.gridWrap, styles.gridStack, { paddingBottom: 0 }] as object}>
              {/* Skeleton sits BEHIND, fully opaque: in-flow while it's the only
                  content (defines height), an absolute backdrop once the grid is
                  mounting on top of it. */}
              {skelMounted && (
                <View
                  pointerEvents="none"
                  style={(heroes.length > 0 ? StyleSheet.absoluteFill : undefined) as object}
                >
                  <View style={gridStyle as object}>
                    {Array.from({ length: 24 }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </View>
                </View>
              )}
              {heroes.length > 0 && (
                <Animated.View style={{ opacity: gridFade }}>{grid}</Animated.View>
              )}
            </View>
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
  // Anchor for the absolutely-positioned skeleton overlay during the crossfade.
  gridStack: { position: 'relative' } as object,

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
