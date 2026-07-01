// app/(tabs)/explore.tsx — Home screen: spotlight + curated/personal carousels +
// the daily battle and editorial "Beyond the Page" features (rivalries, most
// feared, era timeline, first-appearance covers). Brought to parity with the web
// explore so native shows the full catalogue's depth, not a thin slice.
import { useState, useCallback, useMemo, type ComponentType } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  type ListRenderItem,
  type FlatListProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type AnimatedProps,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { HomeSkeleton } from '../../src/components/skeletons/HomeSkeleton';
import { SpotlightCarousel, spotlightHeight } from '../../src/components/home/SpotlightCarousel';
import { PaperSurface } from '../../src/components/home/PaperSurface';
import { rowStyle } from '../../src/lib/home/rowStyle';
import { HomeHeroRow, type RowHero } from '../../src/components/home/HomeHeroRow';
import { type Hero, type Rivalry } from '../../src/lib/db/heroes';
import {
  type TrendingTitle,
  type Campaign,
  type TrendingTitleCharacter,
  type WikiTrendingHero,
} from '../../src/lib/db/trending';
import type { NewComic } from '../../src/lib/db/comics';
import type { DebutIssue } from '../../src/lib/db/anniversaries';
import { type TodaysMatchup as Matchup } from '../../src/lib/matchup';
import { RightNowBand } from '../../src/components/home/RightNowBand';
import { TodaysMatchup } from '../../src/components/home/TodaysMatchup';
import { HallOfFame } from '../../src/components/home/HallOfFame';
import { FeaturedRivalry } from '../../src/components/home/FeaturedRivalry';
import { CategoryPodGrid, BROWSE_PODS } from '../../src/components/home/CategoryPodGrid';
import { PublisherGrid } from '../../src/components/home/PublisherGrid';
import { PulseTicker } from '../../src/components/home/PulseTicker';
import { DailyChallengeBanner } from '../../src/components/game/DailyChallengeBanner';
import { useExploreData } from '../../src/lib/query/exploreQueries';
import type { FavouriteHero } from '../../src/types';

const SPOTLIGHT_POOL = 5;

function toRowHero(h: Hero | FavouriteHero): RowHero {
  return { id: h.id, name: h.name, image_url: h.image_url, portrait_url: h.portrait_url };
}

// Each visible section of the feed is one FlatList row, so only the rows near
// the viewport stay mounted (the old ScrollView mounted all ~12 at once).
type FeedRow =
  | { type: 'spotlight'; heroes: Hero[] }
  | { type: 'publishers' }
  | { type: 'matchup'; matchup: Matchup }
  | { type: 'daily' }
  | { type: 'ticker'; heroCount: number; newlyAddedCount: number }
  | { type: 'recent'; heroes: RowHero[] }
  | { type: 'favourites'; heroes: RowHero[] }
  | {
      type: 'rightnow';
      campaign: Campaign | null;
      onScreen: TrendingTitle[];
      comingSoon: TrendingTitle[];
      streaming: TrendingTitle[];
      personalized: TrendingTitleCharacter[];
      newComics: NewComic[];
      wikiTrending: WikiTrendingHero[];
      debuts: DebutIssue[];
    }
  | { type: 'chapter'; kicker: string; title: string }
  | { type: 'halloffame'; heroes: Hero[] }
  | { type: 'browsegrid' }
  | { type: 'featuredrivalry'; rivalry: Rivalry }
  | { type: 'seeall'; label: string; route: Href }
  | { type: 'curated'; key: string; label: string; title: string; heroes: Hero[]; route?: Href };

// Typed Animated.FlatList so renderItem/keyExtractor/CellRenderer infer FeedRow.
const FeedList = Animated.FlatList as unknown as ComponentType<
  AnimatedProps<FlatListProps<FeedRow>>
>;

// The dark "stage" rows (deepNavy, glass containers). Everything else is the
// beige Library zone — wrapped in PaperSurface (halftone + the seam lip).
const DARK_ROWS = new Set<FeedRow['type']>([
  'spotlight',
  'publishers',
  'matchup',
  'daily',
  'ticker',
  'rightnow',
]);

// The dark stage rides up into the spotlight's bottom fade so the glass chips
// emerge from the portrait (no hard seam).
const SPOTLIGHT_OVERLAP = 14;

