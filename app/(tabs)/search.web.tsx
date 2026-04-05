import { useEffect, useState, useMemo, useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/constants/colors';
import { heroImageSource } from '../../src/constants/heroImages';
import { searchHeroes, rankResults } from '../../src/lib/db/heroes';
import type { HeroSearchResult, PublisherFilter } from '../../src/lib/db/heroes';

const PUBLISHER_FILTERS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];
const DISPLAY_LIMIT = 120;

// Publisher logos — matched by checking publisher string
const MARVEL_LOGO = require('../../assets/images/Marvel-Logo.jpg') as number;
const DC_LOGO = require('../../assets/images/DC-Logo.png') as number;

// CSS grid must live outside StyleSheet.create
// Uses auto-fill so it collapses gracefully on tablet/mobile viewports
const resultsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gridAutoRows: '220px',
  gap: 10,
};

// ── Hero card ─────────────────────────────────────────────────────────────────
function HeroCard({ item, onPress }: { item: HeroSearchResult; onPress: () => void }) {
  const source = heroImageSource(item.id, item.image_url, item.portrait_url);
  const pub = (item.publisher ?? '').toLowerCase();
  const isMarvel = pub.includes('marvel');
  const isDC = pub.includes('dc');

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [card.wrap, hovered && (card.wrapHover as object)] as object
      }
    >
      {/* Hero image */}
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top center"
        style={StyleSheet.absoluteFill}
        transition={200}
        placeholder={COLORS.navy}
      />

      {/* Gradient overlay */}
      <View style={card.overlay as object} />

      {/* Publisher badge — logo if Marvel/DC, text otherwise */}
      {(isMarvel || isDC) ? (
        <View style={card.logoWrap}>
          <Image
            source={isMarvel ? MARVEL_LOGO : DC_LOGO}
            style={isMarvel ? (card.logoMarvel as object) : (card.logoDC as object)}
            contentFit="contain"
          />
        </View>
      ) : item.publisher ? (
        <View style={card.pubTextWrap}>
          <Text style={card.pubTextFallback} numberOfLines={1}>{item.publisher}</Text>
        </View>
      ) : null}

      {/* Hero name — bottom */}
      <View style={card.bottom}>
        <Text style={card.name} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
    </Pressable>
  );
}

