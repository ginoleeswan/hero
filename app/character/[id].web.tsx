import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';
import { getHeroById, heroRowToCharacterData } from '../../src/lib/db/heroes';
import { isFavourited, addFavourite, removeFavourite } from '../../src/lib/db/favourites';
import { getPowerIcon } from '../../src/constants/powerIcons';
import { useAuth } from '../../src/hooks/useAuth';
import { heroImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import { StatBar } from '../../src/components/web/StatBar';
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

export default function WebCharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 700;

  const skeletonOpacity = useSkeletonAnim();
  const [data, setData] = useState<CharacterData | null>(null);
  const [comicVineLoading, setComicVineLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favourited, setFavourited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

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
              powers: null,
              description: null,
              origin: null,
              issueCount: null,
              creators: null,
              enemies: null,
              friends: null,
              movies: null,
              teams: null,
            },
            firstIssue: null,
          });
          fetchHeroDetails(stats.id, stats.name)
            .then(async (details) => {
              const firstIssue = details.firstIssueId
                ? await fetchFirstIssue(details.firstIssueId).catch(() => null)
                : null;
              setData({ stats, details, firstIssue });
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
          const needsComicVine = !hero.comicvine_enriched_at || hero.powers === null;
          setComicVineLoading(needsComicVine);
          if (needsComicVine) {
            fetchHeroDetails(hero.id, hero.name)
              .then(async (details) => {
                const firstIssue = details.firstIssueId
                  ? await fetchFirstIssue(details.firstIssueId).catch(() => null)
                  : null;
                setData((prev) =>
                  prev ? { ...prev, details, firstIssue: firstIssue ?? prev.firstIssue } : prev,
                );
              })
              .catch(() => {})
              .finally(() => setComicVineLoading(false));
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

  const statValues = STAT_CONFIG
    .map(({ key }) => parseInt((stats.powerstats as Record<string, string>)[key] ?? '0', 10))
    .filter((n) => !isNaN(n) && n > 0);
  const powerScore = statValues.length > 0
    ? Math.round(statValues.reduce((a, b) => a + b, 0) / statValues.length)
    : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* ── Identity header — navy strip, no image ── */}
      <View style={[styles.identityHeader, { borderBottomWidth: 3, borderBottomColor: alignmentColor }]}>
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
            <Pressable
              onPress={() =>
                router.push(`/compare/${id}/pick?name=${encodeURIComponent(stats.name)}`)
              }
              style={({ hovered }: { hovered?: boolean }) =>
                [styles.compareBtn, hovered && (styles.compareBtnHover as object)] as object
              }
            >
              <Ionicons name="git-compare-outline" size={15} color={COLORS.beige} />
              <Text style={styles.compareBtnText}>Compare</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.heroIdentity}>
          <Text style={[styles.heroName, { fontSize: isDesktop ? 52 : 34 }]}>{stats.name}</Text>
          {alias ? <Text style={styles.heroAlias}>{alias}</Text> : null}
        </View>

        {/* Publisher — bottom-right corner */}
        {stats.biography.publisher ? (
          <View style={styles.publisherCorner}>
            <Text style={styles.heroPublisher}>{stats.biography.publisher}</Text>
          </View>
        ) : null}

        {/* Origin badge + issue count + creator credit */}
        <View style={styles.heroIdentityMeta}>
          {comicVineLoading ? (
            <>
              <SkeletonBlock opacity={skeletonOpacity} width={60} height={18} borderRadius={4} dark />
              <SkeletonBlock opacity={skeletonOpacity} width={200} height={11} borderRadius={4} dark style={{ marginTop: 6 }} />
            </>
          ) : (
            <>
              {details.origin ? <Text style={styles.originBadge}>{details.origin}</Text> : null}
              {(details.issueCount ?? 0) > 0 || (details.creators?.length ?? 0) > 0 ? (
                <Text style={styles.heroMeta}>
                  {(details.issueCount ?? 0) > 0
                    ? `Featured in ${details.issueCount!.toLocaleString()} issues`
                    : ''}
                  {(details.issueCount ?? 0) > 0 && details.creators?.length ? '  ·  ' : ''}
                  {details.creators?.length ? `Created by ${details.creators.join(' & ')}` : ''}
                </Text>
              ) : null}
            </>
          )}
        </View>
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
                <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Power Stats</Text>
                {powerScore !== null ? (
                  <View style={[styles.powerScorePill, { backgroundColor: alignmentColor + '22' }]}>
                    <Text style={[styles.powerScoreValue, { color: alignmentColor }]}>{powerScore}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardDivider} />
              {STAT_CONFIG.map(({ key, label, color }) => (
                <StatBar
                  key={key}
                  label={label}
                  value={(stats.powerstats as Record<string, string>)[key] ?? '0'}
                  color={color}
                />
              ))}
            </View>
          </View>

          {/* Right column: summary → abilities → info grid → first appearance → enemies → on screen */}
          <View style={styles.rightCol}>
            {/* Summary */}
            {comicVineLoading && !details.summary ? (
              <View style={styles.summaryBox}>
                <SkeletonBlock opacity={skeletonOpacity} height={12} style={{ marginBottom: 10 }} />
                <SkeletonBlock opacity={skeletonOpacity} height={12} width="85%" style={{ marginBottom: 10 }} />
                <SkeletonBlock opacity={skeletonOpacity} height={12} width="65%" />
              </View>
            ) : details.summary || details.description ? (
              <View style={styles.summaryBox}>
                {details.summary ? <Text style={styles.summaryText}>{details.summary}</Text> : null}
                {details.description ? (
                  <Pressable
                    onPress={() => router.push(`/biography/${id}`)}
                    style={({ hovered }: { hovered?: boolean }) =>
                      [styles.biographyLink, hovered && (styles.biographyLinkHover as object)] as object
                    }
                  >
                    <Text style={styles.biographyLinkText}>Read biography</Text>
                    <Ionicons name="chevron-forward" size={13} color={COLORS.orange} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Abilities */}
            <WebAbilitiesCard
              powers={details.powers}
              loading={comicVineLoading}
              skeletonOpacity={skeletonOpacity}
            />

            {/* 3-col info grid: Overview | Appearance | Work & Connections */}
            <View style={styles.infoGridDesktop as object}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Overview</Text>
                <View style={styles.cardDivider} />
                <InfoRow label="Full name" value={stats.biography['full-name']} />
                <InfoRow label="Alter egos" value={stats.biography['alter-egos']} />
                <InfoRow label="Place of birth" value={stats.biography['place-of-birth']} />
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
                {/* Show first 2 teams only to keep this card compact */}
                <InfoRow
                  label="Affiliations"
                  value={
                    details.teams?.length
                      ? details.teams.slice(0, 2).join(', ') + (details.teams.length > 2 ? ` +${details.teams.length - 2} more` : '')
                      : stats.connections['group-affiliation']
                  }
                />
              </View>
            </View>

            {/* First Appearance — horizontal card: cover on left, year + title on right */}
            {comicVineLoading ? (
              <View style={styles.card}>
                <View style={styles.firstAppearanceRow}>
                  <SkeletonBlock opacity={skeletonOpacity} width={90} height={130} borderRadius={6} />
                  <View style={{ flex: 1, gap: 10 }}>
                    <SkeletonBlock opacity={skeletonOpacity} width="40%" height={10} borderRadius={4} />
                    <SkeletonBlock opacity={skeletonOpacity} width="55%" height={36} borderRadius={5} />
                    <SkeletonBlock opacity={skeletonOpacity} width="70%" height={12} borderRadius={4} />
                  </View>
                </View>
              </View>
            ) : data.firstIssue?.imageUrl ? (
              <View style={[styles.card, styles.firstAppearanceDesktopCard]}>
                <View style={styles.firstAppearanceRow}>
                  <img
                    src={data.firstIssue.imageUrl}
                    style={{
                      width: 90,
                      height: 130,
                      objectFit: 'cover',
                      borderRadius: 6,
                      flexShrink: 0,
                      display: 'block',
                    }}
                  />
                  <View style={styles.firstAppearanceMeta}>
                    <Text style={styles.firstAppearanceLabel}>First Appearance</Text>
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
            ) : null}

            {/* Enemies & Allies */}
            {comicVineLoading ? (
              <View style={styles.card}>
                <SkeletonBlock opacity={skeletonOpacity} width="45%" height={11} borderRadius={4} style={{ marginBottom: 10 }} />
                <View style={styles.cardDivider} />
                <SkeletonBlock opacity={skeletonOpacity} width="25%" height={10} borderRadius={4} style={{ marginBottom: 8 }} />
                <View style={styles.chipRow}>
                  {[72, 90, 60, 80, 68].map((w, i) => (
                    <SkeletonBlock key={i} opacity={skeletonOpacity} width={w} height={26} borderRadius={20} />
                  ))}
                </View>
              </View>
            ) : details.enemies?.length || details.friends?.length ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Enemies &amp; Allies</Text>
                <View style={styles.cardDivider} />
                {details.enemies?.length ? (
                  <View style={styles.chipGroup}>
                    <Text style={styles.chipGroupLabel}>Enemies</Text>
                    <View style={styles.chipRow}>
                      {details.enemies.slice(0, 10).map((name, i) => (
                        <View key={i} style={styles.chipEnemy}>
                          <Text style={styles.chipTextEnemy}>{name}</Text>
                        </View>
                      ))}
                      {details.enemies.length > 10 ? (
                        <View key="more-e" style={styles.chipEnemy}>
                          <Text style={styles.chipTextEnemy}>+{details.enemies.length - 10} more</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
                {details.friends?.length ? (
                  <View style={styles.chipGroup}>
                    <Text style={styles.chipGroupLabel}>Allies</Text>
                    <View style={styles.chipRow}>
                      {details.friends.slice(0, 10).map((name, i) => (
                        <View key={i} style={styles.chipAlly}>
                          <Text style={styles.chipTextAlly}>{name}</Text>
                        </View>
                      ))}
                      {details.friends.length > 10 ? (
                        <View key="more-f" style={styles.chipAlly}>
                          <Text style={styles.chipTextAlly}>+{details.friends.length - 10} more</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* On Screen */}
            {comicVineLoading ? (
              <View style={styles.card}>
                <SkeletonBlock opacity={skeletonOpacity} width="30%" height={11} borderRadius={4} style={{ marginBottom: 10 }} />
                <View style={styles.cardDivider} />
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.movieRow, { alignItems: 'center' }]}>
                    <SkeletonBlock opacity={skeletonOpacity} width={22} height={22} borderRadius={4} />
                    <View style={{ gap: 4 }}>
                      <SkeletonBlock opacity={skeletonOpacity} width={160} height={12} borderRadius={4} />
                      <SkeletonBlock opacity={skeletonOpacity} width={40} height={10} borderRadius={4} />
                    </View>
                  </View>
                ))}
              </View>
            ) : details.movies?.length ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>On Screen</Text>
                <View style={styles.cardDivider} />
                {details.movies.map((entry, i) => {
                  const match = entry.match(/^(.+?)\s*\((\d{4})\)$/);
                  const title = match ? match[1] : entry;
                  const year = match ? match[2] : null;
                  return (
                    <View key={i} style={styles.movieRow}>
                      <Ionicons name="film-outline" size={16} color={COLORS.grey} style={{ marginTop: 1 }} />
                      <View>
                        <Text style={styles.movieTitle}>{title}</Text>
                        {year ? <Text style={styles.movieYear}>{year}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        /* ── Mobile: stacked ── */
        <View style={styles.body}>
          {/* Portrait at natural aspect ratio */}
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
              <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Power Stats</Text>
              {powerScore !== null ? (
                <View style={[styles.powerScorePill, { backgroundColor: alignmentColor + '22' }]}>
                  <Text style={[styles.powerScoreValue, { color: alignmentColor }]}>{powerScore}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardDivider} />
            {STAT_CONFIG.map(({ key, label, color }) => (
              <StatBar
                key={key}
                label={label}
                value={(stats.powerstats as Record<string, string>)[key] ?? '0'}
                color={color}
              />
            ))}
          </View>

          {comicVineLoading && !details.summary ? (
            <View style={styles.summaryBox}>
              <SkeletonBlock opacity={skeletonOpacity} height={12} style={{ marginBottom: 10 }} />
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
                    [styles.biographyLink, hovered && (styles.biographyLinkHover as object)] as object
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
              <SkeletonBlock opacity={skeletonOpacity} width="40%" height={11} borderRadius={4} style={{ marginBottom: 10 }} />
              <View style={styles.cardDivider} />
              <View style={styles.firstIssueRow}>
                <SkeletonBlock opacity={skeletonOpacity} width={80} height={120} borderRadius={6} />
                <View style={{ flex: 1, gap: 8, justifyContent: 'flex-end' as const }}>
                  <SkeletonBlock opacity={skeletonOpacity} width="80%" height={13} borderRadius={4} />
                  <SkeletonBlock opacity={skeletonOpacity} width="30%" height={11} borderRadius={4} />
                </View>
              </View>
            </View>
          ) : data.firstIssue?.imageUrl ? (
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
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Overview</Text>
            <View style={styles.cardDivider} />
            <InfoRow label="Full name" value={stats.biography['full-name']} />
            <InfoRow label="Alter egos" value={stats.biography['alter-egos']} />
            <InfoRow label="Place of birth" value={stats.biography['place-of-birth']} />
            <InfoRow label="First appearance" value={stats.biography['first-appearance']} />
            <InfoRow label="Alignment" value={stats.biography.alignment} />
            {stats.biography.aliases.filter((a) => a && a !== '-').length > 0 && (
              <InfoRow label="Aliases" value={stats.biography.aliases.join(', ')} />
            )}
          </View>

          {comicVineLoading ? (
            <View style={styles.card}>
              <SkeletonBlock opacity={skeletonOpacity} width="45%" height={11} borderRadius={4} style={{ marginBottom: 10 }} />
              <View style={styles.cardDivider} />
              <SkeletonBlock opacity={skeletonOpacity} width="25%" height={10} borderRadius={4} style={{ marginBottom: 8 }} />
              <View style={styles.chipRow}>
                {[72, 90, 60, 80, 68].map((w, i) => (
                  <SkeletonBlock key={i} opacity={skeletonOpacity} width={w} height={26} borderRadius={20} />
                ))}
              </View>
            </View>
          ) : details.enemies?.length || details.friends?.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Enemies &amp; Allies</Text>
              <View style={styles.cardDivider} />
              {details.enemies?.length ? (
                <View style={styles.chipGroup}>
                  <Text style={styles.chipGroupLabel}>Enemies</Text>
                  <View style={styles.chipRow}>
                    {details.enemies.slice(0, 10).map((name, i) => (
                      <View key={i} style={styles.chipEnemy}>
                        <Text style={styles.chipTextEnemy}>{name}</Text>
                      </View>
                    ))}
                    {details.enemies.length > 10 ? (
                      <View style={styles.chipEnemy}>
                        <Text style={styles.chipTextEnemy}>
                          +{details.enemies.length - 10} more
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
              {details.friends?.length ? (
                <View style={styles.chipGroup}>
                  <Text style={styles.chipGroupLabel}>Allies</Text>
                  <View style={styles.chipRow}>
                    {details.friends.slice(0, 10).map((name, i) => (
                      <View key={i} style={styles.chipAlly}>
                        <Text style={styles.chipTextAlly}>{name}</Text>
                      </View>
                    ))}
                    {details.friends.length > 10 ? (
                      <View style={styles.chipAlly}>
                        <Text style={styles.chipTextAlly}>+{details.friends.length - 10} more</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {comicVineLoading ? (
            <View style={styles.card}>
              <SkeletonBlock opacity={skeletonOpacity} width="30%" height={11} borderRadius={4} style={{ marginBottom: 10 }} />
              <View style={styles.cardDivider} />
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.movieRow, { alignItems: 'center' }]}>
                  <SkeletonBlock opacity={skeletonOpacity} width={22} height={22} borderRadius={4} />
                  <View style={{ gap: 4 }}>
                    <SkeletonBlock opacity={skeletonOpacity} width={160} height={12} borderRadius={4} />
                    <SkeletonBlock opacity={skeletonOpacity} width={40} height={10} borderRadius={4} />
                  </View>
                </View>
              ))}
            </View>
          ) : details.movies?.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>On Screen</Text>
              <View style={styles.cardDivider} />
              {details.movies.map((entry, i) => {
                const match = entry.match(/^(.+?)\s*\((\d{4})\)$/);
                const title = match ? match[1] : entry;
                const year = match ? match[2] : null;
                return (
                  <View key={i} style={styles.movieRow}>
                    <Ionicons name="film-outline" size={16} color={COLORS.grey} style={{ marginTop: 1 }} />
                    <View>
                      <Text style={styles.movieTitle}>{title}</Text>
                      {year ? <Text style={styles.movieYear}>{year}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

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
            <Text style={styles.cardTitle}>Work</Text>
            <View style={styles.cardDivider} />
            <InfoRow label="Occupation" value={stats.work.occupation} />
            <InfoRow label="Base" value={stats.work.base} />
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Connections</Text>
            <View style={styles.cardDivider} />
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
        </View>
      )}
    </ScrollView>
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
    marginBottom: 8,
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
  heroIdentityMeta: {
    paddingHorizontal: 24,
    paddingTop: 6,
  },
  originBadge: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: 'rgba(245,235,220,0.6)',
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  heroMeta: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.5)',
    marginTop: 4,
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

  // On Screen movies
  movieRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  movieTitle: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.navy },
  movieYear: { fontFamily: 'FlameSans-Regular', fontSize: 11, color: COLORS.grey, marginTop: 1 },

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
  firstAppearanceRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  firstAppearanceMeta: { flex: 1, justifyContent: 'flex-end' as const, paddingBottom: 4 },
  firstAppearanceLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    opacity: 0.45,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  firstAppearanceYear: {
    fontFamily: 'Flame-Regular',
    fontSize: 48,
    color: COLORS.navy,
    lineHeight: 52,
    marginBottom: 4,
  },
  firstAppearanceName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    opacity: 0.65,
  },
});
