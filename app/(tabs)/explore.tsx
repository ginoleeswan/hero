// app/(tabs)/explore.tsx — Home screen: spotlight + curated/personal carousels
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
import { PublisherGrid } from '../../src/components/home/PublisherGrid';
import { rowStyle } from '../../src/lib/home/rowStyle';
import { HomeHeroRow, type RowHero } from '../../src/components/home/HomeHeroRow';
import {
  getSpotlightHeroes,
  getIconicHeroes,
  getNewlyAddedCV,
  getAntiHeroes,
  getVillains,
  getXMen,
  getHeroesByPublisher,
  getHeroesByStatRanking,
  getFranchiseIcons,
  getHeroesByMediaTag,
  type Hero,
} from '../../src/lib/db/heroes';
import { getUserFavouriteHeroes } from '../../src/lib/db/favourites';
import { getTrendingHeroes, type TrendingHero } from '../../src/lib/db/trending';
import { getRecentlyViewed } from '../../src/lib/db/viewHistory';
import { useAuth } from '../../src/hooks/useAuth';
import type { FavouriteHero } from '../../src/types';

const SPOTLIGHT_POOL = 5;

function toRowHero(h: Hero | FavouriteHero): RowHero {
  return { id: h.id, name: h.name, image_url: h.image_url, portrait_url: h.portrait_url };
}

