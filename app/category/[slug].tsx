// app/category/[slug].tsx — Category full-list: navy header + search + sort/filter + infinite grid
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { useLocalSearchParams, useRouter, usePathname, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HouseCard } from '../../src/components/family/HouseIndex';
import { useUniverseHouses } from '../../src/hooks/useHouseList';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CATEGORY_LABELS,
  getCategoryFacetCounts,
  type CategorySlug,
  type Hero,
} from '../../src/lib/db/heroes';
import {
  DEFAULT_FILTERS,
  defaultSort,
  visibleFacets,
  activeFilterList,
  type CategoryFilters,
  type FacetCounts,
} from '../../src/lib/db/categoryFilters';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCategoryHeroes,
  useUniverseHeroes,
  useFranchiseHeroes,
  prefetchHeroRow,
} from '../../src/lib/query/heroQueries';
import { publisherBySlug, brandForPublisher } from '../../src/constants/publishers';
import { flattenCategoryPages } from '../../src/lib/query/heroCache';
import { HeroImage } from '../../src/components/HeroImage';
import { BrandLogoView } from '../../src/components/PublisherBadge';
import { COLORS } from '../../src/constants/colors';
import { CategorySkeleton } from '../../src/components/skeletons/CategorySkeleton';
import { FadeOutSkeleton } from '../../src/components/ui/FadeOutSkeleton';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { SEAM } from '../../src/design';
import { categoryGrid, CATEGORY_STAGE } from '../../src/constants/categoryGeometry';

// Publishers (marvel/dc/image/dark-horse) are NOT here — they're universes now,
// served by /universe/[slug] (this same screen, resolved via the registry). Only
// thematic collections remain categories.
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
  'magic',
  'aliens',
  'mythology',
]);

// A one-line editorial tagline per category — gives the navy header warmth and
// purpose without a featured image fighting the portrait art.
const CATEGORY_TAGLINES: Record<CategorySlug, string> = {
  popular: 'The characters everyone’s reading right now.',
  villain: 'The masterminds, monsters, and menaces.',
  xmen: 'Mutants of the X-Men and everyone in their orbit.',
  'anti-heroes': 'Heroes who break the rules to do what’s right.',
  marvel: 'Icons of the Marvel Universe.',
  dc: 'Legends of the DC Universe.',
  image: 'Creator-owned characters from Image Comics.',
  'dark-horse': 'Heroes and villains from Dark Horse.',
  strongest: 'Raw power at the very top of the scale.',
  'most-intelligent': 'The sharpest minds in comics.',
  'most-iconic': 'The faces that defined the medium.',
  'franchise-icons': 'Icons from famous shows, movies, games, and anime.',
  anime: 'Heroes and villains from the biggest anime and manga.',
  'video-games': 'Legends straight out of video-game history.',
  horror: 'The slashers and monsters of horror cinema.',
  magic: 'Sorcerers, mystics, and wielders of the arcane.',
  aliens: 'Born somewhere other than Earth.',
  mythology: 'Gods, monsters, and legends out of myth.',
};
// Shared with CategorySkeleton so the placeholder cannot drift from the real
// layout — see constants/categoryGeometry.
const H_PAD = 16;
const GAP = 8;
// Native search bar sits below the nav bar in the header; the navy stage pads
// down past both so its content clears the floating header + search field.
const SEARCH_BAR_PAD = 16;

// Native header: transparent so the navy stage reads as one continuous surface —
// no opaque bar appearing over the content on scroll. Matches the arena / pick screens.
const headerOptions = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
} as const;

