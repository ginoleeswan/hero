// app/(tabs)/explore.tsx — Home screen: spotlight + curated/personal carousels +
// the daily battle and editorial "Beyond the Page" features (rivalries, most
// feared, era timeline, first-appearance covers). Brought to parity with the web
// explore so native shows the full catalogue's depth, not a thin slice.
import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type ComponentType,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  type ListRenderItem,
  type ViewStyle,
  type StyleProp,
  type FlatListProps,
} from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  type AnimatedProps,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { HomeSkeleton } from '../../src/components/skeletons/HomeSkeleton';
import { SpotlightCarousel } from '../../src/components/home/SpotlightCarousel';
import { rowStyle } from '../../src/lib/home/rowStyle';
import { HomeHeroRow, type RowHero } from '../../src/components/home/HomeHeroRow';
import {
  getSpotlightHeroes,
  getIconicHeroes,
  getTrendingSpotlightHeroes,
  getBrowseCovers,
  getVillains,
  getAntiHeroes,
  getXMen,
  getNewlyAddedCV,
  getFranchiseIcons,
  getHeroesByPublisher,
  getHeroesByMediaTag,
  getHeroesByStatRanking,
  getTopRivalries,
  getMostFeared,
  getEraTimeline,
  getFirstAppearanceCovers,
  type Hero,
  type BrowseCover,
  type CategorySlug,
  type Rivalry,
  type FearedVillain,
  type EraBucket,
  type FirstAppearanceCover,
} from '../../src/lib/db/heroes';
import { getUserFavouriteHeroes } from '../../src/lib/db/favourites';
import {
  getTrendingTitles,
  getActiveCampaigns,
  getTrendingForUser,
  type TrendingTitle,
  type Campaign,
  type TrendingTitleCharacter,
} from '../../src/lib/db/trending';
import { getTodaysMatchup, type TodaysMatchup as Matchup } from '../../src/lib/matchup';
import { RightNowBand } from '../../src/components/home/RightNowBand';
import { TodaysMatchup } from '../../src/components/home/TodaysMatchup';
import { GreatestRivalries } from '../../src/components/home/GreatestRivalries';
import { HallOfInfamy } from '../../src/components/home/HallOfInfamy';
import { EraTimeline } from '../../src/components/home/EraTimeline';
import { CoverGallery } from '../../src/components/home/CoverGallery';
import { CategoryPodGrid, BROWSE_PODS } from '../../src/components/home/CategoryPodGrid';
import { getRecentlyViewed } from '../../src/lib/db/viewHistory';
import { useAuth } from '../../src/hooks/useAuth';
import type { FavouriteHero } from '../../src/types';

const SPOTLIGHT_POOL = 5;

function toRowHero(h: Hero | FavouriteHero): RowHero {
  return { id: h.id, name: h.name, image_url: h.image_url, portrait_url: h.portrait_url };
}

// A curated carousel row, declared as data so the catalogue order lives in one
// place. `key` selects its editorial style (tone/accent/ranked) via rowStyle.
interface CuratedRow {
  key: string;
  label: string;
  title: string;
  heroes: Hero[];
  route?: Href;
}

// Each visible section of the feed is one FlatList row, so only the rows near
// the viewport stay mounted (the old ScrollView mounted all ~12 at once).
type FeedRow =
  | { type: 'spotlight'; heroes: Hero[] }
  | { type: 'matchup'; matchup: Matchup }
  | { type: 'recent'; heroes: RowHero[] }
  | { type: 'browsegrid' }
  | { type: 'favourites'; heroes: RowHero[] }
  | {
      type: 'rightnow';
      campaign: Campaign | null;
      onScreen: TrendingTitle[];
      comingSoon: TrendingTitle[];
      streaming: TrendingTitle[];
      personalized: TrendingTitleCharacter[];
    }
  | { type: 'chapter'; kicker: string; title: string }
  | { type: 'rivalries'; rivalries: Rivalry[] }
  | { type: 'infamy'; villains: FearedVillain[] }
  | { type: 'era'; eras: EraBucket[] }
  | { type: 'covers'; covers: FirstAppearanceCover[] }
  | { type: 'curated'; key: string; label: string; title: string; heroes: Hero[]; route?: Href };

// Typed Animated.FlatList so renderItem/keyExtractor/CellRenderer infer FeedRow.
const FeedList = Animated.FlatList as unknown as ComponentType<
  AnimatedProps<FlatListProps<FeedRow>>
