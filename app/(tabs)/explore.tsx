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
  type Hero,
  type BrowseCover,
  type CategorySlug,
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
import { RightNowBand } from '../../src/components/home/RightNowBand';
import { CategoryPodGrid, BROWSE_PODS } from '../../src/components/home/CategoryPodGrid';
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
  | { type: 'browsehead' }
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

  // One marquee rail (Most Iconic); everything else lives in the Browse grid.
  const [iconic, setIconic] = useState<Hero[]>([]);
  const [browseCovers, setBrowseCovers] = useState<Record<string, BrowseCover>>({});
  const [onScreen, setOnScreen] = useState<TrendingTitle[]>([]);
  const [comingSoon, setComingSoon] = useState<TrendingTitle[]>([]);
  const [streaming, setStreaming] = useState<TrendingTitle[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [trendingForUser, setTrendingForUser] = useState<TrendingTitleCharacter[]>([]);

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

  // The feed as a flat list of rows. A deliberate, short sequence: billboard →
  // the dynamic "Right Now" zone → your personal rows → one marquee rail → the
  // Browse grid. No row soup.
  const rows = useMemo<FeedRow[]>(() => {
    const out: FeedRow[] = [];
    if (spotlightPool.length > 0) out.push({ type: 'spotlight', heroes: spotlightPool });
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
    out.push({ type: 'browsehead' });
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
    return out;
  }, [
    spotlightPool,
    recentlyViewed,
    favourites,
    iconic,
    onScreen,
    comingSoon,
    streaming,
    campaigns,
    trendingForUser,
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
        case 'browsehead':
          return (
            <View style={styles.browseHead}>
              <Text style={styles.browseKicker}>The Library</Text>
              <Text style={styles.browseTitle}>Browse the Universe</Text>
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
  // "Browse the Universe" chapter break between the dynamic zone and the library.
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
