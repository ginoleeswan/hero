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
import { getFilmById, getFilmHeroes, extractProviders } from '../../src/lib/db/films';
import type { HeroFilm } from '../../src/lib/db/films';
import type { RelatedHeroCard } from '../../src/lib/db/heroes';
import { COLORS } from '../../src/constants/colors';
import { NotFoundView } from '../../src/components/NotFoundView';
import { FilmBackdropHeader } from '../../src/components/film/FilmBackdropHeader';
import { FilmTrailer } from '../../src/components/film/FilmTrailer';
import { WhereToWatch } from '../../src/components/film/WhereToWatch';
import { CastRail } from '../../src/components/film/CastRail';
import { StillsGallery } from '../../src/components/film/StillsGallery';
import { HeroesInFilmRail } from '../../src/components/film/HeroesInFilmRail';

export default function FilmScreen() {
  const { tmdbId } = useLocalSearchParams<{ tmdbId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 900;

  const [film, setFilm] = useState<HeroFilm | null | undefined>(undefined); // undefined = loading, null = not found
  const [heroes, setHeroes] = useState<RelatedHeroCard[]>([]);

  useEffect(() => {
    if (!tmdbId) { setFilm(null); return; }
    let active = true;
    getFilmById(tmdbId).then((f) => { if (active) setFilm(f); });
    getFilmHeroes(tmdbId).then((h) => { if (active) setHeroes(h); });
    return () => { active = false; };
  }, [tmdbId]);

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
          headline="Film not found"
          subline="We don't have this film in the archive yet."
          actions={[{ label: 'Go back', primary: true, onPress: () => router.back() }]}
        />
      </View>
    );
  }

  const providers = extractProviders(film.watchProviders);

  const tmdbUrl = `https://www.themoviedb.org/movie/${film.tmdbId}`;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <FilmBackdropHeader film={film} onBack={() => router.back()} />

        {wide ? (
          // Desktop layout: centered max-width container, overview then large trailer
          <View style={styles.desktopContainer}>
            {film.overview ? (
              <Text style={[styles.overview, styles.overviewWide]}>{film.overview}</Text>
            ) : null}
            {film.trailerKey ? (
              <View style={styles.trailerWide}>
                <FilmTrailer trailerKey={film.trailerKey} />
              </View>
            ) : null}
            {providers.length > 0 ? (
              <View style={styles.railSectionWide}>
                <WhereToWatch providers={providers} />
              </View>
            ) : null}
            {film.cast && film.cast.length > 0 ? (
              <View style={styles.railSectionWide}>
                <CastRail cast={film.cast} />
              </View>
            ) : null}
            {film.stills && film.stills.length > 0 ? (
              <View style={styles.railSectionWide}>
                <StillsGallery stills={film.stills} />
              </View>
            ) : null}
            {heroes.length > 0 ? (
              <View style={styles.railSectionWide}>
                <HeroesInFilmRail heroes={heroes} />
              </View>
            ) : null}
            {/* Web: subtle left-aligned text link instead of a giant filled button */}
            <TouchableOpacity
              style={styles.tmdbLinkWide}
              onPress={() => Linking.openURL(tmdbUrl)}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={13} color={COLORS.orange} />
              <Text style={styles.tmdbLinkTextWide}>View on TMDB</Text>
            </TouchableOpacity>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  loading: {
    flex: 1,
    backgroundColor: COLORS.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { gap: 0 },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  railSection: {
    paddingTop: 20,
  },
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
  // Desktop-only layout styles
  desktopContainer: {
    maxWidth: 1040,
    alignSelf: 'center',
    width: '100%',
    paddingTop: 24,
    gap: 24,
  },
  overviewWide: {
    paddingHorizontal: 32,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 760,
  },
  trailerWide: {
    paddingHorizontal: 32,
  },
  railSectionWide: {
    gap: 0,
  },
  linkBtnWide: {
    marginHorizontal: 32,
    marginBottom: 16,
  },
  // Web: subtle TMDB link (text + icon, left-aligned) instead of full-width filled button
  tmdbLinkWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginHorizontal: 32,
    marginBottom: 16,
    paddingVertical: 4,
  },
  tmdbLinkTextWide: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 0.2,
  },
});
