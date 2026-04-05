import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchHeroes, rankResults } from '../../../src/lib/db/heroes';
import type { HeroSearchResult } from '../../../src/lib/db/heroes';
import { heroImageSource } from '../../../src/constants/heroImages';
import { COLORS } from '../../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_WIDTH - 12 * 3) / 2;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function PickOpponentScreen() {
  const { id1, name } = useLocalSearchParams<{ id1: string; name: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [all, setAll] = useState<HeroSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    searchHeroes('', 'All', 600)
      .then(setAll)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayed = debouncedQuery.trim()
    ? rankResults(all, debouncedQuery).slice(0, 80)
    : all.slice(0, 80);

  const handlePick = (item: HeroSearchResult) => {
    router.replace(`/compare/${id1}/${item.id}`);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.beige} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Who does {name ?? 'this hero'} face?
        </Text>
      </View>

      {/* Search input */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="rgba(245,235,220,0.4)" style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Hero or villain name…"
          placeholderTextColor="rgba(245,235,220,0.28)"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Grid */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} />
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 16 }]}
          renderItem={({ item }) => {
            const source = heroImageSource(item.id, item.image_url, item.portrait_url);
            return (
              <TouchableOpacity
                onPress={() => handlePick(item)}
                activeOpacity={0.82}
                style={[styles.card, { width: CARD_SIZE, height: Math.round(CARD_SIZE * 1.48) }]}
              >
                <Image
                  source={source}
                  contentFit="cover"
                  contentPosition="top"
                  style={StyleSheet.absoluteFill}
                  placeholder={COLORS.navy}
                  transition={150}
                />
                <View style={styles.cardOverlay} />
                <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: { flexShrink: 0 },
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
  },
  grid: { paddingHorizontal: 12, gap: 8 },
  row: { gap: 8, marginBottom: 0 },
  card: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    marginBottom: 8,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,45,51,0.45)',
  },
  cardName: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
    lineHeight: 17,
  },
});
