import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
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
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import * as Haptics from 'expo-haptics';
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';
import { isFavourited, addFavourite, removeFavourite } from '../../src/lib/db/favourites';
import { useAuth } from '../../src/hooks/useAuth';
import { HERO_IMAGES } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import type { CharacterData } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_IMAGE_HEIGHT = 480;

// Matches original: tintColor + tintColorSecondary gradient on each dial
const STAT_CONFIG: { key: string; label: string; tint: string; secondary: string }[] = [
  { key: 'intelligence', label: 'Intelligence', tint: COLORS.blue,   secondary: COLORS.green  },
  { key: 'strength',     label: 'Strength',     tint: COLORS.red,    secondary: COLORS.yellow },
  { key: 'speed',        label: 'Speed',        tint: COLORS.yellow, secondary: COLORS.orange },
  { key: 'durability',   label: 'Durability',   tint: COLORS.green,  secondary: COLORS.blue   },
  { key: 'power',        label: 'Power',        tint: COLORS.orange, secondary: COLORS.red    },
  { key: 'combat',       label: 'Combat',       tint: COLORS.brown,  secondary: COLORS.navy   },
];

const PUBLISHER_LOGOS: Record<string, ReturnType<typeof require>> = {
  'Marvel Comics': require('../../assets/images/Marvel-Logo.jpg'),
  'Marvel':        require('../../assets/images/Marvel-Logo.jpg'),
  'DC Comics':     require('../../assets/images/DC-Logo.png'),
};