// Each visible section of the feed is one FlatList row, so only the rows near
// the viewport stay mounted (the old ScrollView mounted all ~12 at once).
type FeedRow =
  | { type: 'spotlight'; heroes: Hero[] }
  | { type: 'recent'; heroes: RowHero[] }
  | { type: 'publishers' }
  | { type: 'favourites'; heroes: RowHero[] }
  | {
      type: 'curated';
      key: string;
      label: string;
      title: string;
      heroes: Hero[];
      route?: Href;
    };

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

  // Below-fold rows — each renders as soon as its data arrives
  const [iconic, setIconic] = useState<Hero[]>([]);
  const [villains, setVillains] = useState<Hero[]>([]);
  const [xmen, setXmen] = useState<Hero[]>([]);
  const [antiHeroes, setAntiHeroes] = useState<Hero[]>([]);
  const [marvel, setMarvel] = useState<Hero[]>([]);
  const [dc, setDc] = useState<Hero[]>([]);
  const [strongest, setStrongest] = useState<Hero[]>([]);
  const [mostIntelligent, setMostIntelligent] = useState<Hero[]>([]);
  const [newlyAdded, setNewlyAdded] = useState<Hero[]>([]);
  const [franchiseIcons, setFranchiseIcons] = useState<Hero[]>([]);
  const [anime, setAnime] = useState<Hero[]>([]);
  const [videoGames, setVideoGames] = useState<Hero[]>([]);
  const [horror, setHorror] = useState<Hero[]>([]);
  const [onScreen, setOnScreen] = useState<TrendingHero[]>([]);
  const [comingSoon, setComingSoon] = useState<TrendingHero[]>([]);
  const [streaming, setStreaming] = useState<TrendingHero[]>([]);

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
    getSpotlightHeroes(SPOTLIGHT_POOL)
      .then((heroes) => {
        setSpotlight(heroes);
        setInitialLoaded(true);
      })
      .catch(() => setInitialLoaded(true));

    getIconicHeroes(20)
      .then(setIconic)
      .catch(() => {});
    getVillains(20)
      .then(setVillains)
      .catch(() => {});
    getXMen(20)
      .then(setXmen)
      .catch(() => {});
    getAntiHeroes(20)
      .then(setAntiHeroes)
      .catch(() => {});
    getHeroesByPublisher('marvel', 20)
      .then(setMarvel)
      .catch(() => {});
    getHeroesByPublisher('dc', 20)
      .then(setDc)
      .catch(() => {});
    getHeroesByStatRanking('strength', 20)
      .then(setStrongest)
      .catch(() => {});
    getHeroesByStatRanking('intelligence', 20)
      .then(setMostIntelligent)
      .catch(() => {});
    getNewlyAddedCV(20)
      .then(setNewlyAdded)
      .catch(() => {});
    getFranchiseIcons(20)
      .then(setFranchiseIcons)
      .catch(() => {});
    getHeroesByMediaTag('anime', 20)
      .then(setAnime)
      .catch(() => {});
    getHeroesByMediaTag('video-game', 20)
      .then(setVideoGames)
      .catch(() => {});
    getHeroesByMediaTag('horror-icon', 20)
      .then(setHorror)
      .catch(() => {});
    getTrendingHeroes('on_screen', 20)
      .then(setOnScreen)
      .catch(() => {});
    getTrendingHeroes('coming_soon', 20)
      .then(setComingSoon)
      .catch(() => {});
    getTrendingHeroes('streaming', 20)
      .then(setStreaming)
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

  const handlePublisherPress = useCallback(
    (slug: string) => {
      Haptics.selectionAsync();
      router.push(`/publisher/${slug}`);
    },
    [router],
  );

  // Fixed catalog order. Tone alternates by catalog index (not by which rows
  // happen to be loaded), so a row's band colour never flips as data streams in.
  const curatedCatalog: {
    key: string;
    label: string;
    title: string;
    heroes: Hero[];
    route?: Href;
  }[] = [
    {
      key: 'onscreen',
      label: 'In Theaters & Recent',
      title: 'On the Big Screen',
      heroes: onScreen as unknown as Hero[],
    },
    {
      key: 'comingsoon',
      label: 'Releasing Soon',
      title: 'Coming Soon',
      heroes: comingSoon as unknown as Hero[],
    },
    {
      key: 'streaming',
      label: 'Now Streaming',
      title: 'Streaming Now',
      heroes: streaming as unknown as Hero[],
    },
    {
      key: 'iconic',
      label: 'By Appearances',
      title: 'Most Iconic',
      heroes: iconic,
      route: '/category/most-iconic',
    },
    {
      key: 'franchise',
      label: 'Shows · Movies · Games',
      title: 'Beyond the Comics',
      heroes: franchiseIcons,
      route: '/category/franchise-icons',
    },
    {
      key: 'villains',
      label: 'The Dark Side',
      title: 'Villains',
      heroes: villains,
      route: '/category/villain',
    },
    {
      key: 'horror',
      label: 'Movie Nightmares',
      title: 'Horror Icons',
      heroes: horror,
      route: '/category/horror',
    },
    {
      key: 'marvel',
      label: 'Marvel Comics',
      title: 'Marvel Universe',
      heroes: marvel,
      route: '/category/marvel',
    },
    { key: 'dc', label: 'DC Comics', title: 'DC Universe', heroes: dc, route: '/category/dc' },
    {
      key: 'anti',
      label: 'Neither Good Nor Evil',
      title: 'Anti-Heroes',
      heroes: antiHeroes,
      route: '/category/anti-heroes',
    },
    {
      key: 'strongest',
      label: 'By Power Stats',
      title: 'Strongest Heroes',
      heroes: strongest,
      route: '/category/strongest',
    },
    {
      key: 'xmen',
      label: 'Gifted Youngsters',
      title: 'X-Men',
      heroes: xmen,
      route: '/category/xmen',
    },
    {
      key: 'anime',
      label: 'Anime & Manga',
      title: 'Anime Legends',
      heroes: anime,
      route: '/category/anime',
    },
    {
      key: 'games',
      label: 'Video Games',
      title: 'Video Game Heroes',
      heroes: videoGames,
      route: '/category/video-games',
    },
    {
      key: 'minds',
      label: 'By Power Stats',
      title: 'Brightest Minds',
      heroes: mostIntelligent,
      route: '/category/most-intelligent',
    },
    { key: 'new', label: 'New to the Encyclopedia', title: 'Recently Added', heroes: newlyAdded },
  ];

  // The feed as a flat list of rows. Rows appear as their data streams in
  // (empty rows are dropped), preserving the original "fill as you go" feel.
  const rows = useMemo<FeedRow[]>(() => {
    const out: FeedRow[] = [];
    if (spotlightPool.length > 0) out.push({ type: 'spotlight', heroes: spotlightPool });
    if (recentlyViewed.length > 0)
      out.push({ type: 'recent', heroes: recentlyViewed.map(toRowHero) });
    out.push({ type: 'publishers' });
    if (favourites.length > 0) out.push({ type: 'favourites', heroes: favourites.map(toRowHero) });
    for (const r of curatedCatalog) {
      if (r.heroes.length === 0) continue;
      out.push({ type: 'curated', ...r });
    }
    return out;
    // curatedCatalog is rebuilt each render from the same state, so depend on
    // the underlying arrays rather than the wrapper object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    spotlightPool,
    recentlyViewed,
    favourites,
    iconic,
    villains,
    marvel,
    dc,
    antiHeroes,
    strongest,
    xmen,
    mostIntelligent,
    newlyAdded,
    franchiseIcons,
    anime,
    videoGames,
    horror,
    onScreen,
    comingSoon,
    streaming,
  ]);

  const keyExtractor = useCallback(
    (row: FeedRow) => (row.type === 'curated' ? `curated-${row.key}` : row.type),
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
        case 'publishers':
          return <PublisherGrid onPress={handlePublisherPress} />;
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
    [insets.top, scrollY, handlePress, handlePublisherPress, navigating, router],
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
});
