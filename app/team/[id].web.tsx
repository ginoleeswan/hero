// app/team/[id].web.tsx — web team roster browse page.
// Mirrors the universe/category browse page: a dark "gallery" canvas, a
// publisher-branded BrowseBanner masthead (the team name in the display face on
// its publisher's brand colour, with a member-portrait montage), the shared
// filter rail / sheet, and gallery hero cards. A team is "heroes whose teams[]
// contains the team name", so it reuses the same paginated, faceted query path
// as universes (getTeamPage) — and therefore the same filter UI.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { type Hero } from '../../src/lib/db/heroes';
import { useTeam, useTeamHeroes } from '../../src/lib/query/heroQueries';
import { flattenCategoryPages } from '../../src/lib/query/heroCache';
import { brandForPublisher } from '../../src/constants/publishers';
import { teamLogo } from '../../src/constants/teamBrands';
import { activeFilterList, type CategoryFilters } from '../../src/lib/db/categoryFilters';
import { useCategoryFilters } from '../../src/hooks/useCategoryFilters';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { useSkeletonAnim } from '../../src/components/web/Skeleton';
import { FilterRail } from '../../src/components/web/category/FilterRail';
import { FilterSheet } from '../../src/components/web/category/FilterSheet';
import { ActiveFilterChips } from '../../src/components/web/category/ActiveFilterChips';
import { BrowseBanner } from '../../src/components/web/category/BrowseBanner';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { SeoHead } from '../../src/components/web/SeoHead';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';

// Teams with no recognised publisher fall back to a warm orange stage.
const FALLBACK_COLOR = COLORS.orange;
const FALLBACK_COLOR_DARK = '#7a3411';

// ── Gallery card (matches the category/universe HeroCard) ─────────────────────
function SkeletonCard({ opacity }: { opacity: Animated.Value }) {
  return <Animated.View style={[sk.wrap as object, { opacity }]} />;
}
const sk = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 10,
    aspectRatio: '3 / 4',
    backgroundColor: '#1b3038',
  } as object,
});

