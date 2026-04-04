import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import * as Haptics from 'expo-haptics';
import { fetchHeroStats, fetchHeroDetails, fetchFirstIssue } from '../../src/lib/api';
import { isFavourited, addFavourite, removeFavourite } from '../../src/lib/db/favourites';
import { useAuth } from '../../src/hooks/useAuth';
import { heroImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import { CharacterSkeleton } from '../../src/components/skeletons/CharacterSkeleton';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../src/components/ui/SkeletonProvider';
import type { CharacterData } from '../../src/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_IMAGE_HEIGHT = Math.round(SCREEN_HEIGHT * 0.6);

const STAT_CONFIG: { key: string; label: string; tint: string }[] = [
  { key: 'intelligence', label: 'Intelligence', tint: COLORS.blue },
  { key: 'strength', label: 'Strength', tint: COLORS.red },
  { key: 'speed', label: 'Speed', tint: COLORS.yellow },
  { key: 'durability', label: 'Durability', tint: COLORS.green },
  { key: 'power', label: 'Power', tint: COLORS.orange },
  { key: 'combat', label: 'Combat', tint: COLORS.brown },
];

const PUBLISHER_LOGOS: Record<string, number> = {
  'Marvel Comics': require('../../assets/images/Marvel-Logo.jpg'),
  Marvel: require('../../assets/images/Marvel-Logo.jpg'),
  'DC Comics': require('../../assets/images/DC-Logo.png'),
};

function StatDial({ label, value, tint }: { label: string; value: string; tint: string }) {
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
        backgroundColor={COLORS.navy}
        padding={0}
        lineCap="round"
      >
        {(f: number) => <Text style={styles.dialValue}>{Math.floor(f)}</Text>}
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
  const { id, name: paramName, imageUri: paramImageUri } = useLocalSearchParams<{
    id: string;
    name?: string;
    imageUri?: string;
  }>();
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

  // Image fades out as content scrolls up over it — keeps text readable on beige bg
  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HERO_IMAGE_HEIGHT * 0.55],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Header name slides up + snaps in from large scale as the content name scrolls behind the header.
  // Content name scrolls naturally — the header clips it. No content-side transforms needed.
  const HEADER_H = 100; // approx status bar + nav bar height
  const NAME_TOP = HERO_IMAGE_HEIGHT - 60; // content paddingTop = where name starts
  const NAME_IN = NAME_TOP - HEADER_H - 30; // name approaching header bottom
  const NAME_OUT = NAME_TOP - HEADER_H + 20; // name fully behind header

  const headerNameOpacity = scrollY.interpolate({
    inputRange: [NAME_IN, NAME_OUT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const headerNameScale = scrollY.interpolate({
    inputRange: [NAME_IN, NAME_OUT],
    outputRange: [1.3, 1],
    extrapolate: 'clamp',
  });
  const headerNameY = scrollY.interpolate({
    inputRange: [NAME_IN, NAME_OUT],
    outputRange: [10, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (!id) return;

    // Step 1 — fetch stats from SuperheroAPI (fast). Render immediately.
    fetchHeroStats(id)
      .then((stats) => {
        setData({
          stats,
          details: { summary: null, publisher: null, firstIssueId: null },
          firstIssue: null,
        });

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
    isFavourited(user.id, id)
      .then(setFavourited)
      .catch(() => {});
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

  // Priority: API image (best) → passed URI (from search) → bundled/CDN fallback
  const heroImage = data?.stats.image.url
    ? { uri: data.stats.image.url }
    : paramImageUri
      ? { uri: paramImageUri }
      : id
        ? heroImageSource(id)
        : null;

  // Show name immediately from params while API loads
  const displayName = data?.stats.name ?? paramName ?? '';

  if (error) {
    return (
      <View style={[styles.container, styles.center]}>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTransparent: true,
            headerStyle: { backgroundColor: 'transparent' },
            headerShadowVisible: false,
            headerTitle: '',
            headerBackTitle: '',
          }}
        />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Native header — transparent over image, fades to beige on scroll */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerBackTitle: '',
          headerStyle: { backgroundColor: 'transparent' },
          headerTitleAlign: 'center',
          headerTitle: () => (
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.headerTitle,
                {
                  opacity: headerNameOpacity,
                  transform: [{ scale: headerNameScale }, { translateY: headerNameY }],
                },
              ]}
            >
              {displayName}
            </Animated.Text>
          ),
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerBtn}
            >
              <Ionicons name="arrow-back" size={22} />
            </TouchableOpacity>
          ),
          headerRight: user
            ? () => (
                <TouchableOpacity
                  onPress={toggleFavourite}
                  disabled={favLoading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.headerBtn}
                >
                  <Ionicons
                    name={favourited ? 'heart' : 'heart-outline'}
                    size={22}
                    color={favourited ? COLORS.red : undefined}
                  />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      {/* Hero image — parallax + zoom-on-overscroll + fade-out on scroll */}
      <Animated.View
        style={[
          styles.heroImageContainer,
          {
            opacity: imageOpacity,
            transform: [{ translateY: imageTranslateY }, { scale: imageScale }],
          },
        ]}
      >
        <Image
          source={heroImage}
          contentFit="cover"
          contentPosition="top"
          style={styles.heroImage}
        />
        <LinearGradient
          colors={[
            'transparent',
            'rgba(245,235,220,0.03)',
            'rgba(245,235,220,0.08)',
            'rgba(245,235,220,0.18)',
            'rgba(245,235,220,0.32)',
            'rgba(245,235,220,0.52)',
            'rgba(245,235,220,0.72)',
            'rgba(245,235,220,0.9)',
            COLORS.beige,
          ]}
          locations={[0.2, 0.35, 0.48, 0.58, 0.68, 0.78, 0.88, 0.95, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: HERO_IMAGE_HEIGHT - 160,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        {/* Name block — renders immediately from params, detail row fills in when API responds */}
        {displayName ? (
          <View style={styles.nameBlock}>
            <Text style={styles.heroName}>{displayName}</Text>
            {data ? (
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
            ) : (
              <View style={styles.nameRow}>
                <Skeleton width="40%" height={14} borderRadius={6} />
                <Skeleton width={50} height={30} borderRadius={4} />
              </View>
            )}
            <View style={styles.nameDivider} />
          </View>
        ) : null}

        {!data ? (
          <CharacterSkeleton hideNameBlock />
        ) : (
          <>
            {/* Summary — shows skeleton lines while ComicVine is loading */}
            {comicVineLoading ? (
              <SkeletonProvider>
                <View style={styles.summaryBlock}>
                  <Skeleton width="100%" height={12} borderRadius={5} style={{ marginBottom: 7 }} />
                  <Skeleton width="88%" height={12} borderRadius={5} style={{ marginBottom: 7 }} />
                  <Skeleton width="65%" height={12} borderRadius={5} />
                </View>
              </SkeletonProvider>
            ) : data.details.summary ? (
              <View style={styles.summaryBlock}>
                <Text style={styles.summary}>{data.details.summary}</Text>
              </View>
            ) : null}

            {/* Power Stats — circular dials, 3×2 grid */}
            <Section title="Power Stats">
              <View style={styles.statsGrid}>
                {STAT_CONFIG.map(({ key, label, tint }) => (
                  <StatDial
                    key={key}
                    label={label}
                    value={(data.stats.powerstats as Record<string, string>)[key] ?? '0'}
                    tint={tint}
                  />
                ))}
              </View>
            </Section>

            {/* Biography */}
            <Section title="Biography">
              <InfoRow label="Full name" value={data.stats.biography['full-name']} />
              <InfoRow label="Alter egos" value={data.stats.biography['alter-egos']} />
              <InfoRow label="Place of birth" value={data.stats.biography['place-of-birth']} />
              <InfoRow label="First appearance" value={data.stats.biography['first-appearance']} />
              <InfoRow label="Alignment" value={data.stats.biography.alignment} />
              {data.stats.biography.aliases.filter((a) => a && a !== '-').length > 0 && (
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
              <InfoRow label="Race" value={data.stats.appearance.race} />
              <InfoRow label="Height" value={data.stats.appearance.height.join(' / ')} />
              <InfoRow label="Weight" value={data.stats.appearance.weight.join(' / ')} />
              <InfoRow label="Eyes" value={data.stats.appearance['eye-color']} />
              <InfoRow label="Hair" value={data.stats.appearance['hair-color']} />
            </Section>

            {/* Work */}
            <Section title="Work">
              <InfoRow label="Occupation" value={data.stats.work.occupation} />
              <InfoRow label="Base" value={data.stats.work.base} />
            </Section>

            {/* Connections */}
            <Section title="Connections">
              <InfoRow
                label="Group affiliation"
                value={data.stats.connections['group-affiliation']}
              />
              <InfoRow label="Relatives" value={data.stats.connections.relatives} />
            </Section>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  center: { alignItems: 'center', justifyContent: 'center' },
  heroImageContainer: {
    width: SCREEN_WIDTH,
    height: HERO_IMAGE_HEIGHT,
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.navy,
  },
  scroll: { flex: 1 },

  // Name block
  nameBlock: { paddingHorizontal: 20, paddingBottom: 4 },
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
  logoRect: { width: 50, height: 30, borderRadius: 4 },
  logoSquare: { width: 30, height: 30, borderRadius: 4 },
  nameDivider: { height: 2, backgroundColor: COLORS.navy, borderRadius: 30, marginTop: 10 },

  // Summary
  summaryBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  summary: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
    lineHeight: 18,
  },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    textAlign: 'right',
    paddingVertical: 5,
  },
  divider: { height: 2, backgroundColor: COLORS.navy, borderRadius: 30, marginBottom: 14 },

  // Circular stat dials
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 8,
  },
  dialWrap: { alignItems: 'center', justifyContent: 'center', padding: 5 },
  dialValue: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy, left: 1 },
  dialLabel: { fontFamily: 'Flame-Regular', fontSize: 10, color: COLORS.navy, marginTop: -10 },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 5,
  },
  infoLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.navy,
    textTransform: 'capitalize',
  },
  infoValue: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    textTransform: 'capitalize',
    flex: 1,
    textAlign: 'right',
  },

  // First issue
  comicContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.39,
    shadowRadius: 8.3,
    elevation: 13,
  },
  comicImage: { width: 160, height: 240 },

  errorText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.red,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
