// app/(tabs)/explore.tsx — Home screen: spotlight + curated/personal carousels
import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import Animated, { FadeIn, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { HomeSkeleton } from '../../src/components/skeletons/HomeSkeleton';
import { SpotlightCarousel } from '../../src/components/home/SpotlightCarousel';
import { rowStyle } from '../../src/lib/home/rowStyle';
import { HomeHeroRow, type RowHero } from '../../src/components/home/HomeHeroRow';
import {
  getPopularHeroes,
  getIconicHeroes,
  getNewlyAddedCV,
  getAntiHeroes,
  getVillains,
  getXMen,
  getHeroesByPublisher,
  getHeroesByStatRanking,
  type Hero,
} from '../../src/lib/db/heroes';
import { getUserFavouriteHeroes } from '../../src/lib/db/favourites';
import { getRecentlyViewed } from '../../src/lib/db/viewHistory';
import { useAuth } from '../../src/hooks/useAuth';
import type { FavouriteHero } from '../../src/types';

const SPOTLIGHT_POOL = 5;

function toRowHero(h: Hero | FavouriteHero): RowHero {
  return { id: h.id, name: h.name, image_url: h.image_url, portrait_url: h.portrait_url };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Above-fold data — skeleton shows until this arrives
  const [popular, setPopular] = useState<Hero[]>([]);
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

  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [navigating, setNavigating] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const spotlightPool = popular.slice(0, SPOTLIGHT_POOL);

  // Popular fires first — it feeds both the spotlight and the Popular row.
  // Once it resolves the skeleton is replaced with real content.
  // All other queries fire in parallel and their rows appear as they arrive.
  useEffect(() => {
    getPopularHeroes(25)
      .then((heroes) => {
        setPopular(heroes);
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

  // Fixed catalog order. Tone alternates by catalog index (not by which rows
  // happen to be loaded), so a row's band colour never flips as data streams in.
  const curatedRows: {
    key: string;
    label: string;
    title: string;
    heroes: Hero[];
    route?: Href;
  }[] = [
    { key: 'iconic', label: 'By Appearances', title: 'Most Iconic', heroes: iconic, route: '/category/most-iconic' },
    { key: 'villains', label: 'The Dark Side', title: 'Villains', heroes: villains, route: '/category/villain' },
    { key: 'marvel', label: 'Marvel Comics', title: 'Marvel Universe', heroes: marvel, route: '/category/marvel' },
    { key: 'dc', label: 'DC Comics', title: 'DC Universe', heroes: dc, route: '/category/dc' },
    { key: 'anti', label: 'Neither Good Nor Evil', title: 'Anti-Heroes', heroes: antiHeroes, route: '/category/anti-heroes' },
    { key: 'strongest', label: 'By Power Stats', title: 'Strongest Heroes', heroes: strongest, route: '/category/strongest' },
    { key: 'xmen', label: 'Gifted Youngsters', title: 'X-Men', heroes: xmen, route: '/category/xmen' },
    { key: 'minds', label: 'By Power Stats', title: 'Brightest Minds', heroes: mostIntelligent, route: '/category/most-intelligent' },
    { key: 'new', label: 'New to the Encyclopedia', title: 'Recently Added', heroes: newlyAdded },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {!initialLoaded ? (
        <HomeSkeleton insets={insets} />
      ) : (
        <Animated.ScrollView
          entering={FadeIn.duration(280)}
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={styles.content}
          scrollEventThrottle={16}
          onScroll={scrollHandler}
        >
          {spotlightPool.length > 0 && (
            <SpotlightCarousel
              heroes={spotlightPool}
              insetTop={insets.top}
              scrollY={scrollY}
              onHeroPress={handlePress}
            />
          )}

          <View style={styles.sheet}>
          {recentlyViewed.length > 0 && (
            <HomeHeroRow
              label="Personal"
              title="Jump Back In"
              heroes={recentlyViewed.map(toRowHero)}
              variant="thumb"
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {favourites.length > 0 && (
            <HomeHeroRow
              label="Personal"
              title="Your Favourites"
              heroes={favourites.map(toRowHero)}
              variant="portrait"
              onPress={handlePress}
              disabled={navigating}
            />
          )}

          {curatedRows.map((r) => {
            if (r.heroes.length === 0) return null;
            const rs = rowStyle(r.key);
            return (
              <HomeHeroRow
                key={r.key}
                label={r.label}
                title={r.title}
                tone={rs.tone}
                accent={rs.accent}
                ranked={rs.ranked}
                feature={rs.feature}
                heroes={r.heroes.map(toRowHero)}
                onPress={handlePress}
                onViewAll={r.route ? () => router.push(r.route!) : undefined}
                disabled={navigating}
              />
            );
          })}
          </View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  // Transparent so the dark navy root shows under the status bar and on
  // overscroll (matching the spotlight) instead of a beige band. The beige lives
  // on the content sheet below.
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { flexGrow: 1 },
  sheet: { flexGrow: 1, backgroundColor: COLORS.beige, paddingBottom: 120 },
});
