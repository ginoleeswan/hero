import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';
import { getHeroById, heroRowToCharacterData } from '../../src/lib/db/heroes';
import { isFavourited, addFavourite, removeFavourite } from '../../src/lib/db/favourites';
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

  const [data, setData] = useState<CharacterData | null>(null);
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
            details: { summary: null, publisher: null, firstIssueId: null, powers: null },
            firstIssue: null,
          });
          fetchHeroDetails(stats.name)
            .then(async (details) => {
              const firstIssue = details.firstIssueId
                ? await fetchFirstIssue(details.firstIssueId).catch(() => null)
                : null;
              setData({ stats, details, firstIssue });
            })
            .catch(() => {});
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'));
    };

    getHeroById(id)
      .then((hero) => {
        if (hero?.enriched_at) {
          setData(heroRowToCharacterData(hero));
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* ── Identity header — navy strip, no image ── */}
      <View style={styles.identityHeader}>
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
      </View>

      {/* ── Body ── */}
      {isDesktop ? (
        <View style={styles.bodyDesktop}>
          {/* Left column: portrait + power stats */}
          <View style={styles.leftCol}>
            {/* Portrait card — lets the image breathe in its natural aspect ratio */}
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

            {/* Power stats sit directly below the portrait */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Power Stats</Text>
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

          {/* Right column: summary + 2-col info cards */}
          <View style={styles.rightCol}>
            {details.summary ? (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText}>{details.summary}</Text>
              </View>
            ) : null}

            <View style={styles.infoGridDesktop as object}>
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
                <InfoRow label="Group affiliation" value={stats.connections['group-affiliation']} />
                <InfoRow label="Relatives" value={stats.connections.relatives} />
              </View>
            </View>
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
            <Text style={styles.cardTitle}>Power Stats</Text>
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

          {details.summary ? (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{details.summary}</Text>
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
            <InfoRow label="Group affiliation" value={stats.connections['group-affiliation']} />
            <InfoRow label="Relatives" value={stats.connections.relatives} />
          </View>
        </View>
      )}
    </ScrollView>
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
  bodyDesktop: { flexDirection: 'row', alignItems: 'flex-start', gap: 18, padding: 20 },
  leftCol: { width: 280, flexShrink: 0, gap: 14 },
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
  infoGridDesktop: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
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

  // ── Desktop two-column body ──────────────────────────────────────────────────
  bodyDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
    padding: 20,
  },
  leftCol: {
    width: 280,
    flexShrink: 0,
    gap: 14,
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
  },
  summaryText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.navy,
    lineHeight: 22,
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

  // Desktop 2-col info grid
  infoGridDesktop: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
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
});
