import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
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

// CSS grid must live outside StyleSheet.create
const resultsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 14,
};
const skeletonGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 14,
};

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

  const isFiltered = query.trim().length > 0 || publisher !== 'All';
  const resultLabel = loading
    ? ''
    : isFiltered
      ? `${results.length} result${results.length !== 1 ? 's' : ''}`
      : `${allHeroes.length} heroes & villains`;

  return (
    <View style={styles.root}>

      {/* ── Editorial search header ── */}
      <View style={styles.header as object}>
        <View style={styles.headerInner}>
          <View style={styles.titleRow}>
            <Text style={styles.indexTag}>01</Text>
            <Text style={styles.headline}>Search</Text>
          </View>
          <Text style={styles.subheadline}>
            {allHeroes.length > 0 ? `${allHeroes.length}+` : '700+'} heroes & villains
          </Text>

          {/* Search input */}
          <View style={styles.inputRow as object}>
            <View style={styles.inputWrap as object}>
              <TextInput
                style={styles.input as object}
                placeholder="Search by name…"
                placeholderTextColor="rgba(245,235,220,0.3)"
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery('')}
                  style={({ hovered }: { hovered?: boolean }) =>
                    [styles.clearBtn, hovered && (styles.clearBtnHover as object)] as object
                  }
                >
                  <Text style={styles.clearX}>×</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Publisher filter pills */}
          <View style={styles.pills}>
            {PUBLISHER_FILTERS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setPublisher(f)}
                style={({ hovered }: { hovered?: boolean }) =>
                  [
                    styles.pill,
                    publisher === f && (styles.pillActive as object),
                    hovered && publisher !== f && (styles.pillHover as object),
                  ] as object
                }
              >
                <Text style={[styles.pillText, publisher === f && styles.pillTextActive]}>
                  {f}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* ── Results ── */}
      {loading ? (
        <SearchSkeleton />
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyHeadline}>No results</Text>
          <Text style={styles.emptySubtext}>
            {query ? `Nothing matched "${query}"` : 'Try a different filter'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.resultsContent}>
          {!loading && <Text style={styles.resultCount}>{resultLabel}</Text>}
          <View style={resultsGrid as object}>
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

function SearchSkeleton() {
  const opacity = useSkeletonAnim();
  return (
    <ScrollView contentContainerStyle={styles.resultsContent}>
      <View style={skeletonGrid as object}>
        {Array.from({ length: 24 }).map((_, i) => (
          <SkeletonBlock key={i} opacity={opacity} height={180} borderRadius={12} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 36,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.07)',
  } as object,

  headerInner: {
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
    gap: 16,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  indexTag: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 2,
  },
  headline: {
    fontFamily: 'Flame-Regular',
    fontSize: 52,
    color: COLORS.beige,
    lineHeight: 54,
  } as object,
  subheadline: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: -8,
  } as object,

  // ── Input ───────────────────────────────────────────────────────────────────
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  } as object,

  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,235,220,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    gap: 10,
    transition: 'border-color 150ms ease',
  } as object,

  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.beige,
    outlineStyle: 'none',
  } as object,

  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(245,235,220,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as object,
  clearBtnHover: {
    backgroundColor: 'rgba(245,235,220,0.2)',
  } as object,
  clearX: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.6)',
    lineHeight: 17,
    marginTop: -1,
  } as object,

  // ── Filter pills ────────────────────────────────────────────────────────────
  pills: {
    flexDirection: 'row',
    gap: 8,
  },

  pill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  } as object,
  pillActive: {
    backgroundColor: COLORS.orange,
    borderColor: COLORS.orange,
  } as object,
  pillHover: {
    borderColor: 'rgba(245,235,220,0.45)',
  } as object,
  pillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.5,
  },
  pillTextActive: {
    color: 'white',
  },

  // ── Results area ────────────────────────────────────────────────────────────
  resultsContent: {
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 80,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },

  resultCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    letterSpacing: 0.3,
    marginBottom: 18,
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyHeadline: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    color: COLORS.navy,
  },
  emptySubtext: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: COLORS.grey,
  },
});
