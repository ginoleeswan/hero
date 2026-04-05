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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { SearchSkeleton } from '../../src/components/skeletons/SearchSkeleton';
import { searchHeroes, rankResults } from '../../src/lib/db/heroes';
import type { HeroSearchResult, PublisherFilter } from '../../src/lib/db/heroes';

const PUBLISHER_PILLS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [results, setResults] = useState<HeroSearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
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
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, publisherFilter, retryCount]);

  const handlePress = useCallback(
    (id: string, name: string, imageUri: string) => {
      if (navigatingId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigatingId(id);
      inputRef.current?.blur();
      router.push({
        pathname: '/character/[id]',
        params: { id, name, imageUri },
      });
      setTimeout(() => setNavigatingId(null), 1000);
    },
    [router, navigatingId],
  );

  const clearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handlePillPress = (pill: PublisherFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPublisherFilter(pill);
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
            placeholder="Search heroes…"
            placeholderTextColor="rgba(245,235,220,0.35)"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={clearQuery}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
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
                onPress={() => handlePillPress(pill)}
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
        ) : (
          <FlatList
            data={results}
            keyExtractor={(h) => h.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const isNavigating = navigatingId === item.id;
              const imageUri = item.portrait_url ?? item.image_md_url ?? item.image_url ?? undefined;
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() =>
                    handlePress(item.id, item.name, item.portrait_url ?? item.image_url ?? '')
                  }
                  activeOpacity={0.75}
                  disabled={!!navigatingId}
                >
                  {/* Portrait thumbnail */}
                  <View style={styles.thumbWrap}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.thumb}
                      contentFit="cover"
                      contentPosition="top"
                      placeholder="#d4c8b8"
                      transition={200}
                    />
                  </View>

                  {/* Text */}
                  <View style={styles.rowText}>
                    <Text style={styles.heroName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.publisher ? (
                      <View style={styles.publisherRow}>
                        <Text style={styles.publisherText} numberOfLines={1}>
                          {item.publisher}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Trailing indicator */}
                  {isNavigating ? (
                    <ActivityIndicator size="small" color={COLORS.orange} />
                  ) : (
                    <Ionicons name="chevron-forward" size={15} color="rgba(41,60,67,0.25)" />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyHeadline}>No heroes found</Text>
                <Text style={styles.emptySub}>Try a different search or filter</Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const THUMB_W = 44;
const THUMB_H = 58;

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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  indexLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 44,
    color: COLORS.navy,
    lineHeight: 46,
  },
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
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
  },

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
    paddingHorizontal: 20,
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  // ── List ────────────────────────────────────────────────────────────────────
  list: { paddingHorizontal: 16, paddingBottom: 40 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 14,
  },

  thumbWrap: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#d4c8b8',
    flexShrink: 0,
  },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
  },

  rowText: { flex: 1, gap: 3 },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.navy,
    lineHeight: 18,
  },
  publisherRow: { flexDirection: 'row', alignItems: 'center' },
  publisherText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    letterSpacing: 0.2,
  },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(41,60,67,0.1)',
    marginLeft: THUMB_W + 14,
  },

  // ── States ──────────────────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 8,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(41,60,67,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorHeadline: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
  },
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
  retryText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.beige,
    letterSpacing: 0.3,
  },
  emptyHeadline: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.navy,
  },
  emptySub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
  },
});
