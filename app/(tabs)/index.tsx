import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getHeroesByCategory, type Hero, type HeroesByCategory } from '../../src/lib/db/heroes';
import { HeroCard } from '../../src/components/HeroCard';
import { HomeSkeleton } from '../../src/components/skeletons/HomeSkeleton';
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

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerBlurEffect: 'regular',
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerTitle: () => (
            <Animated.Text style={[styles.navTitle, { opacity: smallTitleOpacity }]}>
              hero
            </Animated.Text>
          ),
        }}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
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
          <Svg width={44} height={44} viewBox="0 0 1024 1024">
            <Path
              fill={COLORS.navy}
              d="M771.83 359.726C790.233 359.157 809.038 360.561 827.217 363.687C860.194 368.791 880.58 384.832 899.577 411.588C952.323 485.882 910.478 588.451 840.684 635.156C777.716 677.292 684.759 672.267 615.599 648.433C606.232 645.205 596.363 641.14 587.513 636.51C560.951 620.256 539.813 614.985 508.598 616.581C476.925 618.201 457.215 629.785 428.71 641.463C378.199 662.157 312.618 674.016 258.384 663.281C223.369 657.798 188.002 641.874 162.23 617.635C99.3027 558.45 73.5282 462.814 138.958 393.848C166.265 365.064 197.584 361.227 235.229 360.28C291.337 358.869 345.958 367.328 400.078 381.829C413.535 385.43 426.897 389.376 440.151 393.665C470.511 403.519 493.246 412.119 526.372 410.492C544.544 409.599 556.786 403.601 573.782 397.773C584.487 394.125 595.271 390.711 606.126 387.535C659.036 371.973 716.754 361.015 771.83 359.726ZM379.43 580.576C404.316 570.739 422.585 557.516 434.848 532.384C439.037 523.799 439.936 512.178 436.403 503.212C428.365 482.815 393.689 466.137 374.256 457.991C346.125 446.198 312.018 435.868 281.435 435.007C275.287 434.834 268.989 434.216 262.784 434.713C226.343 436.857 209.334 467.83 211.588 501.699C213.173 525.52 224.795 548.661 242.631 564.609C267.287 585.96 306.277 591.723 337.967 589.297C352.112 588.232 366.054 585.299 379.43 580.576ZM669.618 585.812C703.165 593.579 746.514 591.622 776.102 573.056C796.619 559.96 811.158 539.317 816.578 515.588C826.183 473.57 805.637 434.865 760.026 435.926C754.894 436.045 749.642 435.782 744.496 436.282C698.168 440.71 646.68 454.898 608.343 482.267C576.199 505.214 594.861 542.717 619.664 562.508C634.433 574.519 651.324 581.316 669.618 585.812Z"
            />
          </Svg>
          <View>
            <Text style={styles.logoText}>hero</Text>
            <Text style={styles.logoSubtitle}>the Superhero Encyclopedia</Text>
          </View>
        </Animated.View>

        {!heroes ? (
          <HomeSkeleton />
        ) : (
          <>
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
          </>
        )}
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
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 10,
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
