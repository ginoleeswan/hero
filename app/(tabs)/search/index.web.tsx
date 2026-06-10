// app/search.web.tsx — Search experience (web).
// Desktop: committed results driven by the nav field (?q= in the URL).
// Mobile: full-screen live search with its own input, plus Recent + Trending.
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { type HeroSearchResult, type PublisherFilter } from '../../../src/lib/db/heroes';
import { heroGridImageSource } from '../../../src/constants/heroImages';
import { COLORS } from '../../../src/constants/colors';
import { HeroPeek, type PeekHero } from '../../../src/components/compare/HeroPeek';
import { useSearch } from '../../../src/contexts/SearchContext';
import { useSearchHistory } from '../../../src/hooks/useSearchHistory';
import { useHeroSearch } from '../../../src/hooks/useHeroSearch';
import { useIdleHeroes } from '../../../src/hooks/useIdleHeroes';
import { useSkeletonAnim } from '../../../src/components/web/Skeleton';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { useWebDocumentScroll } from '../../../src/hooks/useWebDocumentScroll';

const RESULT_LIMIT = 300;
const PUB_OPTS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];

function normalizePublisher(p?: string | string[]): PublisherFilter {
  const v = (Array.isArray(p) ? p[0] : (p ?? '')).toLowerCase();
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
  // width:100% — WebKit won't stretch an aspect-ratio grid item to the track
  wrap: {
    width: '100%',
    borderRadius: 10,
    aspectRatio: '3 / 4',
    backgroundColor: '#ddd5c8',
  } as object,
});

