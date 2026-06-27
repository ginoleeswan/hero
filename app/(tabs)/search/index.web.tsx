// app/search.web.tsx — Search experience (web).
// Desktop: committed results driven by the nav field (?q= in the URL).
// Idle (any width): full-screen browse surface — Recent searches + category pods.
import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import { type HeroSearchResult } from '../../../src/lib/db/heroes';
import { HeroImage } from '../../../src/components/HeroImage';
import { COLORS, SURFACE, SURFACE_GRADIENT, SEAM_COLOR } from '../../../src/constants/colors';
import { HeroPeek, type PeekHero } from '../../../src/components/compare/HeroPeek';
import { useSearch } from '../../../src/contexts/SearchContext';
import { useSearchHistory } from '../../../src/hooks/useSearchHistory';
import { useUnifiedSearch } from '../../../src/hooks/useUnifiedSearch';
import { UniverseChip } from '../../../src/components/web/search/UniverseChip';
import { TitleResultRow } from '../../../src/components/web/search/TitleResultRow';
import { FEATURED_PUBLISHERS } from '../../../src/constants/publishers';
import { useBrowseCovers } from '../../../src/hooks/useBrowseCovers';
import { SearchBrowse } from '../../../src/components/web/search/SearchBrowse';
import { useSkeletonAnim } from '../../../src/components/web/Skeleton';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { SeoHead } from '../../../src/components/web/SeoHead';

