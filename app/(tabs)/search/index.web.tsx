// app/search.web.tsx — Search experience (web).
// Desktop: committed results driven by the nav field (?q= in the URL).
// Idle (any width): full-screen browse surface — Recent searches + category pods.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSearchIdleHeroes, type HeroSearchResult } from '../../../src/lib/db/heroes';
import { HeroImage } from '../../../src/components/HeroImage';
import { COLORS, SURFACE, SURFACE_GRADIENT } from '../../../src/constants/colors';
import { HeroPeek, type PeekHero } from '../../../src/components/compare/HeroPeek';
import { useSearch } from '../../../src/contexts/SearchContext';
import { useAuth } from '../../../src/hooks/useAuth';
import { useSearchHistory } from '../../../src/hooks/useSearchHistory';
import { useUnifiedSearch } from '../../../src/hooks/useUnifiedSearch';
import { UniverseChip } from '../../../src/components/web/search/UniverseChip';
import { TeamResultRow } from '../../../src/components/web/search/TeamResultRow';
import { TitleRail } from '../../../src/components/web/search/TitleRail';
import { TopResultRow } from '../../../src/components/web/search/TopResultRow';
import { HeroRail, type RailHero } from '../../../src/components/web/search/HeroRail';
import { pickTopResult, topResultKey, type TopResult } from '../../../src/lib/search/topResult';
import { getRecentlyViewed } from '../../../src/lib/db/viewHistory';
import { SEARCH_UNIVERSES } from '../../../src/constants/publishers';
import { useBrowseCovers } from '../../../src/hooks/useBrowseCovers';
import { SearchBrowse } from '../../../src/components/web/search/SearchBrowse';
import { useSkeletonAnim } from '../../../src/components/web/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { SEARCH_CHIP } from '../../../src/components/web/searchChip';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { SeoHead } from '../../../src/components/web/SeoHead';
import { pressTransform } from '../../../src/components/web/pressStyles';
import { useHeroMorph } from '../../../src/hooks/useHeroMorph';