// ── Card ────────────────────────────────────────────────────────────────────────
function HeroCard({
  hero,
  onPress,
  onLongPress,
  onInfo,
}: {
  hero: HeroSearchResult;
  onPress: () => void;
  onLongPress?: () => void;
  onInfo?: () => void;
}) {
  const source = heroGridImageSource(hero.id, hero.image_url, hero.portrait_url, hero.image_md_url);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [card.wrap, hovered && (card.wrapHover as object)] as object
      }
    >
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <>
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
          {onInfo && (
            <Pressable
              onPress={onInfo}
              accessibilityLabel={`About ${hero.name}`}
              pointerEvents={hovered ? 'auto' : 'none'}
              style={({ hovered: chipHovered }: { pressed: boolean; hovered?: boolean }) =>
                [
                  card.infoChip,
                  { opacity: hovered ? 1 : 0 },
                  chipHovered && (card.infoChipHover as object),
                ] as object
              }
            >
              <Ionicons name="information" size={15} color={COLORS.beige} />
            </Pressable>
          )}
        </>
      )}
    </Pressable>
  );
}
const card = StyleSheet.create({
  wrap: {
    width: '100%', // WebKit won't stretch an aspect-ratio grid item to the track — force the inline size
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
  infoChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,14,10,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.4)',
    cursor: 'pointer',
    transition: 'opacity 150ms ease, background-color 150ms ease',
  } as object,
  infoChipHover: { backgroundColor: 'rgba(18,14,10,0.82)' } as object,
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function WebSearchScreen() {
  const params = useLocalSearchParams<{ q?: string; publisher?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { setQuery: setNavQuery } = useSearch();
  const skeletonOpacity = useSkeletonAnim();
  const { history, addSearch, clearHistory } = useSearchHistory();

  // Document scroll so the grid bleeds edge-to-edge under the iOS Safari toolbar.
  useWebDocumentScroll(COLORS.beige);

  const urlQ = (Array.isArray(params.q) ? params.q[0] : (params.q ?? '')).toString();
  const publisher = normalizePublisher(params.publisher);

  // One input state for both platforms. ?q= in the URL is the source of truth —
  // deep links, sharing, and the (future) nav palette all drive the page through
  // it; the local state just keeps typing responsive.
  const [inputQuery, setInputQuery] = useState(urlQ);
  const query = inputQuery;
  const trimmed = query.trim();
  const hasCriteria = trimmed.length > 0 || publisher !== 'All';

  // Shared debounced search primitive (same one the nav palette rides on).
  const { results: heroes, loading } = useHeroSearch(query, publisher, RESULT_LIMIT);

  // Sync the input FROM the URL (deep links, back/forward, nav palette).
  useEffect(() => {
    setNavQuery(urlQ);
    setInputQuery(urlQ);
  }, [urlQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror the committed query back INTO the URL so results stay shareable. The
  // equality guard stops this from fighting the sync above. setParams replaces
  // the current route's params (no history spam).
  useEffect(() => {
    if (trimmed === urlQ) return;
    const t = setTimeout(() => router.setParams({ q: trimmed }), 300);
    return () => clearTimeout(t);
  }, [trimmed, urlQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trending for the empty mobile state.
  const showIdle = !isDesktop && !hasCriteria;
  const { heroes: trending, isLoading: trendingLoading } = useIdleHeroes(showIdle, 12);

  const goToHero = (id: string) => {
    if (trimmed) addSearch(trimmed);
    router.push(`/character/${id}`);
  };

  const [peek, setPeek] = useState<PeekHero | null>(null);

  const setPublisher = (p: PublisherFilter) => {
    router.setParams({ publisher: p === 'All' ? '' : p });
  };

  const title = trimmed ? `"${trimmed}"` : publisher !== 'All' ? publisher : 'Search';
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
      : 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 12,
  };

  return (
    <View style={styles.root}>
      {isDesktop ? (
        /* ── Desktop search zone — self-contained input, ?q= is the source of truth ── */
        <View style={[styles.heroZone, { paddingHorizontal: contentPad }] as object}>
          <View style={styles.heroZoneInner}>
            <View style={styles.desktopSearchBar}>
              <Ionicons name="search" size={20} color="rgba(245,235,220,0.5)" />
              <TextInput
                style={styles.desktopInput as object}
                placeholder="Search heroes…"
                placeholderTextColor="rgba(245,235,220,0.4)"
                value={inputQuery}
                onChangeText={setInputQuery}
                autoFocus={!urlQ}
                autoCorrect={false}
                returnKeyType="search"
              />
              {inputQuery.length > 0 && (
                <Pressable
                  onPress={() => setInputQuery('')}
                  style={styles.mobileClear as object}
                  aria-label="Clear search"
                >
                  <Ionicons name="close-circle" size={20} color="rgba(245,235,220,0.5)" />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      ) : (
        /* ── Mobile search header (own input) ───────────────────────────────── */
        <View style={styles.mobileHeader as object}>
          <View style={styles.mobileSearchBar as object}>
            <Ionicons name="search" size={16} color="rgba(245,235,220,0.5)" />
            <TextInput
              style={styles.mobileInput as object}
              placeholder="Search heroes…"
              placeholderTextColor="rgba(245,235,220,0.4)"
              value={inputQuery}
              onChangeText={setInputQuery}
              autoFocus={!urlQ}
              autoCorrect={false}
              returnKeyType="search"
            />
            {inputQuery.length > 0 && (
              <Pressable onPress={() => setInputQuery('')} style={styles.mobileClear as object}>
                <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.5)" />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* ── Publisher filter (both platforms) ────────────────────────────────── */}
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
                  style={
                    [
                      styles.pillText,
                      publisher === p && (styles.pillTextActive as object),
                    ] as object
                  }
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
          {hasCriteria && <Text style={styles.countLabel as object}>{countLabel}</Text>}
        </View>
      </View>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {showIdle ? (
        <View style={styles.scroll}>
          <View style={[styles.gridWrap, { paddingHorizontal: contentPad, paddingBottom: 0 }]}>
            {history.length > 0 && (
              <>
                <View style={styles.idleHeaderRow}>
                  <Text style={styles.idleHeader as object}>Recent</Text>
                  <Pressable onPress={clearHistory}>
                    <Text style={styles.clearLink as object}>Clear</Text>
                  </Pressable>
                </View>
                <View style={styles.chips as object}>
                  {history.map((h) => (
                    <Pressable
                      key={h}
                      onPress={() => setInputQuery(h)}
                      style={styles.chip as object}
                    >
                      <Ionicons name="time-outline" size={13} color={COLORS.grey} />
                      <Text style={styles.chipText as object} numberOfLines={1}>
                        {h}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <Text style={[styles.idleHeader, { marginTop: history.length > 0 ? 24 : 4 }] as object}>
              Trending
            </Text>
            {trendingLoading ? (
              <View style={gridStyle as object}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <SkeletonCard key={i} opacity={skeletonOpacity} />
                ))}
              </View>
            ) : (
              <View style={gridStyle as object}>
                {trending.map((hero) => (
                  <HeroCard key={hero.id} hero={hero} onPress={() => goToHero(hero.id)} onLongPress={() => setPeek(hero)} onInfo={() => setPeek(hero)} />
                ))}
              </View>
            )}
          </View>
        </View>
      ) : !hasCriteria ? (
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
        <View style={styles.scroll}>
          <View style={[styles.gridWrap, { paddingHorizontal: contentPad, paddingBottom: 0 }]}>
            <View style={gridStyle as object}>
              {heroes.map((hero) => (
                <HeroCard key={hero.id} hero={hero} onPress={() => goToHero(hero.id)} onLongPress={() => setPeek(hero)} onInfo={() => setPeek(hero)} />
              ))}
            </View>
            {capped && (
              <Text style={styles.moreHint as object}>
                Showing the first {RESULT_LIMIT} results — refine your search to narrow it down.
              </Text>
            )}
          </View>
        </View>
      )}

      {peek && (
        <HeroPeek
          hero={peek}
          onClose={() => setPeek(null)}
          onFight={() => router.push(`/compare/${peek.id}/pick`)}
          onViewProfile={() => {
            setPeek(null);
            router.push(`/character/${peek.id}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },

  // Desktop hero zone
  heroZone: { backgroundColor: COLORS.navy, paddingTop: TOPBAR_HEIGHT + 18, paddingBottom: 22 },
  heroZoneInner: { maxWidth: 1200, width: '100%', alignSelf: 'center' },
  // Prominent desktop search field — the page's own input (?q= source of truth).
  desktopSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.16)',
    paddingHorizontal: 18,
    height: 56,
  } as object,
  desktopInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 18,
    color: COLORS.beige,
    outlineStyle: 'none',
  } as object,

  // Mobile header
  mobileHeader: {
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: TOPBAR_HEIGHT + 8,
    paddingBottom: 12,
  } as object,
  mobileSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
    paddingHorizontal: 12,
    height: 42,
  } as object,
  mobileInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.beige,
    outlineStyle: 'none',
  } as object,
  mobileClear: { padding: 2, cursor: 'pointer' } as object,

  // Controls
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

  // Idle (mobile)
  idleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  idleHeader: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.grey,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  } as object,
  clearLink: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
    marginBottom: 10,
  } as object,
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } as object,
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(29,45,51,0.07)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    cursor: 'pointer',
    maxWidth: 220,
  } as object,
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy } as object,

  scroll: { flex: 1 },
  gridWrap: { paddingTop: 24, maxWidth: 1200, width: '100%', alignSelf: 'center' },
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
