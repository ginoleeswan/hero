import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, PAPER_TEXT, ORANGE_INK } from '../../constants/colors';
import type { TitleRecommendation } from '../../lib/db/titles';

const CARD_W = 116;
const POSTER_H = 174; // 2:3

function RecCard({ rec, onPress }: { rec: TitleRecommendation; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="link"
      accessibilityLabel={rec.title}
    >
      {rec.posterUrl ? (
        <Image
          source={{ uri: rec.posterUrl }}
          style={styles.poster}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.poster, styles.posterPlaceholder]}>
          <Ionicons name="film-outline" size={26} color={COLORS.grey} />
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {rec.title}
      </Text>
      {rec.year != null ? <Text style={styles.year}>{rec.year}</Text> : null}
    </TouchableOpacity>
  );
}

/**
 * "You might also like" — TMDB recommendations narrowed to in-catalogue titles.
 * `inCard` drops the rail's own header (the card supplies it) and bleeds to the
 * card edges.
 */
export function RecommendationsRail({
  recommendations,
  label = 'You might also like',
  inCard,
}: {
  recommendations: TitleRecommendation[];
  label?: string;
  inCard?: boolean;
}) {
  const router = useRouter();
  if (recommendations.length === 0) return null;

  const scroller = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={inCard ? styles.bleed : undefined}
      contentContainerStyle={styles.row}
    >
      {recommendations.map((rec) => (
        <RecCard key={rec.id} rec={rec} onPress={() => router.push(`/title/${rec.id}`)} />
      ))}
    </ScrollView>
  );

  if (inCard) return scroller;

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      {scroller}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  label: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: ORANGE_INK,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: 20,
  },
  row: {
    gap: 14,
    paddingHorizontal: 20,
  },
  bleed: { marginHorizontal: -20 },
  card: { width: CARD_W, gap: 7 },
  poster: {
    width: CARD_W,
    height: POSTER_H,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: COLORS.navy + '12',
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
    lineHeight: 15,
  },
  year: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    marginTop: -2,
  },
});
