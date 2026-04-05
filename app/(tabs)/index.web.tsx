// app/(tabs)/index.web.tsx — Unified Explore screen for web
// Default state: editorial discover carousels. Active state: portrait card grid.
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

// ── CSS grid layouts (must live outside StyleSheet.create) ────────────────────
const popularRightGrid = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gridTemplateRows: 'repeat(2, 1fr)',
  gap: 14,
};
const villainsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gridAutoRows: '190px',
  gap: 14,
};
const xmenGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gridAutoRows: '260px',
  gap: 14,
};
const resultsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gridAutoRows: '220px',
  gap: 10,
};

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

      {item.publisher ? (
        <View style={gcard.pubTextWrap}>
          <Text style={gcard.pubText} numberOfLines={1}>{item.publisher}</Text>
        </View>
      ) : null}

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
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.1) 55%, transparent 100%)',
  } as object,
  pubTextWrap: { position: 'absolute', top: 10, left: 10, right: 10 },
  pubText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottom: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
    textShadow: '0 1px 10px rgba(0,0,0,0.9)',
  } as object,
});

// ── Featured hero panel (Popular section left column) ─────────────────────────
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
        style={{ width: '100%', height: '100%' } as object}
      />
      <View style={feat.overlay as object} />
      <View style={feat.content}>
        {hero.publisher ? (
          <Text style={feat.publisher}>{hero.publisher}</Text>
        ) : null}
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
    width: 380,
    flexShrink: 0,
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  panelHover: {
    transform: [{ scale: 1.018 }],
    boxShadow: '0 20px 56px rgba(0,0,0,0.28)',
    zIndex: 1,
  } as object,
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.4) 45%, transparent 100%)',
  } as object,
  content: { position: 'absolute', bottom: 28, left: 28, right: 28 },
  publisher: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 10,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 34,
    color: COLORS.beige,
    lineHeight: 36,
    marginBottom: 18,
    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
  } as object,
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,235,220,0.18)',
    paddingTop: 14,
  },
  ctaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  ctaArrow: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: 'rgba(245,235,220,0.5)' },
});

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({
  index,
  label,
  category,
  onViewAll,
}: {
  index: number;
  label: string;
  category: string;
  onViewAll: () => void;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleGroup}>
          <Text style={styles.sectionNumber}>{String(index + 1).padStart(2, '0')}</Text>
          <Text style={styles.sectionTitle}>{label}</Text>
          <Text style={styles.sectionCategory}>{category}</Text>
        </View>
        <Pressable
          onPress={onViewAll}
          style={({ hovered }: { hovered?: boolean }) =>
            [styles.viewAllBtn, hovered && (styles.viewAllBtnHover as object)] as object
          }
        >
          <Text style={styles.viewAllText}>Search all →</Text>
        </Pressable>
      </View>
      <View style={styles.sectionRule} />
    </>
  );
}

