import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getHeroesByCategory, type Hero, type HeroesByCategory } from '../../src/lib/db/heroes';
import { HeroCard } from '../../src/components/HeroCard';
import { COLORS } from '../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const CARD_HEIGHT = 380;
const CARD_GAP = 12;
const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

// Large title fades out over this scroll range (when title scrolls up into the nav bar)
const TITLE_FADE_START = 20;
const TITLE_FADE_END = 60;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SECTIONS: { key: keyof HeroesByCategory; label: string; icon: IconName }[] = [
  { key: 'popular', label: 'Popular', icon: 'trending-up' },
  { key: 'villain', label: 'Villians', icon: 'skull-outline' },
  { key: 'xmen', label: 'X-Men', icon: 'flash-outline' },
];

function HeroRow({ heroes, onPress }: { heroes: Hero[]; onPress: (h: Hero) => void }) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const snapInterval = CARD_WIDTH + CARD_GAP;

  return (
    <Animated.FlatList
      horizontal
      data={heroes}
      keyExtractor={(h) => h.id}
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={snapInterval}
      contentContainerStyle={{ paddingLeft: 15, paddingRight: 15 }}
      ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      })}
      scrollEventThrottle={16}
      renderItem={({ item, index }) => {
        const inputRange = [
          (index - 1) * snapInterval,
          index * snapInterval,
          (index + 1) * snapInterval,
        ];
        const opacity =
          Platform.OS === 'ios'
            ? scrollX.interpolate({ inputRange, outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' })
            : 1;

        return (
          <Animated.View style={{ width: CARD_WIDTH, opacity }}>
            <HeroCard
              id={item.id}
              name={item.name}
              imageUrl={item.image_url}
              onPress={() => onPress(item)}
            />
          </Animated.View>
        );
      }}
    />
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [heroes, setHeroes] = useState<HeroesByCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Large title fades out as it scrolls into the nav bar
  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [TITLE_FADE_START, TITLE_FADE_END],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Small nav bar title fades in as large title fades out
  const smallTitleOpacity = scrollY.interpolate({
    inputRange: [TITLE_FADE_START, TITLE_FADE_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const load = useCallback(() => {
    return getHeroesByCategory()
      .then(setHeroes)
      .catch((e) => setError(e.message ?? 'Failed to load heroes'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handlePress = useCallback(
    (hero: Hero) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/character/${hero.id}`);
    },
    [router],
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!heroes) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.orange} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerBlurEffect: 'regular',
          headerShadowVisible: false,
          headerTitleAlign: 'right',
          headerTitle: () => (
            <Animated.Text style={[styles.navTitle, { opacity: smallTitleOpacity }]}>
              hero
            </Animated.Text>
          ),
        }}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8 }]}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.orange}
            colors={[COLORS.orange]}
          />
        }
      >
        {/* Large title — fades out as it scrolls into the nav bar */}
        <Animated.View style={[styles.header, { opacity: largeTitleOpacity }]}>
          <Text style={styles.logoText}>hero</Text>
          <Text style={styles.logoSubtitle}>the Superhero Encyclopedia</Text>
        </Animated.View>

        {/* Sections */}
        {SECTIONS.map(({ key, label, icon }, i) => (
          <View key={key} style={[styles.section, i === 0 && styles.firstSection]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{label}</Text>
              <Ionicons name={icon} size={26} color={COLORS.navy} style={styles.sectionIcon} />
            </View>
            <HeroRow heroes={heroes[key]} onPress={handlePress} />
          </View>
        ))}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 2,
  },
  logoText: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 40,
    color: COLORS.navy,
    textAlign: 'right',
    lineHeight: 44,
  },
  logoSubtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 7,
    color: COLORS.grey,
    textAlign: 'right',
    marginTop: -2,
  },
  navTitle: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 20,
    color: COLORS.navy,
  },
  section: {
    alignItems: 'flex-start',
  },
  firstSection: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: COLORS.navy,
  },
  sectionIcon: {
    marginLeft: 6,
    marginBottom: 2,
  },
  errorText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 16,
    color: COLORS.red,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