function HeroCard({
  hero,
  onPress,
  onInfo,
}: {
  hero: Hero;
  onPress: () => void;
  onInfo: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onInfo}
      delayLongPress={300}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [card.wrap, hovered && (card.wrapHover as object)] as object
      }
    >
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <>
          <HeroImage
            id={String(hero.id)}
            name={hero.name}
            imageUrl={hero.image_url}
            portraitUrl={hero.portrait_url}
            imageMdUrl={hero.image_md_url}
            blurhash={hero.portrait_blurhash}
            grid
            contentFit="cover"
            contentPosition={{ top: 0, left: '50%' }}
            style={StyleSheet.absoluteFill}
            recyclingKey={String(hero.id)}
            transition={150}
          />
          <View style={card.overlay as object} />
          <View style={card.bottom}>
            <Text style={card.name as object} numberOfLines={2}>
              {hero.name}
            </Text>
          </View>
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
        </>
      )}
    </Pressable>
  );
}
const card = StyleSheet.create({
  wrap: {
    width: '100%',
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
      'linear-gradient(to top, rgba(11,24,32,0.98) 0%, rgba(11,24,32,0.6) 26%, rgba(11,24,32,0.12) 48%, transparent 70%)',
  } as object,
  bottom: { position: 'absolute', bottom: 12, left: 12, right: 12 },
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
export default function WebTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Team summary via React Query (cached, deduped) — header identity + the
  // membership term that drives the roster query.
  const teamQuery = useTeam(id);
  const team = teamQuery.data ?? null;
  const teamLoaded = teamQuery.isFetched;
  const [searchFocused, setSearchFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [peek, setPeek] = useState<PeekHero | null>(null);
  const skeletonOpacity = useSkeletonAnim();

  // Teams have no publisher facet (a team is already one publisher) — slug=null,
  // exactly like a universe page.
  const { filters, setFilter, reset } = useCategoryFilters(null);
  const activeChips = activeFilterList(null, filters);

  // Dark "gallery" canvas so the colourful cards lift off it — same as universe.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  const brand = brandForPublisher(team?.publisher);
  const color = brand?.color ?? FALLBACK_COLOR;
  const colorDark = brand?.colorDark ?? FALLBACK_COLOR_DARK;
  const teamName = team?.name ?? null;

  // Roster grid via React Query (infinite, cached, deduped) — the same path the
  // native team screen and the universe/category pages use. Search is debounced
  // into the query key so we don't refetch per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), filters.search ? 300 : 0);
    return () => clearTimeout(t);
  }, [filters.search]);
  const queryFilters: CategoryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  const { data, isPending, isFetchingNextPage, fetchNextPage, hasNextPage } = useTeamHeroes(
    teamName,
    queryFilters,
  );
  const heroes = useMemo(() => flattenCategoryPages(data), [data]);
  const total = data?.pages[0]?.total ?? 0;
  const loading = isPending;
  const loadingMore = isFetchingNextPage;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Infinite load rides the document scroll (like the category page).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const distanceFromBottom =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (distanceFromBottom < 400) loadMore();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMore]);

  // Montage: lead with the top member, then a varied handful — re-rolled per
  // visit, stable across renders (keyed on the lead member only). Each carries a
  // BlurHash for an instant placeholder.
  const [montage, setMontage] = useState<{ uri: string; blurhash?: string | null }[]>([]);
  const topMemberId = heroes[0]?.id;
  useEffect(() => {
    if (heroes.length === 0) {
      // No roster yet — clear the montage. Derived from async-loaded heroes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMontage([]);
      return;
    }
    const pool = heroes.slice(1, 24);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setMontage(
      [heroes[0], ...pool.slice(0, 5)]
        .map((h) => ({ uri: h.portrait_url ?? h.image_url, blurhash: h.portrait_blurhash }))
        .filter((m): m is { uri: string; blurhash: string | null } => !!m.uri),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topMemberId]);

  const notFound = teamLoaded && team === null;
  const contentPad = isDesktop ? 32 : 16;
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: isDesktop
      ? 'repeat(auto-fill, minmax(160px, 1fr))'
      : 'repeat(auto-fill, minmax(108px, 1fr))',
    gap: 15,
  };

  const grid = (
    <View style={gridStyle as object}>
      {heroes.map((hero) => (
        <HeroCard
          key={hero.id}
          hero={hero}
          onPress={() => router.push(`/character/${hero.id}`)}
          onInfo={() => setPeek(hero)}
        />
      ))}
      {loadingMore &&
        Array.from({ length: 12 }).map((_, i) => (
          <SkeletonCard key={`sk-${i}`} opacity={skeletonOpacity} />
        ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <SeoHead
        title={team ? `${team.name} — team | Mythique` : 'Team | Mythique'}
        description={
          team
            ? `Meet the members of ${team.name}${team.publisher ? `, the ${team.publisher} team` : ''}.`
            : 'Team roster on Mythique.'
        }
        path={`/team/${id}`}
        noindex
      />

      {team && (
        <BrowseBanner
          title={team.name}
          color={color}
          colorDark={colorDark}
          total={total || team.member_count}
          leadName={heroes[0]?.name}
          logo={teamLogo(team)?.logo}
          badgeSize={teamLogo(team)?.badgeSize}
          logoTint={teamLogo(team)?.logoTint}
          montage={montage}
          unitLabel="MEMBER"
          compact={!isDesktop}
          sticky={isDesktop}
        />
      )}

      {notFound && (
        <View style={[styles.notFoundStage, { paddingHorizontal: contentPad }] as object}>
          <Text style={styles.notFoundTitle as object}>Team not found</Text>
          <Text style={styles.notFoundSub as object}>This team doesn’t exist.</Text>
        </View>
      )}

      {/* Mobile: controls-only bar (search + Filters) under the banner. */}
      {team && !isDesktop && (
        <View style={[styles.header, { paddingHorizontal: contentPad }] as object}>
          <View style={[styles.controlsRow] as object}>
            <View
              style={
                [styles.searchBar, searchFocused && (styles.searchBarFocused as object)] as object
              }
            >
              <Ionicons name="search" size={16} color={COLORS.orange} />
              <TextInput
                style={styles.searchInput as object}
                placeholder={`Search ${team.name}…`}
                placeholderTextColor="rgba(245,235,220,0.4)"
                value={filters.search}
                onChangeText={(t) => setFilter('search', t)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                autoCorrect={false}
              />
            </View>
            <Pressable
              onPress={() => setSheetOpen(true)}
              style={
                [
                  styles.filterBtn,
                  activeChips.length > 0 && (styles.filterBtnActive as object),
                ] as object
              }
            >
              <Ionicons
                name="options-outline"
                size={16}
                color={activeChips.length > 0 ? COLORS.orange : COLORS.beige}
              />
              <Text
                style={
                  [
                    styles.filterBtnText,
                    activeChips.length > 0 && (styles.filterBtnTextActive as object),
                  ] as object
                }
              >
                Filters
              </Text>
              {activeChips.length > 0 && (
                <View style={styles.filterBadge as object}>
                  <Text style={styles.filterBadgeText as object}>{activeChips.length}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Mobile active-filters strip */}
      {team && !isDesktop && activeChips.length > 0 && (
        <View style={[styles.activeStrip, { paddingHorizontal: contentPad }] as object}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeStripContent as object}
          >
            <ActiveFilterChips slug={null} filters={filters} setFilter={setFilter} />
            <Pressable onPress={reset} style={styles.stripClear as object}>
              <Text style={styles.stripClearText as object}>Clear all</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* Content: desktop = rail + grid; mobile = grid only */}
      <View style={[styles.contentRow, { paddingHorizontal: contentPad }] as object}>
        {team && isDesktop && (
          <FilterRail
            slug={null}
            filters={filters}
            counts={null}
            setFilter={setFilter}
            onReset={reset}
            hasActive={activeChips.length > 0}
            activeCount={activeChips.length}
            searchPlaceholder={`Search ${team.name}…`}
          />
        )}
        <View style={styles.contentMain as object}>
          {team && isDesktop && (
            <View style={styles.resultsBar as object}>
              <Text style={styles.resultsCount as object}>
                {loading
                  ? 'Searching…'
                  : `${total.toLocaleString()} ${total === 1 ? 'member' : 'members'}`}
              </Text>
              {activeChips.length > 0 && (
                <View style={styles.resultsBarFilters as object}>
                  <ActiveFilterChips slug={null} filters={filters} setFilter={setFilter} />
                  <Pressable onPress={reset} style={styles.resultsClear as object}>
                    <Text style={styles.resultsClearText as object}>Clear all</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
          {loading ? (
            <View style={styles.gridWrap}>
              <View style={gridStyle as object}>
                {Array.from({ length: 18 }).map((_, i) => (
                  <SkeletonCard key={i} opacity={skeletonOpacity} />
                ))}
              </View>
            </View>
          ) : heroes.length === 0 ? (
            !notFound && (
              <View style={styles.center}>
                <Ionicons name="search-outline" size={34} color="rgba(245,235,220,0.25)" />
                <Text style={styles.empty}>
                  {activeChips.length > 0 ? 'No members match these filters' : 'No members found'}
                </Text>
                {activeChips.length > 0 && (
                  <Pressable onPress={reset} style={styles.emptyClear as object}>
                    <Ionicons name="close" size={15} color={COLORS.beige} />
                    <Text style={styles.emptyClearText as object}>Clear filters</Text>
                  </Pressable>
                )}
              </View>
            )
          ) : (
            <View style={[styles.gridWrap, { paddingBottom: 0 }] as object}>{grid}</View>
          )}
        </View>
      </View>

      {team && (
        <FilterSheet
          open={sheetOpen}
          slug={null}
          filters={filters}
          counts={null}
          setFilter={setFilter}
          onReset={reset}
          onClose={() => setSheetOpen(false)}
          total={total}
          hasActive={activeChips.length > 0}
        />
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
  root: { minHeight: '100lvh' as unknown as number, backgroundColor: SURFACE.ink },

  // Mobile controls-only bar (transparent — sits just under the banner).
  header: { paddingTop: 6, paddingBottom: 4 } as object,
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 } as object,
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(41,60,67,0.6)',
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    paddingHorizontal: 13,
    height: 46,
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
  } as object,
  searchBarFocused: {
    borderColor: 'rgba(231,115,51,0.8)',
    boxShadow: '0 0 0 3px rgba(231,115,51,0.16)',
  } as object,
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.beige,
    outlineStyle: 'none',
    outlineWidth: 0,
  } as object,
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(41,60,67,0.6)',
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    cursor: 'pointer',
    flexShrink: 0,
  } as object,
  filterBtnActive: {
    backgroundColor: 'rgba(231,115,51,0.2)',
    borderColor: 'rgba(231,115,51,0.6)',
  } as object,
  filterBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13.5, color: COLORS.beige } as object,
  filterBtnTextActive: { color: COLORS.orange } as object,
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  } as object,
  filterBadgeText: { fontFamily: 'Nunito_900Black', fontSize: 11, color: '#fff' } as object,

  activeStrip: { paddingTop: 12 } as object,
  activeStripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 16,
  } as object,
  stripClear: {
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 6,
    cursor: 'pointer',
    flexShrink: 0,
  } as object,
  stripClearText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: COLORS.orange,
    letterSpacing: 0.2,
  } as object,

  contentRow: {
    flexDirection: 'row',
    gap: 24,
    maxWidth: 1680,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
    flexShrink: 0,
    paddingTop: 16,
  } as object,
  contentMain: { flex: 1, minWidth: 0 } as object,
  gridWrap: { paddingTop: 4, backgroundColor: SURFACE.ink } as object,

  resultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    minHeight: 30,
  } as object,
  resultsCount: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.55)',
    letterSpacing: 0.2,
  } as object,
  resultsBarFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  } as object,
  resultsClear: {
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: 4,
    cursor: 'pointer',
  } as object,
  resultsClearText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: COLORS.orange,
    letterSpacing: 0.2,
  } as object,

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 80 },
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 16, color: 'rgba(245,235,220,0.55)' },
  emptyClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: COLORS.orange,
    cursor: 'pointer',
  } as object,
  emptyClearText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13.5,
    color: COLORS.beige,
    letterSpacing: 0.2,
  } as object,

  notFoundStage: {
    maxWidth: 1680,
    width: '100%',
    alignSelf: 'center',
    paddingTop: TOPBAR_HEIGHT + 60,
    paddingBottom: 12,
  } as object,
  notFoundTitle: { fontFamily: 'Flame-Regular', fontSize: 34, color: COLORS.beige } as object,
  notFoundSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.55)',
    marginTop: 6,
  } as object,
});
