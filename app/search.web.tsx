// app/search.web.tsx — Committed search results page (web). Reads ?q= and ?publisher=.
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  searchHeroes,
  rankResults,
  type HeroSearchResult,
  type PublisherFilter,
} from '../src/lib/db/heroes';
import { heroGridImageSource } from '../src/constants/heroImages';
import { COLORS } from '../src/constants/colors';
import { useSearch } from '../src/contexts/SearchContext';
import { useSkeletonAnim } from '../src/components/web/Skeleton';

const RESULT_LIMIT = 300;
const PUB_OPTS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];

function normalizePublisher(p?: string | string[]): PublisherFilter {
  const v = (Array.isArray(p) ? p[0] : p ?? '').toLowerCase();
  if (v === 'marvel') return 'Marvel';
  if (v === 'dc') return 'DC';
  if (v === 'other') return 'Other';
  return 'All';
}

// ── Skeleton card ──────────────────────────────────────────────────────────────
function SkeletonCard({ opacity }: { opacity: Animated.Value }) {
  return <Animated.View style={[sk.wrap as object, { opacity }]} />;
}

const sk = StyleSheet.create({
  wrap: { borderRadius: 10, aspectRatio: '3 / 4', backgroundColor: '#ddd5c8' } as object,
});

// ── Card ────────────────────────────────────────────────────────────────────────
function HeroCard({ hero, onPress }: { hero: HeroSearchResult; onPress: () => void }) {
  const source = heroGridImageSource(hero.id, hero.image_url, hero.portrait_url, hero.image_md_url);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [card.wrap, hovered && (card.wrapHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition={{ top: 0, left: '50%' }}
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={hero.id}
        transition={typeof source === 'object' && 'uri' in source ? 150 : null}
      />
      <View style={card.overlay as object} />
      <View style={card.bottom}>
        <Text style={card.name as object} numberOfLines={2}>
          {hero.name}
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
    aspectRatio: '3 / 4',
  } as object,
  wrapHover: {
    transform: [{ scale: 1.04 }],
    boxShadow: '0 20px 56px rgba(0,0,0,0.32)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.08) 55%, transparent 100%)',
  } as object,
  bottom: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
  } as object,
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function WebSearchScreen() {
  const params = useLocalSearchParams<{ q?: string; publisher?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { setQuery } = useSearch();
  const skeletonOpacity = useSkeletonAnim();

  const q = (Array.isArray(params.q) ? params.q[0] : params.q ?? '').toString();
  const publisher = normalizePublisher(params.publisher);
  const hasCriteria = q.trim().length > 0 || publisher !== 'All';

  const [heroes, setHeroes] = useState<HeroSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Reflect the committed query in the nav search field. Only re-runs when the
  // URL param changes (commit/navigation), so it never clobbers live typing.
  useEffect(() => {
    setQuery(q);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasCriteria) {
      setHeroes([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await searchHeroes(q, publisher, RESULT_LIMIT);
        const ranked = q.trim() ? rankResults(res, q) : res;
        if (!cancelled) setHeroes(ranked);
      } catch {
        if (!cancelled) setHeroes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, publisher, hasCriteria]);

  const handlePress = (id: string) => router.push(`/character/${id}`);

  const setPublisher = (p: PublisherFilter) => {
    router.setParams({ publisher: p === 'All' ? '' : p });
  };

  const title = q.trim() ? `"${q.trim()}"` : publisher !== 'All' ? publisher : 'Search';
  const capped = heroes.length >= RESULT_LIMIT;
  const countLabel = loading
    ? 'Searching…'
    : heroes.length === 0
      ? 'No heroes found'
      : capped
        ? `${RESULT_LIMIT}+ results`
        : `${heroes.length} result${heroes.length !== 1 ? 's' : ''}`;

  const contentPad = isDesktop ? 32 : 16;
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: isDesktop
      ? 'repeat(auto-fill, minmax(170px, 1fr))'
      : 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12,
  };

  return (
    <View style={styles.root}>
      {/* ── Hero zone ─────────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.heroZone,
          isDesktop && (styles.heroZoneDesktop as object),
          { paddingHorizontal: contentPad },
        ] as object}
      >
        <View
          style={[styles.heroZoneInner, isDesktop && (styles.heroZoneInnerDesktop as object)] as object}
        >
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
            style={({ hovered }: { hovered?: boolean }) =>
              [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
            }
          >
            <Ionicons name="arrow-back" size={15} color="rgba(245,235,220,0.55)" />
            <Text style={styles.backText as object}>Back</Text>
          </Pressable>

          <View style={styles.titleRow}>
            <View style={[styles.accentBar, isDesktop && (styles.accentBarDesktop as object)] as object} />
            <View style={styles.titleBlock}>
              <Text style={styles.eyebrow as object}>Search Results</Text>
              <Text
                style={[styles.title, isDesktop && (styles.titleDesktop as object)] as object}
                numberOfLines={1}
              >
                {title}
              </Text>
            </View>
            {!loading && heroes.length > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countText as object}>
                  {capped ? `${RESULT_LIMIT}+` : heroes.length.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Controls bar — publisher filter ──────────────────────────────────── */}
      <View style={styles.controlsBar}>
        <View style={[styles.controlsInner, { paddingHorizontal: contentPad }] as object}>
          <View style={styles.pills as object}>
            {PUB_OPTS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setPublisher(p)}
                style={[styles.pill, publisher === p && (styles.pillActive as object)] as object}
              >
                <Text
                  style={[styles.pillText, publisher === p && (styles.pillTextActive as object)] as object}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
          {isDesktop && <Text style={styles.countLabel as object}>{countLabel}</Text>}
        </View>
      </View>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {!hasCriteria ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Search for a hero to see results.</Text>
        </View>
      ) : loading ? (
        <View style={[styles.gridWrap, { paddingHorizontal: contentPad }]}>
          <View style={gridStyle as object}>
            {Array.from({ length: 18 }).map((_, i) => (
              <SkeletonCard key={i} opacity={skeletonOpacity} />
            ))}
          </View>
        </View>
      ) : heroes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>No heroes match {title}.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          <View style={[styles.gridWrap, { paddingHorizontal: contentPad, paddingBottom: 60 }]}>
            <View style={gridStyle as object}>
              {heroes.map((hero) => (
                <HeroCard key={hero.id} hero={hero} onPress={() => handlePress(hero.id)} />
              ))}
            </View>
            {capped && (
              <Text style={styles.moreHint as object}>
                Showing the first {RESULT_LIMIT} results — refine your search to narrow it down.
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },

  heroZone: { backgroundColor: COLORS.navy, paddingTop: 12, paddingBottom: 16 },
  heroZoneDesktop: { paddingTop: 20, paddingBottom: 22 } as object,
  heroZoneInner: { maxWidth: 1200, width: '100%', alignSelf: 'center', gap: 10 },
  heroZoneInnerDesktop: { gap: 14 } as object,
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  backBtnHover: { opacity: 0.5 } as object,
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.55)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as object,
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  accentBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
    flexShrink: 0,
  },
  accentBarDesktop: { height: 56 } as object,
  titleBlock: { flex: 1, gap: 4, minWidth: 0 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    color: COLORS.beige,
    lineHeight: 34,
  } as object,
  titleDesktop: { fontSize: 46, lineHeight: 50 } as object,
  countPill: {
    backgroundColor: 'rgba(232,98,26,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(232,98,26,0.35)',
    flexShrink: 0,
  },
  countText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
    letterSpacing: 0.3,
  } as object,

  controlsBar: {
    backgroundColor: COLORS.beige,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.12)',
    paddingVertical: 12,
    position: 'sticky',
    top: 64,
    zIndex: 40,
  } as object,
  controlsInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  } as object,
  pills: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' } as object,
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(29,45,51,0.07)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  pillActive: { backgroundColor: COLORS.navy } as object,
  pillText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy } as object,
  pillTextActive: { color: COLORS.beige } as object,
  countLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    marginLeft: 'auto',
    letterSpacing: 0.2,
  } as object,

  scroll: { flex: 1 },
  gridWrap: { paddingTop: 28, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: COLORS.grey },
  moreHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    paddingTop: 24,
  } as object,
});