function StatDial({ label, value, tint, secondary }: {
  label: string; value: string; tint: string; secondary: string;
}) {
  const numeric = parseInt(value, 10);
  const fill = isNaN(numeric) ? 0 : numeric;

  return (
    <View style={styles.dialWrap}>
      <AnimatedCircularProgress
        size={60}
        width={10}
        duration={1800}
        backgroundWidth={8}
        rotation={-124}
        arcSweepAngle={250}
        fill={fill}
        tintColor={tint}
        tintColorSecondary={secondary}
        backgroundColor={COLORS.navy}
        padding={0}
        lineCap="round"
      >
        {(f) => (
          <Text style={styles.dialValue}>{Math.floor(f)}</Text>
        )}
      </AnimatedCircularProgress>
      <Text style={styles.dialLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.divider} />
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '-' || value === 'null' || value === '') return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}:</Text>
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
  const [comicVineLoading, setComicVineLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favourited, setFavourited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Parallax: image drifts up at ~0.3x scroll speed as content covers it
  // Overscroll zoom: when scrollY < 0, translateY tracks half the overscroll
  // so the scaled image stays anchored at the top edge
  const imageTranslateY = scrollY.interpolate({
    inputRange: [-HERO_IMAGE_HEIGHT, 0, HERO_IMAGE_HEIGHT],
    outputRange: [-HERO_IMAGE_HEIGHT / 2, 0, -HERO_IMAGE_HEIGHT / 3],
    extrapolate: 'clamp',
  });

  // Scale up on overscroll (scrollY < 0). At scrollY = 0 → scale 1.
  const imageScale = scrollY.interpolate({
    inputRange: [-HERO_IMAGE_HEIGHT, 0],
    outputRange: [2, 1],
    extrapolateRight: 'clamp',
  });

  useEffect(() => {
    if (!id) return;

    // Step 1 — fetch stats from SuperheroAPI (fast). Render immediately.
    fetchHeroStats(id)
      .then((stats) => {
        setData({ stats, details: { summary: null, publisher: null, firstIssueId: null }, firstIssue: null });

        // Step 2 — fetch ComicVine data in the background, update when ready.
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
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load character');
      });
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
    Haptics.impactAsync(
      next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
    try {
      await (next ? addFavourite(user.id, id) : removeFavourite(user.id, id));
    } catch {
      setFavourited(!next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setFavLoading(false);
    }
  }, [user, id, favourited, favLoading]);

  const heroImage = id ? (HERO_IMAGES[id] ?? null) : null;

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero image — parallax + zoom-on-overscroll */}
      <Animated.View
        style={[
          styles.heroImageContainer,
          { transform: [{ translateY: imageTranslateY }, { scale: imageScale }] },
        ]}
      >
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
      </Animated.View>

      {/* Buttons sit outside the animated view so they don't scale/parallax */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 8 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>
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

      {!data ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.orange} />
        </View>
      ) : (
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
        >
          {/* Name block */}
          <View style={styles.nameBlock}>
            <Text style={styles.heroName}>{data.stats.name}</Text>
            <View style={styles.nameRow}>
              {data.stats.biography['full-name'] ? (
                <Text style={styles.heroAlias}>{data.stats.biography['full-name']}</Text>
              ) : null}
              {PUBLISHER_LOGOS[data.stats.biography.publisher] ? (
                <Image
                  source={PUBLISHER_LOGOS[data.stats.biography.publisher]}
                  style={
                    data.stats.biography.publisher.startsWith('DC')
                      ? styles.logoSquare
                      : styles.logoRect
                  }
                  contentFit="contain"
                />
              ) : (
                <Text style={styles.heroPublisher}>{data.stats.biography.publisher}</Text>
              )}
            </View>
          </View>

          {/* Summary — shows spinner while ComicVine is loading */}
          {comicVineLoading ? (
            <View style={styles.summaryBlock}>
              <ActivityIndicator size="small" color={COLORS.grey} />
            </View>
          ) : data.details.summary ? (
            <View style={styles.summaryBlock}>
              <Text style={styles.summary}>{data.details.summary}</Text>
            </View>
          ) : null}

          {/* Power Stats — circular dials, 3×2 grid */}
          <Section title="Power Stats">
            <View style={styles.statsGrid}>
              {STAT_CONFIG.map(({ key, label, tint, secondary }) => (
                <StatDial
                  key={key}
                  label={label}
                  value={(data.stats.powerstats as Record<string, string>)[key] ?? '0'}
                  tint={tint}
                  secondary={secondary}
                />
              ))}
            </View>
          </Section>

          {/* Biography */}
          <Section title="Biography">
            <InfoRow label="Full name"        value={data.stats.biography['full-name']} />
            <InfoRow label="Alter egos"       value={data.stats.biography['alter-egos']} />
            <InfoRow label="Place of birth"   value={data.stats.biography['place-of-birth']} />
            <InfoRow label="First appearance" value={data.stats.biography['first-appearance']} />
            <InfoRow label="Alignment"        value={data.stats.biography.alignment} />
            {data.stats.biography.aliases.filter(a => a && a !== '-').length > 0 && (
              <InfoRow label="Aliases" value={data.stats.biography.aliases.join(', ')} />
            )}
          </Section>

          {/* First issue */}
          {data.firstIssue?.imageUrl ? (
            <Section title="First Appearance">
              <View style={styles.comicContainer}>
                <Image
                  source={{ uri: data.firstIssue.imageUrl }}
                  contentFit="contain"
                  style={styles.comicImage}
                />
              </View>
            </Section>
          ) : null}

          {/* Appearance */}
          <Section title="Appearance">
            <InfoRow label="Gender" value={data.stats.appearance.gender} />
            <InfoRow label="Race"   value={data.stats.appearance.race} />
            <InfoRow label="Height" value={data.stats.appearance.height.join(' / ')} />
            <InfoRow label="Weight" value={data.stats.appearance.weight.join(' / ')} />
            <InfoRow label="Eyes"   value={data.stats.appearance['eye-color']} />
            <InfoRow label="Hair"   value={data.stats.appearance['hair-color']} />
          </Section>

          {/* Work */}
          <Section title="Work">
            <InfoRow label="Occupation" value={data.stats.work.occupation} />
            <InfoRow label="Base"       value={data.stats.work.base} />
          </Section>

          {/* Connections */}
          <Section title="Connections">
            <InfoRow label="Group affiliation" value={data.stats.connections['group-affiliation']} />
            <InfoRow label="Relatives"         value={data.stats.connections.relatives} />
          </Section>
        </Animated.ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.beige },
  center:       { alignItems: 'center', justifyContent: 'center' },
  heroImageContainer: { width: SCREEN_WIDTH, height: HERO_IMAGE_HEIGHT, position: 'absolute', top: 0, overflow: 'hidden' },
  heroImage:    { width: '100%', height: '100%' },
  backButton: {
    position: 'absolute', left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  favButton: {
    position: 'absolute', right: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  scroll:        { flex: 1, marginTop: HERO_IMAGE_HEIGHT - 60 },
  loadingOverlay:{ marginTop: HERO_IMAGE_HEIGHT + 40, alignItems: 'center' },

  // Name block
  nameBlock:  { paddingHorizontal: 20, paddingBottom: 4 },
  heroName: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 35,
    color: COLORS.navy,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  heroAlias: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.navy,
    flex: 1,
    marginRight: 8,
  },
  heroPublisher: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  logoRect:   { width: 50, height: 30, borderRadius: 4 },
  logoSquare: { width: 30, height: 30, borderRadius: 4 },

  // Summary
  summaryBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  summary: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
    lineHeight: 18,
  },

  // Sections
  section:      { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  sectionTitle: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.navy, textAlign: 'right', paddingVertical: 5 },
  divider:      { height: 2, backgroundColor: COLORS.navy, borderRadius: 30, marginBottom: 14 },

  // Circular stat dials
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 8,
  },
  dialWrap:  { alignItems: 'center', justifyContent: 'center', padding: 5 },
  dialValue: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy, left: 1 },
  dialLabel: { fontFamily: 'Flame-Regular', fontSize: 10, color: COLORS.navy, marginTop: -10 },

  // Info rows
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 5 },
  infoLabel: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.navy, textTransform: 'capitalize' },
  infoValue: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.navy, textTransform: 'capitalize', flex: 1, textAlign: 'right' },

  // First issue
  comicContainer: { width: '100%', alignItems: 'center', marginVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.39, shadowRadius: 8.3, elevation: 13 },
  comicImage:     { width: 160, height: 240 },

  errorText: { fontFamily: 'FlameSans-Regular', fontSize: 15, color: COLORS.red, textAlign: 'center', paddingHorizontal: 32 },
});