// ── Hero grid card ────────────────────────────────────────────────────────────
function HeroGridCard({
  hero,
  onPress,
  onLongPress,
  size,
}: {
  hero: Hero;
  onPress: () => void;
  onLongPress?: () => void;
  size: { width: number; height: number };
}) {
  return (
    <TouchableOpacity
      style={[styles.card, size]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      activeOpacity={0.82}
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        recyclingKey={String(hero.id)}
        transition={150}
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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Live, not a module constant: the screen and CategorySkeleton both derive
  // from categoryGrid(), and a frozen width would let them disagree the moment
  // an iPad rotates — which is exactly the jump categoryGeometry exists to stop.
  const { width: winW } = useWindowDimensions();
  const grid = categoryGrid(winW);
  const cardSize = { width: grid.cardW, height: grid.cardH };

  // This one screen serves three routes. /franchise/[slug] carries the franchise
  // display name (URL-encoded) and matches heroes.franchise exactly; /category
  // and /universe behave as before.
  const isFranchise = pathname?.startsWith('/franchise') ?? false;
  const franchiseTerm = isFranchise && slug ? decodeURIComponent(slug) : null;
  const categorySlug =
    !isFranchise && VALID_SLUGS.has(slug as CategorySlug) ? (slug as CategorySlug) : null;
  // Any non-category, non-franchise slug is a universe (publisher/studio):
  // a registered brand routes by its ILIKE query, anything else by its raw name.
  const isUniverse = !isFranchise && !categorySlug;
  // A registered brand drives the logo masthead — universes resolve by slug,
  // franchises (God of War, Halo) by their display name.
  const brand = isUniverse
    ? publisherBySlug(slug)
    : isFranchise
      ? brandForPublisher(franchiseTerm)
      : undefined;
  const universeTerm = isUniverse && slug ? (brand?.query ?? decodeURIComponent(slug)) : null;
  const title = categorySlug
    ? CATEGORY_LABELS[categorySlug]
    : (franchiseTerm ?? brand?.name ?? slug ?? 'Characters');

  const [filters, setFilters] = useState<CategoryFilters>(() => ({
    ...DEFAULT_FILTERS,
    sort: defaultSort(categorySlug),
  }));
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState<FacetCounts | null>(null);
  const [navigating, setNavigating] = useState(false);

  const setFilter = useCallback(
    <K extends keyof CategoryFilters>(key: K, value: CategoryFilters[K]) => {
      setFilters((prev) => {
        let next: CategoryFilters = { ...prev, [key]: value };
        // Power sort is meaningless without rated stats — couple them, matching web.
        if (key === 'sort' && value === 'power') next = { ...next, hasStats: true };
        return next;
      });
    },
    [],
  );
  const [peek, setPeek] = useState<PeekHero | null>(null);

  // Charted houses for this world. Empty for almost every universe — the row
  // renders nothing rather than an empty header.
  const houses = useUniverseHouses(universeTerm ?? franchiseTerm);

  const queryClient = useQueryClient();

  // Debounce the search box into the query key so we don't refetch per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryFilters: CategoryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  // One of these is active; the others are disabled (null source) and idle.
  const categoryQuery = useCategoryHeroes(categorySlug, queryFilters);
  const universeQuery = useUniverseHeroes(universeTerm, queryFilters);
  const franchiseQuery = useFranchiseHeroes(franchiseTerm, queryFilters);
  const activeQuery = categorySlug ? categoryQuery : isFranchise ? franchiseQuery : universeQuery;

  useEffect(() => {
    // Facet counts come from a category-keyed RPC; universe pages have no counts.
    if (!categorySlug) {
      // Universe pages have no facet counts. Effect-based fetch (pre-React-Query).
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = activeQuery;

  const heroes = flattenCategoryPages(activeQuery.data);
  const total = activeQuery.data?.pages[0]?.total ?? 0;
  const loading = activeQuery.isPending;
  // pre → bare navy root (a cached page never blinks a skeleton); skeleton →
  // placeholders; crossfade → the grid renders and the skeleton dissolves off it.
  const phase = useSkeletonTransition(loading);
  const loadingMore = isFetchingNextPage;
  const tagline = categorySlug ? CATEGORY_TAGLINES[categorySlug] : null;

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleHeroPress = useCallback(
    (id: string) => {
      if (navigating) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      prefetchHeroRow(queryClient, id);
      setNavigating(true);
      router.push(`/character/${id}`);
      setTimeout(() => setNavigating(false), 1000);
    },
    [router, navigating, queryClient],
  );

  const openPeek = useCallback((hero: Hero) => {
    Haptics.selectionAsync();
    setPeek(hero);
  }, []);

  // The header floats (transparent), so pad the navy stage down to clear it.
  const headerHeight = insets.top + (Platform.OS === 'ios' ? 44 : 56);

  // The set's size, and the only place the page says a filter is narrowing it.
  //
  // This was a gold uppercase eyebrow on its own line ABOVE the title, which
  // read as decoration and cost ~26pt for one number. It is not decoration: it
  // is the status line — it becomes "12 results" while searching and picks up
  // "· Marvel" when the publisher facet is on, so deleting it to save the space
  // would leave a filtered page looking exactly like an unfiltered one. It now
  // shares the tagline's line instead: same information, one line less.
  const countLine = (() => {
    if (search.trim()) return `${total} result${total !== 1 ? 's' : ''}`;
    const base = `${total.toLocaleString()} character${total === 1 ? '' : 's'}`;
    if (filters.publisher === 'marvel') return `${base} · Marvel`;
    if (filters.publisher === 'dc') return `${base} · DC`;
    return base;
  })();

  // Registered universes get a brand masthead: the logo at a fixed height, sized
  // by its badge aspect (mirrors the team screen + the web banner's compact mode,
  // which also drops the desktop portrait montage on phone widths).
  const STAGE_LOGO_H = CATEGORY_STAGE.logoHeight;
  const brandLogo = useMemo(() => {
    if (!brand?.logo || !brand?.badgeSize) return null;
    return {
      logo: brand.logo,
      width: STAGE_LOGO_H * (brand.badgeSize.width / brand.badgeSize.height),
      height: STAGE_LOGO_H,
      tint: brand.logoTint,
    };
  }, [brand]);

  // Everything the placeholder needs to draw THIS page's stage rather than a
  // generic one — all of it derivable from the slug, so it is known on the
  // first frame. A registered universe's masthead is 16pt taller than a title
  // line and as wide as its own logo; the count/tagline line wraps to two on a
  // category (count + middot + an editorial sentence never fit 320pt at 13pt)
  // and stays at one on universes and franchises, which carry no tagline.
  const skeletonStage = {
    topPadding: headerHeight + SEARCH_BAR_PAD,
    mastheadHeight: brandLogo?.height ?? CATEGORY_STAGE.titleLine,
    mastheadWidth: brandLogo?.width ?? ('50%' as const),
    taglineLines: categorySlug ? 2 : 1,
  };

  const listHeader = useMemo(
    () => (
      <>
        {/* Navy stage — a confident, compact header the floating bar + native
            search field sit over. Registered universes get a brand-coloured wash
            + logo masthead; categories + unregistered universes keep the navy
            stage with a title + tagline. Grid-first: portraits lead. */}
        <View style={[styles.stage, { paddingTop: headerHeight + SEARCH_BAR_PAD }]}>
          {brand && (
            <LinearGradient
              colors={[brand.color, brand.colorDark, COLORS.navy]}
              locations={[0, 0.55, 1]}
              start={{ x: 0.9, y: 0 }}
              end={{ x: 0.1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {brandLogo ? (
            <View style={styles.stageLogo}>
              <BrandLogoView
                logo={brandLogo.logo}
                width={brandLogo.width}
                height={brandLogo.height}
                tint={brandLogo.tint}
                shadow
              />
            </View>
          ) : (
            <Text style={styles.stageTitle} numberOfLines={2}>
              {title}
            </Text>
          )}
          {/* Count first — it is the part that moves. The tagline is a fixed
              description and can follow it on the same line; while a search is
              running it is dropped entirely, because "12 results" is the answer
              and the category's blurb is not what you are reading for. */}
          <Text style={styles.tagline} numberOfLines={2}>
            <Text style={styles.taglineCount}>{countLine}</Text>
            {tagline && !search.trim() ? ` · ${tagline}` : ''}
          </Text>
        </View>

        {/* Beige sheet rises up and overlaps the navy stage, then the grid. */}
        <View style={styles.sheetTop} />

        {/* Houses, where this world has any. Sits above the character grid
            because a dynasty is a way INTO the characters, not a sibling of
            them — and it is the only route to the family trees from here. */}
        {houses.length > 0 && (
          <View style={styles.housesRow}>
            <Text style={styles.housesLabel}>{houses.length === 1 ? 'House' : 'Houses'}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.housesTrack}
            >
              {houses.map((h) => (
                <HouseCard key={h.slug} house={h} width={172} />
              ))}
            </ScrollView>
          </View>
        )}
      </>
    ),

    [countLine, search, tagline, title, headerHeight, brand, brandLogo, houses],
  );

  const visible = visibleFacets(categorySlug);
  const anyActive =
    activeFilterList(categorySlug, filters).length > 0 ||
    filters.sort !== defaultSort(categorySlug);

  const lbl = (text: string, count?: number) =>
    typeof count === 'number' && count > 0 ? `${text} (${count.toLocaleString()})` : text;

  const resetFilters = useCallback(() => {
    setFilters({
      ...DEFAULT_FILTERS,
      sort: defaultSort(categorySlug),
    });
  }, [categorySlug]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={headerOptions} />
      <StatusBar style="light" />

      {/* Native search bar in the nav header — collapses on scroll. */}
      <Stack.SearchBar
        placeholder={`Search ${title.toLowerCase()}…`}
        onChangeText={(e) => setSearch(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearch('')}
        hideWhenScrolling
        autoCapitalize="none"
      />

      {/* Native sort + filter as a single header pull-down menu. */}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={anyActive ? 'line.3.horizontal.decrease.circle.fill' : 'line.3.horizontal.decrease'}
        >
          <Stack.Toolbar.Menu inline title="Sort">
            <Stack.Toolbar.MenuAction
              isOn={filters.sort === 'popular'}
              onPress={() => setFilter('sort', 'popular')}
            >
              Popular
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={filters.sort === 'az'}
              onPress={() => setFilter('sort', 'az')}
            >
              A–Z
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={filters.sort === 'power'}
              onPress={() => setFilter('sort', 'power')}
            >
              Power
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>

          {visible.includes('publisher') && (
            <Stack.Toolbar.Menu inline title="Publisher">
              <Stack.Toolbar.MenuAction
                isOn={filters.publisher === 'all'}
                onPress={() => setFilter('publisher', 'all')}
              >
                {lbl('All publishers', counts?.publisher.all)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.publisher === 'marvel'}
                onPress={() => setFilter('publisher', 'marvel')}
              >
                {lbl('Marvel', counts?.publisher.marvel)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.publisher === 'dc'}
                onPress={() => setFilter('publisher', 'dc')}
              >
                {lbl('DC', counts?.publisher.dc)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.publisher === 'other'}
                onPress={() => setFilter('publisher', 'other')}
              >
                {lbl('Other', counts?.publisher.other)}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )}

          {visible.includes('alignment') && (
            <Stack.Toolbar.Menu inline title="Alignment">
              <Stack.Toolbar.MenuAction
                isOn={filters.alignment === 'any'}
                onPress={() => setFilter('alignment', 'any')}
              >
                Any
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.alignment === 'good'}
                onPress={() => setFilter('alignment', 'good')}
              >
                {lbl('Good', counts?.alignment.good)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.alignment === 'bad'}
                onPress={() => setFilter('alignment', 'bad')}
              >
                {lbl('Bad', counts?.alignment.bad)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.alignment === 'neutral'}
                onPress={() => setFilter('alignment', 'neutral')}
              >
                {lbl('Neutral', counts?.alignment.neutral)}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )}

          {visible.includes('gender') && (
            <Stack.Toolbar.Menu inline title="Gender">
              <Stack.Toolbar.MenuAction
                isOn={filters.gender === 'any'}
                onPress={() => setFilter('gender', 'any')}
              >
                Any
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.gender === 'male'}
                onPress={() => setFilter('gender', 'male')}
              >
                {lbl('Male', counts?.gender.male)}
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.gender === 'female'}
                onPress={() => setFilter('gender', 'female')}
              >
                {lbl('Female', counts?.gender.female)}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )}

          {visible.includes('hasStats') && (
            <Stack.Toolbar.Menu inline title="Power stats">
              <Stack.Toolbar.MenuAction
                isOn={!filters.hasStats}
                onPress={() => setFilter('hasStats', false)}
              >
                Any
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                isOn={filters.hasStats}
                onPress={() => setFilter('hasStats', true)}
              >
                {lbl('Rated only', counts?.has_stats)}
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )}

          {anyActive && (
            <Stack.Toolbar.Menu inline>
              <Stack.Toolbar.MenuAction onPress={resetFilters}>
                Reset filters
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          )}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {loading ? (
        phase === 'skeleton' ? (
          <CategorySkeleton {...skeletonStage} />
        ) : null
      ) : (
        <FlatList
          style={styles.list}
          data={heroes}
          keyExtractor={(h) => String(h.id)}
          // FlatList cannot change numColumns in place — RN warns and the rows
          // render at the old count — so the key forces a fresh list when the
          // window resizes past a column boundary.
          key={grid.columns}
          numColumns={grid.columns}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <HeroGridCard
              hero={item}
              size={cardSize}
              onPress={() => handleHeroPress(String(item.id))}
              onLongPress={() => openPeek(item)}
            />
          )}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            // getCategoryPage throws, so isError is real here — it just was not
            // being read. An outage rendered the empty-result copy, which tells
            // the reader their FILTER is wrong when the network is the problem.
            activeQuery.isError ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn’t load these characters"
                body="Check your connection and try again."
                action={{ label: 'Try again', onPress: () => void activeQuery.refetch() }}
                tone="light"
                compact
              />
            ) : (
              <EmptyState
                icon="search-outline"
                title="No characters found"
                body="Try a different search, or clear a filter."
                tone="light"
                compact
              />
            )
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

      {/* The grid sits settled underneath; only this layer animates. */}
      {phase === 'crossfade' ? (
        <FadeOutSkeleton>
          <CategorySkeleton {...skeletonStage} />
        </FadeOutSkeleton>
      ) : null}

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
  housesRow: { paddingTop: 6, paddingBottom: 14, gap: 10 },
  housesLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: '#a99b84',
    paddingHorizontal: 16,
  },
  housesTrack: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  root: { flex: 1, backgroundColor: COLORS.navy },
  list: { flex: 1, backgroundColor: COLORS.navy },
  listContent: { backgroundColor: COLORS.beige, flexGrow: 1 },

  // Navy stage — compact header region (top padding applied inline to clear the header)
  stage: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: H_PAD,
    paddingBottom: CATEGORY_STAGE.paddingBottom,
    overflow: 'hidden', // clip the brand gradient wash to the stage
  },
  stageLogo: { alignSelf: 'flex-start' },

  stageTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    color: COLORS.beige,
    lineHeight: CATEGORY_STAGE.titleLine,
  },
  taglineCount: { fontFamily: 'Nunito_700Bold', color: COLORS.goldAccent },
  tagline: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: CATEGORY_STAGE.taglineLine,
    color: 'rgba(245,235,220,0.6)',
    marginTop: CATEGORY_STAGE.taglineGap,
    maxWidth: 320,
  },

  // Beige sheet — a slim rounded cap that rises over the navy stage, leading
  // into the grid. (Search + sort/filter now live in the native header.)
  sheetTop: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: SEAM.radius,
    borderTopRightRadius: SEAM.radius,
    borderCurve: 'continuous',
    marginTop: -SEAM.overlap,
    height: CATEGORY_STAGE.capHeight,
  },

  // Grid
  row: { gap: GAP, marginBottom: GAP, paddingHorizontal: H_PAD },
  card: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    padding: 6,
  },
  cardName: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.beige, lineHeight: 14 },

  // States
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
});