// ── Discover skeleton ─────────────────────────────────────────────────────────
function DiscoverSkeleton() {
  const opacity = useSkeletonAnim();
  return (
    <ScrollView style={sk.scroll} contentContainerStyle={sk.content}>
      <View style={sk.section}>
        <View style={sk.sectionHeader}>
          <View style={{ gap: 6 } as object}>
            <SkeletonBlock opacity={opacity} width={28} height={10} borderRadius={3} />
            <SkeletonBlock opacity={opacity} width={140} height={32} borderRadius={6} />
            <SkeletonBlock opacity={opacity} width={80} height={10} borderRadius={3} />
          </View>
          <SkeletonBlock opacity={opacity} width={60} height={12} borderRadius={3} />
        </View>
        <View style={sk.rule} />
        <View style={{ flexDirection: 'row', gap: 14, height: 460 } as object}>
          <SkeletonBlock opacity={opacity} width={380} height={460} borderRadius={12} style={{ flexShrink: 0 }} />
          <View style={popularRightGrid as object}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} opacity={opacity} height={223} borderRadius={12} />
            ))}
          </View>
        </View>
      </View>
      {[{ cols: 5, height: 190 }, { cols: 3, height: 260 }].map((conf, si) => (
        <View key={si} style={sk.section}>
          <View style={sk.sectionHeader}>
            <View style={{ gap: 6 } as object}>
              <SkeletonBlock opacity={opacity} width={28} height={10} borderRadius={3} />
              <SkeletonBlock opacity={opacity} width={110} height={32} borderRadius={6} />
              <SkeletonBlock opacity={opacity} width={90} height={10} borderRadius={3} />
            </View>
            <SkeletonBlock opacity={opacity} width={60} height={12} borderRadius={3} />
          </View>
          <View style={sk.rule} />
          <View
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${conf.cols}, 1fr)`,
              gridAutoRows: `${conf.height}px`,
              gap: 14,
            } as object}
          >
            {Array.from({ length: conf.cols }).map((_, i) => (
              <SkeletonBlock key={i} opacity={opacity} height={conf.height} borderRadius={12} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const sk = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 80,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  section: { marginBottom: 72 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  rule: { height: 1, backgroundColor: COLORS.navy, opacity: 0.12, marginBottom: 20 },
});

// ── Search grid skeleton ──────────────────────────────────────────────────────
function GridSkeleton() {
  const opacity = useSkeletonAnim();
  return (
    <View style={styles.scrollContent}>
      <View style={resultsGrid as object}>
        {Array.from({ length: 30 }).map((_, i) => (
          <SkeletonBlock key={i} opacity={opacity} height={220} borderRadius={10} />
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
export default function WebExploreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const inputRef = useRef<TextInput>(null);

  // Search state from context (shared with TopNav on desktop)
  const { query, setQuery, publisher, setPublisher } = useSearch();

  // Discover data
  const [categories, setCategories] = useState<HeroesByCategory | null>(null);

  // Search data — loaded once, filtered client-side
  const [allHeroes, setAllHeroes] = useState<HeroSearchResult[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  const isSearchActive = query.trim() !== '' || publisher !== 'All';

  // Load both in parallel on mount
  useEffect(() => {
    getHeroesByCategory().then(setCategories).catch(() => {});
    searchHeroes('', 'All', 600)
      .then(setAllHeroes)
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }, []);

  // Client-side filter + rank — instant, no network on keystroke
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

  const countLabel = (() => {
    if (!isSearchActive) return loadingAll ? '' : `${allHeroes.length} heroes`;
    if (loadingAll) return '—';
    return hasMore
      ? `Showing ${DISPLAY_LIMIT} of ${filtered.length}`
      : `${filtered.length} hero${filtered.length !== 1 ? 'es' : ''}`;
  })();

  const handleClear = useCallback(() => {
    setQuery('');
    setPublisher('All');
  }, []);

  const focusSearch = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <View style={styles.root}>

      {/* ── Command bar ───────────────────────────────────────────────────────── */}
      {/* Desktop: pills + count only (search lives in TopNav) */}
      {/* Mobile: full search input + pills */}
      <View style={[styles.commandBar, isDesktop && (styles.commandBarDesktop as object)] as object}>
        <View style={styles.commandInner}>

          {/* Mobile search row */}
          {!isDesktop && (
            <View style={styles.inputRow as object}>
              <View style={styles.underlineWrap as object}>
                <TextInput
                  ref={inputRef}
                  style={styles.inputMobile as object}
                  placeholder="Search heroes…"
                  placeholderTextColor="rgba(245,235,220,0.28)"
                  value={query}
                  onChangeText={setQuery}
                />
                {query.length > 0 ? (
                  <Pressable
                    onPress={() => setQuery('')}
                    style={({ hovered }: { hovered?: boolean }) =>
                      [styles.clearBtn, hovered && (styles.clearBtnHover as object)] as object
                    }
                  >
                    <Text style={styles.clearX as object}>×</Text>
                  </Pressable>
                ) : null}
              </View>
              {loadingAll ? (
                <ActivityIndicator size="small" color={COLORS.orange} />
              ) : (
                <Text style={styles.countBadge as object}>{countLabel}</Text>
              )}
            </View>
          )}

          {/* Publisher pills — always visible */}
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
            {isDesktop && (
              loadingAll ? (
                <ActivityIndicator size="small" color={COLORS.orange} />
              ) : (
                <Text style={styles.countBadge as object}>{countLabel}</Text>
              )
            )}
          </View>

        </View>
      </View>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {isSearchActive ? (

        // ── Search / grid mode ──────────────────────────────────────────────
        loadingAll ? (
          <GridSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState query={query} onClear={handleClear} />
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={resultsGrid as object}>
              {displayed.map((item) => (
                <PortraitCard
                  key={item.id}
                  item={item}
                  onPress={() => router.push(`/character/${item.id}`)}
                />
              ))}
            </View>
            {hasMore && (
              <Text style={styles.moreHint}>Refine your search to see more results</Text>
            )}
          </ScrollView>
        )

      ) : (

        // ── Discover / editorial mode ───────────────────────────────────────
        !categories ? (
          <DiscoverSkeleton />
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.discoverContent}>
            {/* 01 Popular — magazine split */}
            {categories.popular.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  index={0}
                  label="Popular"
                  category="Heroes"
                  onViewAll={focusSearch}
                />
                <View style={{ flexDirection: 'row', gap: 14, height: 460 } as object}>
                  <FeaturedHeroPanel
                    hero={categories.popular[0]}
                    onPress={() => router.push(`/character/${categories.popular[0].id}`)}
                  />
                  <View style={popularRightGrid as object}>
                    {categories.popular.slice(1, 5).map((hero) => (
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
              </View>
            )}

            {/* 02 Villains — 5-col compact grid */}
            {categories.villain.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  index={1}
                  label="Villains"
                  category="Rogues Gallery"
                  onViewAll={focusSearch}
                />
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

            {/* 03 X-Men — 3-col tall grid */}
            {categories.xmen.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  index={2}
                  label="X-Men"
                  category="Mutants"
                  onViewAll={focusSearch}
                />
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
          </ScrollView>
        )

      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flex: 1 },

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
  commandBarDesktop: {
    paddingTop: 10,
    paddingBottom: 10,
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
  },
  countBadge: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.3)',
    letterSpacing: 0.5,
    flexShrink: 0,
    minWidth: 100,
    textAlign: 'right',
  },
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
  pillActive: { backgroundColor: COLORS.orange, borderColor: COLORS.orange } as object,
  pillHover: { borderColor: 'rgba(245,235,220,0.4)' } as object,
  pillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.38)',
    letterSpacing: 0.4,
  },
  pillTextActive: { color: 'white' },

  // ── Discover editorial layout ────────────────────────────────────────────────
  discoverContent: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 80,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  section: { marginBottom: 72 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  sectionTitleGroup: { gap: 3 },
  sectionNumber: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 2,
  },
  sectionTitle: { fontFamily: 'Flame-Regular', fontSize: 38, color: COLORS.navy, lineHeight: 40 },
  sectionCategory: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  viewAllBtn: { paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  viewAllBtnHover: { borderBottomColor: COLORS.navy } as object,
  viewAllText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    opacity: 0.45,
    letterSpacing: 0.5,
  },
  sectionRule: { height: 1, backgroundColor: COLORS.navy, opacity: 0.12, marginBottom: 20 },

  // ── Search grid layout ───────────────────────────────────────────────────────
  scrollContent: {
    padding: 16,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 80,
  },
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
  },
  emptySub: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.grey, textAlign: 'center' },
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
  clearFilterText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
});