// Live activity feed — the ops floor. Renders the merged cross-domain timeline
// (runs · page views · engagement) newest-first, with a relative timestamp per
// row. The list itself scrolls within its panel (fill layout).
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../../constants/colors';
import { relTime, CC } from '../../format';
import type { FeedItem } from './feed';

export function ActivityFeed({ items, narrow }: { items: FeedItem[]; narrow: boolean }) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="pulse-outline" size={20} color={COLORS.grey} />
        <Text style={styles.emptyText}>Quiet right now — activity streams in as it happens.</Text>
      </View>
    );
  }
  const body = items.map((it, i) => (
    <View key={`${it.at}-${i}`} style={[styles.row, i > 0 && styles.rowDivide]}>
      <View style={[styles.icon, { backgroundColor: it.tint + '1f' }]}>
        <Ionicons name={it.icon as keyof typeof Ionicons.glyphMap} size={13} color={it.tint} />
      </View>
      <Text style={styles.text} numberOfLines={1}>
        {it.text}
      </Text>
      <Text style={styles.time}>{relTime(it.at)}</Text>
    </View>
  ));
  // On desktop the panel is a fixed-height fill cell → scroll inside it. On
  // mobile the whole page scrolls, so render flat (no nested scroller).
  return narrow ? <View>{body}</View> : (
    <ScrollView style={styles.scroll} nestedScrollEnabled showsVerticalScrollIndicator>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, minHeight: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  rowDivide: { borderTopWidth: 1, borderTopColor: CC.hairline },
  icon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.navy },
  time: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: COLORS.grey, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  emptyText: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, textAlign: 'center', maxWidth: 240 },
});
