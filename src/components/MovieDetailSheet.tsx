import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import type { MovieAppearance } from '../types';
import { COLORS } from '../constants/colors';
import type { HeroFilm } from '../lib/db/films';

// react-native-webview / web iframe — loaded lazily to avoid a hard crash when
// the sheet is opened without a trailer.
let WebView: React.ComponentType<{
  source: { uri: string };
  style?: object;
  allowsInlineMediaPlayback?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
}> | null = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    WebView = require('react-native-webview').WebView;
  } catch {
    // webview not linked — trailer falls back gracefully
  }
}

interface Props {
  film?: HeroFilm;
  movie?: MovieAppearance;
  onClose: () => void;
}

function formatRevenue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

// Extract watch provider names from the TMDB watch_providers blob for a given region.
function extractProviderNames(
  watchProviders: Record<string, unknown> | null | undefined,
): string[] {
  if (!watchProviders) return [];
  // Prefer US; fall back to first available region.
  const regionData =
    (watchProviders['US'] as Record<string, unknown> | undefined) ??
    Object.values(watchProviders).find(
      (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
    );
  if (!regionData) return [];

  const names = new Set<string>();
  for (const key of ['flatrate', 'rent', 'buy'] as const) {
    const arr = regionData[key];
    if (Array.isArray(arr)) {
      for (const p of arr) {
        if (typeof p === 'object' && p !== null && typeof (p as Record<string, unknown>)['provider_name'] === 'string') {
          names.add((p as Record<string, string>)['provider_name']);
        }
      }
    }
  }
  return Array.from(names);
}

// ── Trailer section ──────────────────────────────────────────────────────────
function TrailerSection({ trailerKey }: { trailerKey: string }) {
  const [expanded, setExpanded] = useState(false);
  const embedUrl = `https://www.youtube.com/embed/${trailerKey}`;

  if (!expanded) {
    return (
      <TouchableOpacity style={styles.trailerBtn} onPress={() => setExpanded(true)} activeOpacity={0.8}>
        <Ionicons name="play-circle" size={18} color="#fff" />
        <Text style={styles.trailerBtnText}>Watch Trailer</Text>
      </TouchableOpacity>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.trailerFrame}>
        {/* @ts-ignore — iframe is a web-only element */}
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ border: 'none', borderRadius: 10 }}
        />
      </View>
    );
  }

  if (WebView) {
    return (
      <View style={styles.trailerFrame}>
        <WebView
          source={{ uri: embedUrl }}
          style={styles.trailerWebView}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      </View>
    );
  }

  // Fallback: open in browser
  return (
    <TouchableOpacity
      style={styles.trailerBtn}
      onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${trailerKey}`)}
      activeOpacity={0.8}
    >
      <Ionicons name="play-circle" size={18} color="#fff" />
      <Text style={styles.trailerBtnText}>Open Trailer</Text>
    </TouchableOpacity>
  );
}

// ── Film-specific content ────────────────────────────────────────────────────
function FilmContent({ film }: { film: HeroFilm }) {
  const providerNames = extractProviderNames(film.watchProviders);

  return (
    <>
      {film.overview ? (
        <Text style={styles.deck}>{film.overview}</Text>
      ) : null}

      {film.trailerKey ? (
        <TrailerSection trailerKey={film.trailerKey} />
      ) : null}

      {providerNames.length > 0 ? (
        <View style={styles.providersBlock}>
          <Text style={styles.subLabel}>Where to Watch</Text>
          <View style={styles.providerRow}>
            {providerNames.map((name) => (
              <View key={name} style={styles.providerChip}>
                <Text style={styles.providerName}>{name}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {film.cast && film.cast.length > 0 ? (
        <View style={styles.castBlock}>
          <Text style={styles.subLabel}>Cast</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.castRow}
          >
            {film.cast.map((member) => (
              <View key={member.name} style={styles.castMember}>
                {member.profile_url ? (
                  <Image
                    source={{ uri: member.profile_url }}
                    style={styles.castAvatar}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={[styles.castAvatar, styles.castAvatarPlaceholder]}>
                    <Ionicons name="person" size={18} color={COLORS.grey} />
                  </View>
                )}
                <Text style={styles.castName} numberOfLines={2}>{member.name}</Text>
                {member.character ? (
                  <Text style={styles.castCharacter} numberOfLines={2}>{member.character}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {film.stills && film.stills.length > 0 ? (
        <View style={styles.stillsBlock}>
          <Text style={styles.subLabel}>Stills</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stillsRow}
          >
            {film.stills.map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={styles.still}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </>
  );
}

export function MovieDetailSheet({ film, movie, onClose }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = Platform.OS === 'web' && width >= 700;

  // Poster / title derive from film (TMDB) when present, else legacy movie.
  const posterUrl = film?.posterUrl ?? movie?.imageUrl ?? null;
  const title = film?.title ?? movie?.name ?? '';

  // Legacy meta pills (only when using legacy movie path)
  const revenue = movie ? formatRevenue(movie.totalRevenue) : null;
  const metaPills: string[] = film
    ? [
        film.year ? String(film.year) : null,
        film.voteAverage != null ? `${film.voteAverage.toFixed(1)} ★` : null,
        film.runtime ? `${film.runtime} min` : null,
      ].filter((v): v is string => v !== null)
    : ([
        movie?.year ?? null,
        movie?.rating ?? null,
        movie?.runtime ? `${movie.runtime} min` : null,
      ].filter((v): v is string => v !== null));

  const handleOpenUrl = () => {
    const url =
      film
        ? `https://www.themoviedb.org/movie/${film.tmdbId}`
        : movie?.url ?? `https://www.google.com/search?q=${encodeURIComponent((movie?.name ?? '') + ' film')}`;
    Linking.openURL(url);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, isDesktop && styles.backdropDesktop]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            isDesktop ? styles.sheetDesktop : { paddingBottom: Math.max(insets.bottom, 28) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {!isDesktop ? (
            <View style={styles.handle} />
          ) : (
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={16} color={COLORS.navy} />
            </Pressable>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <View style={styles.topRow}>
              {/* Poster */}
              <View style={styles.posterShadow}>
                <View style={styles.posterWrapper}>
                  {posterUrl ? (
                    <Image
                      source={{ uri: posterUrl }}
                      style={styles.poster}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.poster, styles.posterPlaceholder]}>
                      <Ionicons name="film-outline" size={30} color={COLORS.grey} />
                    </View>
                  )}
                </View>
              </View>

              {/* Meta */}
              <View style={styles.meta}>
                <Text style={styles.title}>{title}</Text>

                {metaPills.length > 0 ? (
                  <View style={styles.pillRow}>
                    {metaPills.map((p, i) => (
                      <View key={i} style={styles.pill}>
                        <Text style={styles.pillText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {revenue ? (
                  <View style={styles.revenueRow}>
                    <Ionicons name="trending-up-outline" size={13} color={COLORS.green} />
                    <Text style={styles.revenue}>{revenue} box office</Text>
                  </View>
                ) : null}

                {/* Legacy movie deck (no film present) */}
                {!film && movie?.deck ? (
                  <Text style={styles.deck}>{movie.deck}</Text>
                ) : null}
              </View>
            </View>

            {/* TMDB-enriched content */}
            {film ? <FilmContent film={film} /> : null}

            <Pressable style={styles.linkBtn} onPress={handleOpenUrl}>
              <Ionicons name="open-outline" size={14} color="#fff" />
              <Text style={styles.linkBtnText}>
                {film ? 'View on TMDB' : 'View on ComicVine'}
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdropDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: '82%',
  },
  sheetDesktop: {
    width: 520,
    maxHeight: '88%',
    borderRadius: 20,
    paddingTop: 52,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.navy + '28',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.navy + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'flex-start',
  },
  posterShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderRadius: 10,
    flexShrink: 0,
  },
  posterWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  poster: {
    width: 100,
    height: 150,
  },
  posterPlaceholder: {
    backgroundColor: COLORS.navy + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meta: {
    flex: 1,
    paddingTop: 2,
    gap: 10,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.navy,
    lineHeight: 23,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    backgroundColor: COLORS.navy + '12',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pillText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy + 'cc',
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  revenue: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.green,
  },
  deck: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy + '99',
    lineHeight: 20,
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
  trailerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
  },
  trailerBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: '#fff',
  },
  trailerFrame: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  trailerWebView: {
    flex: 1,
  },
  subLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  providersBlock: {
    gap: 0,
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  providerChip: {
    backgroundColor: COLORS.navy + '12',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  providerName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
  },
  castBlock: {
    gap: 0,
  },
  castRow: {
    gap: 12,
    paddingRight: 8,
  },
  castMember: {
    width: 72,
    alignItems: 'center',
    gap: 4,
  },
  castAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  castAvatarPlaceholder: {
    backgroundColor: COLORS.navy + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  castName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 13,
  },
  castCharacter: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 9,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 12,
  },
  stillsBlock: {
    gap: 0,
  },
  stillsRow: {
    gap: 8,
    paddingRight: 8,
  },
  still: {
    width: 160,
    height: 90,
    borderRadius: 8,
  },
});
