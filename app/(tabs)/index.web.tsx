// app/(tabs)/index.web.tsx — Home screen for web
// Search mode: full-screen grid (unchanged). Home mode: spotlight + horizontal scroll rows.
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/constants/colors';
import { heroGridImageSource, heroImageSource } from '../../src/constants/heroImages';
import { useSearch } from '../../src/contexts/SearchContext';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import {
  getHeroesByCategory,
  getAntiHeroes,
  getHeroesByPublisher,
  getHeroesByStatRanking,
  searchHeroes,
  rankResults,
  type Hero,
  type HeroSearchResult,
  type PublisherFilter,
} from '../../src/lib/db/heroes';
import { getUserFavouriteHeroes } from '../../src/lib/db/favourites';
import { getRecentlyViewed } from '../../src/lib/db/viewHistory';
import { useAuth } from '../../src/hooks/useAuth';
import type { FavouriteHero } from '../../src/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const PUBLISHER_FILTERS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];
const DISPLAY_LIMIT = 120;
const SPOTLIGHT_POOL = 5;
const ROW_CARD_HEIGHT = 260;
const ROW_CARD_WIDTH = 180;

// Publisher logos
const MARVEL_LOGO = require('../../assets/images/Marvel-Logo.jpg') as number;
const DC_LOGO = require('../../assets/images/DC-Logo.png') as number;
const DARK_HORSE_LOGO = require('../../assets/images/Dark_Horse_Comics_logo.png') as number;
const STAR_WARS_LOGO = require('../../assets/images/star-wars-logo.png') as number;

// ── CSS grid / scroll layouts ─────────────────────────────────────────────────
const resultsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gridAutoRows: '240px',
  gap: 12,
};
const rowScrollStyle = {
  display: 'flex',
  flexDirection: 'row',
  gap: 12,
  overflowX: 'auto',
  // Extra padding gives box-shadows room to render inside the overflow container
  // on all four sides. Negative margins compensate so layout spacing is unchanged.
  paddingTop: 16,
  paddingBottom: 64,
  paddingLeft: 48,
  paddingRight: 48,
  marginTop: -16,
  marginBottom: -52, // net: 64 - 52 = 12 (same as original paddingBottom)
  marginLeft: -48,
  marginRight: -48,
  scrollbarWidth: 'none',
};

// ── Publisher logo helper ─────────────────────────────────────────────────────
function PublisherLogo({ publisher }: { publisher?: string | null }) {
  if (!publisher) return null;
  const pub = publisher.toLowerCase();
  const isMarvel = pub.includes('marvel');
  const isDC = pub.includes('dc');
  const isDarkHorse = pub.includes('dark horse');
  const isStarWars = pub.includes('george lucas') || pub.includes('star wars');

  if (isMarvel)
    return (
      <Image
        source={MARVEL_LOGO}
        style={{ width: 38, height: 15, borderRadius: 2 } as object}
        contentFit="contain"
      />
    );
  if (isDC)
    return (
      <Image
        source={DC_LOGO}
        style={{ width: 22, height: 22, borderRadius: 2 } as object}
        contentFit="contain"
      />
    );
  if (isDarkHorse)
    return (
      <Image
        source={DARK_HORSE_LOGO}
        style={{ width: 18, height: 26, borderRadius: 2 } as object}
        contentFit="contain"
      />
    );
  if (isStarWars)
    return (
      <Image
        source={STAR_WARS_LOGO}
        style={{ width: 32, height: 32, borderRadius: 2 } as object}
        contentFit="contain"
      />
    );

  return (
    <Text style={logo.text} numberOfLines={1}>
      {publisher}
    </Text>
  );
}

const logo = StyleSheet.create({
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

// ── Portrait grid card (search mode) ─────────────────────────────────────────
function PortraitCard({ item, onPress }: { item: HeroSearchResult; onPress: () => void }) {
  const source = heroGridImageSource(item.id, item.image_url, item.portrait_url);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [gcard.wrap, hovered && (gcard.wrapHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top center"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={item.id}
        transition={null}
      />
      <View style={gcard.overlay as object} />
      <View style={gcard.logoWrap}>
        <PublisherLogo publisher={item.publisher} />
      </View>
      <View style={gcard.bottom}>
        <Text style={gcard.name as object} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
    </Pressable>
  );
}

const gcard = StyleSheet.create({
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.08) 55%, transparent 100%)',
  } as object,
  logoWrap: { position: 'absolute', top: 10, left: 10 },
  bottom: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
  } as object,
});

