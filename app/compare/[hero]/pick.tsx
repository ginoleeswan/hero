import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  searchHeroes,
  rankResults,
  getHeroById,
  getHeroesByPowerRange,
} from '../../../src/lib/db/heroes';
import type { HeroSearchResult, HeroPowerResult } from '../../../src/lib/db/heroes';
import { heroImageSource } from '../../../src/constants/heroImages';
import { getRivals } from '../../../src/constants/rivals';
import { COLORS } from '../../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SIZE = (SCREEN_WIDTH - 12 * 3) / 2;
const CARD_HEIGHT = Math.round(CARD_SIZE * 1.48);
const SUGGEST_CARD_W = 110;
const SUGGEST_CARD_H = 150;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function SuggestCard({
  item,
  onPress,
}: {
  item: HeroSearchResult | HeroPowerResult;
  onPress: () => void;
}) {
  const source = heroImageSource(item.id, item.image_url, item.portrait_url);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82} style={suggest.card}>
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        placeholder={COLORS.navy}
        transition={150}
      />
      <View style={suggest.overlay} />
      <Text style={suggest.name} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
}

export default function PickOpponentScreen() {
  const { hero, name } = useLocalSearchParams<{ hero: string; name: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [all, setAll] = useState<HeroSearchResult[]>([]);
  const [rivals, setRivals] = useState<HeroSearchResult[]>([]);
  const [sameUniverse, setSameUniverse] = useState<HeroSearchResult[]>([]);
  const [similar, setSimilar] = useState<HeroPowerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    const rivalIds = new Set(getRivals(hero ?? ''));

    searchHeroes('', 'All', 600)
      .then((allHeroes) => {
        const filtered = allHeroes.filter((h) => h.id !== hero);
        // Sort: portrait first, then image, then neither
        const sorted = [...filtered].sort((a, b) => {
          const scoreA = a.portrait_url ? 2 : a.image_url ? 1 : 0;
          const scoreB = b.portrait_url ? 2 : b.image_url ? 1 : 0;
          return scoreB - scoreA;
        });
        setAll(sorted);

        const heroRow = allHeroes.find((h) => h.id === hero);
        const publisher = heroRow?.publisher;

        if (rivalIds.size > 0) {
          const heroMap = new Map(allHeroes.map((h) => [h.id, h]));
          setRivals(
            Array.from(rivalIds)
              .map((id) => heroMap.get(id))
              .filter(Boolean) as HeroSearchResult[],
          );
        }
        if (publisher) {
          setSameUniverse(
            filtered.filter((h) => h.publisher === publisher && !rivalIds.has(h.id)).slice(0, 8),
          );
        }
      })
      .catch((e: unknown) => {
        console.warn('[PickOpponentScreen] Failed to load heroes:', e);
      })
      .finally(() => setLoading(false));

    getHeroById(hero ?? '')
      .then((row) => {
        if (!row?.enriched_at) return;
        const total =
          (row.intelligence ?? 0) +
          (row.strength ?? 0) +
          (row.speed ?? 0) +
          (row.durability ?? 0) +
          (row.power ?? 0) +
          (row.combat ?? 0);
        const margin = Math.round(total * 0.18);
        getHeroesByPowerRange(total - margin, total + margin, hero ?? '').then((results) => {
          setSimilar(results.filter((r) => !rivalIds.has(r.id)));
        });
      })
      .catch(() => {});
  }, [hero]);

  const displayed = debouncedQuery.trim()
    ? rankResults(all, debouncedQuery).slice(0, 80)
    : all.slice(0, 80);

  const handlePick = (id: string) => {
    router.replace(`/compare/${hero}/${id}`);
  };

  const showSuggestions =
    !debouncedQuery.trim() && (rivals.length > 0 || sameUniverse.length > 0 || similar.length > 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.beige} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Who does {name ?? 'this hero'} face?
        </Text>
      </View>

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
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 16 }}
          ListHeaderComponent={
            showSuggestions ? (
              <View>
                {rivals.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Classic Rivals</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.suggestRow}
                    >
                      {rivals.map((item) => (
                        <SuggestCard
                          key={item.id}
                          item={item}
                          onPress={() => handlePick(item.id)}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
                {sameUniverse.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Same Universe</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.suggestRow}
                    >
                      {sameUniverse.map((item) => (
                        <SuggestCard
                          key={item.id}
                          item={item}
                          onPress={() => handlePick(item.id)}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
                {similar.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Similar Power Level</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.suggestRow}
                    >
                      {similar.map((item) => (
                        <SuggestCard
                          key={item.id}
                          item={item}
                          onPress={() => handlePick(item.id)}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
                <Text style={styles.sectionLabel}>All Heroes</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const source = heroImageSource(item.id, item.image_url, item.portrait_url);
            return (
              <TouchableOpacity
                onPress={() => handlePick(item.id)}
                activeOpacity={0.82}
                style={styles.card}
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
                <Text style={styles.cardName} numberOfLines={2}>
                  {item.name}
                </Text>
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
  headerTitle: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.beige, flex: 1 },
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
  input: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.beige },
  row: { gap: 8, marginBottom: 8 },
  card: {
    width: CARD_SIZE,
    height: CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(29,45,51,0.45)' },
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
  section: { marginBottom: 16 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  suggestRow: { gap: 10, paddingRight: 12 },
});

const suggest = StyleSheet.create({
  card: {
    width: SUGGEST_CARD_W,
    height: SUGGEST_CARD_H,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(29,45,51,0.4)' },
  name: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    fontFamily: 'Flame-Regular',
    fontSize: 12,
    color: COLORS.beige,
    lineHeight: 15,
  },
});
