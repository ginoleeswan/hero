import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { searchHeroes, rankResults, getHeroById, getHeroesByPowerRange } from '../../../src/lib/db/heroes';
import type { HeroSearchResult, HeroPowerResult } from '../../../src/lib/db/heroes';
import { heroImageSource } from '../../../src/constants/heroImages';
import { getRivals } from '../../../src/constants/rivals';
import { COLORS } from '../../../src/constants/colors';

const resultsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
  gridAutoRows: '200px',
  gap: 10,
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function SuggestRow({ label, items, onPick }: { label: string; items: (HeroSearchResult | HeroPowerResult)[]; onPick: (id: string) => void }) {
  return (
    <View style={suggest.section}>
      <Text style={suggest.sectionLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={suggest.row as object}>
        {items.map((item) => {
          const source = heroImageSource(item.id, item.image_url, item.portrait_url);
          return (
            <Pressable
              key={item.id}
              onPress={() => onPick(item.id)}
              style={({ hovered }: { hovered?: boolean }) =>
                [suggest.card, hovered && (suggest.cardHover as object)] as object
              }
            >
              <Image source={source} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} placeholder={COLORS.navy} transition={150} />
              <View style={suggest.overlay as object} />
              <Text style={suggest.name as object} numberOfLines={2}>{item.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function WebPickOpponentScreen() {
  const { hero, name } = useLocalSearchParams<{ hero: string; name: string }>();
  const router = useRouter();
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
        const sorted = [...filtered].sort((a, b) => {
          const sA = a.portrait_url ? 2 : a.image_url ? 1 : 0;
          const sB = b.portrait_url ? 2 : b.image_url ? 1 : 0;
          return sB - sA;
        });
        setAll(sorted);
        if (rivalIds.size > 0) {
          const heroMap = new Map(allHeroes.map((h) => [h.id, h]));
          setRivals(Array.from(rivalIds).map((id) => heroMap.get(id)).filter(Boolean) as HeroSearchResult[]);
        }
        const heroRow = allHeroes.find((h) => h.id === hero);
        if (heroRow?.publisher) {
          setSameUniverse(filtered.filter((h) => h.publisher === heroRow.publisher && !rivalIds.has(h.id)).slice(0, 8));
        }
      })
      .catch((e: unknown) => { console.warn('[WebPickOpponentScreen] Failed to load heroes:', e); })
      .finally(() => setLoading(false));

    getHeroById(hero ?? '').then((row) => {
      if (!row?.enriched_at) return;
      const total = (row.intelligence ?? 0) + (row.strength ?? 0) + (row.speed ?? 0)
        + (row.durability ?? 0) + (row.power ?? 0) + (row.combat ?? 0);
      const margin = Math.round(total * 0.18);
      getHeroesByPowerRange(total - margin, total + margin, hero ?? '').then((results) => {
        const rivalIds2 = new Set(getRivals(hero ?? ''));
        setSimilar(results.filter((r) => !rivalIds2.has(r.id)));
      });
    }).catch(() => {});

    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [hero]);

  const showSuggestions = !debouncedQuery.trim() && (rivals.length > 0 || sameUniverse.length > 0 || similar.length > 0);
  const displayed = debouncedQuery.trim()
    ? rankResults(all, debouncedQuery).slice(0, 120)
    : all.slice(0, 120);

  return (
    <View style={styles.root}>
      {/* Header bar */}
      <View style={styles.header as object}>
        <View style={styles.headerInner}>
          <Pressable
            onPress={() => router.back()}
            style={({ hovered }: { hovered?: boolean }) =>
              [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
            }
          >
            <Ionicons name="arrow-back" size={16} color={COLORS.beige} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Who does {name ?? 'this hero'} face?</Text>
          <View style={styles.searchWrap as object}>
            <TextInput
              ref={inputRef}
              style={styles.input as object}
              placeholder="Hero or villain name…"
              placeholderTextColor="rgba(245,235,220,0.28)"
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color="rgba(245,235,220,0.4)" />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Grid */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {showSuggestions && (
            <View style={suggest.sections as object}>
              {rivals.length > 0 && <SuggestRow label="Classic Rivals" items={rivals} onPick={(id) => router.replace(`/compare/${hero}/${id}`)} />}
              {sameUniverse.length > 0 && <SuggestRow label="Same Universe" items={sameUniverse} onPick={(id) => router.replace(`/compare/${hero}/${id}`)} />}
              {similar.length > 0 && <SuggestRow label="Similar Power Level" items={similar} onPick={(id) => router.replace(`/compare/${hero}/${id}`)} />}
              <Text style={suggest.sectionLabel}>All Heroes</Text>
            </View>
          )}
          <View style={resultsGrid as object}>
            {displayed.map((item) => {
              const source = heroImageSource(item.id, item.image_url, item.portrait_url);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.replace(`/compare/${hero}/${item.id}`)}
                  style={({ hovered }: { hovered?: boolean }) =>
                    [card.wrap, hovered && (card.wrapHover as object)] as object
                  }
                >
                  <Image
                    source={source}
                    contentFit="cover"
                    contentPosition="top center"
                    style={StyleSheet.absoluteFill}
                    placeholder={COLORS.navy}
                    transition={150}
                  />
                  <View style={card.overlay as object} />
                  <Text style={card.name as object} numberOfLines={2}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    position: 'sticky',
    top: 64,
    zIndex: 50,
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.08)',
    paddingVertical: 14,
  } as object,
  headerInner: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    cursor: 'pointer',
    flexShrink: 0,
  } as object,
  backBtnHover: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.65)',
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.beige,
    flexShrink: 0,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(245,235,220,0.2)',
    paddingBottom: 4,
    gap: 8,
  } as object,
  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.beige,
    outlineStyle: 'none',
  } as object,
  scroll: { flex: 1 },
  content: {
    padding: 16,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 80,
  },
});

const suggest = {
  sections: { marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.grey,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: { display: 'flex', flexDirection: 'row' as const, gap: 10, paddingBottom: 4 },
  card: {
    width: 120,
    height: 170,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    flexShrink: 0,
    position: 'relative' as const,
  },
  cardHover: { transform: [{ scale: 1.04 }] },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: 'linear-gradient(to top, rgba(29,45,51,0.9) 0%, transparent 60%)',
  },
  name: {
    position: 'absolute',
    bottom: 8, left: 8, right: 8,
    fontFamily: 'Flame-Regular',
    fontSize: 12,
    color: COLORS.beige,
    lineHeight: 15,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
  },
};

const card = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 150ms ease, box-shadow 150ms ease',
  } as object,
  wrapHover: {
    transform: [{ scale: 1.04 }],
    boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.9) 0%, rgba(29,45,51,0.1) 55%, transparent 100%)',
  } as object,
  name: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
    lineHeight: 17,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
  } as object,
});
