import { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { MovieAppearance } from '../types';
import { COLORS } from '../constants/colors';
import { MovieDetailSheet } from './MovieDetailSheet';
import { MovieGridModal } from './MovieGridModal';
import type { HeroFilm } from '../lib/db/films';

const FEATURED_W = 120;
const FEATURED_H = 180;
const CARD_W = 100;
const CARD_H = 150;
const INITIAL_COUNT = 10;

interface StripItem {
  key: string;
  title: string;
  year: string | null;
  posterUrl: string | null;
  hasTrailer: boolean;
  film?: HeroFilm;
  movie?: MovieAppearance;
}

interface Props {
  films?: HeroFilm[];
  movies?: MovieAppearance[];
  totalCount: number;
  // Horizontal inset of the first/last card from the scroll viewport edges.
  contentInset?: number;
  // Negative outer margin so the strip can break out of a padded parent (e.g. a
  // web card) and run edge-to-edge. Pass the parent's horizontal padding.
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
      hasTrailer: false,
      movie: m,
    }));
  }
  return [];
}

function StripCard({
  item,
  featured,
  onPress,
}: {
  item: StripItem;
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
      <View
        style={[
          styles.posterWrapper,
          featured && styles.featuredPosterWrapper,
          { width: w, height: h },
        ]}
      >
        {item.posterUrl ? (
          <Image
            source={{ uri: item.posterUrl }}
            style={{ width: w, height: h }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.placeholder, { width: w, height: h }]}>
            <Ionicons name="film-outline" size={featured ? 28 : 22} color={COLORS.grey} />
            <Text style={[styles.placeholderName, { width: w - 16 }]} numberOfLines={3}>
              {item.title}
            </Text>
          </View>
        )}
        {featured ? (
          <View style={styles.firstBadge}>
            <Text style={styles.firstBadgeText}>LATEST</Text>
          </View>
        ) : null}
        {item.hasTrailer ? (
          <View style={styles.trailerBadge}>
            <Ionicons name="play-circle" size={22} color="#fff" />
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, { width: w }]} numberOfLines={2}>
        {item.title}
      </Text>
      {item.year ? <Text style={styles.year}>{item.year}</Text> : null}
    </Pressable>
  );
}

export function MovieStrip({ films, movies, totalCount, contentInset = 16, bleedMargin = 0 }: Props) {
  const [selectedItem, setSelectedItem] = useState<StripItem | null>(null);
  const [gridVisible, setGridVisible] = useState(false);

  const allItems = buildItems(films, movies);
  const sorted = sortItems(allItems);

  // Keep selectedItem in sync when films/movies prop updates (re-enrichment).
  // Only applies to legacy movie path (films are immutable snapshots).
  useEffect(() => {
    if (!selectedItem || selectedItem.movie) return;
    const updated = movies?.find(
      (m) => m.name === selectedItem.title && m.year === selectedItem.year,
    );
    if (updated && updated !== selectedItem.movie) {
      setSelectedItem((prev) =>
        prev ? { ...prev, movie: updated, posterUrl: updated.imageUrl ?? null } : prev,
      );
    }
  }, [movies]);

  const visible = sorted.slice(0, INITIAL_COUNT);
  const overflow = totalCount - visible.length;
  const [featured, ...rest] = visible;

  // For the legacy grid modal we still need MovieAppearance[].
  const legacyMovies: MovieAppearance[] = sorted
    .filter((it) => it.movie != null)
    .map((it) => it.movie!);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={bleedMargin ? { marginHorizontal: -bleedMargin } : undefined}
        contentContainerStyle={[styles.container, { paddingHorizontal: contentInset }]}
      >
        {featured ? (
          <StripCard
            key="featured"
            item={featured}
            featured
            onPress={() => setSelectedItem(featured)}
          />
        ) : null}
        {rest.map((item, i) => (
          <StripCard key={item.key + i} item={item} onPress={() => setSelectedItem(item)} />
        ))}
        {overflow > 0 ? (
          <Pressable
            style={[styles.card, styles.overflowCard]}
            onPress={() => setGridVisible(true)}
          >
            <Text style={styles.overflowCount}>+{overflow}</Text>
            <Text style={styles.overflowLabel}>more</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {selectedItem ? (
        <MovieDetailSheet
          film={selectedItem.film}
          movie={selectedItem.movie}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}

      {gridVisible && legacyMovies.length > 0 ? (
        <MovieGridModal
          movies={legacyMovies}
          onClose={() => setGridVisible(false)}
          onSelectMovie={(movie) => {
            setGridVisible(false);
            const found = sorted.find((it) => it.movie === movie) ?? null;
            setSelectedItem(found);
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
