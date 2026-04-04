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
import { searchHeroes } from '../../src/lib/db/heroes';
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
    setLoadingList(true);
    setError(false);
    searchHeroes(debouncedQuery, publisherFilter)
      .then(setResults)
      .catch(() => setError(true))
      .finally(() => setLoadingList(false));
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

  const resultLabel = loadingList
    ? ''
    : error
      ? ''
      : `${results.length} result${results.length !== 1 ? 's' : ''}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>search</Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.beige} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search heroes…"
            placeholderTextColor="rgba(245,235,220,0.5)"
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
              <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.6)" />
            </TouchableOpacity>
          )}
        </View>

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

        {!loadingList && !error && <Text style={styles.resultCount}>{resultLabel}</Text>}

        {loadingList ? (
          <SearchSkeleton />
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="wifi-outline" size={40} color={COLORS.grey} />
            <Text style={styles.errorText}>Couldn't load heroes</Text>
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
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => handlePress(item.id, item.name, item.image_url ?? '')}
                  activeOpacity={0.7}
                  disabled={!!navigatingId}
                >
                  <Image
                    source={{ uri: item.image_md_url ?? item.image_url ?? undefined }}
                    style={styles.avatar}
                    contentFit="cover"
                    placeholder="#d4c8b8"
                    transition={200}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.heroName}>{item.name}</Text>
                    {item.publisher ? <Text style={styles.publisher}>{item.publisher}</Text> : null}
                  </View>
                  {isNavigating ? (
                    <ActivityIndicator size="small" color={COLORS.orange} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={COLORS.grey} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No heroes found</Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 48;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontFamily: 'Righteous_400Regular', fontSize: 50, color: COLORS.navy },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    marginHorizontal: 15,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.beige },
  pillsScroll: { flexGrow: 0, height: 48, marginBottom: 10 },
  pillsContainer: { paddingHorizontal: 15, paddingVertical: 4, gap: 8, alignItems: 'center' },
  pill: {
    height: 36,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
  },
  pillActive: { backgroundColor: COLORS.navy },
  pillText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  pillTextActive: { color: COLORS.beige },
  resultCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  list: { paddingHorizontal: 15, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.navy,
    marginRight: 14,
  },
  rowText: { flex: 1 },
  heroName: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.navy },
  publisher: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, marginTop: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d4c8b8',
    marginLeft: AVATAR_SIZE + 14,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: 'FlameSans-Regular', fontSize: 15, color: COLORS.grey },
  errorText: { fontFamily: 'FlameSans-Regular', fontSize: 15, color: COLORS.grey },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.navy,
    borderRadius: 20,
  },
  retryText: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: COLORS.beige },
});