// ── Row card (home carousel rows) ────────────────────────────────────────────
function RowCard({ hero, onPress }: { hero: Hero | FavouriteHero; onPress: () => void }) {
  const source = heroImageSource(String(hero.id), hero.image_url, hero.portrait_url);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [rc.wrap, hovered && (rc.wrapHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
        cachePolicy="memory-disk"
        recyclingKey={String(hero.id)}
        transition={typeof source === 'object' && 'uri' in source ? 200 : null}
      />
      <View style={rc.overlay as object} />
      <View style={rc.bottom}>
        <Text style={rc.name as object} numberOfLines={2}>
          {hero.name}
        </Text>
      </View>
    </Pressable>
  );
}

const rc = StyleSheet.create({
  wrap: {
    width: ROW_CARD_WIDTH,
    height: ROW_CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  wrapHover: {
    transform: [{ scale: 1.04 }],
    boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
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
    fontSize: 14,
    color: COLORS.beige,
    lineHeight: 16,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
  } as object,
});

// ── Spotlight banner ──────────────────────────────────────────────────────────
function WebSpotlight({
  hero,
  index,
  total,
  onPress,
  onDotPress,
}: {
  hero: Hero;
  index: number;
  total: number;
  onPress: () => void;
  onDotPress: (i: number) => void;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const source = heroImageSource(String(hero.id), hero.image_url, hero.portrait_url);

  const height = isDesktop ? 500 : 340;
  const nameFontSize = isDesktop ? 52 : 34;
  const nameLineHeight = isDesktop ? 54 : 38;
  const contentPad = isDesktop ? 44 : 24;
  const bottomPad = isDesktop ? 40 : 28;

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [spot.wrap, { height } as object, hovered && (spot.wrapHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition={'center 15%' as any}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
        cachePolicy="memory-disk"
        recyclingKey={String(hero.id)}
        transition={200}
      />
      <View style={spot.overlay as object} />
      <View style={[spot.content, { left: contentPad, right: contentPad, bottom: bottomPad }]}>
        <View style={spot.logoRow}>
          <PublisherLogo publisher={hero.publisher} />
        </View>
        <Text style={spot.label as object}>Featured Hero</Text>
        <Text
          style={[spot.name, { fontSize: nameFontSize, lineHeight: nameLineHeight }] as object}
          numberOfLines={2}
        >
          {hero.name}
        </Text>
        <View style={spot.cta}>
          <Text style={spot.ctaText}>View profile</Text>
          <Text style={spot.ctaArrow}> →</Text>
        </View>
      </View>
      {total > 1 && (
        <View style={[spot.dots, { right: contentPad }] as object}>
          {Array.from({ length: total }).map((_, i) => (
            <Pressable
              key={i}
              onPress={(e) => {
                e.stopPropagation?.();
                onDotPress(i);
              }}
              style={[spot.dot, i === index && (spot.dotActive as object)] as object}
            />
          ))}
        </View>
      )}
    </Pressable>
  );
}

const spot = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'box-shadow 220ms ease',
    marginBottom: 48,
  } as object,
  wrapHover: {
    boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.98) 0%, rgba(29,45,51,0.5) 40%, rgba(29,45,51,0.1) 70%, transparent 100%)',
  } as object,
  content: { position: 'absolute' },
  logoRow: { marginBottom: 10 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  } as object,
  name: {
    fontFamily: 'Flame-Regular',
    color: COLORS.beige,
    marginBottom: 20,
    textShadow: '0 2px 16px rgba(0,0,0,0.8)',
  } as object,
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,235,220,0.15)',
    paddingTop: 14,
  },
  ctaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  ctaArrow: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.4)',
  },
  dots: {
    position: 'absolute',
    bottom: 14,
    flexDirection: 'row',
    gap: 6,
  } as object,
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(245,235,220,0.3)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  } as object,
  dotActive: { width: 18, backgroundColor: COLORS.orange } as object,
});

