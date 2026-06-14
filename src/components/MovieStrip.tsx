import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { MovieAppearance } from '../types';
import { COLORS } from '../constants/colors';
import { MovieGridModal } from './MovieGridModal';
import type { HeroFilm } from '../lib/db/films';
import { pickFeaturedFilm } from '../lib/db/films';

const CARD_W = 100;
const CARD_H = 150;
const INITIAL_COUNT = 10;

// Landscape backdrop card dimensions (films with a backdropUrl)
const BACKDROP_W = 220;
const BACKDROP_H = 150;

interface StripItem {
  key: string;
  title: string;
  year: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  hasTrailer: boolean;
  film?: HeroFilm;
  movie?: MovieAppearance;
}

interface Props {
  films?: HeroFilm[];
  movies?: MovieAppearance[];
  totalCount: number;
  contentInset?: number;
  bleedMargin?: number;
}

function sortItems(items: StripItem[]): StripItem[] {
  return [...items].sort((a, b) => {
    if (!a.year && !b.year) return 0;
    if (!a.year) return 1;
    if (!b.year) return -1;
    return parseInt(b.year) - parseInt(a.year);
  });
}

function buildItems(films?: HeroFilm[], movies?: MovieAppearance[]): StripItem[] {
  if (films && films.length > 0) {
    return films.map((f) => ({
      key: f.tmdbId,
      title: f.title,
      year: f.year ? String(f.year) : null,
      posterUrl: f.posterUrl,
      backdropUrl: f.backdropUrl,
      voteAverage: f.voteAverage,
      hasTrailer: !!f.trailerKey,
      film: f,
    }));
  }
  if (movies && movies.length > 0) {
    return movies.map((m) => ({
      key: m.name,
      title: m.name,
      year: m.year ?? null,
      posterUrl: m.imageUrl ?? null,
      backdropUrl: null,
      voteAverage: null,
      hasTrailer: false,
      movie: m,
    }));
  }
  return [];
}

