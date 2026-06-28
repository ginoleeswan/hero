import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import type { TitleReview } from '../../lib/tmdb/extras';

function ReviewCard({ review }: { review: TitleReview }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{review.author.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.author} numberOfLines={1}>
          {review.author}
        </Text>
        {review.rating != null ? (
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={11} color={COLORS.orange} />
            <Text style={styles.ratingText}>{review.rating}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.body} numberOfLines={6}>
        {review.content}
      </Text>
      {review.url ? (
        <TouchableOpacity
          onPress={() => Linking.openURL(review.url as string)}
          activeOpacity={0.7}
          accessibilityRole="link"
        >
          <Text style={styles.readMore}>Read full review →</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Audience/critic reviews from TMDB, as a horizontal carousel. Empty-safe. */
export function ReviewsSection({ reviews }: { reviews: TitleReview[] }) {
  if (reviews.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.label}>Reviews</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {reviews.map((r, i) => (
          <ReviewCard key={`${r.author}-${i}`} review={r} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 14 },
  label: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
  },
  card: {
    width: Platform.OS === 'web' ? 400 : 300,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    padding: 18,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Flame-Regular', fontSize: 13, color: '#fff' },
  author: { fontFamily: 'Flame-Regular', fontSize: 14, color: COLORS.navy, flex: 1, minWidth: 0 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.orange + '18',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingText: { fontFamily: 'Flame-Regular', fontSize: 12, color: COLORS.orange },
  body: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    color: COLORS.navy + 'cc',
    lineHeight: 21,
  },
  readMore: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12.5,
    color: COLORS.orange,
    letterSpacing: 0.2,
  },
});