// On scroll-down the portrait lags (moves at ~half speed) so the content slides
// UP over it, instead of the whole billboard scrolling away.
const SPOTLIGHT_PARALLAX = 0.5;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Shared, platform-neutral data layer (see useExploreData). Aliased to the
  // names this view already renders with; spotlight is sliced to the native
  // billboard size and heroCount coerced to a number for the pulse ticker.
  const {
    started: initialLoaded,
    spotlight: spotlightAll,
    iconic,
    onScreen,
    comingSoon,
    streaming,
    wikiTrending,
    debutsThisMonth,
    campaigns,
    trendingForUser,
    matchup,
    heroCount: heroCountRaw,
    newlyAdded,
    newComics,
    rivalries,
    recentlyViewed,
    favourites,
    browseCovers,
  } = useExploreData();
  const spotlight = spotlightAll.slice(0, SPOTLIGHT_POOL);
  const heroCount = heroCountRaw ?? 0;
  const [navigating, setNavigating] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  // Counteract the overscroll bounce so the whole page holds still on pull-down —
  // only the spotlight portrait zooms (Apple TV style), no navy gap appears.
  const spotH = spotlightHeight(insets.top);
  // Pull-down (sy < 0): stretch the billboard, top-anchored, to fill the overscroll
  // so no band is ever revealed behind it. Down-scroll (sy > 0): parallax lag so the
  // dark stage slides up over the portrait instead of scrolling off with it.
  const spotlightParallax = useAnimatedStyle(() => {
    const sy = scrollY.value;
    if (sy < 0) {
      return { transform: [{ translateY: sy }, { scale: 1 - sy / spotH }] };
    }
    return { transform: [{ translateY: sy * SPOTLIGHT_PARALLAX }] };
  });
  // As the stage slides up over the portrait, a dark frost fades in over it.
  const spotlightBlur = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 220], [0, 1], Extrapolation.CLAMP),
  }));
  const spotlightPool = spotlight;

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

  const handleHeroId = useCallback((id: string) => handlePress({ id }), [handlePress]);

  const handleOpenPath = useCallback(
    (path: string) => {
      Haptics.selectionAsync();
      router.push(path as Href);
    },
    [router],
  );

  const handlePublisherPress = useCallback(
    (slug: string) => {
      Haptics.selectionAsync();
      router.push(`/universe/${slug}`);
    },
    [router],
  );

  // Browse-grid tiles route by axis: publishers → /universe, everything else
  // → /category.
  const handleBrowsePress = useCallback(
    (slug: string) => {
      Haptics.selectionAsync();
      const pod = BROWSE_PODS.find((p) => p.slug === slug);
      const path = pod?.kind === 'Publisher' ? `/universe/${slug}` : `/category/${slug}`;
      router.push(path as Href);
    },
    [router],
  );

  const handleTitlePress = useCallback(
    (titleId: string) => {
      Haptics.selectionAsync();
      router.push(`/title/${titleId}`);
    },
    [router],
  );

  const handleIssuePress = useCallback(
    (issueId: string) => {
      Haptics.selectionAsync();
      router.push(`/issue/${issueId}`);
    },
    [router],
  );

  // The feed as a flat list of rows. A deliberate, chaptered sequence: billboard →
  // today's battle → the dynamic "Right Now" zone → your personal rows → the
  // Library (browse) → curated catalogue rows → "Beyond the Page" editorial
  // features. Chapter headers keep the rhythm so it reads as a magazine, not soup.
  const rows = useMemo<FeedRow[]>(() => {
    const out: FeedRow[] = [];
    if (spotlightPool.length > 0) out.push({ type: 'spotlight', heroes: spotlightPool });
    out.push({ type: 'publishers' });
    if (matchup) out.push({ type: 'matchup', matchup });
    out.push({ type: 'daily' });
    if (heroCount > 0) out.push({ type: 'ticker', heroCount, newlyAddedCount: newlyAdded.length });
    if (
      campaigns[0] ||
      onScreen.length > 0 ||
      comingSoon.length > 0 ||
      streaming.length > 0 ||
      trendingForUser.length > 0 ||
      newComics.length > 0 ||
      wikiTrending.length > 0 ||
      debutsThisMonth.length > 0
    ) {
      out.push({
        type: 'rightnow',
        campaign: campaigns[0] ?? null,
        onScreen,
        comingSoon,
        streaming,
        personalized: trendingForUser,
        newComics,
        wikiTrending,
        debuts: debutsThisMonth,
      });
    }
    if (recentlyViewed.length > 0)
      out.push({ type: 'recent', heroes: recentlyViewed.map(toRowHero) });

    // The Library — an authored canon feature, then the browse grid (the map that
    // replaces the old wall of category rails), then the one fresh rail.
    out.push({ type: 'chapter', kicker: 'The Library', title: 'Browse the Universe' });
    if (iconic.length > 0) out.push({ type: 'halloffame', heroes: iconic });
    out.push({ type: 'browsegrid' });
    if (newlyAdded.length > 0)
      out.push({
        type: 'curated',
        key: 'new',
        label: 'Fresh to the Vault',
        title: 'Newly Added',
        heroes: newlyAdded,
      });

    // The Arena — a featured rivalry leads; the rest live in /versus.
    if (rivalries.length > 0) {
      out.push({ type: 'chapter', kicker: 'The Arena', title: 'Greatest Rivalries' });
      out.push({ type: 'featuredrivalry', rivalry: rivalries[0] });
      out.push({ type: 'seeall', label: 'See all rivalries →', route: '/versus' });
    }

    if (favourites.length > 0) out.push({ type: 'favourites', heroes: favourites.map(toRowHero) });
    return out;
  }, [
    spotlightPool,
    matchup,
    heroCount,
    recentlyViewed,
    favourites,
    iconic,
    onScreen,
    comingSoon,
    streaming,
    wikiTrending,
    debutsThisMonth,
    campaigns,
    trendingForUser,
    newComics,
    newlyAdded,
    rivalries,
  ]);

  const keyExtractor = useCallback(
    (row: FeedRow) =>
      row.type === 'curated'
        ? `curated-${row.key}`
        : row.type === 'chapter'
          ? `chapter-${row.title}`
          : row.type,
    [],
  );

  // The first beige row carries the seam (rounded lip + top-light).
  const firstBeigeIndex = useMemo(() => rows.findIndex((r) => !DARK_ROWS.has(r.type)), [rows]);

  const renderRow = useCallback<ListRenderItem<FeedRow>>(
    ({ item, index }) => {
      const content = (() => {
        switch (item.type) {
          case 'spotlight':
            return (
              <Animated.View style={[styles.spotlightWrap, spotlightParallax]}>
                <SpotlightCarousel
                  heroes={item.heroes}
                  insetTop={insets.top}
                  scrollY={scrollY}
                  onHeroPress={handlePress}
                  showLip={false}
                />
                <Animated.View
                  style={[StyleSheet.absoluteFill, spotlightBlur]}
                  pointerEvents="none"
                >
                  <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
                </Animated.View>
              </Animated.View>
            );
          case 'publishers':
            return (
              <View style={index > 0 ? styles.podsOverlap : undefined}>
                <PublisherGrid onPress={handlePublisherPress} />
              </View>
            );
          case 'daily':
            return (
              <DailyChallengeBanner
                onPress={() => handleOpenPath('/play')}
                style={styles.dailyOnDark}
              />
            );
          case 'matchup':
            return <TodaysMatchup matchup={item.matchup} onOpen={handleOpenPath} />;
          case 'ticker':
            return (
              <PulseTicker heroCount={item.heroCount} newlyAddedCount={item.newlyAddedCount} />
            );
          case 'recent':
            return (
              <HomeHeroRow
                label="Personal"
                title="Recently Viewed"
                heroes={item.heroes}
                variant="thumb"
                onPress={handlePress}
                disabled={navigating}
              />
            );
          case 'rightnow':
            return (
              <RightNowBand
                campaign={item.campaign}
                onScreen={item.onScreen}
                comingSoon={item.comingSoon}
                streaming={item.streaming}
                personalized={item.personalized}
                newComics={item.newComics}
                wikiTrending={item.wikiTrending}
                debuts={item.debuts}
                onHeroPress={handlePress}
                onTitlePress={handleTitlePress}
                onIssuePress={handleIssuePress}
                disabled={navigating}
              />
            );
          case 'chapter':
            return (
              <View style={styles.browseHead}>
                <Text style={styles.browseKicker}>{item.kicker}</Text>
                <Text style={styles.browseTitle}>{item.title}</Text>
              </View>
            );
          case 'favourites':
            return (
              <HomeHeroRow
                label="For You"
                title="Your Favourites"
                heroes={item.heroes}
                variant="portrait"
                onPress={handlePress}
                disabled={navigating}
              />
            );
          case 'halloffame':
            return <HallOfFame heroes={item.heroes} onPress={handleHeroId} />;
          case 'browsegrid':
            return <CategoryPodGrid covers={browseCovers} onPress={handleBrowsePress} />;
          case 'featuredrivalry':
            return <FeaturedRivalry rivalry={item.rivalry} onOpen={handleOpenPath} />;
          case 'seeall':
            return (
              <Pressable
                style={styles.seeAllRow}
                onPress={() => handleOpenPath(item.route as string)}
              >
                <Text style={styles.seeAllText}>{item.label}</Text>
              </Pressable>
            );
          case 'curated': {
            const rs = rowStyle(item.key);
            return (
              <HomeHeroRow
                label={item.label}
                title={item.title}
                tone={rs.tone}
                accent={rs.accent}
                ranked={rs.ranked}
                feature={rs.feature}
                heroes={item.heroes.map(toRowHero)}
                onPress={handlePress}
                onViewAll={item.route ? () => router.push(item.route!) : undefined}
                disabled={navigating}
              />
            );
          }
        }
      })();
      if (content == null) return null;
      // Dark stage rows render straight on the deep-navy scroll surface; beige
      // Library rows sit on the printed-paper surface (the first one seams it).
      if (DARK_ROWS.has(item.type)) return content;
      return <PaperSurface lip={index === firstBeigeIndex}>{content}</PaperSurface>;
    },
    [
      insets.top,
      scrollY,
      handlePress,
      handleHeroId,
      handleOpenPath,
      handlePublisherPress,
      handleBrowsePress,
      handleTitlePress,
      handleIssuePress,
      browseCovers,
      navigating,
      router,
      firstBeigeIndex,
      spotlightParallax,
      spotlightBlur,
    ],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Two-tone bounce: the deep-navy root shows on the top rubber-band (matching
          the spotlight), this beige fill shows on the bottom one (matching the
          beige tail). Both sit behind the transparent FeedList; the opaque content
          hides the seam — only the over-scroll gaps reveal them. */}
      <View style={styles.bottomFill} pointerEvents="none" />
      {!initialLoaded ? (
        <HomeSkeleton insets={insets} />
      ) : (
        <FeedList
          entering={FadeIn.duration(280)}
          style={styles.scroll}
          data={rows}
          keyExtractor={keyExtractor}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={styles.content}
          ListFooterComponent={<PaperSurface style={styles.footer} />}
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Deep navy so the overscroll rubber-band reveals the same dark as the stage
  // (no lighter-navy band behind the zooming portrait).
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  // Transparent so the dark navy root shows under the status bar and on
  // overscroll (matching the spotlight) instead of a beige band.
  scroll: { flex: 1, backgroundColor: 'transparent' },
  // Deep-navy scroll surface: the dark stage rows sit straight on it; beige
  // Library rows bring their own PaperSurface. Overscroll reveals dark, matching
  // the spotlight.
  content: { flexGrow: 1, backgroundColor: COLORS.deepNavy, paddingBottom: 0 },
  // Beige paper tail so the bottom padding isn't a dark strip.
  footer: { height: 120 },
  // Beige behind the bottom half — revealed on the bottom over-scroll bounce so
  // it never flashes the deep-navy root under the beige tail.
  bottomFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: COLORS.beige,
  },
  // Chapter break ("Browse the Universe", "Beyond the Page").
  browseHead: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 4 },
  browseKicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 3,
  },
  browseTitle: { fontFamily: 'Flame-Regular', fontSize: 30, color: COLORS.navy, lineHeight: 32 },
  // "See all rivalries →" link under the featured rivalry.
  seeAllRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  seeAllText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 0.5,
  },
  // The dark stage overlaps the spotlight's fade; zIndex keeps the glass chips
  // painting over the portrait.
  podsOverlap: { marginTop: -SPOTLIGHT_OVERLAP, zIndex: 1 },
  // Daily banner on the dark stage — a hairline edge, plus even gaps top/bottom
  // (the shared banner's defaults skew 16/4; matchup adds 12 above, ticker 0
  // below, so 4/16 here lands a balanced ~16pt on each side).
  dailyOnDark: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    marginTop: 4,
    marginBottom: 16,
  },
  // Top-anchored so the pull-down stretch grows the billboard downward (top pinned).
  spotlightWrap: { transformOrigin: 'top' },
});
