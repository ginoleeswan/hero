// app/(tabs)/search/index.tsx — Search tab.
// • Native iOS search field in the tab bar (role="search" + Stack.SearchBar).
// • Filters: FilterChips rows in the CONTENT, on every platform, shown only
//   with results. They were an iOS-only Stack.Toolbar of two unlabelled glyphs.
// • One publisher-aware fetch path: empty query → top heroes for the selected
//   publisher (DB-side); non-empty → alias/typo-tolerant search_heroes RPC.
// • Idle is a BROWSE surface, ordered history → widest door → narrowest:
//   Recently Viewed (works signed out), recent queries, the category pods,
//   then the publisher tiles. No "Search" heading — the tab is named Search and
//   the field is pinned to the bottom on iOS 26, so a title at the top named
//   the room from the far end of it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { SearchBarCommands } from 'react-native-screens';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS, INK_TEXT } from '../../../src/constants/colors';
import { RADIUS } from '../../../src/design';
import { PortraitCard } from '../../../src/components/search/PortraitCard';
import { UniverseResultRow } from '../../../src/components/search/UniverseResultRow';
import { TeamResultRow } from '../../../src/components/search/TeamResultRow';
import { TitleResultRow } from '../../../src/components/search/TitleResultRow';
import { TopResultRow } from '../../../src/components/search/TopResultRow';
import { FilterChips, type FilterOption } from '../../../src/components/search/FilterChips';
import { AccentRail } from '../../../src/components/search/AccentRail';
import { CategoryPodGrid } from '../../../src/components/home/CategoryPodGrid';
import { PublisherGrid } from '../../../src/components/home/PublisherGrid';
import { HeroPeek, type PeekHero } from '../../../src/components/compare/HeroPeek';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../../src/components/ui/SkeletonProvider';
import { FadeOutSkeleton } from '../../../src/components/ui/FadeOutSkeleton';
import { useSkeletonTransition } from '../../../src/hooks/useSkeletonTransition';
import type { PublisherFilter, AlignmentFilter } from '../../../src/lib/db/heroes';
import { searchUniverses } from '../../../src/lib/db/universes';
import { searchHouses, type HouseSearchResult } from '../../../src/lib/db/houses';
import { HouseResultRow } from '../../../src/components/family/HouseResultRow';
import { searchTeams, type TeamSearchResult } from '../../../src/lib/db/teams';
import { searchTitles, type TitleSearchResult } from '../../../src/lib/db/titles';
import { pickTopResult, topResultKey, type TopResult } from '../../../src/lib/search/topResult';
import { useHeroSearchInfinite, prefetchHeroSearch } from '../../../src/lib/query/heroQueries';
import { getRecentlyViewed } from '../../../src/lib/db/viewHistory';
import { useAuth } from '../../../src/hooks/useAuth';
import { useRecentSearches } from '../../../src/hooks/useRecentSearches';
import { useBrowseCovers } from '../../../src/hooks/useBrowseCovers';
import { DUR } from '../../../src/lib/nativeMotion';
import { useDebouncedValue, flushWhenBlank } from '../../../src/hooks/useDebouncedValue';
import type { FavouriteHero } from '../../../src/types';