/** Landscape backdrop card — used for the top film when it has a backdropUrl. */
function FeaturedFilmCard({ item, onPress }: { item: StripItem; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const webHoverProps =
    Platform.OS === 'web'
      ? ({ onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } as object)
      : {};

  return (
    <Pressable
      style={({ pressed }) => [styles.backdropCard, (pressed || hovered) && styles.cardActive]}
      onPress={onPress}
      {...webHoverProps}
    >
      {item.backdropUrl ? (
        <Image
          source={{ uri: item.backdropUrl }}
          style={styles.backdropImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : item.posterUrl ? (
        <Image
          source={{ uri: item.posterUrl }}
          style={styles.backdropImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.backdropImage, styles.placeholder]}>
          <Ionicons name="film-outline" size={28} color={COLORS.grey} />
        </View>
      )}

      {/* Bottom gradient + title overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(20,28,32,0.85)']}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.backdropMeta}>
        <Text style={styles.backdropTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.backdropPillRow}>
          {item.year ? (
            <Text style={styles.backdropPill}>{item.year}</Text>
          ) : null}
          {item.voteAverage != null ? (
            <Text style={styles.backdropPill}>★ {item.voteAverage.toFixed(1)}</Text>
          ) : null}
        </View>
      </View>

      {item.hasTrailer ? (
        <View style={styles.trailerBadge}>
          <Ionicons name="play-circle" size={22} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Standard portrait poster card for non-featured items. */
function StripCard({ item, onPress }: { item: StripItem; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const webHoverProps =
    Platform.OS === 'web'
      ? ({ onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } as object)
      : {};

  return (
    <Pressable
      style={({ pressed }) => [styles.card, (pressed || hovered) && styles.cardActive]}
      onPress={onPress}
      {...webHoverProps}
    >
      <View style={styles.posterWrapper}>
        {item.posterUrl ? (
          <Image
            source={{ uri: item.posterUrl }}
            style={{ width: CARD_W, height: CARD_H }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.placeholder, { width: CARD_W, height: CARD_H }]}>
            <Ionicons name="film-outline" size={22} color={COLORS.grey} />
            <Text style={[styles.placeholderName, { width: CARD_W - 16 }]} numberOfLines={3}>
              {item.title}
            </Text>
          </View>
        )}

        {/* ★ rating chip — top-left */}
        {item.voteAverage != null ? (
          <View style={styles.ratingChip}>
            <Text style={styles.ratingChipText}>★ {item.voteAverage.toFixed(1)}</Text>
          </View>
        ) : null}

        {/* Trailer play badge — top-right */}
        {item.hasTrailer ? (
          <View style={styles.trailerBadge}>
            <Ionicons name="play-circle" size={22} color="#fff" />
          </View>
        ) : null}
      </View>

      <Text style={[styles.title, { width: CARD_W }]} numberOfLines={2}>{item.title}</Text>
      {item.year ? <Text style={styles.year}>{item.year}</Text> : null}
    </Pressable>
  );
}

export function MovieStrip({ films, movies, totalCount, contentInset = 16, bleedMargin = 0 }: Props) {
  const router = useRouter();
  const [gridVisible, setGridVisible] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const allItems = buildItems(films, movies);
  const sorted = sortItems(allItems);

  const isFilmsPath = !!(films && films.length > 0);

  // For the films path: featured film uses backdrop card (if any film has one)
  const featuredFilm = isFilmsPath ? pickFeaturedFilm(films ?? []) : null;
  const featuredItem = featuredFilm
    ? sorted.find((it) => it.film?.tmdbId === featuredFilm.tmdbId)
    : null;
  const restItems = featuredItem
    ? sorted.filter((it) => it !== featuredItem)
    : sorted.slice(1);
  const legacyFeatured = !featuredItem ? sorted[0] : null;

  const cappedRest = isFilmsPath
    ? (showAll ? restItems : restItems.slice(0, INITIAL_COUNT - 1))
    : restItems.slice(0, INITIAL_COUNT - 1);

  const filmOverflow = isFilmsPath && !showAll && restItems.length > INITIAL_COUNT - 1
    ? restItems.length - (INITIAL_COUNT - 1)
    : 0;
  const legacyOverflow = !isFilmsPath
    ? totalCount - Math.min(sorted.length, INITIAL_COUNT)
    : 0;

  const legacyMovies: MovieAppearance[] = sorted
    .filter((it) => it.movie != null)
    .map((it) => it.movie!);

  const handlePress = (item: StripItem) => {
    if (item.film) {
      router.push(`/film/${item.film.tmdbId}`);
    } else if (item.movie) {
      const url = item.movie.url ?? `https://www.google.com/search?q=${encodeURIComponent(item.title + ' film')}`;
      Linking.openURL(url);
    }
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={bleedMargin ? { marginHorizontal: -bleedMargin } : undefined}
        contentContainerStyle={[styles.container, { paddingHorizontal: contentInset }]}
      >
        {/* Featured card: landscape backdrop (films) or poster (legacy) */}
        {featuredItem ? (
          <FeaturedFilmCard item={featuredItem} onPress={() => handlePress(featuredItem)} />
        ) : legacyFeatured ? (
          <StripCard item={legacyFeatured} onPress={() => handlePress(legacyFeatured)} />
        ) : null}

        {cappedRest.map((item, i) => (
          <StripCard key={item.key + i} item={item} onPress={() => handlePress(item)} />
        ))}

        {/* Films overflow: reveal all in-place */}
        {filmOverflow > 0 ? (
          <Pressable
            style={[styles.card, styles.overflowCard]}
            onPress={() => setShowAll(true)}
          >
            <Text style={styles.overflowCount}>+{filmOverflow}</Text>
            <Text style={styles.overflowLabel}>more</Text>
          </Pressable>
        ) : null}

        {/* Legacy movies overflow: open grid modal */}
        {legacyOverflow > 0 ? (
          <Pressable
            style={[styles.card, styles.overflowCard]}
            onPress={() => setGridVisible(true)}
          >
            <Text style={styles.overflowCount}>+{legacyOverflow}</Text>
            <Text style={styles.overflowLabel}>more</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {gridVisible && legacyMovies.length > 0 ? (
        <MovieGridModal
          movies={legacyMovies}
          onClose={() => setGridVisible(false)}
          onSelectMovie={(movie) => {
            setGridVisible(false);
            const url = movie.url ?? `https://www.google.com/search?q=${encodeURIComponent(movie.name + ' film')}`;
            Linking.openURL(url);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  // Landscape backdrop card
  backdropCard: {
    width: BACKDROP_W,
    height: BACKDROP_H,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  backdropImage: {
    width: BACKDROP_W,
    height: BACKDROP_H,
  },
  backdropMeta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    gap: 4,
  },
  backdropTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: '#fff',
    lineHeight: 17,
  },
  backdropPillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  backdropPill: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  // Standard portrait card
  card: {
    width: CARD_W,
    alignItems: 'center',
  },
  cardActive: { opacity: 0.8 },
  posterWrapper: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
  },
  placeholder: {
    backgroundColor: COLORS.navy + '18',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  placeholderName: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    textAlign: 'center',
    opacity: 0.65,
    paddingHorizontal: 4,
  },
  ratingChip: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  ratingChipText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 8,
    color: '#fff',
    letterSpacing: 0.2,
  },
  trailerBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  title: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    textAlign: 'center',
    lineHeight: 14,
  },
  year: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.grey,
    marginTop: 2,
    textAlign: 'center',
  },
  overflowCard: {
    height: CARD_H + 6 + 14 + 2 + 12,
    justifyContent: 'center',
    backgroundColor: COLORS.navy + '0f',
    borderRadius: 8,
  },
  overflowCount: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.navy,
    textAlign: 'center',
  },
  overflowLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textAlign: 'center',
  },
});
