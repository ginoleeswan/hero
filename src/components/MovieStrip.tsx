import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { MovieAppearance } from '../types';
import { COLORS } from '../constants/colors';

const CARD_W = 80;
const CARD_H = 120;
const INITIAL_COUNT = 10;

interface Props {
  movies: MovieAppearance[];
  totalCount: number;
}

export function MovieStrip({ movies, totalCount }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? movies : movies.slice(0, INITIAL_COUNT);
  const overflow = totalCount - visible.length;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {visible.map((movie, i) => (
        <View key={i} style={styles.card}>
          {movie.imageUrl ? (
            <Image
              source={{ uri: movie.imageUrl }}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.poster, styles.placeholder]}>
              <Ionicons name="film-outline" size={24} color={COLORS.grey} />
            </View>
          )}
          <Text style={styles.title} numberOfLines={2}>
            {movie.name}
          </Text>
          {movie.year ? <Text style={styles.year}>{movie.year}</Text> : null}
        </View>
      ))}

      {!expanded && overflow > 0 ? (
        <Pressable style={[styles.card, styles.overflowCard]} onPress={() => setExpanded(true)}>
          <Text style={styles.overflowCount}>+{overflow}</Text>
          <Text style={styles.overflowLabel}>more</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 2,
    gap: 10,
    paddingBottom: 4,
  },
  card: {
    width: CARD_W,
    alignItems: 'center',
  },
  poster: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 8,
    marginBottom: 6,
  },
  placeholder: {
    backgroundColor: COLORS.navy + '18',
    justifyContent: 'center',
    alignItems: 'center',
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