// ── Home row section ──────────────────────────────────────────────────────────
function HomeRow({
  label,
  title,
  heroes,
  onPress,
  onViewAll,
}: {
  label?: string;
  title: string;
  heroes: (Hero | FavouriteHero)[];
  onPress: (id: string) => void;
  onViewAll?: () => void;
}) {
  if (heroes.length === 0) return null;
  return (
    <View style={row.section}>
      <View style={row.header}>
        <View style={row.headerLeft}>
          {!!label && <Text style={row.label}>{label}</Text>}
          <Text style={row.title}>{title}</Text>
        </View>
        {!!onViewAll && (
          <Pressable
            onPress={onViewAll}
            style={({ hovered }: { hovered?: boolean }) =>
              [row.seeAll, hovered && (row.seeAllHover as object)] as object
            }
          >
            <Text style={row.seeAllText as object}>See All →</Text>
          </Pressable>
        )}
      </View>
      <View style={rowScrollStyle as object}>
        {heroes.map((h) => (
          <RowCard key={h.id} hero={h} onPress={() => onPress(String(h.id))} />
        ))}
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  section: { marginBottom: 40 },
  header: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerLeft: { gap: 2 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 28, color: COLORS.navy },
  seeAll: {
    paddingBottom: 4,
    paddingLeft: 12,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  seeAllHover: { opacity: 0.7 } as object,
  seeAllText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 0.3,
  } as object,
});

