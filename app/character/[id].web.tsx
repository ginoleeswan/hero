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

const STAT_CONFIG = [
  { key: 'intelligence', label: 'Intelligence', color: COLORS.blue },
  { key: 'strength', label: 'Strength', color: COLORS.red },
  { key: 'speed', label: 'Speed', color: COLORS.yellow },
  { key: 'durability', label: 'Durability', color: COLORS.green },
  { key: 'power', label: 'Power', color: COLORS.orange },
  { key: 'combat', label: 'Combat', color: COLORS.brown },
];

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '-' || value === 'null' || value === '') return null;
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
        setData({ stats, details: { summary: null, publisher: null, firstIssueId: null }, firstIssue: null });
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
    isFavourited(user.id, id).then(setFavourited).catch(() => {});
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
  const bannerHeight = isDesktop ? 360 : 280;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Cinematic banner */}
      <View style={[styles.banner, { height: bannerHeight }]}>
        {heroImage && (
          <Image
            source={heroImage}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 15%',
            } as object}
          />
        )}
        <View style={styles.bannerOverlay as object} />

        <View style={styles.bannerTopRow}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={16} color={COLORS.beige} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          {user && (
            <Pressable onPress={toggleFavourite} disabled={favLoading} style={styles.favBtn}>
              <Ionicons
                name={favourited ? 'heart' : 'heart-outline'}
                size={22}
                color={favourited ? COLORS.red : 'white'}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.bannerBottom}>
          {stats.biography.publisher ? (
            <Text style={styles.heroPublisher}>{stats.biography.publisher}</Text>
          ) : null}
          <Text style={[styles.heroName, { fontSize: isDesktop ? 52 : 36 }]}>{stats.name}</Text>
          {stats.biography['full-name'] ? (
            <Text style={styles.heroAlias}>{stats.biography['full-name']}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {/* Summary */}
        {details.summary ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{details.summary}</Text>
          </View>
        ) : null}

        {/* Power stats — full width */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Power Stats</Text>
          <View style={styles.cardDivider} />
          <View style={[styles.statsGrid as object, isDesktop && styles.statsGridDesktop as object]}>
            {STAT_CONFIG.map(({ key, label, color }) => (
              <View key={key} style={[styles.statItem, isDesktop && styles.statItemDesktop]}>
                <StatBar
                  label={label}
                  value={(stats.powerstats as Record<string, string>)[key] ?? '0'}
                  color={color}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Info grid */}
        <View style={[styles.infoGrid as object, !isDesktop && styles.infoGridMobile as object]}>
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: { maxWidth: 960, alignSelf: 'center', width: '100%', paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.beige },
  errorText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.red },

  // Banner
  banner: {
    width: '100%',
    backgroundColor: COLORS.navy,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(29,45,51,0.95) 100%)',
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    zIndex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backText: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.beige },
  favBtn: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 8,
    borderRadius: 20,
  },
  bannerBottom: { padding: 24, paddingBottom: 28, zIndex: 1 },
  heroPublisher: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  heroName: {
    fontFamily: 'Flame-Bold',
    color: COLORS.beige,
    lineHeight: 54,
    marginBottom: 4,
  },
  heroAlias: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.6)',
  },

  // Body
  body: { padding: 16, gap: 14 },

  summaryBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 18,
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
    padding: 18,
    borderWidth: 1,
    borderColor: '#e8ddd0',
  },
  cardTitle: {
    fontFamily: 'Flame-Bold',
    fontSize: 12,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  cardDivider: { height: 1, backgroundColor: '#e8ddd0', marginBottom: 12 },

  // Stats
  statsGrid: { flexDirection: 'column' },
  statsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: { width: '100%' },
  statItemDesktop: { width: '50%', paddingRight: 20 },

  // Info grid
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  infoGridMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },
  infoLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
    textTransform: 'capitalize',
    flexShrink: 0,
  },
  infoValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 12,
    color: COLORS.navy,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
    textTransform: 'capitalize',
  },
});