const SEARCH_NAVY = '#1a262b';
const GRID_COLUMNS = 2;
const H_PAD = 16;
const GAP = 8;
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
  const debouncedQuery = useDebouncedValue(query, 250, flushWhenBlank);
  // Declared up here rather than beside the other derived flags because
  // `loadMore` needs it: when idle the screen is a browse surface and the hero
  // list is deliberately empty, so nothing must page.
  const isIdle = !debouncedQuery.trim();

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

  // No auth gate. The local mirror in viewHistory answers for signed-out
  // readers, and browsing this catalogue has never required an account — a rail
  // called "Recently Viewed" that stayed empty for exactly the people doing the
  // most anonymous browsing was the screen refusing to remember what it showed.
  useEffect(() => {
    getRecentlyViewed(user?.id)
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

  // The `isIdle` guard is load-bearing, not defensive. While idle `listData` is
  // [] by design, so the list's whole content is the header — the user is
  // permanently inside the end-reached threshold. VirtualizedList re-arms
  // `onEndReached` whenever content length changes, and the footer spinner
  // mounting and unmounting changes it on every cycle. The result was a closed
  // loop: fetch → footer appears → re-arm → fetch, spinning forever and paging
  // through all ~34k heroes in the background for results nothing would render.
  const loadMore = useCallback(() => {
    if (isIdle || !hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [isIdle, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Tapping any result is a successful search — record the term. The Search
  // keyboard button alone missed the common path (type → tap a card), so
  // Recent stayed empty for most sessions. addRecent no-ops on short/empty.
  const recordQuery = useCallback(() => addRecent(query), [addRecent, query]);

  const handlePress = useCallback(
    (item: { id: string; portrait_url?: string | null; image_url?: string | null }) => {
      if (navigating) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigating(true);
      recordQuery();
      const img = item.portrait_url ?? item.image_url;
      const suffix = img ? `?imageUri=${encodeURIComponent(img)}` : '';
      router.push(`/character/${item.id}${suffix}`);
      setTimeout(() => setNavigating(false), 1000);
    },
    [router, navigating, recordQuery],
  );

  // The results grid navigates via <Link> rather than an imperative push, so
  // its cards can be the ORIGIN of Apple's fluid zoom transition — the same
  // one the Explore rows use. Without this the identical hero zoomed open from
  // the feed and slid open from search. The Link performs the navigation and
  // this runs the side effects only; Slot composes both handlers.
  const characterHref = useCallback(
    (item: { id: string; portrait_url?: string | null; image_url?: string | null }): Href => {
      const img = item.portrait_url ?? item.image_url;
      return `/character/${item.id}${img ? `?imageUri=${encodeURIComponent(img)}` : ''}` as Href;
    },
    [],
  );

  const handleCardPress = useCallback(() => {
    if (navigating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNavigating(true);
    recordQuery();
    setTimeout(() => setNavigating(false), 1000);
  }, [navigating, recordQuery]);

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

  // Matching teams from the teams table (popularity-ordered). Mirrors the web
  // search's Teams section; routes to /team/[id].
  const [teams, setTeams] = useState<TeamSearchResult[]>([]);
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      // Clear when the query empties. Effect-based fetch (pre-React-Query).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeams([]);
      return;
    }
    let cancelled = false;
    searchTeams(q, 3)
      .then((res) => {
        if (!cancelled) setTeams(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Matching films & shows from the titles table (debouncedQuery is already
  // debounced upstream). Mirrors the web search's "Films & Shows" section;
  // routes to /title/[id]. Degrades silently to none on error.
  const [titles, setTitles] = useState<TitleSearchResult[]>([]);
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      // Clear when the query empties. Effect-based fetch (pre-React-Query).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitles([]);
      return;
    }
    let cancelled = false;
    searchTitles(q, 3)
      .then((res) => {
        if (!cancelled) setTitles(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Matching houses. Same debounced-fetch shape as teams and titles; routes to
  // /house/[slug]. A surname query ("targaryen") means the dynasty far more
  // often than it means any one character who bears the name.
  const [houses, setHouses] = useState<HouseSearchResult[]>([]);
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      // Clear when the query empties. Effect-based fetch (pre-React-Query).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHouses([]);
      return;
    }
    let cancelled = false;
    searchHouses(q, 3)
      .then((res) => {
        if (!cancelled) setHouses(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // The single confident "Top result" across every type (Raycast/Spotlight
  // pattern), via the shared pickTopResult. Null when nothing is a confident
  // winner — then the screen just shows the grouped sections. Mirrors web.
  const topResult: TopResult | null = useMemo(
    () =>
      pickTopResult(debouncedQuery, {
        universes,
        teams,
        heroes: displayedHeroes,
        titles,
        houses,
      }),
    [debouncedQuery, universes, teams, displayedHeroes, titles, houses],
  );
  const topKey = topResult ? topResultKey(topResult) : null;

  // Drop whatever is featured up top from its own section so it isn't shown twice.
  const sectionUniverses = useMemo(
    () => universes.filter((u) => `universe:${u.slug}` !== topKey),
    [universes, topKey],
  );
  const sectionHouses = useMemo(
    () => houses.filter((h) => `house:${h.slug}` !== topKey),
    [houses, topKey],
  );
  const sectionTeams = useMemo(
    () => teams.filter((t) => `team:${t.id}` !== topKey),
    [teams, topKey],
  );
  const sectionTitles = useMemo(
    () => titles.filter((t) => `title:${t.id}` !== topKey),
    [titles, topKey],
  );

  const openTop = useCallback(
    (top: TopResult) => {
      Haptics.selectionAsync();
      recordQuery();
      const push = (href: string) => router.push(href as Parameters<typeof router.push>[0]);
      switch (top.kind) {
        case 'universe':
          return push(`/universe/${top.universe.slug}`);
        case 'team':
          return push(`/team/${top.team.id}`);
        case 'title':
          return push(`/title/${top.title.id}`);
        case 'hero': {
          const img = top.hero.portrait_url ?? top.hero.image_url;
          return push(
            `/character/${top.hero.id}${img ? `?imageUri=${encodeURIComponent(img)}` : ''}`,
          );
        }
      }
    },
    [router, recordQuery],
  );

  const showIdleExtras = !query.trim();
  // What the two toolbar glyphs are currently doing, in words.
  const filtersOn = publisherFilter !== 'All' || alignmentFilter !== 'All';
  const activeFilterLabel = [
    publisherFilter !== 'All' ? publisherFilter : null,
    alignmentFilter !== 'All' ? alignmentFilter : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const clearFilters = useCallback(() => {
    Haptics.selectionAsync();
    setPublisherFilter('All');
    setAlignmentFilter('All');
  }, []);
  // The beat between the first keystroke and the debounced query settling:
  // idle extras are already hidden but results haven't been asked for yet.
  // Without this the screen blanks for the debounce window.
  const settling = isIdle && !showIdleExtras;
  // When idle, the screen is a browse surface (recent · recently viewed · the
  // category pods) — not a results grid. Suppress the hero list so the pods read
  // as the primary doorway instead of competing with a "Popular" wall.
  const listData = isIdle
    ? []
    : topResult?.kind === 'hero'
      ? displayedHeroes.filter((h) => h.id !== topResult.hero.id)
      : displayedHeroes;

  // The results grid is pending — the debounce beat, or the first fetch for a
  // settled query. pre → nothing (a cached query never blinks a skeleton).
  const gridLoading = settling || (!isIdle && isPending);
  const gridPhase = useSkeletonTransition(gridLoading);
  const skelCardHeight = Math.round(cardWidth * 1.48);
  // 8 cards over 2 columns = 4 rows, plus the grid's own 4px lead-in.
  const skelGridHeight = skelCardHeight * 4 + GAP * 3 + 4;
  const skelGrid = (
    <SkeletonProvider>
      <View style={styles.skelGrid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} width={cardWidth} height={skelCardHeight} borderRadius={10} />
        ))}
      </View>
    </SkeletonProvider>
  );

  const listHeader = (
    <>
      {/* NO "Search" title. The tab is called Search, the field's placeholder
          already says what to type, and on iOS 26 that field is pinned to the
          BOTTOM — so a 38pt heading at the top spent the most valuable space on
          the screen naming the room you are standing in, at the opposite end
          from the thing you came to use. It was a leftover from the
          top-anchored era. */}

      {/* The filters live in the CONTENT, on every platform.
          They used to be two unlabelled glyphs in a `Stack.Toolbar` — a books
          stack and theatre masks — pinned to the top-right of the native
          header. Three problems in one control: nobody decodes those icons,
          nothing showed which filter was active, and with no header title left
          the header collapsed to its minimum and took the toolbar up against
          the status bar, where it read as floating debris rather than as part
          of the screen. The same `FilterChips` Android and web already used
          fixes all three: named options, visible selection, and a position
          this file actually controls. Shown only with results, because idle
          suppresses the hero list and there is nothing to filter. */}
      {!showIdleExtras && (
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
              <Pressable
                key={term}
                style={styles.recentChip}
                onPress={() => applyRecent(term)}
                hitSlop={8}
              >
                <Ionicons name="time-outline" size={13} color="rgba(245,235,220,0.5)" />
                <Text style={styles.recentChipText} numberOfLines={1}>
                  {term}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Universes is a SHORTCUT, Browse is the content.
          As a two-row tile grid, Universes forced a choice between burying it
          under eight pods — a long scroll for a one-tap intent — and putting it
          on top of them, which pushes the richest thing on the screen below the
          fold. As a rail it costs one row, so it sits high AND leaves the pods
          where they can be seen. Neither had to lose. */}
      {showIdleExtras && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Universes</Text>
          </View>
          {/* Owns its own 16px gutter, so cancel the list's content padding and
              let the rail run to the physical screen edge. */}
          <View style={styles.browseGrid}>
            <PublisherGrid
              layout="rail"
              onPress={(slug) => {
                Haptics.selectionAsync();
                router.push(`/universe/${slug}` as Parameters<typeof router.push>[0]);
              }}
            />
          </View>

          {/* No "Browse" label. Label a section when the content does not say
              what it is: "Recent" marks a list of chips as YOUR history and
              "Universes" tells you the logos are publishers, but tiles reading
              Villains, Anime and Video Games are already their own label — and
              "browse" names the activity of the entire screen rather than
              these eight things. What the label was really providing is a
              boundary, so the boundary stays as space. */}
          {/* CategoryPodGrid owns its 16px gutter (tiles sized from the screen
              width), so cancel the list's content padding to align it edge-to-edge. */}
          <View style={[styles.browseGrid, styles.podsTop]}>
            <CategoryPodGrid covers={browseCovers} onPress={handleCategoryPress} />
          </View>
        </>
      )}

      {!isIdle && topResult && (
        <View style={styles.universeSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Top result</Text>
          </View>
          <TopResultRow top={topResult} onPress={() => openTop(topResult)} />
        </View>
      )}

      {!isIdle && sectionUniverses.length > 0 && (
        <View style={styles.universeSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Universes</Text>
          </View>
          {sectionUniverses.map((u) => (
            <UniverseResultRow
              key={u.slug}
              universe={u}
              onPress={() => {
                Haptics.selectionAsync();
                recordQuery();
                router.push(`/universe/${u.slug}` as Parameters<typeof router.push>[0]);
              }}
            />
          ))}
        </View>
      )}

      {!isIdle && sectionTeams.length > 0 && (
        <View style={styles.universeSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Teams</Text>
          </View>
          {sectionTeams.map((t) => (
            <TeamResultRow
              key={t.id}
              team={t}
              onPress={() => {
                Haptics.selectionAsync();
                recordQuery();
                router.push(`/team/${t.id}` as Parameters<typeof router.push>[0]);
              }}
            />
          ))}
        </View>
      )}

      {!isIdle && sectionHouses.length > 0 && (
        <View style={styles.universeSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Houses</Text>
          </View>
          {sectionHouses.map((h) => (
            <HouseResultRow
              key={h.slug}
              house={h}
              onPress={() => {
                Haptics.selectionAsync();
                recordQuery();
                router.push(`/house/${h.slug}` as Parameters<typeof router.push>[0]);
              }}
            />
          ))}
        </View>
      )}

      {!isIdle && sectionTitles.length > 0 && (
        <View style={styles.universeSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Films & Shows</Text>
          </View>
          {sectionTitles.map((t) => (
            <TitleResultRow
              key={t.id}
              title={t}
              onPress={() => {
                Haptics.selectionAsync();
                recordQuery();
                router.push(`/title/${t.id}` as Parameters<typeof router.push>[0]);
              }}
            />
          ))}
        </View>
      )}

      {!isIdle && !isPending && listData.length > 0 && (
        <View style={styles.sectionHeader}>
          {/* Only claim a count once every page is in — a page-sized number
              next to an infinite list reads as "30 results" when there are 400. */}
          <Text style={styles.sectionLabel}>
            {hasNextPage ? 'Characters' : `Characters  ·  ${listData.length}`}
          </Text>
        </View>
      )}

      {/* Grid crossfade. The skeleton has to dissolve over the real cards, but
          those are list items, not something we can wrap — so a zero-height
          anchor at the header's bottom edge (i.e. exactly where the first row
          starts, whatever sections the header grew) carries the overlay. */}
      {gridPhase === 'crossfade' ? (
        <View style={styles.skelAnchor}>
          <View style={[styles.skelOverlay, { height: skelGridHeight }]}>
            <FadeOutSkeleton>{skelGrid}</FadeOutSkeleton>
          </View>
        </View>
      ) : null}
    </>
  );

  const listEmpty = gridLoading ? (
    gridPhase === 'skeleton' ? (
      skelGrid
    ) : null
  ) : isIdle ? null : isFetching ? null : topResult ? null : (
    <View style={styles.center}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name={filtersOn ? 'funnel-outline' : 'search-outline'}
          size={30}
          color={COLORS.orange}
        />
      </View>
      <Text style={styles.emptyHeadline}>No characters found</Text>
      {/* "Try a different search or filter" was said whether or not a filter
          existed — useless advice in the common case, and in the case where a
          filter WAS narrowing the search it pointed at two unlabelled glyphs
          rather than fixing it. A filter is by far the likeliest cause of an
          empty result for a name that exists, so when one is on, say which and
          undo it in a tap. */}
      {filtersOn ? (
        <>
          <Text style={styles.emptySub}>{activeFilterLabel} is narrowing this search.</Text>
          <Pressable
            onPress={clearFilters}
            accessibilityRole="button"
            style={({ pressed }) => [styles.emptyCta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.emptyCtaText}>Search everything</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.emptySub}>Try a shorter name, or a different spelling.</Text>
      )}
    </View>
  );

  return (
    <View style={styles.root} collapsable={false}>
      <StatusBar style="light" />
      <Stack.Header transparent style={{ color: COLORS.beige, shadowColor: 'transparent' }} />
      <Stack.SearchBar
        ref={searchRef}
        placeholder="Character, team, or real name…"
        // MUST stay "automatic" while the tab carries role="search".
        //
        // This was "stacked" — pinned under the header — and the field went
        // completely dead: visible in the tab bar, impossible to type into.
        // react-native-screens documents why on `allowToolbarIntegration`:
        // "When placement is set to `stacked`, this property's value will be
        // overridden with `false`". Toolbar integration is exactly the channel
        // the iOS 26 search-role tab uses to hand its field to this search bar,
        // so `stacked` severs it — the tab bar still draws the pill (that's the
        // role, not us) but nothing behind it is wired.
        //
        // "automatic" is also the Apple-recommended shape for a tabbed app: the
        // circular search tab morphs into a bottom-aligned field that rides up
        // over the keyboard. The old comment here called that floating field a
        // problem that "fights this screen's own top-anchored layout" — it is
        // the iOS 26 pattern, and the list's paddingBottom already clears it.
        placement="automatic"
        autoCapitalize="none"
        hideWhenScrolling={false}
        // No barTintColor. It sets the search FIELD's background colour, which
        // on the iOS 26 bottom-aligned field paints an opaque rectangle behind
        // the Liquid Glass capsule — the capsule's rounded corners then show
        // grey square shoulders. The system material already renders a dark,
        // legible field over this screen; tinting it only fights the glass.
        textColor={COLORS.beige}
        hintTextColor="rgba(245,235,220,0.55)"
        headerIconColor="rgba(245,235,220,0.6)"
        tintColor={COLORS.orange}
        onChangeText={handleSearchText}
        onSearchButtonPress={() => addRecent(query)}
        onCancelButtonPress={() => setQuery('')}
      />

      {/* Native filter menus (iOS) on the right — fills the header bar. */}
      {/* Entrance parity with Explore. Wrapping the list (rather than the
          screen root) keeps Stack.Header/SearchBar/Toolbar as direct
          children, which is how expo-router registers the native header. */}
      <Animated.View
        style={styles.listWrap}
        collapsable={false}
        entering={FadeIn.duration(DUR.base)}
      >
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
            !isIdle && isFetchingNextPage ? (
              <View style={styles.footer}>
                <ActivityIndicator color={COLORS.orange} />
              </View>
            ) : null
          }
          onEndReachedThreshold={0.6}
          onEndReached={loadMore}
          // 150 exists so the last RESULT row clears the iOS 26 bottom-aligned
          // search field. Idle has no results — the pods ARE the end of the
          // content — so that same padding became a screenful of nothing you
          // could scroll into. Idle keeps only what the floating field needs.
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + (isIdle ? 72 : 150) },
          ]}
          columnWrapperStyle={listData.length > 0 ? styles.gridRow : undefined}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => (
            <PortraitCard
              item={item}
              cardWidth={cardWidth}
              href={characterHref(item)}
              onPress={handleCardPress}
              onLongPress={() => openPeek(item)}
              disabled={navigating}
              onDark
            />
          )}
        />
      </Animated.View>

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
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  listWrap: { flex: 1 },
  list: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: H_PAD, paddingTop: 14 },
  ctaPressed: { opacity: 0.6 },
  emptyCta: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.beige,
  },
  emptyCtaText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: COLORS.deepNavy },

  chipStack: { marginHorizontal: -H_PAD, paddingBottom: 2 },
  browseGrid: { marginHorizontal: -H_PAD, paddingBottom: 4 },
  // The boundary the removed 'Browse' label used to draw.
  podsTop: { paddingTop: 18 },
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingTop: 4 },
  skelAnchor: { height: 0 },
  skelOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
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
    color: INK_TEXT.faint,
  },
  recentClear: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 180,
    paddingHorizontal: 12,
    // minHeight + padding so the chip grows with large OS text instead of clipping.
    minHeight: 32,
    paddingVertical: 6,
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
