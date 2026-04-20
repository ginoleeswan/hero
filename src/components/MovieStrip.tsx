import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { MovieAppearance } from '../types';
import { COLORS } from '../constants/colors';
import { MovieDetailSheet } from './MovieDetailSheet';
import { MovieGridModal } from './MovieGridModal';

const FEATURED_W = 120;
const FEATURED_H = 180;
const CARD_W = 100;
const CARD_H = 150;
const INITIAL_COUNT = 10;

interface Props {
  movies: MovieAppearance[];
  totalCount: number;
}

function sortByYear(movies: MovieAppearance[]): MovieAppearance[] {
  return [...movies].sort((a, b) => {
    if (!a.year && !b.year) return 0;
    if (!a.year) return 1;
    if (!b.year) return -1;
    return parseInt(b.year) - parseInt(a.year);
  });
}

function MovieCard({
  movie,
  featured,
  onPress,
}: {
  movie: MovieAppearance;
  featured?: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const w = featured ? FEATURED_W : CARD_W;
  const h = featured ? FEATURED_H : CARD_H;

  const webHoverProps =
    Platform.OS === 'web'
      ? ({
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        } as object)
      : {};

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        featured && styles.featuredCard,
        (pressed || hovered) && styles.cardActive,
      ]}
      onPress={onPress}
      {...webHoverProps}
    >
      <View style={[styles.posterWrapper, featured && styles.featuredPosterWrapper, { width: w, height: h }]}>
        {movie.imageUrl ? (
          <Image
            source={{ uri: movie.imageUrl }}
            style={{ width: w, height: h }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.placeholder, { width: w, height: h }]}>
            <Ionicons name="film-outline" size={featured ? 28 : 22} color={COLORS.grey} />
            <Text style={[styles.placeholderName, { width: w - 16 }]} numberOfLines={3}>
              {movie.name}
            </Text>
          </View>
        )}
        {featured ? (
          <View style={styles.firstBadge}>
            <Text style={styles.firstBadgeText}>LATEST</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, { width: w }]} numberOfLines={2}>
        {movie.name}
      </Text>
      {movie.year ? <Text style={styles.year}>{movie.year}</Text> : null}
    </Pressable>
  );
}

export function MovieStrip({ movies, totalCount }: Props) {
  const [selectedMovie, setSelectedMovie] = useState<MovieAppearance | null>(null);
  const [gridVisible, setGridVisible] = useState(false);

  const sorted = sortByYear(movies);
  const visible = sorted.slice(0, INITIAL_COUNT);
  const overflow = totalCount - visible.length;
  const [featured, ...rest] = visible;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {featured ? (
          <MovieCard key="featured" movie={featured} featured onPress={() => setSelectedMovie(featured)} />
        ) : null}
        {rest.map((movie, i) => (
          <MovieCard key={i} movie={movie} onPress={() => setSelectedMovie(movie)} />
        ))}
        {overflow > 0 ? (
          <Pressable style={[styles.card, styles.overflowCard]} onPress={() => setGridVisible(true)}>
            <Text style={styles.overflowCount}>+{overflow}</Text>
            <Text style={styles.overflowLabel}>more</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {selectedMovie ? (
        <MovieDetailSheet movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      ) : null}

      {gridVisible ? (
        <MovieGridModal movies={sorted} onClose={() => setGridVisible(false)} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 2,
    gap: 10,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  card: {
    width: CARD_W,
    alignItems: 'center',
  },
  featuredCard: {
    width: FEATURED_W,
  },
  cardActive: {
    opacity: 0.8,
  },
  posterWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
  },
  featuredPosterWrapper: {
    borderWidth: 2,
    borderColor: COLORS.orange,
    borderRadius: 9,
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
  firstBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: COLORS.orange,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  firstBadgeText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 8,
    color: '#fff',
    letterSpacing: 0.5,
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
    fontFamily: 'Flame-Bold',
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
