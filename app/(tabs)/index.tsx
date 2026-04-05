// app/(tabs)/index.tsx — Unified Explore screen (discover carousels + live search)
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Platform,
  Animated,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../src/constants/colors';
import { heroImageSource } from '../../src/constants/heroImages';
import { SearchSkeleton } from '../../src/components/skeletons/SearchSkeleton';
import { HomeSkeleton } from '../../src/components/skeletons/HomeSkeleton';
import { HeroCard } from '../../src/components/HeroCard';
import {
  getHeroesByCategory,
  searchHeroes,
  rankResults,
} from '../../src/lib/db/heroes';
import type {
  Hero,
  HeroesByCategory,
  HeroSearchResult,
  PublisherFilter,
} from '../../src/lib/db/heroes';

// ── Constants ─────────────────────────────────────────────────────────────────
const PUBLISHER_PILLS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];
const GRID_COLUMNS = 2;
const H_PAD = 12;
const GAP = 8;
const DISPLAY_LIMIT = 100;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const CARD_GAP = 12;

const MARVEL_LOGO = require('../../assets/images/Marvel-Logo.jpg') as number;
const DC_LOGO = require('../../assets/images/DC-Logo.png') as number;
const DARK_HORSE_LOGO = require('../../assets/images/Dark_Horse_Comics_logo.png') as number;
const STAR_WARS_LOGO = require('../../assets/images/star-wars-logo.png') as number;

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const SECTIONS: { key: keyof HeroesByCategory; label: string; icon: IconName }[] = [
  { key: 'popular', label: 'Popular', icon: 'trending-up' },
  { key: 'villain', label: 'Villains', icon: 'skull-outline' },
  { key: 'xmen', label: 'X-Men', icon: 'flash-outline' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Portrait card (search/grid mode) ─────────────────────────────────────────
function PortraitCard({
  item,
  cardWidth,
  onPress,
  disabled,
}: {
  item: HeroSearchResult;
  cardWidth: number;
  onPress: () => void;
  disabled: boolean;
}) {
  const source = heroImageSource(item.id, item.image_url, item.portrait_url);
  const pub = (item.publisher ?? '').toLowerCase();
  const isMarvel = pub.includes('marvel');
  const isDC = pub.includes('dc');
  const isDarkHorse = pub.includes('dark horse');
  const isStarWars = pub.includes('george lucas') || pub.includes('star wars');
  const hasLogo = isMarvel || isDC || isDarkHorse || isStarWars;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      disabled={disabled}
      style={[pcard.wrap, { width: cardWidth, height: Math.round(cardWidth * 1.48) }]}
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={item.id}
        transition={typeof source === 'object' && 'uri' in source ? 200 : null}
        placeholder={COLORS.navy}
      />
      <LinearGradient
        colors={['transparent', 'rgba(29,45,51,0.18)', 'rgba(29,45,51,0.97)']}
        locations={[0, 0.45, 1]}
        style={pcard.gradient}
      />
      {hasLogo ? (
        <View style={pcard.logoWrap}>
          <Image
            source={isMarvel ? MARVEL_LOGO : isDC ? DC_LOGO : isDarkHorse ? DARK_HORSE_LOGO : STAR_WARS_LOGO}
            style={
              isMarvel ? pcard.logoMarvel
              : isDC ? pcard.logoDC
              : isDarkHorse ? pcard.logoDarkHorse
              : pcard.logoStarWars
            }
            contentFit="contain"
          />
        </View>
      ) : item.publisher ? (
        <View style={pcard.pubTextWrap}>
          <Text style={pcard.pubText} numberOfLines={1}>{item.publisher}</Text>
        </View>
      ) : null}
      <View style={pcard.bottom}>
        <Text style={pcard.name} numberOfLines={2}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

const pcard = StyleSheet.create({
  wrap: { borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.navy },
  gradient: { ...StyleSheet.absoluteFillObject },
  logoWrap: { position: 'absolute', top: 10, left: 10 },
  logoMarvel: { width: 38, height: 15, borderRadius: 3 },
  logoDC: { width: 22, height: 22, borderRadius: 3 },
  logoDarkHorse: { width: 18, height: 26, borderRadius: 2 },
  logoStarWars: { width: 36, height: 36, borderRadius: 2 },
  pubTextWrap: { position: 'absolute', top: 10, left: 10, right: 10 },
  pubText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottom: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige, lineHeight: 18 },
});

// ── Carousel row (discover mode) ──────────────────────────────────────────────
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
              portraitUrl={item.portrait_url}
              onPress={() => onPress(item)}
            />
          </Animated.View>
        );
      }}
    />
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const { width } = useWindowDimensions();
  const cardWidth = (width - H_PAD * 2 - GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  // Discover state
  const [heroCategories, setHeroCategories] = useState<HeroesByCategory | null>(null);
  const [categoriesError, setCategoriesError] = useState(false);

  // Search state
  const [allHeroes, setAllHeroes] = useState<HeroSearchResult[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [query, setQuery] = useState('');
  const [publisherFilter, setPublisherFilter] = useState<PublisherFilter>('All');
  const [navigating, setNavigating] = useState(false);

  const debouncedQuery = useDebounce(query, 150);
  const isSearchActive = debouncedQuery.trim() !== '' || publisherFilter !== 'All';

  // Load category data for discover carousels
  useEffect(() => {
    getHeroesByCategory()
      .then(setHeroCategories)
      .catch(() => setCategoriesError(true));
  }, []);

  // Load full hero roster once for search mode
  useEffect(() => {
    searchHeroes('', 'All', 600)
      .then(setAllHeroes)
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }, []);

  // Client-side filter + rank — instant, no network on keystroke
  const filteredHeroes = useMemo(() => {
    let list =
      publisherFilter === 'All'
        ? allHeroes
        : allHeroes.filter((h) => {
            const pub = (h.publisher ?? '').toLowerCase();
            if (publisherFilter === 'Marvel') return pub.includes('marvel');
            if (publisherFilter === 'DC') return pub.includes('dc');
            return !pub.includes('marvel') && !pub.includes('dc');
          });
    return debouncedQuery.trim() ? rankResults(list, debouncedQuery) : list;
  }, [allHeroes, debouncedQuery, publisherFilter]);

  const displayedHeroes = filteredHeroes.slice(0, DISPLAY_LIMIT);

  const handlePress = useCallback(
    (item: { id: string }) => {
      if (navigating) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigating(true);
      inputRef.current?.blur();
      router.push(`/character/${item.id}`);
      setTimeout(() => setNavigating(false), 1000);
    },
    [router, navigating],
  );

  const clearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.indexLabel}>01</Text>
            <Text style={styles.title}>Explore</Text>
          </View>
          <Text style={styles.subtitle}>Heroes & Villains</Text>
        </View>

        {/* ── Search bar ── */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color="rgba(245,235,220,0.45)" style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Hero, villain, or real name…"
            placeholderTextColor="rgba(245,235,220,0.35)"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearQuery} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.4)" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Publisher pills ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContainer}
          style={styles.pillsScroll}
          keyboardShouldPersistTaps="handled"
        >
          {PUBLISHER_PILLS.map((pill) => {
            const active = publisherFilter === pill;
            return (
              <TouchableOpacity
                key={pill}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPublisherFilter(pill);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{pill}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Content ── */}
        {isSearchActive ? (
          // ── Search / grid mode ──
          loadingAll ? (
            <SearchSkeleton />
          ) : displayedHeroes.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyHeadline}>No heroes found</Text>
              <Text style={styles.emptySub}>Try a different search or filter</Text>
            </View>
          ) : (
            <FlatList
              data={displayedHeroes}
              keyExtractor={(h) => h.id}
              numColumns={GRID_COLUMNS}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.grid}
              columnWrapperStyle={styles.row}
              ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
              renderItem={({ item }) => (
                <PortraitCard
                  item={item}
                  cardWidth={cardWidth}
                  onPress={() => handlePress(item)}
                  disabled={navigating}
                />
              )}
            />
          )
        ) : (
          // ── Discover / carousel mode ──
          categoriesError ? (
            <View style={styles.center}>
              <Text style={styles.emptyHeadline}>Can't load heroes</Text>
              <Text style={styles.emptySub}>Check your connection and try again</Text>
            </View>
          ) : !heroCategories ? (
            <HomeSkeleton />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
              keyboardShouldPersistTaps="handled"
            >
              {SECTIONS.map(({ key, label, icon }, i) => (
                <View key={key} style={[styles.section, i === 0 && styles.firstSection]}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{label}</Text>
                    <Ionicons name={icon} size={26} color={COLORS.navy} style={styles.sectionIcon} />
                  </View>
                  <HeroRow heroes={heroCategories[key]} onPress={handlePress} />
                </View>
              ))}
            </ScrollView>
          )
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  flex: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.08)',
  },
  headerTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  indexLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 44, color: COLORS.navy, lineHeight: 46 },
  subtitle: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 1,
  },

  // ── Search bar ──────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 8,
  },
  searchIcon: { marginRight: 2 },
  searchInput: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.beige },

  // ── Pills ───────────────────────────────────────────────────────────────────
  pillsScroll: { flexGrow: 0, height: 44, marginBottom: 4 },
  pillsContainer: { paddingHorizontal: 16, paddingVertical: 2, gap: 8, alignItems: 'center' },
  pill: {
    height: 34,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(41,60,67,0.2)',
  },
  pillActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  pillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(41,60,67,0.5)' },
  pillTextActive: { color: COLORS.beige },

  // ── Grid (search mode) ───────────────────────────────────────────────────────
  grid: { paddingHorizontal: H_PAD, paddingBottom: 40 },
  row: { gap: GAP },

  // ── Carousels (discover mode) ────────────────────────────────────────────────
  carouselContent: { paddingBottom: 120 },
  section: { alignItems: 'flex-start' },
  firstSection: { marginTop: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    marginBottom: 10,
  },
  sectionTitle: { fontFamily: 'Flame-Regular', fontSize: 28, color: COLORS.navy },
  sectionIcon: { marginLeft: 6, marginBottom: 2 },

  // ── States ──────────────────────────────────────────────────────────────────
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyHeadline: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy },
  emptySub: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
});