// ── Home skeleton ─────────────────────────────────────────────────────────────
function HomeSkeleton() {
  const opacity = useSkeletonAnim();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.discoverContent}>
      <SkeletonBlock
        opacity={opacity}
        height={480}
        borderRadius={16}
        style={{ marginBottom: 48 }}
      />
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ marginBottom: 40 } as object}>
          <SkeletonBlock
            opacity={opacity}
            width={160}
            height={28}
            borderRadius={6}
            style={{ marginBottom: 14 }}
          />
          <View style={{ flexDirection: 'row', gap: 12 } as object}>
            {Array.from({ length: 6 }).map((_, j) => (
              <SkeletonBlock
                key={j}
                opacity={opacity}
                width={ROW_CARD_WIDTH}
                height={ROW_CARD_HEIGHT}
                borderRadius={10}
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Grid skeleton (search mode) ───────────────────────────────────────────────
function GridSkeleton() {
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
      <Text style={styles.emptyHeadline as object}>{query ? `"${query}"` : 'Nothing here'}</Text>
      <Text style={styles.emptySub as object}>
        {query ? 'No heroes match that search.' : 'No heroes found for this filter.'}
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
export default function WebHomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const isDesktop = width >= 768;
  const inputRef = useRef<TextInput>(null);

  const { query, setQuery, publisher, setPublisher } = useSearch();
  const { user } = useAuth();

  // Search data
  const [allHeroes, setAllHeroes] = useState<HeroSearchResult[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  // Home data
  interface HomeData {
    popular: Hero[];
    villain: Hero[];
    xmen: Hero[];
    antiHeroes: Hero[];
    marvel: Hero[];
    dc: Hero[];
    strongest: Hero[];
    mostIntelligent: Hero[];
  }
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<FavouriteHero[]>([]);
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  const isSearchActive = query.trim() !== '' || publisher !== 'All';

  // Load search heroes + home data in parallel
  useEffect(() => {
    searchHeroes('', 'All', 600)
      .then((heroes) => {
        setAllHeroes(heroes);
        const remoteUrls = heroes
          .slice(0, 200)
          .map((h) => h.portrait_url ?? (h.image_url?.startsWith('http') ? h.image_url : null))
          .filter((u): u is string => u !== null);
        if (remoteUrls.length > 0) Image.prefetch(remoteUrls, 'memory-disk').catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoadingAll(false));

    Promise.all([
      getHeroesByCategory(),
      getAntiHeroes(),
      getHeroesByPublisher('marvel'),
      getHeroesByPublisher('dc'),
      getHeroesByStatRanking('strength'),
      getHeroesByStatRanking('intelligence'),
    ])
      .then(([cats, antiHeroes, marvel, dc, strongest, mostIntelligent]) => {
        setHomeData({
          popular: cats.popular,
          villain: cats.villain,
          xmen: cats.xmen,
          antiHeroes,
          marvel,
          dc,
          strongest,
          mostIntelligent,
        });
      })
      .catch(() => {});
  }, []);

  // Personal rows
  useEffect(() => {
    if (!user?.id) return;
    getRecentlyViewed(user.id)
      .then(setRecentlyViewed)
      .catch(() => {});
    getUserFavouriteHeroes(user.id)
      .then(setFavourites)
      .catch(() => {});
  }, [user?.id]);

  // Auto-advance spotlight
  useEffect(() => {
    if (!homeData?.popular.length) return;
    const total = Math.min(SPOTLIGHT_POOL, homeData.popular.length);
    if (total <= 1) return;
    const timer = setInterval(() => setSpotlightIndex((i) => (i + 1) % total), 6000);
    return () => clearInterval(timer);
  }, [homeData?.popular]);

  const filtered = useMemo(() => {
    let list =
      publisher === 'All'
        ? allHeroes
        : allHeroes.filter((h) => {
            const pub = (h.publisher ?? '').toLowerCase();
            if (publisher === 'Marvel') return pub.includes('marvel');
            if (publisher === 'DC') return pub.includes('dc');
            return !pub.includes('marvel') && !pub.includes('dc');
          });
    return query.trim() ? rankResults(list, query) : list;
  }, [allHeroes, query, publisher]);

  const displayed = filtered.slice(0, DISPLAY_LIMIT);
  const hasMore = filtered.length > DISPLAY_LIMIT;
  const heroCount = loadingAll ? null : allHeroes.length;

  const handleClear = useCallback(() => {
    setQuery('');
    setPublisher('All');
  }, [setQuery, setPublisher]);

  const handlePress = useCallback(
    (id: string) => {
      router.push(`/character/${id}`);
    },
    [router],
  );

  const spotlightHero = homeData?.popular[spotlightIndex] ?? null;
  const spotlightTotal = homeData ? Math.min(SPOTLIGHT_POOL, homeData.popular.length) : 0;

  return (
    <View style={styles.root}>
      {/* ── Desktop: editorial beige filter strip ────────────────────────────── */}
      {isDesktop && (
        <View style={styles.filterStrip as object}>
          <View style={styles.filterInner}>
            <View style={styles.filterTabs as object}>
              {PUBLISHER_FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setPublisher(f)}
                  style={({ hovered }: { hovered?: boolean }) =>
                    [
                      styles.filterTab,
                      publisher === f && (styles.filterTabActive as object),
                      hovered && publisher !== f && (styles.filterTabHover as object),
                    ] as object
                  }
                >
                  <Text
                    style={[styles.filterTabText, publisher === f && styles.filterTabTextActive]}
                  >
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.filterCount as object}>
              {loadingAll
                ? ''
                : isSearchActive
                  ? hasMore
                    ? `${DISPLAY_LIMIT} of ${filtered.length} heroes`
                    : `${filtered.length} hero${filtered.length !== 1 ? 'es' : ''}`
                  : heroCount !== null
                    ? `${heroCount} heroes in the encyclopedia`
                    : ''}
            </Text>
          </View>
        </View>
      )}

      {/* ── Mobile: navy command bar ──────────────────────────────────────────── */}
      {!isDesktop && (
        <View style={styles.commandBar as object}>
          <View style={styles.commandInner}>
            <View style={styles.inputRow as object}>
              <View style={styles.underlineWrap as object}>
                <TextInput
                  ref={inputRef}
                  style={[styles.input, isMobile && (styles.inputMobile as object)] as object}
                  placeholder="Search heroes…"
                  placeholderTextColor="rgba(245,235,220,0.28)"
                  value={query}
                  onChangeText={setQuery}
                />
                {query.length > 0 && (
                  <Pressable
                    onPress={() => setQuery('')}
                    style={({ hovered }: { hovered?: boolean }) =>
                      [styles.clearBtn, hovered && (styles.clearBtnHover as object)] as object
                    }
                  >
                    <Text style={styles.clearX as object}>×</Text>
                  </Pressable>
                )}
              </View>
              {loadingAll ? (
                <ActivityIndicator size="small" color={COLORS.orange} />
              ) : (
                <Text style={styles.countBadge as object}>
                  {isSearchActive
                    ? `${filtered.length} heroes`
                    : heroCount !== null
                      ? `${heroCount} heroes`
                      : ''}
                </Text>
              )}
            </View>
            <View style={styles.pillsRow}>
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
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {isSearchActive ? (
        loadingAll ? (
          <GridSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState query={query} onClear={handleClear} />
        ) : (
          <ScrollView style={styles.scroll}>
            <View style={styles.resultsHeader}>
              <View style={styles.resultsHeaderInner}>
                <Text style={styles.resultsQuery as object}>
                  {query.trim() ? `"${query}"` : publisher}
                </Text>
                {query.trim().length > 0 && (
                  <Text style={styles.resultsMeta}>
                    {hasMore
                      ? `Showing ${DISPLAY_LIMIT} of ${filtered.length} results`
                      : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.scrollContent}>
              <View style={resultsGrid as object}>
                {displayed.map((item) => (
                  <PortraitCard key={item.id} item={item} onPress={() => handlePress(item.id)} />
                ))}
              </View>
              {hasMore && (
                <Text style={styles.moreHint}>Refine your search to see more results</Text>
              )}
            </View>
          </ScrollView>
        )
      ) : !homeData ? (
        <HomeSkeleton />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.discoverContent}>
          {/* Spotlight */}
          {spotlightHero && (
            <WebSpotlight
              hero={spotlightHero}
              index={spotlightIndex}
              total={spotlightTotal}
              onPress={() => handlePress(String(spotlightHero.id))}
              onDotPress={setSpotlightIndex}
            />
          )}

          {/* Personal rows */}
          <HomeRow
            label="Personal"
            title="Jump Back In"
            heroes={recentlyViewed}
            onPress={handlePress}
          />
          <HomeRow
            label="Personal"
            title="Your Favourites"
            heroes={favourites}
            onPress={handlePress}
          />

          {/* Curated rows */}
          <HomeRow
            title="Popular"
            heroes={homeData.popular}
            onPress={handlePress}
            onViewAll={() => router.push('/category/popular')}
          />
          <HomeRow
            title="Villains"
            heroes={homeData.villain}
            onPress={handlePress}
            onViewAll={() => router.push('/category/villain')}
          />
          <HomeRow
            title="X-Men"
            heroes={homeData.xmen}
            onPress={handlePress}
            onViewAll={() => router.push('/category/xmen')}
          />
          <HomeRow
            title="Anti-Heroes"
            heroes={homeData.antiHeroes}
            onPress={handlePress}
            onViewAll={() => router.push('/category/anti-heroes')}
          />
          <HomeRow
            title="Marvel Universe"
            heroes={homeData.marvel}
            onPress={handlePress}
            onViewAll={() => router.push('/category/marvel')}
          />
          <HomeRow
            title="DC Universe"
            heroes={homeData.dc}
            onPress={handlePress}
            onViewAll={() => router.push('/category/dc')}
          />
          <HomeRow
            title="Strongest Heroes"
            heroes={homeData.strongest}
            onPress={handlePress}
            onViewAll={() => router.push('/category/strongest')}
          />
          <HomeRow
            title="Most Intelligent"
            heroes={homeData.mostIntelligent}
            onPress={handlePress}
            onViewAll={() => router.push('/category/most-intelligent')}
          />

          <View style={styles.footerRule} />
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flex: 1 },

  // ── Desktop editorial filter strip ──────────────────────────────────────────
  filterStrip: {
    position: 'sticky',
    top: 64,
    zIndex: 50,
    backgroundColor: COLORS.beige,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.1)',
    height: 46,
    justifyContent: 'center',
  } as object,
  filterInner: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTabs: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
  } as object,
  filterTab: {
    paddingHorizontal: 18,
    height: 46,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    cursor: 'pointer',
    transition: 'border-color 150ms ease',
  } as object,
  filterTabActive: { borderBottomColor: COLORS.navy } as object,
  filterTabHover: { borderBottomColor: 'rgba(41,60,67,0.22)' } as object,
  filterTabText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(41,60,67,0.35)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filterTabTextActive: { color: COLORS.navy },
  filterCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(41,60,67,0.28)',
    letterSpacing: 0.3,
  },

  // ── Mobile command bar ───────────────────────────────────────────────────────
  commandBar: {
    position: 'sticky',
    top: 64,
    zIndex: 50,
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.07)',
    paddingTop: 16,
    paddingBottom: 12,
  } as object,
  commandInner: { paddingHorizontal: 16, gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 } as object,
  underlineWrap: {
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
    fontSize: 18,
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
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.3)',
    letterSpacing: 0.3,
    flexShrink: 0,
  } as object,
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.15)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  } as object,
  pillActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange } as object,
  pillHover: { borderColor: 'rgba(245,235,220,0.4)' } as object,
  pillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.38)',
    letterSpacing: 0.4,
  },
  pillTextActive: { color: 'white' },

  // ── Home layout ──────────────────────────────────────────────────────────────
  discoverContent: {
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 100,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  footerRule: { height: 1, backgroundColor: COLORS.navy, opacity: 0.08, marginTop: 16 },

  // ── Search results layout ────────────────────────────────────────────────────
  resultsHeader: {
    paddingTop: 40,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.08)',
  },
  resultsHeaderInner: {
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  resultsQuery: {
    fontFamily: 'Flame-Regular',
    fontSize: 40,
    color: COLORS.navy,
    lineHeight: 42,
  } as object,
  resultsMeta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(41,60,67,0.4)',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 24,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 100,
  },
  moreHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    marginTop: 32,
    letterSpacing: 0.3,
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 120, gap: 14 },
  emptyHeadline: {
    fontFamily: 'Flame-Regular',
    fontSize: 52,
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
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  } as object,
  clearFilterHover: { backgroundColor: COLORS.navy } as object,
  clearFilterText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
});
