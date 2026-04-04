import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Progress from 'react-native-progress';
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';
import { isFavourited, addFavourite, removeFavourite } from '../../src/lib/db/favourites';
import { useAuth } from '../../src/hooks/useAuth';
import { HERO_IMAGES } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import type { CharacterData } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_IMAGE_HEIGHT = 480;

const STAT_COLORS: Record<string, string> = {
  intelligence: COLORS.blue,
  strength:     COLORS.red,
  speed:        COLORS.yellow,
  durability:   COLORS.green,
  power:        COLORS.orange,
  combat:       COLORS.brown,
};

function StatBar({ label, value }: { label: string; value: string }) {
  const numeric = parseInt(value, 10);
  const valid = !isNaN(numeric);
  const color = STAT_COLORS[label] ?? COLORS.orange;

  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statBarContainer}>
        {valid ? (
          <Progress.Bar
            progress={numeric / 100}
            width={SCREEN_WIDTH - 140}
            height={8}
            color={color}
            unfilledColor="#e0d5c8"
            borderWidth={0}
            borderRadius={4}
          />
        ) : (
          <Text style={styles.statNull}>–</Text>
        )}
      </View>
      {valid && <Text style={[styles.statValue, { color }]}>{numeric}</Text>}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '-' || value === 'null' || value === '') return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function CharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<CharacterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favourited, setFavourited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const stats = await fetchHeroStats(id);
        const details = await fetchHeroDetails(stats.name);
        const firstIssue = details.firstIssueId
          ? await fetchFirstIssue(details.firstIssueId).catch(() => null)
          : null;
        setData({ stats, details, firstIssue });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load character');
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    isFavourited(user.id, id).then(setFavourited).catch(() => {});
  }, [user, id]);

  const toggleFavourite = useCallback(async () => {
    if (!user || !id || favLoading) return;
    setFavLoading(true);
    const next = !favourited;
    setFavourited(next); // optimistic
    try {
      if (next) {
        await addFavourite(user.id, id);
      } else {
        await removeFavourite(user.id, id);
      }
    } catch {
      setFavourited(!next); // revert on error
    } finally {
      setFavLoading(false);
    }
  }, [user, id, favourited, favLoading]);

  const heroImage = id ? (HERO_IMAGES[id] ?? null) : null;

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <TouchableOpacity style={[styles.backButton, { top: insets.top + 8 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero image header */}
      <View style={styles.heroImageContainer}>
        {heroImage ? (
          <Image source={heroImage} contentFit="cover" style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, { backgroundColor: COLORS.navy }]} />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(245,235,220,0.6)', COLORS.beige]}
          locations={[0.45, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Back button */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Favourite button */}
        {user ? (
          <TouchableOpacity
            style={[styles.favButton, { top: insets.top + 8 }]}
            onPress={toggleFavourite}
            disabled={favLoading}
          >
            <Ionicons
              name={favourited ? 'heart' : 'heart-outline'}
              size={22}
              color={favourited ? COLORS.red : '#fff'}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {!data ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.orange} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Name + publisher */}
          <View style={styles.nameBlock}>
            <Text style={styles.heroName}>{data.stats.name}</Text>
            {data.stats.biography['full-name'] ? (
              <Text style={styles.heroAlias}>{data.stats.biography['full-name']}</Text>
            ) : null}
            <Text style={styles.heroPublisher}>{data.stats.biography.publisher}</Text>
          </View>

          {/* Bio summary */}
          {data.details.summary ? (
            <Section title="About">
              <Text style={styles.summary}>{data.details.summary}</Text>
            </Section>
          ) : null}

          {/* Power stats */}
          <Section title="Power Stats">
            {(Object.entries(data.stats.powerstats) as [string, string][]).map(([key, val]) => (
              <StatBar key={key} label={key} value={val} />
            ))}
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <InfoRow label="Gender" value={data.stats.appearance.gender} />
            <InfoRow label="Race" value={data.stats.appearance.race} />
            <InfoRow label="Height" value={data.stats.appearance.height.join(' / ')} />
            <InfoRow label="Weight" value={data.stats.appearance.weight.join(' / ')} />
            <InfoRow label="Eyes" value={data.stats.appearance['eye-color']} />
            <InfoRow label="Hair" value={data.stats.appearance['hair-color']} />
          </Section>

          {/* Biography */}
          <Section title="Biography">
            <InfoRow label="Alter egos" value={data.stats.biography['alter-egos']} />
            <InfoRow label="Place of birth" value={data.stats.biography['place-of-birth']} />
            <InfoRow label="First appearance" value={data.stats.biography['first-appearance']} />
            <InfoRow label="Alignment" value={data.stats.biography.alignment} />
            {data.stats.biography.aliases.length > 0 && (
              <InfoRow label="Aliases" value={data.stats.biography.aliases.join(', ')} />
            )}
          </Section>

          {/* Work */}
          <Section title="Work">
            <InfoRow label="Occupation" value={data.stats.work.occupation} />
            <InfoRow label="Base" value={data.stats.work.base} />
          </Section>

          {/* Connections */}
          <Section title="Connections">
            <InfoRow label="Group affiliation" value={data.stats.connections['group-affiliation']} />
            <InfoRow label="Relatives" value={data.stats.connections.relatives} />
          </Section>

          {/* First issue */}
          {data.firstIssue?.imageUrl ? (
            <Section title="First Appearance">
              <Image
                source={{ uri: data.firstIssue.imageUrl }}
                contentFit="cover"
                style={styles.issueImage}
              />
            </Section>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageContainer: {
    width: SCREEN_WIDTH,
    height: HERO_IMAGE_HEIGHT,
    position: 'absolute',
    top: 0,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    marginTop: HERO_IMAGE_HEIGHT - 60,
  },
  loadingOverlay: {
    marginTop: HERO_IMAGE_HEIGHT + 40,
    alignItems: 'center',
  },
  nameBlock: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  heroName: {
    fontFamily: 'Flame-Bold',
    fontSize: 36,
    color: COLORS.black,
  },
  heroAlias: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.grey,
    marginTop: 2,
  },
  heroPublisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.orange,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontFamily: 'Flame-Bold',
    fontSize: 18,
    color: COLORS.black,
    marginBottom: 12,
  },
  summary: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.navy,
    lineHeight: 22,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
    width: 90,
    textTransform: 'capitalize',
  },
  statBarContainer: {
    flex: 1,
  },
  statValue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    width: 32,
    textAlign: 'right',
  },
  statNull: {
    fontFamily: 'FlameSans-Regular',
    color: COLORS.grey,
    fontSize: 13,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0d5c8',
  },
  infoLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.grey,
    width: 120,
  },
  infoValue: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    flex: 1,
  },
  issueImage: {
    width: 160,
    height: 240,
    borderRadius: 8,
  },
  errorText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.red,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
