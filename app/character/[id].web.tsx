import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';
import { isFavourited, addFavourite, removeFavourite } from '../../src/lib/db/favourites';
import { useAuth } from '../../src/hooks/useAuth';
import { heroImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import { StatBar } from '../../src/components/web/StatBar';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../src/components/ui/SkeletonProvider';
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionDivider} />
      {children}
    </View>
  );
}

export default function WebCharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<CharacterData | null>(null);
  const [comicVineLoading, setComicVineLoading] = useState(true);
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
          .catch(() => {})
          .finally(() => setComicVineLoading(false));
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

  const { stats, details, firstIssue } = data;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.navy} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        {user && (
          <Pressable onPress={toggleFavourite} disabled={favLoading} style={styles.favBtn}>
            <Ionicons
              name={favourited ? 'heart' : 'heart-outline'}
              size={22}
              color={favourited ? COLORS.red : COLORS.navy}
            />
          </Pressable>
        )}
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerText}>
          <Text style={styles.heroName}>{stats.name}</Text>
          {stats.biography['full-name'] ? (
            <Text style={styles.heroAlias}>{stats.biography['full-name']}</Text>
          ) : null}
          {stats.biography.publisher ? (
            <Text style={styles.heroPublisher}>{stats.biography.publisher}</Text>
          ) : null}
        </View>
        {heroImage && (
          <Image
            source={heroImage}
            contentFit="cover"
            contentPosition="top"
            style={styles.bannerImage}
          />
        )}
      </View>

      <View style={styles.grid as object}>
        {comicVineLoading ? (
          <SkeletonProvider>
            <View style={[styles.section, styles.fullWidth as object]}>
              <Skeleton height={12} borderRadius={5} style={{ marginBottom: 7 }} />
              <Skeleton width="85%" height={12} borderRadius={5} style={{ marginBottom: 7 }} />
              <Skeleton width="60%" height={12} borderRadius={5} />
            </View>
          </SkeletonProvider>
        ) : details.summary ? (
          <View style={[styles.section, styles.fullWidth as object]}>
            <Text style={styles.summary}>{details.summary}</Text>
          </View>
        ) : null}

        <Section title="Power Stats">
          {STAT_CONFIG.map(({ key, label, color }) => (
            <StatBar
              key={key}
              label={label}
              value={(stats.powerstats as Record<string, string>)[key] ?? '0'}
              color={color}
            />
          ))}
        </Section>

        <Section title="Biography">
          <InfoRow label="Full name" value={stats.biography['full-name']} />
          <InfoRow label="Alter egos" value={stats.biography['alter-egos']} />
          <InfoRow label="Place of birth" value={stats.biography['place-of-birth']} />
          <InfoRow label="First appearance" value={stats.biography['first-appearance']} />
          <InfoRow label="Alignment" value={stats.biography.alignment} />
          {stats.biography.aliases.filter((a) => a && a !== '-').length > 0 && (
            <InfoRow label="Aliases" value={stats.biography.aliases.join(', ')} />
          )}
        </Section>

        <Section title="Appearance">
          <InfoRow label="Gender" value={stats.appearance.gender} />
          <InfoRow label="Race" value={stats.appearance.race} />
          <InfoRow label="Height" value={stats.appearance.height.join(' / ')} />
          <InfoRow label="Weight" value={stats.appearance.weight.join(' / ')} />
          <InfoRow label="Eyes" value={stats.appearance['eye-color']} />
          <InfoRow label="Hair" value={stats.appearance['hair-color']} />
        </Section>

        <Section title="Work">
          <InfoRow label="Occupation" value={stats.work.occupation} />
          <InfoRow label="Base" value={stats.work.base} />
        </Section>

        <Section title="Connections">
          <InfoRow label="Group affiliation" value={stats.connections['group-affiliation']} />
          <InfoRow label="Relatives" value={stats.connections.relatives} />
        </Section>

        {firstIssue?.imageUrl ? (
          <View style={[styles.section, styles.fullWidth as object, styles.comicSection]}>
            <Text style={styles.sectionTitle}>First Appearance</Text>
            <View style={styles.sectionDivider} />
            <Image
              source={{ uri: firstIssue.imageUrl }}
              contentFit="contain"
              style={styles.comicImage}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: {
    maxWidth: 860,
    alignSelf: 'center',
    width: '100%',
    padding: 24,
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.beige,
  },
  errorText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.red },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.navy },
  favBtn: { padding: 4 },

  banner: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    padding: 28,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    minHeight: 140,
  },
  bannerText: { flex: 1 },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 36,
    color: COLORS.beige,
    lineHeight: 40,
  },
  heroAlias: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 4,
  },
  heroPublisher: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bannerImage: {
    width: 120,
    height: 140,
    borderRadius: 8,
    marginLeft: 20,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  fullWidth: {
    gridColumn: 'span 2',
  },

  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e8ddd0',
  },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e8ddd0',
    marginBottom: 12,
  },
  summary: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },
  infoLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
    textTransform: 'capitalize',
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
  comicSection: { alignItems: 'center' },
  comicImage: { width: 160, height: 240, marginTop: 8 },
});