>;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Above-fold data — skeleton shows until this arrives
  const [spotlight, setSpotlight] = useState<Hero[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [iconic, setIconic] = useState<Hero[]>([]);
  const [browseCovers, setBrowseCovers] = useState<Record<string, BrowseCover>>({});
  const [onScreen, setOnScreen] = useState<TrendingTitle[]>([]);
  const [comingSoon, setComingSoon] = useState<TrendingTitle[]>([]);
  const [streaming, setStreaming] = useState<TrendingTitle[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [trendingForUser, setTrendingForUser] = useState<TrendingTitleCharacter[]>([]);
  const [matchup, setMatchup] = useState<Matchup | null>(null);

  // Curated catalogue rows (the dormant depth, now surfaced on native).
  const [villains, setVillains] = useState<Hero[]>([]);
  const [horror, setHorror] = useState<Hero[]>([]);
  const [antiHeroes, setAntiHeroes] = useState<Hero[]>([]);
  const [marvel, setMarvel] = useState<Hero[]>([]);
  const [dc, setDc] = useState<Hero[]>([]);
  const [strongest, setStrongest] = useState<Hero[]>([]);
  const [mostIntelligent, setMostIntelligent] = useState<Hero[]>([]);
  const [xmen, setXmen] = useState<Hero[]>([]);
  const [anime, setAnime] = useState<Hero[]>([]);
  const [videoGames, setVideoGames] = useState<Hero[]>([]);
  const [franchise, setFranchise] = useState<Hero[]>([]);
  const [newlyAdded, setNewlyAdded] = useState<Hero[]>([]);

  // Editorial "Beyond the Page" features.
  const [rivalries, setRivalries] = useState<Rivalry[]>([]);
  const [mostFeared, setMostFeared] = useState<FearedVillain[]>([]);
  const [eras, setEras] = useState<EraBucket[]>([]);
  const [covers, setCovers] = useState<FirstAppearanceCover[]>([]);

  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [navigating, setNavigating] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  // Counteract the overscroll bounce so the whole page holds still on pull-down —
  // only the spotlight portrait zooms (Apple TV style), no navy gap appears.
  const contentShift = useAnimatedStyle(() => ({
    transform: [{ translateY: scrollY.value < 0 ? scrollY.value : 0 }],
  }));
  const spotlightPool = spotlight;

  // Spotlight fires first — once it resolves the skeleton is replaced with real
  // content. All other queries fire in parallel and their rows appear as they
  // arrive. getSpotlightHeroes gates on portraits + enrichment and rotates a
  // mostly-marquee, partly-discovery lineup, so the billboard always looks right.
  useEffect(() => {
    // Lead the billboard with up to 2 characters who are on screen right now,
    // then fill with the curated spotlight pool (deduped).
    Promise.all([getSpotlightHeroes(SPOTLIGHT_POOL), getTrendingSpotlightHeroes(2)])
      .then(([base, trend]) => {
        const seen = new Set<string>();
        const merged: Hero[] = [];
        for (const h of [...trend, ...base]) {
          if (!seen.has(h.id)) {
            seen.add(h.id);
            merged.push(h);
          }
        }
        setSpotlight(merged.slice(0, SPOTLIGHT_POOL));
        setInitialLoaded(true);
      })
      .catch(() => setInitialLoaded(true));

    getActiveCampaigns()
      .then(setCampaigns)
      .catch(() => {});
    getTodaysMatchup()
      .then(setMatchup)
      .catch(() => {});

    getIconicHeroes(20)
      .then(setIconic)
      .catch(() => {});
    getBrowseCovers(BROWSE_PODS.map((p) => p.slug as CategorySlug))
      .then(setBrowseCovers)
      .catch(() => {});
    getTrendingTitles('on_screen', 6)
      .then(setOnScreen)
      .catch(() => {});
    getTrendingTitles('coming_soon', 6)
      .then(setComingSoon)
      .catch(() => {});
    getTrendingTitles('streaming', 6)
      .then(setStreaming)
      .catch(() => {});

    // Curated catalogue rows.
    getVillains(25)
      .then(setVillains)
      .catch(() => {});
    getHeroesByMediaTag('horror-icon', 20)
      .then(setHorror)
      .catch(() => {});
    getAntiHeroes(20)
      .then(setAntiHeroes)
      .catch(() => {});
    getHeroesByPublisher('marvel', 25)
      .then(setMarvel)
      .catch(() => {});
    getHeroesByPublisher('dc', 25)
      .then(setDc)
      .catch(() => {});
    getHeroesByStatRanking('strength', 20)
      .then(setStrongest)
      .catch(() => {});
    getHeroesByStatRanking('intelligence', 20)
      .then(setMostIntelligent)
      .catch(() => {});
    getXMen(25)
      .then(setXmen)
      .catch(() => {});
    getHeroesByMediaTag('anime', 25)
      .then(setAnime)
      .catch(() => {});
    getHeroesByMediaTag('video-game', 25)
      .then(setVideoGames)
      .catch(() => {});
    getFranchiseIcons(25)
      .then(setFranchise)
      .catch(() => {});
    getNewlyAddedCV(25)
      .then(setNewlyAdded)
      .catch(() => {});

    // Editorial features.
    getTopRivalries(12)
      .then(setRivalries)
      .catch(() => {});
    getMostFeared(12)
      .then(setMostFeared)
      .catch(() => {});
    getEraTimeline(7)
      .then(setEras)
      .catch(() => {});
    getFirstAppearanceCovers(14)
      .then(setCovers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getRecentlyViewed(user.id)
      .then(setRecentlyViewed)
      .catch(() => {});
    getUserFavouriteHeroes(user.id)
      .then(setFavourites)
      .catch(() => {});
    getTrendingForUser(user.id)
      .then(setTrendingForUser)
      .catch(() => {});
  }, [user?.id]);

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

  const handleCategoryPress = useCallback(
    (slug: string) => {
      Haptics.selectionAsync();
      router.push(`/category/${slug}`);
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

  // The feed as a flat list of rows. A deliberate, chaptered sequence: billboard →
  // today's battle → the dynamic "Right Now" zone → your personal rows → the
  // Library (browse) → curated catalogue rows → "Beyond the Page" editorial
  // features. Chapter headers keep the rhythm so it reads as a magazine, not soup.
  const rows = useMemo<FeedRow[]>(() => {
    const out: FeedRow[] = [];
    if (spotlightPool.length > 0) out.push({ type: 'spotlight', heroes: spotlightPool });
    if (matchup) out.push({ type: 'matchup', matchup });
    if (
      campaigns[0] ||
      onScreen.length > 0 ||
      comingSoon.length > 0 ||
      streaming.length > 0 ||
      trendingForUser.length > 0
    ) {
      out.push({
        type: 'rightnow',
        campaign: campaigns[0] ?? null,
        onScreen,
        comingSoon,
        streaming,
        personalized: trendingForUser,
      });
    }
    if (recentlyViewed.length > 0)
      out.push({ type: 'recent', heroes: recentlyViewed.map(toRowHero) });
    if (favourites.length > 0) out.push({ type: 'favourites', heroes: favourites.map(toRowHero) });

    out.push({ type: 'chapter', kicker: 'The Library', title: 'Browse the Universe' });
    if (iconic.length > 0)
      out.push({
        type: 'curated',
        key: 'iconic',
        label: 'By Appearances',
        title: 'Most Iconic',
        heroes: iconic,
        route: '/category/most-iconic',
      });
    out.push({ type: 'browsegrid' });

    // Curated catalogue rows, declared in catalogue order. Style comes from the
    // row's `key` (see rowStyle): the dark-toned villain/horror/anti rows render
    // on navy bands; strongest/minds get leaderboard numerals.
    const curated: CuratedRow[] = [
      { key: 'villains', label: 'The Dark Side', title: 'Villains', heroes: villains, route: '/category/villain' },
      { key: 'horror', label: 'Movie Nightmares', title: 'Horror Icons', heroes: horror, route: '/category/horror' },
      { key: 'anti', label: 'Grey Morality', title: 'Anti-Heroes', heroes: antiHeroes, route: '/category/anti-heroes' },
      { key: 'marvel', label: 'Publisher', title: 'Marvel Universe', heroes: marvel, route: '/category/marvel' },
      { key: 'dc', label: 'Publisher', title: 'DC Universe', heroes: dc, route: '/category/dc' },
      { key: 'strongest', label: 'Raw Power', title: 'Strongest', heroes: strongest, route: '/category/strongest' },
      { key: 'minds', label: 'Great Minds', title: 'Most Intelligent', heroes: mostIntelligent, route: '/category/most-intelligent' },
      { key: 'xmen', label: 'Mutantkind', title: 'X-Men', heroes: xmen, route: '/category/xmen' },
      { key: 'anime', label: 'Beyond the Comics', title: 'Anime Legends', heroes: anime, route: '/category/anime' },
      { key: 'games', label: 'Press Start', title: 'Video Game Heroes', heroes: videoGames, route: '/category/video-games' },
      { key: 'franchise', label: 'Franchise Icons', title: 'Beyond the Comics', heroes: franchise, route: '/category/franchise-icons' },
      { key: 'new', label: 'Fresh to the Vault', title: 'Newly Added', heroes: newlyAdded },
    ];
    for (const r of curated) {
      if (r.heroes.length > 0)
        out.push({ type: 'curated', key: r.key, label: r.label, title: r.title, heroes: r.heroes, route: r.route });
    }

    // "Beyond the Page" — the editorial chapter.
    const hasEditorial =
      rivalries.length > 0 || mostFeared.length > 0 || eras.length > 0 || covers.length > 0;
    if (hasEditorial)
      out.push({ type: 'chapter', kicker: 'Go Deeper', title: 'Beyond the Page' });
    if (rivalries.length > 0) out.push({ type: 'rivalries', rivalries });
    if (mostFeared.length > 0) out.push({ type: 'infamy', villains: mostFeared });
    if (eras.length > 0) out.push({ type: 'era', eras });
    if (covers.length > 0) out.push({ type: 'covers', covers });

    return out;
  }, [
    spotlightPool,
    matchup,
    recentlyViewed,
    favourites,
    iconic,
    onScreen,
    comingSoon,
    streaming,
    campaigns,
    trendingForUser,
    villains,
    horror,
    antiHeroes,
    marvel,
    dc,
    strongest,
    mostIntelligent,
    xmen,
    anime,
    videoGames,
    franchise,
    newlyAdded,
    rivalries,
    mostFeared,
    eras,
    covers,
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

  const renderRow = useCallback<ListRenderItem<FeedRow>>(
    ({ item }) => {
      switch (item.type) {
        case 'spotlight':
          return (
            <SpotlightCarousel
              heroes={item.heroes}
              insetTop={insets.top}
              scrollY={scrollY}
              onHeroPress={handlePress}
            />
          );
        case 'matchup':
          return <TodaysMatchup matchup={item.matchup} onOpen={handleOpenPath} />;
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
              onHeroPress={handlePress}
              onTitlePress={handleTitlePress}
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
        case 'browsegrid':
          return <CategoryPodGrid covers={browseCovers} onPress={handleCategoryPress} />;
        case 'favourites':
          return (
            <HomeHeroRow
              label="Personal"
              title="Your Favourites"
              heroes={item.heroes}
              variant="portrait"
              onPress={handlePress}
              disabled={navigating}
            />
          );
        case 'rivalries':
          return <GreatestRivalries rivalries={item.rivalries} onOpen={handleOpenPath} />;
        case 'infamy':
          return <HallOfInfamy villains={item.villains} onPress={handleHeroId} />;
        case 'era':
          return <EraTimeline eras={item.eras} onPress={handleHeroId} />;
        case 'covers':
          return <CoverGallery covers={item.covers} onPress={handleHeroId} />;
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
    },
    [
      insets.top,
      scrollY,
      handlePress,
      handleHeroId,
      handleOpenPath,
      handleCategoryPress,
      handleTitlePress,
      navigating,
      router,
      browseCovers,
    ],
  );

  // Translate every rendered cell uniformly to counteract the overscroll bounce,
  // exactly as the old wrapper did — only the spotlight portrait zooms (scrollY).
  // Transforms don't affect layout, so virtualization measurement is unaffected.
  const CellRenderer = useCallback(
    ({ style, children, ...rest }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) => (
      <Animated.View style={[style, contentShift]} {...rest}>
        {children}
      </Animated.View>
    ),
    [contentShift],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {!initialLoaded ? (
        <HomeSkeleton insets={insets} />
      ) : (
        <FeedList
          entering={FadeIn.duration(280)}
          style={styles.scroll}
          data={rows}
          keyExtractor={keyExtractor}
          renderItem={renderRow}
          CellRendererComponent={CellRenderer}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={styles.content}
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
  root: { flex: 1, backgroundColor: COLORS.navy },
  // Transparent so the dark navy root shows under the status bar and on
  // overscroll (matching the spotlight) instead of a beige band.
  scroll: { flex: 1, backgroundColor: 'transparent' },
  // Beige content sheet. The spotlight (first row) is opaque navy and covers the
  // beige behind it; the rows below sit on this beige, as the old sheet did.
  content: { flexGrow: 1, backgroundColor: COLORS.beige, paddingBottom: 120 },
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
  browseTitle: { fontFamily: 'Flame-Bold', fontSize: 30, color: COLORS.navy, lineHeight: 32 },
});
