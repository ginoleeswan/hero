import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { shortPublisher, type TasteFacet } from '../../lib/db/taste';

// Warm, on-brand, mutually distinguishable segment colours (orange lead, then a
// navy-teal, gold, and brown), with a muted taupe for the aggregated remainder.
const SEGMENT_COLORS = [COLORS.orange, '#3d5a66', '#E0A44B', '#9c6b4f'];
const OTHER_COLOR = '#cbb79f';
const MAX_SEGMENTS = 4;

interface Segment {
  name: string;
  pct: number;
  color: string;
}

/**
 * A compact stacked bar of the fan's universe mix — the proportional split of
 * their taste across their top publishers, with a legend. Turns "Top universe:
 * Marvel" from a single label into a readable distribution. Renders nothing
 * unless there are at least two universes to compare.
 */
export function TasteMixBar({ facets }: { facets: TasteFacet[] }) {
  const total = facets.reduce((sum, f) => sum + f.weight, 0);
  if (total <= 0 || facets.length < 2) return null;

  const top = facets.slice(0, MAX_SEGMENTS);
  const otherWeight = total - top.reduce((sum, f) => sum + f.weight, 0);

  const segments: Segment[] = top.map((f, i) => ({
    name: shortPublisher(f.name),
    pct: Math.round((f.weight / total) * 100),
    color: SEGMENT_COLORS[i],
  }));
  if (otherWeight > 0) {
    segments.push({
      name: 'Other',
      pct: Math.round((otherWeight / total) * 100),
      color: OTHER_COLOR,
    });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {segments.map((s) => (
          <View key={s.name} style={{ flex: Math.max(s.pct, 1), backgroundColor: s.color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.name} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {s.name}
            </Text>
            <Text style={styles.legendPct}>{s.pct}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#eee3d3',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendName: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  legendPct: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
});
