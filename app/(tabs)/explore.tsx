// app/(tabs)/explore.tsx — Home screen: spotlight + curated/personal carousels
import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { HomeSkeleton } from '../../src/components/skeletons/HomeSkeleton';
import { SpotlightBanner } from '../../src/components/home/SpotlightBanner';
import { HomeHeroRow, type RowHero } from '../../src/components/home/HomeHeroRow';
import { SearchSheet } from '../../src/components/SearchSheet';
import {
  getPopularHeroes,
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
  const [villains, setVillains] = useState<Hero[]>([]);
  const [xmen, setXmen] = useState<Hero[]>([]);
  const [antiHeroes, setAntiHeroes] = useState<Hero[]>([]);
  const [marvel, setMarvel] = useState<Hero[]>([]);
  const [dc, setDc] = useState<Hero[]>([]);
  const [strongest, setStrongest] = useState<Hero[]>([]);
  const [mostIntelligent, setMostIntelligent] = useState<Hero[]>([]);

  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [searchVisible, setSearchVisible] = useState(false);
  const [navigating, setNavigating] = useState(false);

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

    getVillains(20).then(setVillains).catch(() => {});
    getXMen(20).then(setXmen).catch(() => {});
    getAntiHeroes(20).then(setAntiHeroes).catch(() => {});
    getHeroesByPublisher('marvel', 20).then(setMarvel).catch(() => {});
    getHeroesByPublisher('dc', 20).then(setDc).catch(() => {});
    getHeroesByStatRanking('strength', 20).then(setStrongest).catch(() => {});
    getHeroesByStatRanking('intelligence', 20).then(setMostIntelligent).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getRecentlyViewed(user.id).then(setRecentlyViewed).catch(() => {});
    getUserFavouriteHeroes(user.id).then(setFavourites).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!popular.length) return;
    const total = Math.min(SPOTLIGHT_POOL, popular.length);
    if (total <= 1) return;
    const timer = setInterval(() => {
      setSpotlightIndex((i) => (i + 1) % total);
    }, 6000);
    return () => clearInterval(timer);
  }, [popular]);

  const handlePress = useCallback(
    (item: { id: string }) => {
      if (navigating) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigating(true);
      router.push(`/character/${item.id}`);
      setTimeout(() => setNavigating(false), 1000);
    },
    [router, navigating],
  );

  const spotlightHero = popular[spotlightIndex] ?? null;
  const spotlightTotal = Math.min(SPOTLIGHT_POOL, popular.length);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {!initialLoaded ? (
        <HomeSkeleton insets={insets} />
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={styles.content}
        >
          {spotlightHero && (
            <SpotlightBanner
              hero={spotlightHero}
              index={spotlightIndex}
              total={spotlightTotal}
              insetTop={insets.top}
              onSearchPress={() => setSearchVisible(true)}
              onHeroPress={() => handlePress(spotlightHero)}
            />
          )}

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

          {popular.length > 0 && (
            <HomeHeroRow
              title="Popular"
              heroes={popular.map(toRowHero)}
              onPress={handlePress}
              onViewAll={() => router.push('/category/popular')}
              disabled={navigating}
            />
          )}
          {villains.length > 0 && (
            <HomeHeroRow
              title="Villains"
              heroes={villains.map(toRowHero)}
              onPress={handlePress}
              onViewAll={() => router.push('/category/villain')}
              disabled={navigating}
            />
          )}
          {xmen.length > 0 && (
            <HomeHeroRow
              title="X-Men"
              heroes={xmen.map(toRowHero)}
              onPress={handlePress}
              onViewAll={() => router.push('/category/xmen')}
              disabled={navigating}
            />
          )}
          {antiHeroes.length > 0 && (
            <HomeHeroRow
              title="Anti-Heroes"
              heroes={antiHeroes.map(toRowHero)}
              onPress={handlePress}
              onViewAll={() => router.push('/category/anti-heroes')}
              disabled={navigating}
            />
          )}
          {marvel.length > 0 && (
            <HomeHeroRow
              title="Marvel Universe"
              heroes={marvel.map(toRowHero)}
              onPress={handlePress}
              onViewAll={() => router.push('/category/marvel')}
              disabled={navigating}
            />
          )}
          {dc.length > 0 && (
            <HomeHeroRow
              title="DC Universe"
              heroes={dc.map(toRowHero)}
              onPress={handlePress}
              onViewAll={() => router.push('/category/dc')}
              disabled={navigating}
            />
          )}
          {strongest.length > 0 && (
            <HomeHeroRow
              title="Strongest Heroes"
              heroes={strongest.map(toRowHero)}
              onPress={handlePress}
              onViewAll={() => router.push('/category/strongest')}
              disabled={navigating}
            />
          )}
          {mostIntelligent.length > 0 && (
            <HomeHeroRow
              title="Most Intelligent"
              heroes={mostIntelligent.map(toRowHero)}
              onPress={handlePress}
              onViewAll={() => router.push('/category/most-intelligent')}
              disabled={navigating}
            />
          )}
        </ScrollView>
      )}

      <SearchSheet
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onHeroPress={(id) => {
          setSearchVisible(false);
          handlePress({ id });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: { paddingBottom: 120 },
});