const card = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  wrapHover: {
    transform: [{ scale: 1.04 }],
    boxShadow: '0 20px 56px rgba(0,0,0,0.32)',
    zIndex: 2,
  } as object,
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.1) 55%, transparent 100%)',
  } as object,
  logoWrap: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  pubTextWrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
  },
  pubTextFallback: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  logoMarvel: {
    width: 38,
    height: 15,
    borderRadius: 3,
  } as object,
  logoDC: {
    width: 22,
    height: 22,
    borderRadius: 3,
  } as object,
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
    textShadow: '0 1px 10px rgba(0,0,0,0.9)',
  } as object,
});

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SearchSkeleton() {
  const opacity = useSkeletonAnim();
  return (
    <View style={styles.scrollContent}>
      <View style={resultsGrid as object}>
        {Array.from({ length: 30 }).map((_, i) => (
          <SkeletonBlock key={i} opacity={opacity} height={240} borderRadius={10} />
        ))}
      </View>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyHeadline}>
        {query ? `"${query}"` : 'Nothing here'}
      </Text>
      <Text style={styles.emptySub}>
        {query ? 'No heroes match that name.' : 'No heroes found for this filter.'}
      </Text>
      <Pressable
        onPress={onClear}
        style={({ hovered }: { hovered?: boolean }) =>
          [styles.clearFilter, hovered && (styles.clearFilterHover as object)] as object
        }
      >
        <Text style={styles.clearFilterText}>Clear filters</Text>
      </Pressable>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function WebSearchScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  // Load all heroes ONCE on mount — filter client-side for instant results
  const [allHeroes, setAllHeroes] = useState<HeroSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [publisher, setPublisher] = useState<PublisherFilter>('All');

  useEffect(() => {
    searchHeroes('', 'All', 600)
      .then(setAllHeroes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Client-side smart filter + ranking — instant, no network on every keystroke
  const filtered = useMemo(() => {
    // Apply publisher filter first
    let list = publisher === 'All' ? allHeroes : allHeroes.filter((h) => {
      const pub = (h.publisher ?? '').toLowerCase();
      if (publisher === 'Marvel') return pub.includes('marvel');
      if (publisher === 'DC') return pub.includes('dc');
      return !pub.includes('marvel') && !pub.includes('dc');
    });

    // Then rank by relevance (prefix > contains > full_name > alias)
    return query.trim() ? rankResults(list, query) : list;
  }, [allHeroes, query, publisher]);

  const displayed = filtered.slice(0, DISPLAY_LIMIT);
  const hasMore = filtered.length > DISPLAY_LIMIT;

  const countLabel = loading
    ? '—'
    : hasMore
      ? `Showing ${DISPLAY_LIMIT} of ${filtered.length}`
      : `${filtered.length} hero${filtered.length !== 1 ? 'es' : ''}`;

  const handleClear = useCallback(() => {
    setQuery('');
    setPublisher('All');
  }, []);

  return (
    <View style={styles.root}>

      {/* ── Sticky search command bar ─────────────────────────────────────── */}
      <View style={styles.commandBar as object}>
        <View style={styles.commandInner}>

          {/* Row 1: label + underline input + count */}
          <View style={styles.inputRow as object}>
            {!isMobile && <Text style={styles.commandLabel}>Search</Text>}
            <View style={styles.underlineWrap as object}>
              <TextInput
                style={[styles.input, isMobile && (styles.inputMobile as object)] as object}
                placeholder={isMobile ? 'Search heroes…' : 'Hero or villain name…'}
                placeholderTextColor="rgba(245,235,220,0.28)"
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
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.orange} />
            ) : (
              <Text style={styles.countBadge}>{countLabel}</Text>
            )}
          </View>

          {/* Row 2: publisher pills */}
          <View style={styles.filtersRow}>
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

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <SearchSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState query={query} onClear={handleClear} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={resultsGrid as object}>
            {displayed.map((item) => (
              <HeroCard
                key={item.id}
                item={item}
                onPress={() => router.push(`/character/${item.id}`)}
              />
            ))}
          </View>
          {hasMore && (
            <Text style={styles.moreHint}>
              Refine your search to see more results
            </Text>
          )}
        </ScrollView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 80,
  },

  // ── Command bar ─────────────────────────────────────────────────────────────
  commandBar: {
    position: 'sticky',
    top: 64,
    zIndex: 50,
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.07)',
    paddingTop: 20,
    paddingBottom: 14,
  } as object,

  commandInner: {
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
    gap: 10,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  } as object,

  // Hidden on very small screens via fontSize scaling
  commandLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.beige,
    flexShrink: 0,
    lineHeight: 26,
  } as object,

  underlineWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(245,235,220,0.2)',
    paddingBottom: 5,
    gap: 8,
  } as object,

  input: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 22,
    color: COLORS.beige,
    outlineStyle: 'none',
    paddingVertical: 2,
  } as object,
  inputMobile: { fontSize: 16 } as object,

  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(245,235,220,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  } as object,
  clearBtnHover: { backgroundColor: 'rgba(245,235,220,0.18)' } as object,
  clearX: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: 'rgba(245,235,220,0.65)',
    lineHeight: 18,
  } as object,

  countBadge: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.3)',
    letterSpacing: 0.5,
    flexShrink: 0,
    minWidth: 100,
    textAlign: 'right',
  } as object,

  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
  },

  pill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.15)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  } as object,
  pillActive: {
    backgroundColor: COLORS.orange,
    borderColor: COLORS.orange,
  } as object,
  pillHover: {
    borderColor: 'rgba(245,235,220,0.4)',
  } as object,
  pillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.38)',
    letterSpacing: 0.4,
  },
  pillTextActive: { color: 'white' },

  // ── "More" hint ─────────────────────────────────────────────────────────────
  moreHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    marginTop: 28,
    letterSpacing: 0.3,
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
    gap: 12,
  },
  emptyHeadline: {
    fontFamily: 'Flame-Regular',
    fontSize: 48,
    color: COLORS.navy,
    textAlign: 'center',
  } as object,
  emptySub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.grey,
    textAlign: 'center',
  } as object,
  clearFilter: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  clearFilterHover: { backgroundColor: COLORS.navy } as object,
  clearFilterText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
  },
});
