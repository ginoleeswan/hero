import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { fetchHeroStats, fetchHeroDetails } from '../../src/lib/api';
import { getHeroById, heroRowToCharacterData } from '../../src/lib/db/heroes';
import { supabase } from '../../src/lib/supabase';
import { isFavourited, addFavourite, removeFavourite } from '../../src/lib/db/favourites';
import { getPowerIcon } from '../../src/constants/powerIcons';
import { useAuth } from '../../src/hooks/useAuth';
import { heroImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import { StatBar } from '../../src/components/web/StatBar';
import { MovieStrip } from '../../src/components/MovieStrip';
import { FirstIssueModal } from '../../src/components/FirstIssueModal';
import type { CharacterData } from '../../src/types';

const STAT_CONFIG = [
  { key: 'intelligence', label: 'Intelligence', color: COLORS.blue },
  { key: 'strength', label: 'Strength', color: COLORS.red },
  { key: 'speed', label: 'Speed', color: COLORS.yellow },
  { key: 'durability', label: 'Durability', color: COLORS.green },
  { key: 'power', label: 'Power', color: COLORS.orange },
  { key: 'combat', label: 'Combat', color: COLORS.brown },
];

const JUNK_VALUES = new Set(['-', 'null', 'none', 'no alter egos found.', 'n/a', 'unknown']);

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '' || JUNK_VALUES.has(value.toLowerCase().trim())) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ExpandableTeamsRow({
  teams,
  fallback,
}: {
  teams: string[] | null | undefined;
  fallback: string | null | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  if (teams?.length) {
    if (teams.length <= 2 || expanded) {
      return <InfoRow label="Affiliations" value={teams.join(', ')} />;
    }
    const remainder = teams.length - 2;
    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Affiliations</Text>
        <Text style={styles.infoValue}>
          {teams.slice(0, 2).join(', ')}{' '}
          <Text onPress={() => setExpanded(true)} style={{ color: COLORS.blue }}>
            +{remainder} more
          </Text>
        </Text>
      </View>
    );
  }
  return <InfoRow label="Affiliations" value={fallback} />;
}

