// app/search.web.tsx — Search experience (web).
// Desktop: committed results driven by the nav field (?q= in the URL).
// Idle (any width): full-screen browse surface — Recent searches + category pods.
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
import { Ionicons } from '@expo/vector-icons';
import { type HeroSearchResult, type PublisherFilter } from '../../../src/lib/db/heroes';
import { HeroImage } from '../../../src/components/HeroImage';
import { COLORS } from '../../../src/constants/colors';
import { HeroPeek, type PeekHero } from '../../../src/components/compare/HeroPeek';
import { useSearch } from '../../../src/contexts/SearchContext';
import { useSearchHistory } from '../../../src/hooks/useSearchHistory';
import { useHeroSearch } from '../../../src/hooks/useHeroSearch';
import { useBrowseCovers } from '../../../src/hooks/useBrowseCovers';
import { CategoryPodGrid } from '../../../src/components/web/home/CategoryPodGrid';
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
  wrap: {
    width: '100%', // WebKit won't stretch an aspect-ratio grid item to the track
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
          <HeroImage
            id={hero.id}
            name={hero.name}
            imageUrl={hero.image_url}
            portraitUrl={hero.portrait_url}
            imageMdUrl={hero.image_md_url}
            grid
            contentFit="cover"
            contentPosition={{ top: 0, left: '50%' }}
            style={StyleSheet.absoluteFill}
            recyclingKey={hero.id}
            transition={150}
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
    width: '100%', // WebKit won't stretch an aspect-ratio grid item to the track
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

  useWebDocumentScroll(COLORS.beige);

  const urlQ = (Array.isArray(params.q) ? params.q[0] : (params.q ?? '')).toString();
  const publisher = normalizePublisher(params.publisher);

  const [inputQuery, setInputQuery] = useState(urlQ);
  const trimmed = inputQuery.trim();
  const hasCriteria = trimmed.length > 0 || publisher !== 'All';

  const { results: heroes, loading } = useHeroSearch(inputQuery, publisher, RESULT_LIMIT);

  // Sync the input FROM the URL (deep links, back/forward, nav palette).
  useEffect(() => {
    setNavQuery(urlQ);
    setInputQuery(urlQ);
  }, [urlQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror the committed query back INTO the URL so results stay shareable.
  useEffect(() => {
    if (trimmed === urlQ) return;
    const t = setTimeout(() => router.setParams({ q: trimmed }), 300);
    return () => clearTimeout(t);
  }, [trimmed, urlQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Idle (no query, no publisher filter) is now a browse surface on every width:
  // recent searches + the category pods. The old "Trending" hero wall is gone —
  // the pods are the doorway, so desktop no longer shows a bare empty prompt.
  const showIdle = !hasCriteria;
  const browseCovers = useBrowseCovers(showIdle);

  const goToHero = (id: string) => {
    if (trimmed) addSearch(trimmed);
    router.push(`/character/${id}`);
  };

  const [peek, setPeek] = useState<PeekHero | null>(null);

  // The mobile header is position:fixed (see styles.mobileFixedHeader for why),
  // so it's out of flow — reserve its measured height with a spacer below so the
  // grid starts under it instead of behind it. Seeded with a sensible estimate to
  // avoid a first-frame jump before onLayout reports the real height.
  const [headerH, setHeaderH] = useState(TOPBAR_HEIGHT + 95);

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

  const pills = (
    <View style={styles.pills as object}>
      {PUB_OPTS.map((p) => (
        <Pressable
          key={p}
          onPress={() => setPublisher(p)}
          style={[styles.pill, publisher === p && (styles.pillActive as object)] as object}
        >
          <Text
            style={
              [styles.pillText, publisher === p && (styles.pillTextActive as object)] as object
            }
          >
            {p}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      {isDesktop ? (
        <>
          {/* ── Desktop: search hero zone (scrolls away) + sticky pill bar ── */}
          <View style={[styles.desktopHeroZone, { paddingHorizontal: contentPad }] as object}>
            <View style={styles.desktopHeroZoneInner}>
              <View style={styles.desktopSearchBar as object}>
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
                  <Pressable onPress={() => setInputQuery('')} style={styles.clearBtn as object}>
                    <Ionicons name="close-circle" size={20} color="rgba(245,235,220,0.5)" />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
          <View
            style={
              [styles.pillBar, styles.pillBarDesktop, { paddingHorizontal: contentPad }] as object
            }
          >
            <View style={styles.pillBarInner as object}>
              {pills}
              {hasCriteria && <Text style={styles.countLabel as object}>{countLabel}</Text>}
            </View>
          </View>
        </>
      ) : (
        /* ── Mobile: fixed header (search input + pills) pinned under the TopBar,
             plus an in-flow spacer that reserves its height. ── */
        <>
          <View
            style={styles.mobileFixedHeader as object}
            onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
          >
            <View style={styles.mobileSearchRow as object}>
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
                  <Pressable onPress={() => setInputQuery('')} style={styles.clearBtn as object}>
                    <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.5)" />
                  </Pressable>
                )}
              </View>
            </View>
            <View style={[styles.pillBar, { paddingHorizontal: contentPad }] as object}>
              <View style={styles.pillBarInner as object}>
                {pills}
                {hasCriteria && <Text style={styles.countLabel as object}>{countLabel}</Text>}
              </View>
            </View>
          </View>
          <View style={{ height: headerH }} />
        </>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {showIdle ? (
        <View style={[styles.gridWrap, { paddingHorizontal: contentPad, paddingBottom: 0 }]}>
          {history.length > 0 && (
            <>
              <View style={styles.idleHeaderRow}>
                <Text style={styles.idleLabel as object}>Recent</Text>
                <Pressable onPress={clearHistory}>
                  <Text style={styles.clearLink as object}>Clear</Text>
                </Pressable>
              </View>
              <View style={styles.chips as object}>
                {history.map((h) => (
                  <Pressable key={h} onPress={() => setInputQuery(h)} style={styles.chip as object}>
                    <Ionicons name="time-outline" size={13} color={COLORS.grey} />
                    <Text style={styles.chipText as object} numberOfLines={1}>
                      {h}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Text style={[styles.idleLabel, { marginTop: history.length > 0 ? 24 : 4 }] as object}>
            Browse
          </Text>
          <CategoryPodGrid
            covers={browseCovers}
            onPress={(slug) =>
              router.push(`/category/${slug}` as Parameters<typeof router.push>[0])
            }
            flush
          />
        </View>
      ) : (
        <View style={[styles.gridWrap, { paddingHorizontal: contentPad }]}>
          <View style={gridStyle as object}>
            {loading
              ? Array.from({ length: 18 }).map((_, i) => (
                  <SkeletonCard key={i} opacity={skeletonOpacity} />
                ))
              : heroes.map((hero) => (
                  <HeroCard
                    key={hero.id}
                    hero={hero}
                    onPress={() => goToHero(hero.id)}
                    onLongPress={() => setPeek(hero)}
                    onInfo={() => setPeek(hero)}
                  />
                ))}
          </View>
          {!loading && heroes.length === 0 && (
            <View style={styles.center}>
              <Text style={styles.empty}>No heroes match {title}.</Text>
            </View>
          )}
          {capped && (
            <Text style={styles.moreHint as object}>
              Showing the first {RESULT_LIMIT} results — refine your search to narrow it down.
            </Text>
          )}
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

  // ── Desktop ────────────────────────────────────────────────────────────────
  desktopHeroZone: {
    backgroundColor: COLORS.navy,
    paddingTop: TOPBAR_HEIGHT + 18,
    paddingBottom: 22,
  },
  desktopHeroZoneInner: { maxWidth: 1200, width: '100%', alignSelf: 'center' },
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
  pillBarDesktop: {
    position: 'sticky',
    top: TOPBAR_HEIGHT,
  } as object,

  // ── Mobile fixed header (search input + pills as one block) ────────────────
  // position:fixed, NOT sticky. The app scrolls the document while every flex
  // ancestor is clamped to 100dvh (#root { height: 100dvh }), so the containing
  // block for a sticky child is only one viewport tall — sticky would release and
  // scroll away after the first screenful. Fixed pins it to the viewport like the
  // global TopBar; translateZ(0) forces a GPU layer so iOS Safari keeps it pinned
  // under body{overflow:visible} (same fix the TopBar uses). paddingTop clears the
  // TopBar (its height + the status-bar inset) so the search row sits just below.
  mobileFixedHeader: {
    backgroundColor: COLORS.navy,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingTop: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 8px)`,
    transform: 'translateZ(0)',
  } as object,
  mobileSearchRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  mobileSearchBar: {
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
  clearBtn: { padding: 2, cursor: 'pointer' } as object,

  // ── Pill bar (shared, used by both platforms) ──────────────────────────────
  pillBar: {
    backgroundColor: COLORS.beige,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(41,60,67,0.12)',
    paddingVertical: 10,
    zIndex: 40,
  } as object,
  pillBarInner: {
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

  // ── Idle state (mobile, no query) ─────────────────────────────────────────
  idleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  idleLabel: {
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

  // ── Grid / content ─────────────────────────────────────────────────────────
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
