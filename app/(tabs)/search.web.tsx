import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { COLORS } from '../../src/constants/colors';

const CDN_URL = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json';

interface CdnHero {
  id: number;
  name: string;
  biography: { publisher: string };
  images: { md: string };
}

const PUBLISHER_FILTERS = ['All', 'Marvel', 'DC', 'Other'] as const;
type PublisherFilter = (typeof PUBLISHER_FILTERS)[number];

export default function WebSearchScreen() {
  const router = useRouter();
  const [allHeroes, setAllHeroes] = useState<CdnHero[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [publisher, setPublisher] = useState<PublisherFilter>('All');

  useEffect(() => {
    fetch(CDN_URL)
      .then((r) => r.json())
      .then((data: CdnHero[]) => setAllHeroes(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    let list = allHeroes;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((h) => h.name.toLowerCase().includes(q));
    }
    if (publisher !== 'All') {
      list = list.filter((h) => {
        const pub = h.biography.publisher ?? '';
        if (publisher === 'Marvel') return pub.toLowerCase().includes('marvel');
        if (publisher === 'DC') return pub.toLowerCase().includes('dc');
        return !pub.toLowerCase().includes('marvel') && !pub.toLowerCase().includes('dc');
      });
    }
    return list.slice(0, 60);
  }, [allHeroes, query, publisher]);

  return (
    <View style={styles.root}>
      <View style={styles.heroBar}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input as object}
            placeholder="Search 700+ heroes and villains…"
            placeholderTextColor="rgba(245,235,220,0.4)"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
        <View style={styles.chips}>
          {PUBLISHER_FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setPublisher(f)}
              style={[styles.chip, publisher === f && styles.chipActive]}
            >
              <Text style={[styles.chipText, publisher === f && styles.chipTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.orange} size="large" />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {query ? `No results for "${query}"` : 'Search for a hero or villain…'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.resultsContent}>
          <View style={styles.grid as object}>
            {results.map((hero) => (
              <WebHeroCard
                key={hero.id}
                id={String(hero.id)}
                name={hero.name}
                imageUrl={hero.images.md}
                onPress={() => router.push(`/character/${hero.id}`)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  heroBar: {
    backgroundColor: COLORS.navy,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 14,
  },
  inputWrap: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 560,
  },
  input: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
    outlineStyle: 'none',
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: { backgroundColor: COLORS.orange },
  chipText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.6)',
  },
  chipTextActive: { color: 'white', fontFamily: 'Nunito_700Bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.grey,
  },
  resultsContent: {
    padding: 24,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 14,
  },
});