const RESULT_LIMIT = 300;
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
// Memoised: the screen re-renders on every keystroke (inputQuery), but the search
// is debounced — so `heroes` (and each hero object) stays referentially stable
// between keystrokes. Paired with stable `onSelect`/`onPeek` handlers, memo lets
// all up-to-300 cards skip re-rendering until the result set actually changes.
const HeroCard = memo(function HeroCard({
  hero,
  onSelect,
  onPeek,
}: {
  hero: HeroSearchResult;
  onSelect: (id: string) => void;
  onPeek: (hero: HeroSearchResult) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(hero.id)}
      onLongPress={() => onPeek(hero)}
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
          <Pressable
            onPress={() => onPeek(hero)}
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
        </>
      )}
    </Pressable>
  );
});
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

  // Ink-topped over a beige canvas: the status-bar zone is deepNavy so iOS can't
  // wash it out to a light scrim, and the header fuses from that ink down into
  // the navy band. Both ends declared together so they can't drift.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  const urlQ = (Array.isArray(params.q) ? params.q[0] : (params.q ?? '')).toString();

  const [inputQuery, setInputQuery] = useState(urlQ);
  const trimmed = inputQuery.trim();
  const hasCriteria = trimmed.length > 0;

  const { universes, heroes, titles, loading } = useUnifiedSearch(inputQuery, RESULT_LIMIT);

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

  const [peek, setPeek] = useState<PeekHero | null>(null);

  // Stable handlers so the memoised HeroCards don't re-render on every keystroke.
  // `trimmed` changes per keystroke, so read it through a ref to keep goToHero
  // referentially stable (addSearch, router and setPeek are already stable).
  const trimmedRef = useRef(trimmed);
  trimmedRef.current = trimmed;
  const goToHero = useCallback(
    (id: string) => {
      if (trimmedRef.current) addSearch(trimmedRef.current);
      router.push(`/character/${id}`);
    },
    [addSearch, router],
  );
  const openPeek = useCallback((hero: HeroSearchResult) => setPeek(hero), []);

  // The mobile header is position:fixed (see styles.mobileFixedHeader for why),
  // so it's out of flow — reserve its measured height with a spacer below so the
  // grid starts under it instead of behind it. Seeded with a sensible estimate to
  // avoid a first-frame jump before onLayout reports the real height.
  const [headerH, setHeaderH] = useState(TOPBAR_HEIGHT + 64);

  const title = trimmed ? `"${trimmed}"` : 'Search';
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
      <SeoHead
        title="Search heroes & villains | Mythique"
        description="Search 3,000+ heroes and villains across Marvel, DC and more on Mythique."
        path="/search"
        noindex
      />
      {isDesktop ? (
        <>
          {/* ── Desktop: search hero zone (scrolls away) ── */}
          <View style={[styles.desktopHeroZone, { paddingHorizontal: contentPad }] as object}>
            <View style={styles.desktopHeroZoneInner}>
              <View style={styles.desktopSearchBar as object}>
                <Ionicons name="search" size={20} color={COLORS.orange} />
                <TextInput
                  style={styles.desktopInput as object}
                  placeholder="Search heroes & universes…"
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
        </>
      ) : (
        /* ── Mobile: fixed search header pinned under the TopBar, plus an in-flow
             spacer that reserves its height. ── */
        <>
          <View
            style={styles.mobileFixedHeader as object}
            onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
          >
            <View style={styles.mobileSearchRow as object}>
              <View style={styles.mobileSearchBar as object}>
                <Ionicons name="search" size={17} color={COLORS.orange} />
                <TextInput
                  style={styles.mobileInput as object}
                  placeholder="Search heroes & universes…"
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
          <View style={{ marginTop: history.length > 0 ? 20 : 4 }}>
            <View style={styles.idleHeaderRow}>
              <Text style={styles.idleLabel as object}>Browse universes</Text>
            </View>
            <View style={styles.universeRow as object}>
              {FEATURED_PUBLISHERS.map((b) => (
                <View key={b.slug} style={styles.universeChipWrap as object}>
                  <UniverseChip
                    universe={{
                      slug: b.slug,
                      name: b.name,
                      color: b.color,
                      logo: b.logo,
                      badgeSize: b.badgeSize,
                      logoOnLight: b.logoOnLight,
                      logoTint: b.logoTint,
                      exact: false,
                    }}
                    variant="light"
                    onPress={() =>
                      router.push(`/universe/${b.slug}` as Parameters<typeof router.push>[0])
                    }
                  />
                </View>
              ))}
            </View>
          </View>
          <View style={{ marginTop: 20 }}>
            <SearchBrowse
              covers={browseCovers}
              onPress={(slug) =>
                router.push(`/category/${slug}` as Parameters<typeof router.push>[0])
              }
            />
          </View>
        </View>
      ) : (
        <View style={[styles.gridWrap, { paddingHorizontal: contentPad }]}>
          {hasCriteria && <Text style={styles.resultCount as object}>{countLabel}</Text>}
          {universes.length > 0 && (
            <View style={styles.universeRow as object}>
              {universes.map((u) => (
                <View key={u.slug} style={styles.universeChipWrap as object}>
                  <UniverseChip
                    universe={u}
                    variant="light"
                    onPress={() =>
                      router.push(`/universe/${u.slug}` as Parameters<typeof router.push>[0])
                    }
                  />
                </View>
              ))}
            </View>
          )}
          <View style={gridStyle as object}>
            {loading
              ? Array.from({ length: 18 }).map((_, i) => (
                  <SkeletonCard key={i} opacity={skeletonOpacity} />
                ))
              : heroes.map((hero) => (
                  <HeroCard key={hero.id} hero={hero} onSelect={goToHero} onPeek={openPeek} />
                ))}
          </View>
          {!loading && heroes.length === 0 && (
            <View style={styles.center}>
              <Text style={styles.empty}>No heroes match {title}.</Text>
            </View>
          )}
          {titles.length > 0 && (
            <View style={styles.titlesSection}>
              <Text style={styles.idleLabel as object}>Films & Shows</Text>
              {titles.map((t) => (
                <View key={t.id} style={styles.universeChipWrap as object}>
                  <TitleResultRow
                    title={t}
                    variant="light"
                    onPress={() =>
                      router.push(`/title/${t.id}` as Parameters<typeof router.push>[0])
                    }
                  />
                </View>
              ))}
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
    // Ink→navy gradient over a navy base — depth without a flat slab.
    backgroundColor: COLORS.navy,
    backgroundImage: SURFACE_GRADIENT.stage,
    paddingTop: TOPBAR_HEIGHT + 22,
    paddingBottom: 24,
    // The seam: warm orange hairline + drop shadow where the dark band meets the
    // beige canvas — an engineered page edge, not a flat colour jump.
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
    boxShadow: '0 14px 30px -14px rgba(11,24,32,0.55)',
  } as object,
  desktopHeroZoneInner: { maxWidth: 1200, width: '100%', alignSelf: 'center' },
  desktopSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(245,235,220,0.10)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.22)',
    boxShadow: 'inset 0 1px 0 rgba(245,235,220,0.10)',
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
  // ── Mobile fixed search header ─────────────────────────────────────────────
  // position:fixed, NOT sticky. The app scrolls the document while every flex
  // ancestor is clamped to 100dvh (#root { height: 100dvh }), so the containing
  // block for a sticky child is only one viewport tall — sticky would release and
  // scroll away after the first screenful. Fixed pins it to the viewport like the
  // global TopBar; translateZ(0) forces a GPU layer so iOS Safari keeps it pinned
  // under body{overflow:visible} (same fix the TopBar uses). paddingTop clears the
  // TopBar (its height + the status-bar inset) so the search row sits just below.
  mobileFixedHeader: {
    // Ink→navy gradient over a navy base — deepNavy at the status bar easing in.
    backgroundColor: COLORS.navy,
    backgroundImage: SURFACE_GRADIENT.stage,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingTop: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 14px)`,
    transform: 'translateZ(0)',
    // The seam (see desktopHeroZone): warm hairline + shadow at the dark→beige edge.
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
    boxShadow: '0 12px 28px -12px rgba(11,24,32,0.55)',
  } as object,
  mobileSearchRow: {
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  mobileSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(245,235,220,0.10)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.20)',
    boxShadow: 'inset 0 1px 0 rgba(245,235,220,0.10)',
    paddingHorizontal: 12,
    height: 46,
  } as object,
  mobileInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.beige,
    outlineStyle: 'none',
  } as object,
  clearBtn: { padding: 2, cursor: 'pointer' } as object,

  // Result count, shown above the hero grid once a query is committed.
  resultCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    letterSpacing: 0.2,
    paddingTop: 14,
    paddingBottom: 4,
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

  // Universe chips: search-hit row above the grid, and the idle "Browse universes" row.
  universeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  } as object,
  universeChipWrap: {
    backgroundColor: 'rgba(29,45,51,0.05)',
    borderRadius: 12,
  } as object,
  titlesSection: { paddingTop: 20, gap: 6 } as object,

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
