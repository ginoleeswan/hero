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
import { searchHeroes, rankResults } from '../../../src/lib/db/heroes';
import type { HeroSearchResult } from '../../../src/lib/db/heroes';
import { heroImageSource } from '../../../src/constants/heroImages';
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

export default function WebPickOpponentScreen() {
  const { hero, name } = useLocalSearchParams<{ hero: string; name: string }>();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [all, setAll] = useState<HeroSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    searchHeroes('', 'All', 600)
      .then(setAll)
      .catch((e: unknown) => { console.warn('[WebPickOpponentScreen] Failed to load heroes:', e); })
      .finally(() => setLoading(false));
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

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