// 80 is plenty for a typed query (fame-ranked, so the best matches are first) and
// keeps the payload + card-render count small — fetching/rendering 300 per
// keystroke was the main thing that made search feel slow.
const RESULT_LIMIT = 80;
// Cards mounted per progressive-render page (the rest reveal on scroll).
const GRID_PAGE = 30;
// Secondary sections are kept compact so the character grid (the primary payload)
// surfaces near the fold instead of below a wall of teams/films. Films live in a
// horizontal rail, so they self-cap by scroll.
const MAX_UNIVERSES = 4;
// Teams are the lowest-confidence section here (an exact team match is promoted to
// the Top Result instead), so keep it to a tight couple and place it last.
const MAX_TEAMS = 2;
// ── Skeleton card ──────────────────────────────────────────────────────────────
function SkeletonCard({ opacity }: { opacity: Animated.Value }) {
  return <Animated.View style={[sk.wrap as object, { opacity }]} />;
}
const sk = StyleSheet.create({
  wrap: {
    width: '100%', // WebKit won't stretch an aspect-ratio grid item to the track
    borderRadius: 10,
    aspectRatio: '3 / 4',
    backgroundColor: 'rgba(245,235,220,0.06)',
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
  const { morphName, run } = useHeroMorph({
    id: hero.id,
    name: hero.name,
    image_url: hero.image_url,
    portrait_url: hero.portrait_url,
    // HeroSearchResult carries no blurhash; the detail portrait's own blurhash
    // covers the final render.
    blurhash: null,
    publisher: hero.publisher,
    image_md_url: hero.image_md_url,
    grid: true,
  });
  return (
    <Pressable
      onPress={() => run(() => onSelect(hero.id))}
      onLongPress={() => onPeek(hero)}
      delayLongPress={300}
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
        [
          card.wrap,
          hovered && !pressed && (card.wrapHover as object),
          pressTransform({ hovered, pressed }),
        ] as object
      }
    >
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <>
          <View
            style={
              [
                card.imageWrap,
                morphName ? ({ viewTransitionName: morphName } as object) : null,
              ] as object
            }
          >
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
          </View>
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
    boxShadow: '0 20px 56px rgba(0,0,0,0.32)',
    zIndex: 2,
  } as object,
  // Portrait-only morph target (see WebHeroCard.imageWrap).
  imageWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  const { user } = useAuth();
  const skeletonOpacity = useSkeletonAnim();
  const { history, addSearch, clearHistory } = useSearchHistory();

  // Landing rails: fame-ranked "Popular" icons (everyone) + the signed-in user's
  // recently-viewed characters ("jump back in"). Both are character portraits —
  // the icons ARE the discovery surface. React Query so revisits hit the cache
  // (the old effect+setState pair refetched on every navigation to /search).
  const popularQ = useQuery({
    queryKey: ['search', 'idlePopular', 20],
    queryFn: () => getSearchIdleHeroes(20),
    staleTime: 1000 * 60 * 30,
  });
  const recentQ = useQuery({
    queryKey: ['search', 'recentlyViewed', user?.id ?? 'anon'],
    queryFn: () => getRecentlyViewed(user!.id, 16),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  const popular = popularQ.data ?? [];
  const recentlyViewed = user?.id ? (recentQ.data ?? []) : [];

  // Search is a dark discovery surface (like Explore / Versus): the whole page —
  // status-bar zone, header and body — is one continuous deep-ink ground so the
  // character art is the only thing that glows. No seam, no light/dark split.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  const urlQ = (Array.isArray(params.q) ? params.q[0] : (params.q ?? '')).toString();

  const [inputQuery, setInputQuery] = useState(urlQ);
  const trimmed = inputQuery.trim();
  const hasCriteria = trimmed.length > 0;

  const { universes, teams, heroes, titles, loading } = useUnifiedSearch(inputQuery, RESULT_LIMIT);

  // The single confident "Top result" across every type — same picker the desktop
  // palette and native search use, so all three surfaces agree on the answer.
  const topResult: TopResult | null = useMemo(
    () => pickTopResult(inputQuery, { universes, teams, heroes, titles }),
    [inputQuery, universes, teams, heroes, titles],
  );
  const topKey = topResult ? topResultKey(topResult) : null;

  // Drop whatever is featured up top from its own section / the grid (no dupes).
  const sectionUniverses = useMemo(
    () => universes.filter((u) => `universe:${u.slug}` !== topKey),
    [universes, topKey],
  );
  const sectionTeams = useMemo(
    () => teams.filter((t) => `team:${t.id}` !== topKey),
    [teams, topKey],
  );
  const sectionTitles = useMemo(
    () => titles.filter((t) => `title:${t.id}` !== topKey),
    [titles, topKey],
  );
  const gridHeroes = useMemo(
    () => (topResult?.kind === 'hero' ? heroes.filter((h) => h.id !== topResult.hero.id) : heroes),
    [heroes, topResult],
  );

  // Progressive render: only mount the first page of cards (and their images),
  // revealing more as the user scrolls near the bottom. Caps the eager image
  // loads + initial paint without virtualisation machinery. Resets per result set.
  const [visibleCount, setVisibleCount] = useState(GRID_PAGE);
  useEffect(() => {
    // Restart the progressive window whenever the result set changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleCount(GRID_PAGE);
  }, [gridHeroes]);
  useEffect(() => {
    if (typeof window === 'undefined' || visibleCount >= gridHeroes.length) return undefined;
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 700;
      if (nearBottom) setVisibleCount((c) => Math.min(c + GRID_PAGE, gridHeroes.length));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [visibleCount, gridHeroes.length]);
  const visibleHeroes = useMemo(
    () => gridHeroes.slice(0, visibleCount),
    [gridHeroes, visibleCount],
  );

  // Sync the input FROM the URL (deep links, back/forward, nav palette).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setNavQuery(urlQ);
    setInputQuery(urlQ);
  }, [urlQ]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

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
  useEffect(() => {
    trimmedRef.current = trimmed;
  });
  const goToHero = useCallback(
    (id: string) => {
      if (trimmedRef.current) addSearch(trimmedRef.current);
      router.push(`/character/${id}`);
    },
    [addSearch, router],
  );
  const openPeek = useCallback((hero: HeroSearchResult) => setPeek(hero), []);

  const openTop = useCallback(
    (top: TopResult) => {
      if (trimmedRef.current) addSearch(trimmedRef.current);
      const push = (href: string) => router.push(href as Parameters<typeof router.push>[0]);
      switch (top.kind) {
        case 'universe':
          return push(`/universe/${top.universe.slug}`);
        case 'team':
          return push(`/team/${top.team.id}`);
        case 'title':
          return push(`/title/${top.title.id}`);
        case 'hero':
          return push(`/character/${top.hero.id}`);
      }
    },
    [addSearch, router],
  );

  // The mobile header is position:fixed (see styles.mobileFixedHeader for why),
  // so it's out of flow — reserve its measured height with a spacer below so the
  // grid starts under it instead of behind it. Seeded with a sensible estimate to
  // avoid a first-frame jump before onLayout reports the real height.
  const [headerH, setHeaderH] = useState(TOPBAR_HEIGHT + 64);

  // Slide the search header up in sync with the global TopBar: hide on scroll-down,
  // reveal on scroll-up, always shown at the very top. Without this the tall dark
  // band stays pinned and wastes space (and leaves a dark gap once the TopBar that
  // it pads under has itself slid away). Mirrors TopBar's mobile hide/reveal logic.
  const [headerHidden, setHeaderHidden] = useState(false);
  // Orange focus ring on the shared search chip (parity with the browse decks).
  const [mobSearchFocused, setMobSearchFocused] = useState(false);
  useEffect(() => {
    if (isDesktop || typeof window === 'undefined') return undefined;
    let lastY = window.scrollY;
    let ticking = false;
    const apply = () => {
      const y = window.scrollY;
      if (y <= 8) setHeaderHidden(false);
      else {
        const delta = y - lastY;
        if (delta > 6) setHeaderHidden(true);
        else if (delta < -6) setHeaderHidden(false);
      }
      lastY = y;
      ticking = false;
    };
    const onScroll = (e: Event) => {
      const t = e.target;
      if (!(t === document || t === document.documentElement || t === document.body)) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [isDesktop]);

  const title = trimmed ? `"${trimmed}"` : 'Search';
  const capped = heroes.length >= RESULT_LIMIT;
  const countLabel = loading
    ? 'Searching…'
    : gridHeroes.length === 0
      ? 'No characters found'
      : capped
        ? `${RESULT_LIMIT}+ results`
        : `${gridHeroes.length} result${gridHeroes.length !== 1 ? 's' : ''}`;

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
        title="Search every universe | Mythique"
        description="Search characters, teams, films and universes from across all fiction — Marvel, DC, Disney, anime, games and beyond — on Mythique."
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
                  placeholder="Search characters, teams & universes…"
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
                    hitSlop={10}
                    style={styles.clearBtn as object}
                  >
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
            style={
              [
                styles.mobileFixedHeader,
                {
                  transform: headerHidden ? 'translateZ(0) translateY(-101%)' : 'translateZ(0)',
                },
              ] as object
            }
            onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
          >
            <View style={styles.mobileSearchRow as object}>
              <View
                style={
                  [
                    styles.mobileSearchBar,
                    mobSearchFocused && (styles.mobileSearchBarFocused as object),
                  ] as object
                }
              >
                <Ionicons name="search" size={17} color={COLORS.orange} />
                <TextInput
                  style={styles.mobileInput as object}
                  placeholder="Search characters, teams & universes…"
                  placeholderTextColor={SEARCH_CHIP.placeholder}
                  value={inputQuery}
                  onChangeText={setInputQuery}
                  onFocus={() => setMobSearchFocused(true)}
                  onBlur={() => setMobSearchFocused(false)}
                  autoFocus={!urlQ}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {inputQuery.length > 0 && (
                  <Pressable
                    onPress={() => setInputQuery('')}
                    hitSlop={10}
                    style={styles.clearBtn as object}
                  >
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
          {/* Returning context first: the characters you opened ("jump back in").
              Signed-out / no history falls back to cleaned recent-search chips. */}
          {recentlyViewed.length > 0 ? (
            <View style={styles.railSection}>
              <Text style={styles.idleLabel as object}>Recently viewed</Text>
              <HeroRail
                heroes={recentlyViewed}
                edge={contentPad}
                onPress={(h) =>
                  router.push(`/character/${h.id}` as Parameters<typeof router.push>[0])
                }
              />
            </View>
          ) : history.length > 0 ? (
            <View style={styles.topSection}>
              <View style={styles.idleHeaderRow}>
                <Text style={styles.idleLabel as object}>Recent</Text>
                <Pressable onPress={clearHistory}>
                  <Text style={styles.clearLink as object}>Clear</Text>
                </Pressable>
              </View>
              <View style={styles.chips as object}>
                {history.map((h) => (
                  <Pressable key={h} onPress={() => setInputQuery(h)} style={styles.chip as object}>
                    <Ionicons name="time-outline" size={13} color="rgba(245,235,220,0.5)" />
                    <Text style={styles.chipText as object} numberOfLines={1}>
                      {h}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* The discovery hook — fame-ranked icons, the app's whole pitch, tap
              straight into a character. Works for signed-out visitors too. */}
          {popular.length > 0 && (
            <View style={styles.railSection}>
              <Text style={styles.idleLabel as object}>Popular</Text>
              <HeroRail
                heroes={popular}
                edge={contentPad}
                onPress={(h) =>
                  router.push(`/character/${h.id}` as Parameters<typeof router.push>[0])
                }
              />
            </View>
          )}

          {/* Universes as the dedicated publisher entry (→ /universe). Browse below
              is theme-only, so there's no Marvel/DC/Image redundancy between them. */}
          <View style={styles.railSection}>
            <Text style={styles.idleLabel as object}>Universes</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -contentPad } as object}
              contentContainerStyle={
                [
                  styles.universeTrack,
                  { paddingLeft: contentPad, paddingRight: contentPad },
                ] as object
              }
            >
              {SEARCH_UNIVERSES.map((b) => (
                <UniverseChip
                  key={b.slug}
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
                  variant="dark"
                  onPress={() =>
                    router.push(`/universe/${b.slug}` as Parameters<typeof router.push>[0])
                  }
                />
              ))}
            </ScrollView>
          </View>

          {/* Theme pods only (publishers removed — they're the Universes row). */}
          <View style={styles.browseSection}>
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
          {topResult && (
            <View style={styles.topSection}>
              <Text style={styles.idleLabel as object}>Top result</Text>
              <TopResultRow
                top={topResult}
                active={false}
                surface="page"
                onPress={() => openTop(topResult)}
              />
            </View>
          )}
          {sectionUniverses.length > 0 && (
            <View style={styles.titlesSection}>
              <Text style={styles.idleLabel as object}>Universes</Text>
              <View style={styles.universeRow as object}>
                {sectionUniverses.slice(0, MAX_UNIVERSES).map((u) => (
                  <View key={u.slug} style={styles.universeChipWrap as object}>
                    <UniverseChip
                      universe={u}
                      variant="dark"
                      onPress={() =>
                        router.push(`/universe/${u.slug}` as Parameters<typeof router.push>[0])
                      }
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
          {/* Films & Shows sit ABOVE the character grid as a horizontal poster
              rail — posters are visual and there can be many, so one swipeable
              row conserves the vertical space the character grid needs. */}
          {sectionTitles.length > 0 && (
            <View style={styles.railSection}>
              <Text style={styles.idleLabel as object}>Films & Shows</Text>
              <TitleRail
                titles={sectionTitles}
                edge={contentPad}
                onPress={(id) => router.push(`/title/${id}` as Parameters<typeof router.push>[0])}
              />
            </View>
          )}
          {/* Teams last among the secondary sections (lowest confidence — an exact
              team is promoted to Top Result) and capped tight, so they don't
              outweigh the films or the characters people came for. */}
          {sectionTeams.length > 0 && (
            <View style={styles.titlesSection}>
              <Text style={styles.idleLabel as object}>Teams</Text>
              {sectionTeams.slice(0, MAX_TEAMS).map((t) => (
                <View key={t.id} style={styles.universeChipWrap as object}>
                  <TeamResultRow
                    team={t}
                    variant="dark"
                    onPress={() =>
                      router.push(`/team/${t.id}` as Parameters<typeof router.push>[0])
                    }
                  />
                </View>
              ))}
            </View>
          )}
          {hasCriteria && (loading || gridHeroes.length > 0) && (
            <View style={styles.charHeaderRow as object}>
              <Text style={styles.charLabel as object}>Characters</Text>
              <Text style={styles.charCount as object}>{countLabel}</Text>
            </View>
          )}
          {(loading || gridHeroes.length > 0) &&
            // Skeletons only on the FIRST search (nothing to show yet). Once we
            // have results, keep them visible — slightly dimmed — while the next
            // query resolves, so typing never flashes back to skeletons.
            (gridHeroes.length === 0 && loading ? (
              <View style={gridStyle as object}>
                {Array.from({ length: 18 }).map((_, i) => (
                  <SkeletonCard key={i} opacity={skeletonOpacity} />
                ))}
              </View>
            ) : (
              <View style={[gridStyle, loading && (styles.gridLoading as object)] as object}>
                {visibleHeroes.map((hero) => (
                  <HeroCard key={hero.id} hero={hero} onSelect={goToHero} onPeek={openPeek} />
                ))}
              </View>
            ))}
          {!loading && gridHeroes.length === 0 && !topResult && (
            <View style={styles.center}>
              <Text style={styles.empty}>No characters match {title}.</Text>
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
  // One continuous deep-ink ground — the dark discovery surface (matches Explore /
  // Versus). The art is the only thing that glows.
  root: { flex: 1, backgroundColor: COLORS.deepNavy },

  // ── Desktop ────────────────────────────────────────────────────────────────
  desktopHeroZone: {
    // Ink→navy gradient over the deep-ink ground — depth at the search zone that
    // eases into the dark body below (no seam: the whole page is dark now).
    backgroundColor: COLORS.deepNavy,
    backgroundImage: SURFACE_GRADIENT.stage,
    paddingTop: TOPBAR_HEIGHT + 22,
    paddingBottom: 24,
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
  // ancestor is clamped to 100dvh (#root { height: 100lvh }), so the containing
  // block for a sticky child is only one viewport tall — sticky would release and
  // scroll away after the first screenful. Fixed pins it to the viewport like the
  // global TopBar; translateZ(0) forces a GPU layer so iOS Safari keeps it pinned
  // under body{overflow:visible} (same fix the TopBar uses). paddingTop clears the
  // TopBar (its height + the status-bar inset) so the search row sits just below.
  mobileFixedHeader: {
    // Flat deep-ink, identical to the body — so the header is invisible as a band
    // and the search field just floats on the one continuous dark surface. When
    // content scrolls under it, it's hidden behind the same colour: seamless.
    backgroundColor: COLORS.deepNavy,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    // Clearance follows the TopBar's published dock offset: below the bar while
    // it's shown, rising toward the top edge when the bar retires (idle or
    // scroll-down) — otherwise the field floats over a gap where the bar was.
    paddingTop: `calc(var(--mob-utility-top, calc(env(safe-area-inset-top) + ${TOPBAR_HEIGHT - 8}px)) + 18px)`,
    // translateZ(0) is applied inline alongside the hide/reveal translateY.
    transition: 'transform 260ms ease, padding-top 300ms ease',
    paddingBottom: 4,
  } as object,
  mobileSearchRow: {
    paddingHorizontal: 12,
    paddingBottom: 2,
  },
  // The shared navy glass chip (see searchChip.ts) — identical to the browse
  // decks' search field, so search reads as one control across mobile web.
  mobileSearchBar: { ...SEARCH_CHIP.chip } as object,
  mobileSearchBarFocused: { ...SEARCH_CHIP.chipFocused } as object,
  mobileInput: { ...SEARCH_CHIP.input } as object,
  clearBtn: { padding: 2, cursor: 'pointer' } as object,

  // "Characters" section header on the results page — label + count on one row,
  // matching the Universes / Teams / Films & Shows section labels.
  charHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingTop: 18,
    paddingBottom: 10,
  } as object,
  charLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.55)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  } as object,
  charCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.4)',
    letterSpacing: 0.2,
  } as object,

  // ── Idle state (mobile, no query) ─────────────────────────────────────────
  idleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  idleLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    // Quiet warm-beige caps on the dark ground — present but never competing with
    // the art.
    color: 'rgba(245,235,220,0.5)',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    // No marginBottom: every section that uses this label owns the label→content
    // gap, so the spacing isn't doubled.
    marginBottom: 0,
  } as object,
  clearLink: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
  } as object,
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } as object,
  // Recent terms read as small raised paper pills — a warm off-white fill + a
  // hairline so they sit on the canvas rather than dissolving into it.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    cursor: 'pointer',
    maxWidth: 220,
  } as object,
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.beige } as object,

  // Universe chips: search-hit row above the grid, and the idle "Browse universes" row.
  universeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  } as object,
  universeChipWrap: {
    borderRadius: 12,
  } as object,
  topSection: { paddingTop: 16, gap: 8 } as object,
  titlesSection: { paddingTop: 16, gap: 6 } as object,
  railSection: { paddingTop: 16, gap: 9 } as object,
  browseSection: { paddingTop: 16 } as object,
  universeTrack: { flexDirection: 'row', gap: 8 } as object,

  // ── Grid / content ─────────────────────────────────────────────────────────
  gridWrap: { paddingTop: 2, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  // Stale results stay up (just dimmed) while the next query resolves — no flash.
  gridLoading: { opacity: 0.55, transition: 'opacity 140ms ease' } as object,
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: 'rgba(245,235,220,0.55)' },
  moreHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.45)',
    textAlign: 'center',
    paddingTop: 24,
  } as object,
});
