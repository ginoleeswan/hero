// app/(tabs)/index.web.tsx — Unified Explore screen for web
// Default state: editorial discover. Active state: portrait card grid.
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
import { heroImageSource } from '../../src/constants/heroImages';
import { useSearch } from '../../src/contexts/SearchContext';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import {
  getHeroesByCategory,
  searchHeroes,
  rankResults,
} from '../../src/lib/db/heroes';
import type {
  Hero,
  HeroesByCategory,
  HeroSearchResult,
  PublisherFilter,
} from '../../src/lib/db/heroes';

// ── Constants ─────────────────────────────────────────────────────────────────
const PUBLISHER_FILTERS: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];
const DISPLAY_LIMIT = 120;

// Publisher logos
const MARVEL_LOGO = require('../../assets/images/Marvel-Logo.jpg') as number;
const DC_LOGO = require('../../assets/images/DC-Logo.png') as number;
const DARK_HORSE_LOGO = require('../../assets/images/Dark_Horse_Comics_logo.png') as number;
const STAR_WARS_LOGO = require('../../assets/images/star-wars-logo.png') as number;

// ── CSS grid layouts (outside StyleSheet.create) ──────────────────────────────
const villainsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gridAutoRows: '240px',
  gap: 16,
};
const xmenGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gridAutoRows: '320px',
  gap: 16,
};
const resultsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gridAutoRows: '240px',
  gap: 12,
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
    return <Image source={MARVEL_LOGO} style={{ width: 38, height: 15, borderRadius: 2 } as object} contentFit="contain" />;
  if (isDC)
    return <Image source={DC_LOGO} style={{ width: 22, height: 22, borderRadius: 2 } as object} contentFit="contain" />;
  if (isDarkHorse)
    return <Image source={DARK_HORSE_LOGO} style={{ width: 18, height: 26, borderRadius: 2 } as object} contentFit="contain" />;
  if (isStarWars)
    return <Image source={STAR_WARS_LOGO} style={{ width: 32, height: 32, borderRadius: 2 } as object} contentFit="contain" />;

  return <Text style={logo.text} numberOfLines={1}>{publisher}</Text>;
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
  const source = heroImageSource(item.id, item.image_url, item.portrait_url);
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
        transition={200}
        placeholder={COLORS.navy}
      />
      <View style={gcard.overlay as object} />
      <View style={gcard.logoWrap}>
        <PublisherLogo publisher={item.publisher} />
      </View>
      <View style={gcard.bottom}>
        <Text style={gcard.name as object} numberOfLines={2}>{item.name}</Text>
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
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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

// ── Supporting card (Popular right column) ────────────────────────────────────
function SupportingCard({ hero, onPress }: { hero: Hero; onPress: () => void }) {
  const source = heroImageSource(String(hero.id), hero.portrait_url ?? hero.image_url);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [sc.wrap, hovered && (sc.wrapHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
      />
      <View style={sc.overlay as object} />
      <View style={sc.logoWrap}>
        <PublisherLogo publisher={hero.publisher} />
      </View>
      <View style={sc.bottom}>
        <Text style={sc.name as object} numberOfLines={2}>{hero.name}</Text>
      </View>
    </Pressable>
  );
}

const sc = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  wrapHover: {
    transform: [{ scale: 1.02 }],
    boxShadow: '0 16px 48px rgba(0,0,0,0.28)',
    zIndex: 1,
  } as object,
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.95) 0%, rgba(29,45,51,0.2) 50%, transparent 100%)',
  } as object,
  logoWrap: { position: 'absolute', top: 12, left: 14 },
  bottom: { position: 'absolute', bottom: 14, left: 14, right: 14 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    lineHeight: 21,
    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
  } as object,
});

