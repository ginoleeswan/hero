import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';
import { isFavourited, addFavourite, removeFavourite } from '../../src/lib/db/favourites';
import { useAuth } from '../../src/hooks/useAuth';
import { heroImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import { StatBar } from '../../src/components/web/StatBar';
import type { CharacterData } from '../../src/types';

const PUBLISHER_LOGOS: Record<string, number> = {
  'Marvel Comics': require('../../assets/images/Marvel-Logo.jpg'),
  Marvel: require('../../assets/images/Marvel-Logo.jpg'),
  'DC Comics': require('../../assets/images/DC-Logo.png'),
};

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
    fetchHeroStats(id)
      .then((stats) => {
        setData({
          stats,
          details: { summary: null, publisher: null, firstIssueId: null },
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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
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
          {user && (
            <Pressable onPress={toggleFavourite} disabled={favLoading} style={styles.favBtn}>
              <Ionicons
                name={favourited ? 'heart' : 'heart-outline'}
                size={20}
                color={favourited ? COLORS.red : 'rgba(245,235,220,0.6)'}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.heroIdentity}>
          <Text style={[styles.heroName, { fontSize: isDesktop ? 52 : 34 }]}>{stats.name}</Text>
          {alias ? <Text style={styles.heroAlias}>{alias}</Text> : null}
        </View>

        {/* Publisher logo — bottom-right corner */}
        {stats.biography.publisher ? (
          <View style={styles.publisherCorner}>
            {PUBLISHER_LOGOS[stats.biography.publisher] ? (
              <Image
                source={PUBLISHER_LOGOS[stats.biography.publisher]}
                style={
                  stats.biography.publisher.startsWith('DC')
                    ? (styles.logoSquare as object)
                    : (styles.logoRect as object)
                }
                contentFit="contain"
              />
            ) : (
              <Text style={styles.heroPublisher}>{stats.biography.publisher}</Text>
            )}
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
                <Text style={styles.cardTitle}>Biography</Text>
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
            <Text style={styles.cardTitle}>Biography</Text>
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
  favBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 9,
    borderRadius: 20,
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
  logoRect: { width: 56, height: 24, borderRadius: 3 },
  logoSquare: { width: 32, height: 32, borderRadius: 3 },
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
