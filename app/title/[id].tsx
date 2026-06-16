import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getTitleById, getTitleHeroes, extractProviders } from '../../src/lib/db/titles';
import type { HeroTitle } from '../../src/lib/db/titles';
import type { RelatedHeroCard } from '../../src/lib/db/heroes';
import { COLORS } from '../../src/constants/colors';
import { NotFoundView } from '../../src/components/NotFoundView';
import { FilmBackdropHeader } from '../../src/components/film/FilmBackdropHeader';
import { FilmTrailer } from '../../src/components/film/FilmTrailer';
import { WhereToWatch } from '../../src/components/film/WhereToWatch';
import { CastRail } from '../../src/components/film/CastRail';
import { StillsGallery } from '../../src/components/film/StillsGallery';
import { HeroesInFilmRail } from '../../src/components/film/HeroesInFilmRail';

function formatRevenue(n: number | null): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

export default function TitleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const wide = isWeb && width >= 900;

  const [film, setFilm] = useState<HeroTitle | null | undefined>(undefined); // undefined = loading, null = not found
  const [heroes, setHeroes] = useState<RelatedHeroCard[]>([]);

  useEffect(() => {
    if (!id) {
      setFilm(null);
      return;
    }
    let active = true;
    getTitleById(id).then((f) => {
      if (active) setFilm(f);
    });
    getTitleHeroes(id).then((h) => {
      if (active) setHeroes(h);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (film === undefined) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={COLORS.navy} />
      </View>
    );
  }

  if (film === null) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <NotFoundView
          stamp="Missing"
          stampColor={COLORS.red}
          icon="film-outline"
          headline="Title not found"
          subline="We don't have this title in the archive yet."
          actions={[{ label: 'Go back', primary: true, onPress: () => router.back() }]}
        />
      </View>
    );
  }

  const providers = extractProviders(film.watchProviders);
  const tmdbUrl = `https://www.themoviedb.org/${film.mediaType === 'tv' ? 'tv' : 'movie'}/${film.externalId}`;

  // ── Dossier cards (web) — match the character page's white-card design system ──
  const overviewCard =
    film.overview || film.trailerKey ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Overview</Text>
        <View style={styles.cardDivider} />
        {film.overview ? <Text style={styles.cardOverview}>{film.overview}</Text> : null}
        {film.trailerKey ? (
          <View style={film.overview ? styles.trailerSpacer : undefined}>
            <FilmTrailer trailerKey={film.trailerKey} />
          </View>
        ) : null}
      </View>
    ) : null;

  const castCard =
    film.cast && film.cast.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cast</Text>
        <View style={styles.cardDivider} />
        <CastRail cast={film.cast} inCard />
      </View>
    ) : null;

  const stillsCard =
    film.stills && film.stills.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stills</Text>
        <View style={styles.cardDivider} />
        <StillsGallery stills={film.stills} inCard />
      </View>
    ) : null;

  const heroesCard =
    heroes.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Heroes in this Film</Text>
        <View style={styles.cardDivider} />
        <HeroesInFilmRail heroes={heroes} inCard />
      </View>
    ) : null;

  const isTv = film.mediaType === 'tv';
  const tv = (film.details ?? {}) as {
    seasons?: number | null;
    episodes?: number | null;
    episode_runtime?: number | null;
    networks?: string[] | null;
  };

  const detailRows: { label: string; value: string }[] = [];
  if (film.year != null)
    detailRows.push({ label: isTv ? 'First aired' : 'Released', value: String(film.year) });
  if (isTv) {
    if (tv.seasons) detailRows.push({ label: 'Seasons', value: String(tv.seasons) });
    if (tv.episodes) detailRows.push({ label: 'Episodes', value: String(tv.episodes) });
    if (tv.episode_runtime)
      detailRows.push({ label: 'Episode', value: `${tv.episode_runtime} min` });
    if (tv.networks && tv.networks.length > 0)
      detailRows.push({ label: 'Network', value: tv.networks.join(', ') });
  } else if (film.runtime) {
    detailRows.push({ label: 'Runtime', value: `${film.runtime} min` });
  }
  if (film.voteAverage != null)
    detailRows.push({ label: 'Rating', value: `★ ${film.voteAverage.toFixed(1)} / 10` });
  const revenue = formatRevenue(film.revenue);
  if (!isTv && revenue) detailRows.push({ label: 'Box office', value: revenue });

  const detailsCard =
    detailRows.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>
        <View style={styles.cardDivider} />
        {detailRows.map((r, i) => (
          <View
            key={r.label}
            style={[styles.infoRow, i === detailRows.length - 1 && styles.infoRowLast] as object}
          >
            <Text style={styles.infoLabel}>{r.label}</Text>
            <Text style={styles.infoValue}>{r.value}</Text>
          </View>
        ))}
      </View>
    ) : null;

  const watchCard =
    providers.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Where to Watch</Text>
        <View style={styles.cardDivider} />
        <WhereToWatch providers={providers} inCard />
      </View>
    ) : null;

  const tmdbLink = (
    <TouchableOpacity
      style={styles.tmdbLink}
      onPress={() => Linking.openURL(tmdbUrl)}
      activeOpacity={0.7}
    >
      <Ionicons name="open-outline" size={13} color={COLORS.orange} />
      <Text style={styles.tmdbLinkText}>View on TMDB</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <FilmBackdropHeader film={film} onBack={() => router.back()} />

        {isWeb ? (
          <View style={styles.bodyWrap}>
            {wide ? (
              <View style={styles.bodyRow}>
                <View style={styles.mainCol}>
                  {overviewCard}
                  {castCard}
                  {stillsCard}
                  {heroesCard}
                </View>
                <View style={styles.sideCol}>
                  {detailsCard}
                  {watchCard}
                  {tmdbLink}
                </View>
              </View>
            ) : (
              <View style={styles.bodyCol}>
                {overviewCard}
                {detailsCard}
                {watchCard}
                {castCard}
                {stillsCard}
                {heroesCard}
                {tmdbLink}
              </View>
            )}
          </View>
        ) : (
          <>
            {film.overview ? (
              <View style={styles.section}>
                <Text style={styles.overview}>{film.overview}</Text>
              </View>
            ) : null}
            {film.trailerKey ? (
              <View style={styles.section}>
                <FilmTrailer trailerKey={film.trailerKey} />
              </View>
            ) : null}
            {providers.length > 0 ? (
              <View style={styles.railSection}>
                <WhereToWatch providers={providers} />
              </View>
            ) : null}
            {film.cast && film.cast.length > 0 ? (
              <View style={styles.railSection}>
                <CastRail cast={film.cast} />
              </View>
            ) : null}
            {film.stills && film.stills.length > 0 ? (
              <View style={styles.railSection}>
                <StillsGallery stills={film.stills} />
              </View>
            ) : null}
            {heroes.length > 0 ? (
              <View style={styles.railSection}>
                <HeroesInFilmRail heroes={heroes} />
              </View>
            ) : null}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => Linking.openURL(tmdbUrl)}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={14} color="#fff" />
                <Text style={styles.linkBtnText}>View on TMDB</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  loading: {
    flex: 1,
    backgroundColor: COLORS.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { gap: 0 },

  // ── Native stacked layout ──
  section: { paddingHorizontal: 20, paddingTop: 20 },
  railSection: { paddingTop: 20 },
  overview: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.navy + 'bb',
    lineHeight: 22,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    backgroundColor: COLORS.orange,
    borderRadius: 14,
  },
  linkBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.2,
  },

  // ── Web dossier (matches character page tokens) ──
  bodyWrap: { maxWidth: 1180, alignSelf: 'center', width: '100%' },
  bodyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, padding: 24 },
  bodyCol: { padding: 20, gap: 16 },
  mainCol: { flex: 1, minWidth: 0, gap: 16 } as object,
  sideCol: {
    width: 300,
    flexShrink: 0,
    gap: 16,
    position: 'sticky',
    top: 88,
    alignSelf: 'flex-start',
  } as object,
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    boxShadow: '0 6px 22px rgba(41,60,67,0.06)',
  } as object,
  cardTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  cardDivider: { height: 1, backgroundColor: '#ede5da', marginBottom: 14 },
  cardOverview: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    color: COLORS.navy + 'cc',
    lineHeight: 23,
  },
  trailerSpacer: { marginTop: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },
  infoRowLast: { borderBottomWidth: 0 },
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
  },
  tmdbLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  tmdbLinkText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 0.2,
  },
});