// ── Featured hero panel ────────────────────────────────────────────────────────
function FeaturedHeroPanel({ hero, onPress }: { hero: Hero; onPress: () => void }) {
  const source = heroImageSource(String(hero.id), hero.portrait_url ?? hero.image_url);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [feat.panel, hovered && (feat.panelHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as object}
      />
      <View style={feat.overlay as object} />
      <View style={feat.content}>
        <View style={feat.logoRow}>
          <PublisherLogo publisher={hero.publisher} />
        </View>
        <Text style={feat.name as object} numberOfLines={2}>{hero.name}</Text>
        <View style={feat.cta}>
          <Text style={feat.ctaText}>View profile</Text>
          <Text style={feat.ctaArrow}> →</Text>
        </View>
      </View>
    </Pressable>
  );
}

const feat = StyleSheet.create({
  panel: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 220ms ease, box-shadow 220ms ease',
  } as object,
  panelHover: {
    transform: [{ scale: 1.015 }],
    boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
    zIndex: 1,
  } as object,
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.98) 0%, rgba(29,45,51,0.45) 42%, transparent 100%)',
  } as object,
  content: { position: 'absolute', bottom: 32, left: 32, right: 32 },
  logoRow: { marginBottom: 14 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 38,
    color: COLORS.beige,
    lineHeight: 40,
    marginBottom: 20,
    textShadow: '0 2px 16px rgba(0,0,0,0.7)',
  } as object,
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,235,220,0.15)',
    paddingTop: 16,
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
});

// ── Editorial section header ───────────────────────────────────────────────────
function SectionHeader({ index, label, category }: {
  index: number;
  label: string;
  category: string;
}) {
  return (
    <View style={sh.wrap}>
      <Text style={sh.watermark as object}>{String(index + 1).padStart(2, '0')}</Text>
      <Text style={sh.index}>{String(index + 1).padStart(2, '0')}</Text>
      <Text style={sh.title}>{label}</Text>
      <Text style={sh.category}>{category}</Text>
      <View style={sh.rule} />
    </View>
  );
}

const sh = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: 28,
    paddingTop: 12,
  },
  watermark: {
    position: 'absolute',
    bottom: -16,
    left: -12,
    fontFamily: 'Flame-Regular',
    fontSize: 168,
    color: COLORS.navy,
    opacity: 0.04,
    lineHeight: 140,
    userSelect: 'none',
    pointerEvents: 'none',
  } as object,
  index: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 3,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 52,
    color: COLORS.navy,
    lineHeight: 54,
  },
  category: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(41,60,67,0.38)',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginTop: 5,
  },
  rule: {
    height: 1,
    backgroundColor: COLORS.navy,
    opacity: 0.1,
    marginTop: 22,
  },
});

