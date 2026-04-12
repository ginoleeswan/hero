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
import { getHeroById, heroRowToCharacterData } from '../../src/lib/db/heroes';
import { isFavourited, addFavourite, removeFavourite, getHeroFavouriteCount } from '../../src/lib/db/favourites';
import { useAuth } from '../../src/hooks/useAuth';
import { useRecordView } from '../../src/hooks/useViewHistory';
import { heroImageSource, HERO_IMAGES } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';
import { CharacterSkeleton } from '../../src/components/skeletons/CharacterSkeleton';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../src/components/ui/SkeletonProvider';
import { AbilitiesSection } from '../../src/components/AbilitiesSection';
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

function StatDial({ label, value, tint }: { label: string; value: string; tint: string }) {
  const numeric = parseInt(value, 10);
  const fill = isNaN(numeric) ? 0 : numeric;

  return (
    <View style={styles.dialWrap}>
      <AnimatedCircularProgress
        size={72}
        width={11}
        duration={1800}
        backgroundWidth={9}
        rotation={-124}
        arcSweepAngle={250}
        fill={fill}
        tintColor={tint}
        backgroundColor={'rgba(41,60,67,0.12)'}
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

const ALIGNMENT_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  good: { label: 'Hero', bg: 'rgba(39,174,96,0.15)', color: COLORS.green },
  bad: { label: 'Villain', bg: 'rgba(231,76,60,0.15)', color: COLORS.red },
  neutral: { label: 'Neutral', bg: 'rgba(100,100,100,0.12)', color: COLORS.grey },
};

function AlignmentBadge({ alignment }: { alignment: string | null | undefined }) {
  if (!alignment) return null;
  const config = ALIGNMENT_CONFIG[alignment.toLowerCase().trim()];
  if (!config) return null;
  return (
    <View style={[styles.alignmentBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.alignmentBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const ORIGIN_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  mutant:        { label: 'Mutant',    bg: 'rgba(139,92,246,0.15)',  color: COLORS.purple },
  alien:         { label: 'Alien',     bg: 'rgba(21,161,171,0.15)',  color: COLORS.blue },
  human:         { label: 'Human',     bg: 'rgba(162,161,155,0.15)', color: COLORS.grey },
  'god/eternal': { label: 'Eternal',   bg: 'rgba(249,178,34,0.18)',  color: COLORS.gold },
  radiation:     { label: 'Radiation', bg: 'rgba(231,115,51,0.15)',  color: COLORS.orange },
  cyborg:        { label: 'Cyborg',    bg: 'rgba(45,45,45,0.12)',    color: COLORS.black },
  robot:         { label: 'Robot',     bg: 'rgba(45,45,45,0.12)',    color: COLORS.black },
  training:      { label: 'Training',  bg: 'rgba(80,35,20,0.12)',    color: COLORS.brown },
  inhuman:       { label: 'Inhuman',   bg: 'rgba(21,161,171,0.15)',  color: COLORS.blue },
};

function OriginBadge({ origin }: { origin: string | null | undefined }) {
  if (!origin) return null;
  const config = ORIGIN_CONFIG[origin.toLowerCase().trim()];
  if (!config) return null;
  return (
    <View style={[styles.alignmentBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.alignmentBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function AffiliationChips({ value }: { value: string | null | undefined }) {
  if (!value || value === '-' || value === 'null' || value === '') return null;
  const chips = value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== '-' && s !== 'null' && s !== 'none');
  if (chips.length === 0) return null;
  const visible = chips.slice(0, 8);
  const remainder = chips.length - 8;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>Affiliations:</Text>
      <View style={styles.chipsWrap}>
        {visible.map((chip, i) => (
          <View key={i} style={styles.chip}>
            <Text style={styles.chipText}>{chip}</Text>
          </View>
        ))}
        {remainder > 0 && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>+{remainder} more</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function RelativesList({ value }: { value: string | null | undefined }) {
  if (!value || value === '-' || value === 'null' || value === '') return null;
  const entries = value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s && s !== '-' && s !== 'null');
  if (entries.length === 0) return null;
  if (entries.length === 1) {
    return <InfoRow label="Relatives" value={entries[0]} />;
  }
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { alignSelf: 'flex-start', paddingTop: 1 }]}>
        Relatives:
      </Text>
      <View style={{ flex: 1 }}>
        {entries.map((entry, i) => (
          <Text
            key={i}
            style={[styles.infoValue, i < entries.length - 1 && { marginBottom: 5 }]}
          >
            {entry}
          </Text>
        ))}
      </View>
    </View>
  );
}

function AboutBlock({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.aboutBlock}>
      <Text style={styles.aboutText} numberOfLines={expanded ? undefined : 4}>
        {description}
      </Text>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.aboutToggle}>{expanded ? 'Show less' : 'Read more'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CharacterChips({
  label,
  chips,
  chipStyle,
}: {
  label: string;
  chips: string[];
  chipStyle: 'enemy' | 'ally';
}) {
  const visible = chips.slice(0, 8);
  const remainder = chips.length - 8;
  const isEnemy = chipStyle === 'enemy';
  return (
    <View style={styles.characterChipsBlock}>
      <Text style={styles.characterChipsLabel}>{label}</Text>
      <View style={styles.chipsWrap}>
        {visible.map((name, i) => (
          <View
            key={i}
            style={[styles.chip, isEnemy ? styles.chipEnemy : styles.chipAlly]}
          >
            <Text style={[styles.chipText, isEnemy ? styles.chipTextEnemy : styles.chipTextAlly]}>
              {name}
            </Text>
          </View>
        ))}
        {remainder > 0 && (
          <View style={[styles.chip, isEnemy ? styles.chipEnemy : styles.chipAlly]}>
            <Text style={[styles.chipText, isEnemy ? styles.chipTextEnemy : styles.chipTextAlly]}>
              +{remainder} more
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function CharacterScreen() {
  const {
    id,
    name: paramName,
    imageUri: paramImageUri,
  } = useLocalSearchParams<{
    id: string;
    name?: string;
    imageUri?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const compareStripStyle = [styles.compareStrip, { paddingBottom: insets.bottom || 12 }] as const;
  const { user } = useAuth();
  useRecordView(user?.id, id);
  const [data, setData] = useState<CharacterData | null>(null);
  const [comicVineLoading, setComicVineLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favourited, setFavourited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [favCount, setFavCount] = useState<number>(0);

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
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'Failed to load character');
        });
    };

    // Try Supabase first — instant if hero is enriched
    getHeroById(id)
      .then((hero) => {
        if (hero?.enriched_at) {
          setData(heroRowToCharacterData(hero));
          const needsComicVine = !hero.comicvine_enriched_at || hero.powers === null;
          setComicVineLoading(needsComicVine);

          // If ComicVine not enriched yet, or powers column not yet populated, fetch in background
          if (needsComicVine) {
            fetchHeroDetails(hero.id, hero.name)
              .then(async (details) => {
                const firstIssue = details.firstIssueId
                  ? await fetchFirstIssue(details.firstIssueId).catch(() => null)
                  : null;
                setData((prev) =>
                  prev
                    ? {
                        ...prev,
                        details,
                        firstIssue: firstIssue ?? prev.firstIssue,
                      }
                    : prev,
                );
              })
              .catch(() => {})
              .finally(() => setComicVineLoading(false));
          }
          return;
        }

        // Hero not enriched yet — fall through to external APIs
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

  useEffect(() => {
    if (!id) return;
    getHeroFavouriteCount(id)
      .then(setFavCount)
      .catch(() => {});
  }, [id]);

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
      getHeroFavouriteCount(id).then(setFavCount).catch(() => {});
    } catch {
      setFavourited(!next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setFavLoading(false);
    }
  }, [user, id, favourited, favLoading]);

  // Priority: local bundled image → API image → passed URI → CDN fallback
  const heroImage =
    id && HERO_IMAGES[id]
      ? HERO_IMAGES[id]
      : data?.stats.image.url
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
                    size={20}
                    color={favourited ? COLORS.red : undefined}
                  />
                  {favCount > 0 ? (
                    <Text style={styles.favCount}>{favCount > 999 ? '999+' : String(favCount)}</Text>
                  ) : null}
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
          cachePolicy="memory-disk"
          recyclingKey={id ?? 'hero'}
          transition={
            heroImage !== null && typeof heroImage === 'object' && 'uri' in heroImage ? 200 : null
          }
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
          paddingBottom: insets.bottom + 96,
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
                <View style={styles.nameRowRight}>
                  <AlignmentBadge alignment={data.stats.biography.alignment} />
                  <OriginBadge origin={data.details.origin} />
                  <Text style={styles.heroPublisher}>{data.stats.biography.publisher}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.nameRow}>
                <Skeleton width="40%" height={14} borderRadius={6} />
                <Skeleton width={50} height={30} borderRadius={4} />
              </View>
            )}
            {data && ((data.details.issueCount ?? 0) > 0 || (data.details.creators?.length ?? 0) > 0) ? (
              <View style={styles.heroMeta}>
                {(data.details.issueCount ?? 0) > 0 ? (
                  <Text style={styles.heroMetaText}>
                    Featured in {data.details.issueCount!.toLocaleString()} issues
                  </Text>
                ) : null}
                {data.details.creators?.length ? (
                  <Text style={styles.heroMetaText}>
                    Created by {data.details.creators.join(' & ')}
                  </Text>
                ) : null}
              </View>
            ) : null}
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

            {!comicVineLoading && data.details.description ? (
              <AboutBlock description={data.details.description} />
            ) : null}

            {/* Power Stats — circular dials, 3×2 grid */}
            <Section title="Power Stats">
              <View style={styles.statsCard}>
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
                {(() => {
                  const values = STAT_CONFIG.map(({ key }) =>
                    parseInt((data.stats.powerstats as Record<string, string>)[key] ?? '0', 10),
                  ).filter((n) => !isNaN(n) && n > 0);
                  if (values.length === 0) return null;
                  const total = values.reduce((sum, n) => sum + n, 0);
                  return <Text style={styles.statTotal}>Total {total} / 600</Text>;
                })()}
              </View>
            </Section>

            <AbilitiesSection
              powers={data.details.powers}
              loading={comicVineLoading}
            />

            {/* First Appearance — moved before Overview */}
            {data.firstIssue?.imageUrl ? (
              <Section title="First Appearance">
                <View style={styles.comicContainer}>
                  <View style={styles.comicPanel}>
                    <Image
                      source={{ uri: data.firstIssue.imageUrl }}
                      contentFit="contain"
                      style={styles.comicImage}
                      cachePolicy="memory-disk"
                      recyclingKey={`comic-${id}`}
                      transition={200}
                    />
                    {(data.firstIssue.name || data.firstIssue.coverDate) ? (
                      <View style={styles.comicMeta}>
                        {data.firstIssue.name ? (
                          <Text style={styles.comicTitle}>{data.firstIssue.name}</Text>
                        ) : null}
                        {data.firstIssue.coverDate ? (
                          <Text style={styles.comicYear}>
                            {data.firstIssue.coverDate.slice(0, 4)}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              </Section>
            ) : null}

            {/* Overview */}
            <Section title="Overview">
              <InfoRow label="Full name" value={data.stats.biography['full-name']} />
              <InfoRow label="Alter egos" value={data.stats.biography['alter-egos']} />
              <InfoRow label="Place of birth" value={data.stats.biography['place-of-birth']} />
              <InfoRow label="First appearance" value={data.stats.biography['first-appearance']} />
              {data.stats.biography.aliases.filter((a) => a && a !== '-').length > 0 && (
                <InfoRow label="Aliases" value={data.stats.biography.aliases.join(', ')} />
              )}
            </Section>

            {/* Enemies & Allies */}
            {(data.details.enemies?.length || data.details.friends?.length) ? (
              <Section title="Enemies & Allies">
                {data.details.enemies?.length ? (
                  <CharacterChips label="Enemies" chips={data.details.enemies} chipStyle="enemy" />
                ) : null}
                {data.details.friends?.length ? (
                  <CharacterChips label="Allies" chips={data.details.friends} chipStyle="ally" />
                ) : null}
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

            {/* Connections (includes work) */}
            <Section title="Connections">
              <InfoRow label="Occupation" value={data.stats.work.occupation} />
              <InfoRow label="Base" value={data.stats.work.base} />
              <AffiliationChips value={data.stats.connections['group-affiliation']} />
              <RelativesList value={data.stats.connections.relatives} />
            </Section>
          </>
        )}
      </Animated.ScrollView>

      {/* Compare strip — fixed above safe-area bottom */}
      {data && (
        <View style={compareStripStyle}>
          <TouchableOpacity
            onPress={() =>
              router.push(`/compare/${id}/pick?name=${encodeURIComponent(data.stats.name)}`)
            }
            activeOpacity={0.85}
            style={styles.compareStripBtn}
          >
            <Ionicons name="git-compare-outline" size={18} color={COLORS.beige} />
            <Text style={styles.compareStripText}>Compare {data.stats.name}</Text>
          </TouchableOpacity>
        </View>
      )}
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
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favCount: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 10,
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
  nameRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alignmentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  alignmentBadgeText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameDivider: { height: 2, backgroundColor: COLORS.navy, borderRadius: 30, marginTop: 10 },
  heroMeta: {
    marginTop: 6,
    gap: 2,
  },
  heroMetaText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    opacity: 0.5,
  },

  // Summary
  summaryBlock: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  aboutBlock: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  aboutText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
    lineHeight: 20,
    opacity: 0.8,
  },
  aboutToggle: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.orange,
    marginTop: 6,
  },
  summary: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.navy,
    lineHeight: 22,
    opacity: 0.85,
  },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    textAlign: 'right',
    paddingVertical: 5,
  },
  divider: { height: 2, backgroundColor: COLORS.navy, borderRadius: 30, marginBottom: 16 },

  // Circular stat dials
  statsCard: {
    backgroundColor: 'rgba(41,60,67,0.05)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  dialWrap: { alignItems: 'center', justifyContent: 'center', padding: 6 },
  dialValue: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.navy, left: 1 },
  dialLabel: { fontFamily: 'Flame-Regular', fontSize: 11, color: COLORS.navy, marginTop: -8, opacity: 0.75 },
  statTotal: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
    opacity: 0.45,
    textAlign: 'right',
    paddingHorizontal: 12,
    letterSpacing: 0.3,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 9,
  },
  infoLabel: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.navy,
    opacity: 0.6,
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

  // Character chips (Enemies & Allies)
  characterChipsBlock: {
    marginBottom: 10,
  },
  characterChipsLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  chipEnemy: {
    backgroundColor: 'rgba(181,48,43,0.08)',
    borderColor: 'rgba(181,48,43,0.2)',
  },
  chipAlly: {
    backgroundColor: 'rgba(99,169,54,0.08)',
    borderColor: 'rgba(99,169,54,0.2)',
  },
  chipTextEnemy: { color: COLORS.red },
  chipTextAlly: { color: COLORS.green },

  // Affiliation chips
  chipsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
  },
  chip: {
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.14)',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  chipText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    letterSpacing: 0.2,
  },

  // First issue
  comicContainer: {
    width: '100%',
    alignItems: 'center',
  },
  comicPanel: {
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    padding: 16,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
  },
  comicImage: { width: 160, height: 240, borderRadius: 4, overflow: 'hidden' },
  comicMeta: {
    paddingTop: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    width: 192,
  },
  comicTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    color: COLORS.beige,
    textAlign: 'center',
    lineHeight: 18,
  },
  comicYear: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.5)',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  errorText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.red,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Compare strip
  compareStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.navy,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  compareStripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderRadius: 10,
    paddingVertical: 14,
  },
  compareStripText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.beige,
    letterSpacing: 0.3,
  },
});
