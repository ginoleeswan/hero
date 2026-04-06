// app/(tabs)/index.tsx — Home screen: spotlight + curated/personal carousels
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
  getHeroesByCategory,
  getAntiHeroes,
  getHeroesByPublisher,
  getHeroesByStatRanking,
  type Hero,
} from '../../src/lib/db/heroes';
import { getUserFavouriteHeroes } from '../../src/lib/db/favourites';
import { getRecentlyViewed } from '../../src/lib/db/viewHistory';
import { useAuth } from '../../src/hooks/useAuth';
import type { FavouriteHero } from '../../src/types';

const SPOTLIGHT_POOL = 5;

interface HomeData {
  popular: Hero[];
  villain: Hero[];
  xmen: Hero[];
  antiHeroes: Hero[];
  marvel: Hero[];
  dc: Hero[];
  strongest: Hero[];
  mostIntelligent: Hero[];
}

function toRowHero(h: Hero | FavouriteHero): RowHero {
  return { id: h.id, name: h.name, image_url: h.image_url, portrait_url: h.portrait_url };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [data, setData] = useState<HomeData | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [searchVisible, setSearchVisible] = useState(false);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    Promise.all([
      getHeroesByCategory(),
      getAntiHeroes(),
      getHeroesByPublisher('marvel'),
      getHeroesByPublisher('dc'),
      getHeroesByStatRanking('strength'),
      getHeroesByStatRanking('intelligence'),
    ]).then(([cats, antiHeroes, marvel, dc, strongest, mostIntelligent]) => {
      setData({
        popular: cats.popular,
        villain: cats.villain,
        xmen: cats.xmen,
        antiHeroes,
        marvel,
        dc,
        strongest,
        mostIntelligent,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getRecentlyViewed(user.id).then(setRecentlyViewed).catch(() => {});
    getUserFavouriteHeroes(user.id).then(setFavourites).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!data?.popular.length) return;
    const total = Math.min(SPOTLIGHT_POOL, data.popular.length);
    if (total <= 1) return;
    const timer = setInterval(() => {
      setSpotlightIndex((i) => (i + 1) % total);
    }, 6000);
    return () => clearInterval(timer);
  }, [data?.popular]);

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

  const spotlightHero = data?.popular[spotlightIndex] ?? null;
  const spotlightTotal = data ? Math.min(SPOTLIGHT_POOL, data.popular.length) : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {!data ? (
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

          {data.popular.length > 0 && (
            <HomeHeroRow
              title="Popular"
              heroes={data.popular.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.villain.length > 0 && (
            <HomeHeroRow
              title="Villains"
              heroes={data.villain.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.xmen.length > 0 && (
            <HomeHeroRow
              title="X-Men"
              heroes={data.xmen.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.antiHeroes.length > 0 && (
            <HomeHeroRow
              title="Anti-Heroes"
              heroes={data.antiHeroes.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.marvel.length > 0 && (
            <HomeHeroRow
              title="Marvel Universe"
              heroes={data.marvel.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.dc.length > 0 && (
            <HomeHeroRow
              title="DC Universe"
              heroes={data.dc.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.strongest.length > 0 && (
            <HomeHeroRow
              title="Strongest Heroes"
              heroes={data.strongest.map(toRowHero)}
              onPress={handlePress}
              disabled={navigating}
            />
          )}
          {data.mostIntelligent.length > 0 && (
            <HomeHeroRow
              title="Most Intelligent"
              heroes={data.mostIntelligent.map(toRowHero)}
              onPress={handlePress}
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
