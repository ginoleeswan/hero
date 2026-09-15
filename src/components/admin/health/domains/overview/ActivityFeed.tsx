// Live activity feed — the ops floor. Renders the cross-domain timeline
// (runs · page views · engagement) newest-first, with a relative timestamp and
// an optional context line ("Berlin, Germany · mobile · Safari on iOS") per
// row. Cursor-paged: `onLoadMore` appends the next page in place, so the panel
// scrolls back through history instead of stopping at the last dozen rows.
// The list itself scrolls within its panel on desktop (fill layout).
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from '../../../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../../../constants/colors';
import { relTime, CC } from '../../format';
import { LoadMore } from '../../ui';
import type { FeedItem } from './feed';

export function ActivityFeed({
  items,
  narrow,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  dense = true,
}: {
  items: FeedItem[];
  narrow: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Dense (overview panel) vs roomy (the full history page). */
  dense?: boolean;
}) {
  const router = useRouter();
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="pulse-outline" size={20} color={COLORS.grey} />
        <Text style={styles.emptyText}>Quiet right now — activity streams in as it happens.</Text>
      </View>
    );
  }
  const body = items.map((it, i) => {
    const row = (
      <View style={[styles.row, !dense && styles.rowRoomy, i > 0 && styles.rowDivide]}>
        <View style={[styles.icon, { backgroundColor: it.tint + '1f' }]}>
          <Ionicons name={it.icon as keyof typeof Ionicons.glyphMap} size={13} color={it.tint} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.text} numberOfLines={1}>
            {it.text}
          </Text>
          {it.meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {it.meta}
            </Text>
          ) : null}
        </View>
        <Text style={styles.time}>{relTime(it.at)}</Text>
      </View>
    );
    return it.heroId ? (
      <Pressable key={`${it.at}-${i}`} onPress={() => router.push(`/character/${it.heroId}`)}>
        {row}
      </Pressable>
    ) : (
      <View key={`${it.at}-${i}`}>{row}</View>
    );
  });
  const more =
    hasMore && onLoadMore ? (
      <LoadMore onPress={onLoadMore} loading={loadingMore} label="Load older activity" />
    ) : null;
  // On desktop the panel is a fixed-height fill cell → scroll inside it. On
  // mobile the whole page scrolls, so render flat (no nested scroller).
  return narrow || !dense ? (
    <View>
      {body}
      {more}
    </View>
  ) : (
    <ScrollView style={styles.scroll} nestedScrollEnabled showsVerticalScrollIndicator>
      {body}
      {more}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, minHeight: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  rowRoomy: { paddingVertical: 9 },
  rowDivide: { borderTopWidth: 1, borderTopColor: CC.hairline },
  icon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, gap: 1 },
  text: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  meta: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey },
  time: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  emptyText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 240,
  },
});