function ExpandableChipGroup({
  label,
  chips,
  chipStyle,
  chipTextStyle,
}: {
  label: string;
  chips: string[];
  chipStyle: object;
  chipTextStyle: object;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? chips : chips.slice(0, 10);
  const remainder = chips.length - 10;
  return (
    <View style={styles.chipGroup}>
      <Text style={styles.chipGroupLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {visible.map((name, i) => (
          <View key={i} style={chipStyle as object}>
            <Text style={chipTextStyle as object}>{name}</Text>
          </View>
        ))}
        {!expanded && remainder > 0 ? (
          <Pressable onPress={() => setExpanded(true)} style={chipStyle as object}>
            <Text style={chipTextStyle as object}>+{remainder} more</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function WebCharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 700;

  const skeletonOpacity = useSkeletonAnim();
  const [data, setData] = useState<CharacterData | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [comicVineLoading, setComicVineLoading] = useState(true);
  const [statsGenerating, setStatsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favourited, setFavourited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'universe'>('overview');

  useEffect(() => {
    if (!id) return;

    const loadFromApi = () => {
      fetchHeroStats(id)
        .then((stats) => {
          setData({
            stats,
            details: {
              summary: null,
              publisher: null,
              firstIssueId: null,
              firstIssueData: null,
              powers: null,
              description: null,
              origin: null,
              issueCount: null,
              creators: null,
              enemies: null,
              friends: null,
              movies: null,
              movieCount: null,
              teams: null,
            },
            firstIssue: null,
          });
          fetchHeroDetails(stats.id, stats.name)
            .then((details) => {
              setData({ stats, details, firstIssue: details.firstIssueData });
            })
            .catch(() => {})
            .finally(() => setComicVineLoading(false));
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'));
    };

    getHeroById(id)
      .then((hero) => {
        if (hero?.enriched_at) {
          setData(heroRowToCharacterData(hero));
          const needsComicVine =
            !hero.comicvine_enriched_at || hero.powers === null || !hero.movies?.length || !hero.first_issue_id || !hero.first_issue_data;
          const moviesIncomplete =
            !needsComicVine &&
            hero.movie_count != null &&
            hero.movies != null &&
            hero.movie_count > (hero.movies as unknown[]).length;
          const moviesLackDetail =
            !needsComicVine &&
            !moviesIncomplete &&
            hero.movies != null &&
            (hero.movies as unknown[]).length > 0 &&
            (hero.movies as Array<{ deck?: string | null; rating?: string | null; runtime?: string | null }>)
              .slice(0, 5)
              .every((m) => m.deck === null && m.rating === null && m.runtime === null);
          setComicVineLoading(needsComicVine);
          if (needsComicVine || moviesIncomplete || moviesLackDetail) {
            fetchHeroDetails(hero.id, hero.name)
              .then((details) => {
                setData((prev) =>
                  prev ? { ...prev, details, firstIssue: details.firstIssueData ?? prev.firstIssue } : prev,
                );
              })
              .catch(() => {})
              .finally(() => { if (needsComicVine) setComicVineLoading(false); });
          }

          // Lazy AI stat generation for CV characters with no stats yet
          if (hero.intelligence === null && hero.ai_stats_status === 'pending') {
            setStatsGenerating(true);
            supabase.functions
              .invoke<Record<string, number>>('generate-hero-stats', { body: { heroId: hero.id } })
              .then(({ data: stats }) => {
                if (stats && typeof stats.intelligence === 'number') {
                  setData((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      statsSource: 'ai',
                      stats: {
                        ...prev.stats,
                        powerstats: {
                          intelligence: String(stats.intelligence),
                          strength: String(stats.strength),
                          speed: String(stats.speed),
                          durability: String(stats.durability),
                          power: String(stats.power),
                          combat: String(stats.combat),
                        },
                      },
                    };
                  });
                }
              })
              .catch(() => {})
              .finally(() => setStatsGenerating(false));
          }
          return;
        }
        loadFromApi();
      })
      .catch(loadFromApi);
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    isFavourited(user.id, id)
      .then(setFavourited)
      .catch(() => {});
  }, [user, id]);

  const toggleFavourite = useCallback(async () => {
    if (!user || !id || favLoading) return;
    setFavLoading(true);
    const next = !favourited;
    setFavourited(next);
    try {
      await (next ? addFavourite(user.id, id) : removeFavourite(user.id, id));
    } catch {
      setFavourited(!next);
    } finally {
      setFavLoading(false);
    }
  }, [user, id, favourited, favLoading]);

  const heroImage = id ? heroImageSource(id, data?.stats.image.url ?? null) : null;

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data) {
    return <CharacterSkeleton isDesktop={isDesktop} />;
  }

  const { stats, details } = data;

  const alias =
    stats.biography['full-name'] &&
    stats.biography['full-name'] !== stats.name &&
    stats.biography['full-name'] !== '-'
      ? stats.biography['full-name']
      : null;

  const alignmentColor = (() => {
    const a = (stats.biography.alignment ?? '').toLowerCase();
    if (a === 'good') return COLORS.blue;
    if (a === 'bad') return COLORS.red;
    return COLORS.orange;
  })();

  const statValues = STAT_CONFIG.map(({ key }) =>
    parseInt((stats.powerstats as Record<string, string>)[key] ?? '0', 10),
  ).filter((n) => !isNaN(n) && n > 0);
  const powerScore =
    statValues.length > 0
      ? Math.round(statValues.reduce((a, b) => a + b, 0) / statValues.length)
      : null;

  return (
    <>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* ── Identity header — navy strip, no image ── */}
      <View
        style={[
          styles.identityHeader,
          {
            borderBottomWidth: 3,
            borderBottomColor: alignmentColor,
            paddingBottom: isDesktop ? 24 : 14,
          },
        ]}
      >
        {/* Subtle alignment-based tint — gives each character a distinct mood */}
        <View
          style={[styles.headerAlignmentOverlay, { backgroundColor: alignmentColor }]}
          pointerEvents="none"
        />
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={15} color={COLORS.beige} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.headerActions}>
            {user && (
              <Pressable onPress={toggleFavourite} disabled={favLoading} style={styles.favBtn}>
                <Ionicons
                  name={favourited ? 'heart' : 'heart-outline'}
                  size={20}
                  color={favourited ? COLORS.red : 'rgba(245,235,220,0.6)'}
                />
              </Pressable>
            )}
            {powerScore !== null || statsGenerating ? (
              <Pressable
                onPress={() =>
                  !statsGenerating &&
                  router.push(`/compare/${id}/pick?name=${encodeURIComponent(stats.name)}`)
                }
                style={({ hovered }: { hovered?: boolean }) =>
                  [
                    styles.compareBtn,
                    hovered && !statsGenerating && (styles.compareBtnHover as object),
                    statsGenerating && { opacity: 0.5 },
                  ] as object
                }
              >
                <Ionicons name="git-compare-outline" size={15} color={COLORS.beige} />
                <Text style={styles.compareBtnText}>Compare</Text>
              </Pressable>
            ) : (
              <View style={[styles.compareBtn, { opacity: 0.4 }]}>
                <Ionicons name="git-compare-outline" size={15} color={COLORS.beige} />
                <Text style={styles.compareBtnText}>No stats</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.heroIdentity}>
          <Text style={[styles.heroName, { fontSize: isDesktop ? 52 : 30 }]}>{stats.name}</Text>
          {alias ? <Text style={styles.heroAlias}>{alias}</Text> : null}
        </View>

        {/* Publisher + meta — bottom-right corner */}
        {stats.biography.publisher || isDesktop ? (
          <View style={styles.publisherCorner}>
            {stats.biography.publisher ? (
              <Text style={styles.heroPublisher}>{stats.biography.publisher}</Text>
            ) : null}
            {isDesktop ? (
              comicVineLoading ? (
                <SkeletonBlock
                  opacity={skeletonOpacity}
                  width={140}
                  height={10}
                  borderRadius={4}
                  dark
                  style={{ marginTop: 6 }}
                />
              ) : (details.issueCount ?? 0) > 0 || (details.creators?.length ?? 0) > 0 ? (
                <Text style={styles.heroMetaRight}>
                  {[
                    (details.issueCount ?? 0) > 0
                      ? `Featured in ${details.issueCount!.toLocaleString()} issues`
                      : null,
                    details.creators?.length ? `Created by ${details.creators.join(' & ')}` : null,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </Text>
              ) : null
            ) : null}
          </View>
        ) : null}
      </View>

      {/* ── Body ── */}
      {isDesktop ? (
        <View style={styles.bodyDesktop}>
          {/* Left column: portrait + power stats */}
          <View style={styles.leftCol}>
            <View style={styles.portraitCard}>
              {heroImage ? (
                <Image
                  source={heroImage}
                  style={
                    {
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center top',
                    } as object
                  }
                  cachePolicy="memory-disk"
                  recyclingKey={id}
                  transition={typeof heroImage === 'object' && 'uri' in heroImage ? 200 : null}
                />
              ) : (
                <View style={styles.portraitPlaceholder} />
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.statCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Power Stats</Text>
                  {data.statsSource === 'ai' ? (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  ) : null}
                </View>
                {powerScore !== null ? (
                  <View style={[styles.powerScorePill, { backgroundColor: alignmentColor + '22' }]}>
                    <Text style={[styles.powerScoreValue, { color: alignmentColor }]}>
                      {powerScore}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardDivider} />
              {statsGenerating
                ? STAT_CONFIG.map(({ key }) => (
                    <SkeletonBlock
                      key={key}
                      opacity={skeletonOpacity}
                      height={10}
                      borderRadius={5}
                      style={{ marginBottom: 14 }}
                    />
                  ))
                : STAT_CONFIG.map(({ key, label, color }) => (
                    <StatBar
                      key={key}
                      label={label}
                      value={(stats.powerstats as Record<string, string>)[key] ?? '0'}
                      color={color}
                    />
                  ))}
            </View>
          </View>

          {/* Right column: tabbed */}
          <View style={styles.rightCol}>
            {/* Segmented tab bar */}
            <View style={styles.tabBar}>
              {(['overview', 'details', 'universe'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={
                    [styles.tabBtn, activeTab === tab && (styles.tabBtnActive as object)] as object
                  }
                >
                  <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                    {tab === 'overview' ? 'Overview' : tab === 'details' ? 'Details' : 'Universe'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Overview: summary + abilities + first appearance */}
            {activeTab === 'overview' && (
              <View style={styles.tabContent}>
                {comicVineLoading && !details.summary ? (
                  <View style={styles.summaryBox}>
                    <SkeletonBlock
                      opacity={skeletonOpacity}
                      height={12}
                      style={{ marginBottom: 10 }}
                    />
                    <SkeletonBlock
                      opacity={skeletonOpacity}
                      height={12}
                      width="85%"
                      style={{ marginBottom: 10 }}
                    />
                    <SkeletonBlock opacity={skeletonOpacity} height={12} width="65%" />
                  </View>
                ) : details.summary || details.description ? (
                  <View style={styles.summaryBox}>
                    {details.summary ? (
                      <Text style={styles.summaryText}>{details.summary}</Text>
                    ) : null}
                    {details.description ? (
                      <Pressable
                        onPress={() => router.push(`/biography/${id}`)}
                        style={({ hovered }: { hovered?: boolean }) =>
                          [
                            styles.biographyLink,
                            hovered && (styles.biographyLinkHover as object),
                          ] as object
                        }
                      >
                        <Text style={styles.biographyLinkText}>Read biography</Text>
                        <Ionicons name="chevron-forward" size={13} color={COLORS.orange} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                <WebAbilitiesCard
                  powers={details.powers}
                  loading={comicVineLoading}
                  skeletonOpacity={skeletonOpacity}
                />

                {comicVineLoading ? (
                  <View style={styles.card}>
                    <View style={styles.firstAppearanceRow}>
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        width={130}
                        height={190}
                        borderRadius={8}
                      />
                      <View style={{ flex: 1, gap: 10 }}>
                        <SkeletonBlock
                          opacity={skeletonOpacity}
                          width="40%"
                          height={10}
                          borderRadius={4}
                        />
                        <SkeletonBlock
                          opacity={skeletonOpacity}
                          width={80}
                          height={2}
                          borderRadius={1}
                        />
                        <SkeletonBlock
                          opacity={skeletonOpacity}
                          width="55%"
                          height={36}
                          borderRadius={5}
                        />
                        <SkeletonBlock
                          opacity={skeletonOpacity}
                          width="80%"
                          height={12}
                          borderRadius={4}
                        />
                      </View>
                    </View>
                  </View>
                ) : data.firstIssue?.imageUrl ? (
                  <Pressable onPress={() => setShowIssueModal(true)}>
                    <View style={[styles.card, styles.firstAppearanceDesktopCard]}>
                      <View style={styles.firstAppearanceRow}>
                        <img
                          src={data.firstIssue.imageUrl}
                          style={{
                            width: 130,
                            height: 190,
                            objectFit: 'cover',
                            borderRadius: 8,
                            flexShrink: 0,
                            display: 'block',
                            boxShadow: '0 6px 20px rgba(41,60,67,0.22)',
                          }}
                        />
                        <View style={styles.firstAppearanceMeta}>
                          <Text style={styles.firstAppearanceLabel}>First Appearance</Text>
                          <View style={styles.firstAppearanceDivider} />
                          {data.firstIssue.coverDate ? (
                            <Text style={styles.firstAppearanceYear}>
                              {data.firstIssue.coverDate.slice(0, 4)}
                            </Text>
                          ) : null}
                          {data.firstIssue.name ? (
                            <Text style={styles.firstAppearanceName}>{data.firstIssue.name}</Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            )}

            {/* Details: 3-col biographical grid */}
            {activeTab === 'details' && (
              <View style={styles.infoGridDesktop as object}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Overview</Text>
                  <View style={styles.cardDivider} />
                  <InfoRow label="Full name" value={stats.biography['full-name']} />
                  <InfoRow label="Alter egos" value={stats.biography['alter-egos']} />
                  <InfoRow label="Place of birth" value={stats.biography['place-of-birth']} />
                  <InfoRow label="Origin" value={details.origin} />
                  <InfoRow label="Alignment" value={stats.biography.alignment} />
                  {stats.biography.aliases.filter((a) => a && a !== '-').length > 0 && (
                    <InfoRow label="Aliases" value={stats.biography.aliases.join(', ')} />
                  )}
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Appearance</Text>
                  <View style={styles.cardDivider} />
                  <InfoRow label="Gender" value={stats.appearance.gender} />
                  <InfoRow label="Race" value={stats.appearance.race} />
                  <InfoRow label="Height" value={stats.appearance.height.join(' / ')} />
                  <InfoRow label="Weight" value={stats.appearance.weight.join(' / ')} />
                  <InfoRow label="Eyes" value={stats.appearance['eye-color']} />
                  <InfoRow label="Hair" value={stats.appearance['hair-color']} />
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Work &amp; Connections</Text>
                  <View style={styles.cardDivider} />
                  <InfoRow label="Occupation" value={stats.work.occupation} />
                  <InfoRow label="Base" value={stats.work.base} />
                  <InfoRow label="Relatives" value={stats.connections.relatives} />
                  <ExpandableTeamsRow
                    teams={details.teams}
                    fallback={stats.connections['group-affiliation']}
                  />
                </View>
              </View>
            )}

            {/* Universe: enemies + movies */}
            {activeTab === 'universe' && (
              <View style={styles.tabContent}>
                {comicVineLoading ? (
                  <View style={styles.card}>
                    <SkeletonBlock
                      opacity={skeletonOpacity}
                      width="45%"
                      height={11}
                      borderRadius={4}
                      style={{ marginBottom: 10 }}
                    />
                    <View style={styles.cardDivider} />
                    <SkeletonBlock
                      opacity={skeletonOpacity}
                      width="25%"
                      height={10}
                      borderRadius={4}
                      style={{ marginBottom: 8 }}
                    />
                    <View style={styles.chipRow}>
                      {[72, 90, 60, 80, 68].map((w, i) => (
                        <SkeletonBlock
                          key={i}
                          opacity={skeletonOpacity}
                          width={w}
                          height={26}
                          borderRadius={20}
                        />
                      ))}
                    </View>
                  </View>
                ) : details.enemies?.length || details.friends?.length ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Enemies &amp; Allies</Text>
                    <View style={styles.cardDivider} />
                    {details.enemies?.length ? (
                      <ExpandableChipGroup
                        label="Enemies"
                        chips={details.enemies}
                        chipStyle={styles.chipEnemy}
                        chipTextStyle={styles.chipTextEnemy}
                      />
                    ) : null}
                    {details.friends?.length ? (
                      <ExpandableChipGroup
                        label="Allies"
                        chips={details.friends}
                        chipStyle={styles.chipAlly}
                        chipTextStyle={styles.chipTextAlly}
                      />
                    ) : null}
                  </View>
                ) : null}

                {comicVineLoading ? (
                  <View style={styles.card}>
                    <SkeletonBlock
                      opacity={skeletonOpacity}
                      width="30%"
                      height={11}
                      borderRadius={4}
                      style={{ marginBottom: 10 }}
                    />
                    <View style={styles.cardDivider} />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {[0, 1, 2].map((i) => (
                        <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                          <SkeletonBlock
                            opacity={skeletonOpacity}
                            width={80}
                            height={120}
                            borderRadius={8}
                          />
                          <SkeletonBlock
                            opacity={skeletonOpacity}
                            width={60}
                            height={10}
                            borderRadius={4}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ) : details.movies?.length ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>On Screen ({details.movieCount ?? details.movies.length})</Text>
                    <View style={styles.cardDivider} />
                    <MovieStrip
                      movies={details.movies}
                      totalCount={details.movieCount ?? details.movies.length}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>
      ) : (
        /* ── Mobile: stacked with tabs ── */
        <View style={styles.body}>
          <View style={styles.portraitCardMobile}>
            {heroImage ? (
              <Image
                source={heroImage}
                style={
                  {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center top',
                  } as object
                }
                cachePolicy="memory-disk"
                recyclingKey={id}
                transition={typeof heroImage === 'object' && 'uri' in heroImage ? 200 : null}
              />
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.statCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Power Stats</Text>
                {data.statsSource === 'ai' ? (
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                ) : null}
              </View>
              {powerScore !== null ? (
                <View style={[styles.powerScorePill, { backgroundColor: alignmentColor + '22' }]}>
                  <Text style={[styles.powerScoreValue, { color: alignmentColor }]}>
                    {powerScore}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardDivider} />
            {statsGenerating
              ? STAT_CONFIG.map(({ key }) => (
                  <SkeletonBlock
                    key={key}
                    opacity={skeletonOpacity}
                    height={10}
                    borderRadius={5}
                    style={{ marginBottom: 14 }}
                  />
                ))
              : STAT_CONFIG.map(({ key, label, color }) => (
                  <StatBar
                    key={key}
                    label={label}
                    value={(stats.powerstats as Record<string, string>)[key] ?? '0'}
                    color={color}
                  />
                ))}
          </View>

          {/* Segmented tab bar */}
          <View style={styles.tabBar}>
            {(['overview', 'details', 'universe'] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={
                  [styles.tabBtn, activeTab === tab && (styles.tabBtnActive as object)] as object
                }
              >
                <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                  {tab === 'overview' ? 'Overview' : tab === 'details' ? 'Details' : 'Universe'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Overview tab: summary + abilities + first appearance */}
          {activeTab === 'overview' && (
            <>
              {comicVineLoading && !details.summary ? (
                <View style={styles.summaryBox}>
                  <SkeletonBlock
                    opacity={skeletonOpacity}
                    height={12}
                    style={{ marginBottom: 10 }}
                  />
                  <SkeletonBlock
                    opacity={skeletonOpacity}
                    height={12}
                    width="85%"
                    style={{ marginBottom: 10 }}
                  />
                  <SkeletonBlock opacity={skeletonOpacity} height={12} width="65%" />
                </View>
              ) : details.summary || details.description ? (
                <View style={styles.summaryBox}>
                  {details.summary ? (
                    <Text style={styles.summaryText}>{details.summary}</Text>
                  ) : null}
                  {details.description ? (
                    <Pressable
                      onPress={() => router.push(`/biography/${id}`)}
                      style={({ hovered }: { hovered?: boolean }) =>
                        [
                          styles.biographyLink,
                          hovered && (styles.biographyLinkHover as object),
                        ] as object
                      }
                    >
                      <Text style={styles.biographyLinkText}>Read biography</Text>
                      <Ionicons name="chevron-forward" size={13} color={COLORS.orange} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <WebAbilitiesCard
                powers={details.powers}
                loading={comicVineLoading}
                skeletonOpacity={skeletonOpacity}
              />

              {comicVineLoading ? (
                <View style={styles.card}>
                  <SkeletonBlock
                    opacity={skeletonOpacity}
                    width="40%"
                    height={11}
                    borderRadius={4}
                    style={{ marginBottom: 10 }}
                  />
                  <View style={styles.cardDivider} />
                  <View style={styles.firstIssueRow}>
                    <SkeletonBlock
                      opacity={skeletonOpacity}
                      width={80}
                      height={120}
                      borderRadius={6}
                    />
                    <View style={{ flex: 1, gap: 8, justifyContent: 'flex-end' as const }}>
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        width="80%"
                        height={13}
                        borderRadius={4}
                      />
                      <SkeletonBlock
                        opacity={skeletonOpacity}
                        width="30%"
                        height={11}
                        borderRadius={4}
                      />
                    </View>
                  </View>
                </View>
              ) : data.firstIssue?.imageUrl ? (
                <Pressable onPress={() => setShowIssueModal(true)}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>First Appearance</Text>
                    <View style={styles.cardDivider} />
                    <View style={styles.firstIssueRow}>
                      <Image
                        source={{ uri: data.firstIssue.imageUrl }}
                        style={styles.firstIssueCover as object}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                      <View style={styles.firstIssueMeta}>
                        {data.firstIssue.name ? (
                          <Text style={styles.firstIssueTitle}>{data.firstIssue.name}</Text>
                        ) : null}
                        {data.firstIssue.coverDate ? (
                          <Text style={styles.firstIssueYear}>
                            {data.firstIssue.coverDate.slice(0, 4)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Pressable>
              ) : null}
            </>
          )}

          {/* Details tab: biographical info */}
          {activeTab === 'details' && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Overview</Text>
                <View style={styles.cardDivider} />
                <InfoRow label="Full name" value={stats.biography['full-name']} />
                <InfoRow label="Alter egos" value={stats.biography['alter-egos']} />
                <InfoRow label="Place of birth" value={stats.biography['place-of-birth']} />
                <InfoRow label="First appearance" value={stats.biography['first-appearance']} />
                <InfoRow label="Origin" value={details.origin} />
                <InfoRow label="Alignment" value={stats.biography.alignment} />
                {stats.biography.aliases.filter((a) => a && a !== '-').length > 0 && (
                  <InfoRow label="Aliases" value={stats.biography.aliases.join(', ')} />
                )}
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Appearance</Text>
                <View style={styles.cardDivider} />
                <InfoRow label="Gender" value={stats.appearance.gender} />
                <InfoRow label="Race" value={stats.appearance.race} />
                <InfoRow label="Height" value={stats.appearance.height.join(' / ')} />
                <InfoRow label="Weight" value={stats.appearance.weight.join(' / ')} />
                <InfoRow label="Eyes" value={stats.appearance['eye-color']} />
                <InfoRow label="Hair" value={stats.appearance['hair-color']} />
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Work &amp; Connections</Text>
                <View style={styles.cardDivider} />
                <InfoRow label="Occupation" value={stats.work.occupation} />
                <InfoRow label="Base" value={stats.work.base} />
                <InfoRow
                  label="Group affiliation"
                  value={
                    details.teams?.length
                      ? details.teams.join(', ')
                      : stats.connections['group-affiliation']
                  }
                />
                <InfoRow label="Relatives" value={stats.connections.relatives} />
              </View>
            </>
          )}

          {/* Universe tab: enemies + movies */}
          {activeTab === 'universe' && (
            <>
              {comicVineLoading ? (
                <View style={styles.card}>
                  <SkeletonBlock
                    opacity={skeletonOpacity}
                    width="45%"
                    height={11}
                    borderRadius={4}
                    style={{ marginBottom: 10 }}
                  />
                  <View style={styles.cardDivider} />
                  <SkeletonBlock
                    opacity={skeletonOpacity}
                    width="25%"
                    height={10}
                    borderRadius={4}
                    style={{ marginBottom: 8 }}
                  />
                  <View style={styles.chipRow}>
                    {[72, 90, 60, 80, 68].map((w, i) => (
                      <SkeletonBlock
                        key={i}
                        opacity={skeletonOpacity}
                        width={w}
                        height={26}
                        borderRadius={20}
                      />
                    ))}
                  </View>
                </View>
              ) : details.enemies?.length || details.friends?.length ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Enemies &amp; Allies</Text>
                  <View style={styles.cardDivider} />
                  {details.enemies?.length ? (
                    <ExpandableChipGroup
                      label="Enemies"
                      chips={details.enemies}
                      chipStyle={styles.chipEnemy}
                      chipTextStyle={styles.chipTextEnemy}
                    />
                  ) : null}
                  {details.friends?.length ? (
                    <ExpandableChipGroup
                      label="Allies"
                      chips={details.friends}
                      chipStyle={styles.chipAlly}
                      chipTextStyle={styles.chipTextAlly}
                    />
                  ) : null}
                </View>
              ) : null}

              {comicVineLoading ? (
                <View style={styles.card}>
                  <SkeletonBlock
                    opacity={skeletonOpacity}
                    width="30%"
                    height={11}
                    borderRadius={4}
                    style={{ marginBottom: 10 }}
                  />
                  <View style={styles.cardDivider} />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                        <SkeletonBlock
                          opacity={skeletonOpacity}
                          width={80}
                          height={120}
                          borderRadius={8}
                        />
                        <SkeletonBlock
                          opacity={skeletonOpacity}
                          width={60}
                          height={10}
                          borderRadius={4}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ) : details.movies?.length ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>On Screen ({details.movieCount ?? details.movies.length})</Text>
                  <View style={styles.cardDivider} />
                  <MovieStrip
                    movies={details.movies}
                    totalCount={details.movieCount ?? details.movies.length}
                  />
                </View>
              ) : null}
            </>
          )}
        </View>
      )}
    </ScrollView>
    {showIssueModal && data?.firstIssue ? (
      <FirstIssueModal
        firstIssue={data.firstIssue}
        onClose={() => setShowIssueModal(false)}
      />
    ) : null}
    </>
  );
}

const ABILITIES_COLLAPSED = 12;

// ── Web abilities card ───────────────────────────────────────────────────────
function WebAbilitiesCard({
  powers,
  loading,
  skeletonOpacity,
}: {
  powers: string[] | null;
  loading: boolean;
  skeletonOpacity: ReturnType<typeof useSkeletonAnim>;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!loading && (!powers || powers.length === 0)) return null;

  const visible = powers ? (expanded ? powers : powers.slice(0, ABILITIES_COLLAPSED)) : [];
  const overflow = powers ? Math.max(0, powers.length - ABILITIES_COLLAPSED) : 0;

  return (
    <View style={styles.card}>
      {loading && !powers ? (
        <>
          <SkeletonBlock
            opacity={skeletonOpacity}
            width={80}
            height={11}
            style={{ marginBottom: 10 }}
          />
          <View style={{ height: 1, backgroundColor: '#ede5da', marginBottom: 14 }} />
          <View style={styles.powerTagRow}>
            {[90, 70, 110, 80, 95, 75, 100, 85].map((w, i) => (
              <SkeletonBlock
                key={i}
                opacity={skeletonOpacity}
                width={w}
                height={28}
                borderRadius={14}
              />
            ))}
          </View>
        </>
      ) : powers && powers.length > 0 ? (
        <>
          <Text style={styles.cardTitle}>Abilities</Text>
          <View style={styles.cardDivider} />
          <View style={styles.powerTagRow}>
            {visible.map((power, i) => {
              const { icon, gradientEnd } = getPowerIcon(power);
              return (
                <View key={i} style={[styles.powerTag, { borderColor: gradientEnd + '40' }]}>
                  <Ionicons name={icon as any} size={12} color={gradientEnd} />
                  <Text style={styles.powerTagText}>{power}</Text>
                </View>
              );
            })}
            {!expanded && overflow > 0 && (
              <Pressable onPress={() => setExpanded(true)} style={styles.powerTagMore}>
                <Text style={styles.powerTagMoreText}>+{overflow} more</Text>
              </Pressable>
            )}
          </View>
          {expanded && (
            <Pressable onPress={() => setExpanded(false)} style={styles.showLess}>
              <Text style={styles.showLessText}>Show less</Text>
            </Pressable>
          )}
        </>
      ) : null}
    </View>
  );
}

// ── Character page skeleton ──────────────────────────────────────────────────
function CharacterSkeleton({ isDesktop }: { isDesktop: boolean }) {
  const opacity = useSkeletonAnim();
  const statRows = [0, 1, 2, 3, 4, 5];
  const infoRows = [0, 1, 2, 3];

  const cardDivider = <View style={{ height: 1, backgroundColor: '#ede5da', marginBottom: 14 }} />;

  const statsCard = (
    <View style={sk.card}>
      <SkeletonBlock opacity={opacity} width={90} height={11} style={{ marginBottom: 10 }} />
      {cardDivider}
      {statRows.map((i) => (
        <View key={i} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <SkeletonBlock opacity={opacity} width={80} height={11} />
            <SkeletonBlock opacity={opacity} width={22} height={16} borderRadius={4} />
          </View>
          <SkeletonBlock opacity={opacity} height={8} borderRadius={4} />
        </View>
      ))}
    </View>
  );

  const infoCard = (rows: number) => (
    <View style={sk.card}>
      <SkeletonBlock opacity={opacity} width={70} height={11} style={{ marginBottom: 10 }} />
      {cardDivider}
      {Array.from({ length: rows }).map((_, j) => (
        <View
          key={j}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 7,
            borderBottomWidth: 1,
            borderBottomColor: '#f5f0ea',
          }}
        >
          <SkeletonBlock opacity={opacity} width={70} height={12} />
          <SkeletonBlock opacity={opacity} width={110} height={12} />
        </View>
      ))}
    </View>
  );

  return (
    <ScrollView style={sk.scroll} contentContainerStyle={sk.content}>
      {/* Identity header */}
      <View style={sk.identityHeader}>
        <View style={sk.headerTopRow}>
          <SkeletonBlock opacity={opacity} width={80} height={30} borderRadius={20} dark />
          <SkeletonBlock opacity={opacity} width={36} height={36} borderRadius={20} dark />
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          <SkeletonBlock
            opacity={opacity}
            width={isDesktop ? 320 : 200}
            height={isDesktop ? 52 : 36}
            style={{ marginBottom: 10 }}
            dark
          />
          <SkeletonBlock opacity={opacity} width={140} height={14} borderRadius={4} dark />
        </View>
        <View style={{ position: 'absolute', bottom: 20, right: 20 }}>
          <SkeletonBlock opacity={opacity} width={56} height={24} borderRadius={3} dark />
        </View>
      </View>

      {isDesktop ? (
        <View style={sk.bodyDesktop}>
          <View style={sk.leftCol}>
            <View style={sk.portraitCard} />
            {statsCard}
          </View>
          <View style={sk.rightCol}>
            <View style={sk.infoGridDesktop as object}>
              {[5, 5, 3, 3].map((rows, i) => (
                <View key={i}>{infoCard(rows)}</View>
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={sk.body}>
          <View style={sk.portraitCardMobile} />
          {statsCard}
          {infoRows.map((i) => (
            <View key={i}>{infoCard(i < 2 ? 5 : 3)}</View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const sk = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: { maxWidth: 1060, alignSelf: 'center', width: '100%', paddingBottom: 60 },
  identityHeader: { backgroundColor: COLORS.navy, paddingBottom: 24, position: 'relative' },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bodyDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: 20, padding: 24 },
  leftCol: { width: 260, flexShrink: 0, gap: 12 },
  rightCol: { flex: 1, gap: 16 },
  body: { padding: 16, gap: 14 },
  portraitCard: {
    width: '100%',
    height: 380,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ddd5c8',
  },
  portraitCardMobile: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ddd5c8',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
  },
  infoGridDesktop: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },

  // First Appearance — left column cinematic cover
  firstAppearanceCard: { gap: 8 },
  firstAppearanceLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    opacity: 0.45,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.4,
  },
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: { maxWidth: 1060, alignSelf: 'center', width: '100%', paddingBottom: 60 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.beige,
  },
  errorText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.red },

  // ── Identity header ──────────────────────────────────────────────────────────
  identityHeader: {
    backgroundColor: COLORS.navy,
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  headerAlignmentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.07,
  },
  publisherCorner: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'flex-end',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  backText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.beige },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 9,
    borderRadius: 20,
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    cursor: 'pointer',
  } as object,
  compareBtnHover: {
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderColor: 'rgba(245,235,220,0.3)',
  } as object,
  compareBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.75)',
  },
  heroIdentity: {
    paddingHorizontal: 24,
  },
  heroPublisher: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroMetaRight: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: 'rgba(245,235,220,0.4)',
    textAlign: 'right',
    marginTop: 5,
    lineHeight: 15,
  },
  heroName: {
    fontFamily: 'Flame-Regular',
    color: COLORS.beige,
    marginBottom: 6,
  },
  heroAlias: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.45)',
  },
  biographyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingTop: 10,
  },
  biographyLinkHover: { opacity: 0.7 },
  biographyLinkText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.orange,
  },

  // ── Desktop two-column body ──────────────────────────────────────────────────
  bodyDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
    padding: 24,
  },
  leftCol: {
    width: 260,
    flexShrink: 0,
    gap: 12,
  },
  rightCol: {
    flex: 1,
    gap: 16,
  },

  // Portrait card — tall enough to display a full portrait image properly
  portraitCard: {
    width: '100%',
    height: 380,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  portraitPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  // Mobile portrait — wider proportion
  portraitCardMobile: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },

  // Mobile single-column
  body: { padding: 16, gap: 14 },

  // Summary
  summaryBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.orange,
  },
  summaryText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.navy,
    lineHeight: 24,
  },

  // Segmented tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 7,
    cursor: 'pointer',
  } as object,
  tabBtnActive: {
    backgroundColor: COLORS.beige,
  } as object,
  tabLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.grey,
  },
  tabLabelActive: {
    color: COLORS.navy,
    fontFamily: 'Flame-Regular',
  },
  tabContent: {
    gap: 16,
  },

  // Power stats card header with score pill
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  powerScorePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  powerScoreValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
  },
  aiBadge: {
    backgroundColor: 'rgba(41,60,67,0.08)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiBadgeText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    color: COLORS.navy,
    opacity: 0.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },

  // Cards
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
  },
  cardTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  cardDivider: { height: 1, backgroundColor: '#ede5da', marginBottom: 14 },

  // Abilities
  powerTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  powerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#faf7f3',
  },
  powerTagText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
  },
  powerTagMore: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd5c8',
    backgroundColor: '#faf7f3',
    cursor: 'pointer',
  } as object,
  powerTagMoreText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
  },
  showLess: {
    alignSelf: 'flex-start',
    marginTop: 10,
    cursor: 'pointer',
  } as object,
  showLessText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
    textDecorationLine: 'underline',
  },

  // Desktop 2-col info grid
  infoGridDesktop: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },
  infoLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
    flexShrink: 0,
    marginRight: 8,
  },
  infoValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    color: COLORS.navy,
    textAlign: 'right',
    flex: 1,
    textTransform: 'capitalize',
  },

  // Enemies & Allies chips
  chipGroup: { marginBottom: 12 },
  chipGroupLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    opacity: 0.5,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipEnemy: {
    backgroundColor: 'rgba(181,48,43,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(181,48,43,0.2)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipAlly: {
    backgroundColor: 'rgba(99,169,54,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99,169,54,0.2)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipTextEnemy: { fontFamily: 'FlameSans-Regular', fontSize: 11, color: COLORS.red },
  chipTextAlly: { fontFamily: 'FlameSans-Regular', fontSize: 11, color: COLORS.green },

  // First Appearance — desktop card (distinct tinted background)
  firstAppearanceDesktopCard: {
    backgroundColor: '#eef4f5',
    borderColor: '#cddde0',
  },

  // First Appearance — mobile card
  firstIssueRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  firstIssueCover: { width: 80, height: 120, borderRadius: 6 },
  firstIssueMeta: { flex: 1, justifyContent: 'flex-end' as const, paddingBottom: 4 },
  firstIssueTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.navy,
    marginBottom: 4,
  },
  firstIssueYear: { fontFamily: 'FlameSans-Regular', fontSize: 12, color: COLORS.grey },

  // First Appearance — desktop horizontal card
  firstAppearanceRow: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  firstAppearanceMeta: { flex: 1, justifyContent: 'flex-start' as const },
  firstAppearanceLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    opacity: 0.45,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.4,
    marginBottom: 14,
  },
  firstAppearanceDivider: {
    height: 2,
    backgroundColor: COLORS.navy,
    opacity: 0.1,
    marginBottom: 14,
    width: 40,
  },
  firstAppearanceYear: {
    fontFamily: 'Flame-Regular',
    fontSize: 44,
    color: COLORS.navy,
    lineHeight: 48,
    marginBottom: 8,
  },
  firstAppearanceName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.navy,
    opacity: 0.7,
    lineHeight: 20,
  },
});