// ── Discover skeleton ─────────────────────────────────────────────────────────
function DiscoverSkeleton() {
  const opacity = useSkeletonAnim();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.discoverContent}>
      <View style={styles.section}>
        <View style={{ gap: 6, marginBottom: 28 } as object}>
          <SkeletonBlock opacity={opacity} width={28} height={11} borderRadius={3} />
          <SkeletonBlock opacity={opacity} width={200} height={48} borderRadius={6} />
          <SkeletonBlock opacity={opacity} width={80} height={11} borderRadius={3} />
          <SkeletonBlock opacity={opacity} height={1} borderRadius={0} style={{ marginTop: 14 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 16, height: 540 } as object}>
          <SkeletonBlock opacity={opacity} height={540} borderRadius={12} style={{ flex: 1 }} />
          <View style={{ flex: 0.75, gap: 14, flexDirection: 'column' } as object}>
            <SkeletonBlock opacity={opacity} height={0} borderRadius={12} style={{ flex: 7 }} />
            <View style={{ flex: 5, flexDirection: 'row', gap: 14 } as object}>
              <SkeletonBlock opacity={opacity} height={0} borderRadius={12} style={{ flex: 1 }} />
              <SkeletonBlock opacity={opacity} height={0} borderRadius={12} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </View>
      {[{ cols: 5, h: 240 }, { cols: 3, h: 320 }].map((c, si) => (
        <View key={si} style={styles.section}>
          <View style={{ gap: 6, marginBottom: 28 } as object}>
            <SkeletonBlock opacity={opacity} width={28} height={11} borderRadius={3} />
            <SkeletonBlock opacity={opacity} width={160} height={48} borderRadius={6} />
            <SkeletonBlock opacity={opacity} width={80} height={11} borderRadius={3} />
            <SkeletonBlock opacity={opacity} height={1} borderRadius={0} style={{ marginTop: 14 }} />
          </View>
          <View style={{ display: 'grid', gridTemplateColumns: `repeat(${c.cols}, 1fr)`, gridAutoRows: `${c.h}px`, gap: 16 } as object}>
            {Array.from({ length: c.cols }).map((_, i) => (
              <SkeletonBlock key={i} opacity={opacity} height={c.h} borderRadius={12} />
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
export default function WebExploreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const isDesktop = width >= 768;
  const inputRef = useRef<TextInput>(null);

  const { query, setQuery, publisher, setPublisher } = useSearch();

  const [categories, setCategories] = useState<HeroesByCategory | null>(null);
  const [allHeroes, setAllHeroes] = useState<HeroSearchResult[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  const isSearchActive = query.trim() !== '' || publisher !== 'All';

  useEffect(() => {
    getHeroesByCategory().then(setCategories).catch(() => {});
    searchHeroes('', 'All', 600)
      .then(setAllHeroes)
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }, []);

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
                  <Text style={[styles.filterTabText, publisher === f && styles.filterTabTextActive]}>
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.filterCount as object}>
              {loadingAll ? '' : isSearchActive
                ? (hasMore ? `${DISPLAY_LIMIT} of ${filtered.length} heroes` : `${filtered.length} hero${filtered.length !== 1 ? 'es' : ''}`)
                : heroCount !== null ? `${heroCount} heroes in the encyclopedia` : ''}
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
              {loadingAll
                ? <ActivityIndicator size="small" color={COLORS.orange} />
                : <Text style={styles.countBadge as object}>
                    {isSearchActive ? `${filtered.length} heroes` : heroCount !== null ? `${heroCount} heroes` : ''}
                  </Text>
              }
            </View>
            <View style={styles.pillsRow}>
              {PUBLISHER_FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setPublisher(f)}
                  style={({ hovered }: { hovered?: boolean }) =>
                    [styles.pill, publisher === f && (styles.pillActive as object), hovered && publisher !== f && (styles.pillHover as object)] as object
                  }
                >
                  <Text style={[styles.pillText, publisher === f && styles.pillTextActive]}>{f}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {isSearchActive ? (

        loadingAll ? <GridSkeleton /> : filtered.length === 0 ? (
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
                    {hasMore ? `Showing ${DISPLAY_LIMIT} of ${filtered.length} results` : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.scrollContent}>
              <View style={resultsGrid as object}>
                {displayed.map((item) => (
                  <PortraitCard
                    key={item.id}
                    item={item}
                    onPress={() => router.push(`/character/${item.id}`)}
                  />
                ))}
              </View>
              {hasMore && <Text style={styles.moreHint}>Refine your search to see more results</Text>}
            </View>
          </ScrollView>
        )

      ) : (

        !categories ? <DiscoverSkeleton /> : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.discoverContent}>

            {/* 01 — POPULAR */}
            {categories.popular.length > 0 && (
              <View style={styles.section}>
                <SectionHeader index={0} label="Popular" category="Heroes" />
                <View style={{ flexDirection: 'row', gap: 16, height: 540 } as object}>
                  <View style={{ flex: 1 } as object}>
                    <FeaturedHeroPanel
                      hero={categories.popular[0]}
                      onPress={() => router.push(`/character/${categories.popular[0].id}`)}
                    />
                  </View>
                  <View style={{ flex: 0.75, gap: 14, flexDirection: 'column' } as object}>
                    <View style={{ flex: 7 } as object}>
                      {categories.popular[1] && (
                        <SupportingCard
                          hero={categories.popular[1]}
                          onPress={() => router.push(`/character/${categories.popular[1].id}`)}
                        />
                      )}
                    </View>
                    <View style={{ flex: 5, flexDirection: 'row', gap: 14 } as object}>
                      {categories.popular[2] && (
                        <SupportingCard
                          hero={categories.popular[2]}
                          onPress={() => router.push(`/character/${categories.popular[2].id}`)}
                        />
                      )}
                      {categories.popular[3] && (
                        <SupportingCard
                          hero={categories.popular[3]}
                          onPress={() => router.push(`/character/${categories.popular[3].id}`)}
                        />
                      )}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* 02 — VILLAINS */}
            {categories.villain.length > 0 && (
              <View style={styles.section}>
                <SectionHeader index={1} label="Villains" category="Rogues Gallery" />
                <View style={villainsGrid as object}>
                  {categories.villain.map((hero) => (
                    <WebHeroCard
                      key={hero.id}
                      id={String(hero.id)}
                      name={hero.name}
                      imageUrl={hero.image_url}
                      onPress={() => router.push(`/character/${hero.id}`)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* 03 — X-MEN */}
            {categories.xmen.length > 0 && (
              <View style={styles.section}>
                <SectionHeader index={2} label="X-Men" category="Mutants" />
                <View style={xmenGrid as object}>
                  {categories.xmen.map((hero) => (
                    <WebHeroCard
                      key={hero.id}
                      id={String(hero.id)}
                      name={hero.name}
                      imageUrl={hero.image_url}
                      onPress={() => router.push(`/character/${hero.id}`)}
                    />
                  ))}
                </View>
              </View>
            )}

            <View style={styles.footerRule} />
          </ScrollView>
        )

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
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(245,235,220,0.1)',
    alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  } as object,
  clearBtnHover: { backgroundColor: 'rgba(245,235,220,0.18)' } as object,
  clearX: {
    fontFamily: 'Nunito_400Regular', fontSize: 16,
    color: 'rgba(245,235,220,0.65)', lineHeight: 18,
  } as object,
  countBadge: {
    fontFamily: 'Nunito_400Regular', fontSize: 11,
    color: 'rgba(245,235,220,0.3)', letterSpacing: 0.3, flexShrink: 0,
  } as object,
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(245,235,220,0.15)',
    cursor: 'pointer', transition: 'all 150ms ease',
  } as object,
  pillActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange } as object,
  pillHover: { borderColor: 'rgba(245,235,220,0.4)' } as object,
  pillText: {
    fontFamily: 'Nunito_700Bold', fontSize: 11,
    color: 'rgba(245,235,220,0.38)', letterSpacing: 0.4,
  },
  pillTextActive: { color: 'white' },

  // ── Discover editorial layout ────────────────────────────────────────────────
  discoverContent: {
    paddingHorizontal: 32,
    paddingTop: 56,
    paddingBottom: 100,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  section: { marginBottom: 96 },
  footerRule: { height: 1, backgroundColor: COLORS.navy, opacity: 0.08 },

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
    padding: 16, paddingTop: 24,
    maxWidth: 1280, alignSelf: 'center',
    width: '100%', paddingBottom: 100,
  },
  moreHint: {
    fontFamily: 'Nunito_400Regular', fontSize: 12,
    color: COLORS.grey, textAlign: 'center',
    marginTop: 32, letterSpacing: 0.3,
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 120, gap: 14 },
  emptyHeadline: {
    fontFamily: 'Flame-Regular', fontSize: 52,
    color: COLORS.navy, textAlign: 'center',
  } as object,
  emptySub: {
    fontFamily: 'Nunito_400Regular', fontSize: 15,
    color: COLORS.grey, textAlign: 'center',
  } as object,
  clearFilter: {
    marginTop: 8, paddingHorizontal: 28, paddingVertical: 11,
    borderRadius: 24, borderWidth: 1.5, borderColor: COLORS.navy,
    cursor: 'pointer', transition: 'all 150ms ease',
  } as object,
  clearFilterHover: { backgroundColor: COLORS.navy } as object,
  clearFilterText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
});
