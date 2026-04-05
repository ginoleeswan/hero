// app/(tabs)/search.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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

import { searchHeroes, rankResults } from '../../src/lib/db/heroes';
import type { HeroSearchResult, PublisherFilter } from '../../src/lib/db/heroes';

const PUBLISHER_PILLS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];
const COLUMNS = 2;
const H_PAD = 12;
const GAP = 8;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Portrait card ─────────────────────────────────────────────────────────────
function HeroCard({
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

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      disabled={disabled}
      style={[ncard.wrap, { width: cardWidth, height: Math.round(cardWidth * 1.48) }]}
    >
      {/* Hero image */}
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        placeholder={COLORS.navy}
        transition={200}
      />

      {/* Gradient overlay — matches web */}
      <LinearGradient
        colors={['transparent', 'rgba(29,45,51,0.18)', 'rgba(29,45,51,0.97)']}
        locations={[0, 0.45, 1]}
        style={ncard.gradient}
      />

      {/* Publisher badge — top left */}
      {item.publisher ? (
        <View style={ncard.pubTextWrap}>
          <Text style={ncard.pubText} numberOfLines={1}>{item.publisher}</Text>
        </View>
      ) : null}

      {/* Hero name — bottom */}
      <View style={ncard.bottom}>
        <Text style={ncard.name} numberOfLines={2}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

const ncard = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  pubTextWrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
  },
  pubText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottom: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const { width } = useWindowDimensions();
  const cardWidth = (width - H_PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const [results, setResults] = useState<HeroSearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [publisherFilter, setPublisherFilter] = useState<PublisherFilter>('All');
  const [retryCount, setRetryCount] = useState(0);

  const debouncedQuery = useDebounce(query, 150);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setError(false);
    searchHeroes(debouncedQuery, publisherFilter)
      .then((data) => {
        if (!cancelled) setResults(rankResults(data, debouncedQuery));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery, publisherFilter, retryCount]);

  const handlePress = useCallback(
    (item: HeroSearchResult) => {
      if (navigating) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigating(true);
      inputRef.current?.blur();
      router.push({
        pathname: '/character/[id]',
        params: {
          id: item.id,
          name: item.name,
          imageUri: item.portrait_url ?? item.image_url ?? '',
        },
      });
      setTimeout(() => setNavigating(false), 1000);
    },
    [router, navigating],
  );

  const clearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const isFiltered = debouncedQuery.trim() !== '' || publisherFilter !== 'All';
  const resultLabel =
    loadingList || error
      ? ''
      : isFiltered
        ? `${results.length} result${results.length !== 1 ? 's' : ''}`
        : `${results.length} heroes`;

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
            <Text style={styles.title}>Search</Text>
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

        {/* ── Result count ── */}
        {!loadingList && !error && resultLabel ? (
          <Text style={styles.resultCount}>{resultLabel}</Text>
        ) : null}

        {/* ── Content ── */}
        {loadingList ? (
          <SearchSkeleton />
        ) : error ? (
          <View style={styles.center}>
            <View style={styles.errorIcon}>
              <Ionicons name="wifi-outline" size={28} color="rgba(41,60,67,0.3)" />
            </View>
            <Text style={styles.errorHeadline}>Can't load heroes</Text>
            <Text style={styles.errorSub}>Check your connection and try again</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setRetryCount((c) => c + 1)}
              activeOpacity={0.8}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyHeadline}>No heroes found</Text>
            <Text style={styles.emptySub}>Try a different search or filter</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(h) => h.id}
            numColumns={COLUMNS}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            renderItem={({ item }) => (
              <HeroCard
                item={item}
                cardWidth={cardWidth}
                onPress={() => handlePress(item)}
                disabled={navigating}
              />
            )}
          />
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

  // ── Result count ────────────────────────────────────────────────────────────
  resultCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    paddingHorizontal: H_PAD,
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  // ── Grid ────────────────────────────────────────────────────────────────────
  grid: { paddingHorizontal: H_PAD, paddingBottom: 40 },
  row: { gap: GAP },

  // ── States ──────────────────────────────────────────────────────────────────
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 60 },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(41,60,67,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorHeadline: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.navy },
  errorSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.navy,
    borderRadius: 20,
  },
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.beige, letterSpacing: 0.3 },
  emptyHeadline: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy },
  emptySub: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
});
