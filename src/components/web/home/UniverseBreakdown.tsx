import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { PublisherCounts } from '../../../lib/db/heroes';

interface UniverseBreakdownProps {
  counts: PublisherCounts;
  total: number;
  onNavigate: (path: string) => void;
}

const MARVEL = COLORS.orange;
const DC = COLORS.blue;
const OTHER = 'rgba(41,60,67,0.55)';

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
  path?: string;
}

export function UniverseBreakdown({ counts, total, onNavigate }: UniverseBreakdownProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const pagePad = width < 640 ? 16 : 32;

  const denom = total > 0 ? total : counts.marvel + counts.dc + counts.other || 1;
  const segments: Segment[] = [
    {
      key: 'marvel',
      label: 'Marvel',
      value: counts.marvel,
      color: MARVEL,
      path: '/universe/marvel',
    },
    { key: 'dc', label: 'DC', value: counts.dc, color: DC, path: '/universe/dc' },
    { key: 'other', label: 'Other publishers', value: counts.other, color: OTHER },
  ];

  // Build the donut as a conic-gradient (web). Walk the segments accumulating
  // degrees so each slice picks up where the last ended.
  let acc = 0;
  const stops = segments
    .map((s) => {
      const start = (acc / denom) * 360;
      acc += s.value;
      const end = (acc / denom) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    })
    .join(', ');
  const donutBg = `conic-gradient(${stops})`;

  return (
    <View style={[styles.section, { paddingHorizontal: pagePad }] as object}>
      <View style={styles.header}>
        <View style={styles.accentBar} />
        <View style={styles.headerText}>
          <Text style={styles.label}>The Encyclopedia</Text>
          <Text style={styles.title}>Universe Breakdown</Text>
        </View>
      </View>

      <View style={[styles.body, !isDesktop && (styles.bodyStack as object)] as object}>
        <View style={styles.donutWrap}>
          <View style={[styles.donut, { backgroundImage: donutBg }] as object} />
          <View style={styles.donutHole}>
            <Text style={styles.donutTotal}>{total > 0 ? total.toLocaleString() : '—'}</Text>
            <Text style={styles.donutCaption}>heroes & villains</Text>
          </View>
        </View>

        <View style={styles.legend}>
          {segments.map((s) => {
            const pct = denom > 0 ? Math.round((s.value / denom) * 100) : 0;
            const row = (
              <View style={styles.legendRow} key={s.key}>
                <View style={[styles.dot, { backgroundColor: s.color }] as object} />
                <Text style={styles.legendLabel}>{s.label}</Text>
                <View style={styles.legendVals}>
                  <Text style={styles.legendCount}>{s.value.toLocaleString()}</Text>
                  <Text style={styles.legendPct}>{pct}%</Text>
                </View>
              </View>
            );
            return s.path ? (
              <Pressable
                key={s.key}
                onPress={() => onNavigate(s.path!)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [styles.legendPress, hovered && (styles.legendPressHover as object)] as object
                }
              >
                {row}
              </Pressable>
            ) : (
              <View key={s.key} style={styles.legendPress}>
                {row}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 52 },
  header: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
    marginBottom: 24,
  },
  accentBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.orange, minHeight: 38 },
  headerText: { gap: 2, justifyContent: 'center' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 36, color: COLORS.navy, lineHeight: 38 },

  body: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  bodyStack: { flexDirection: 'column', alignItems: 'flex-start', gap: 28 } as object,

  donutWrap: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center' },
  donut: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
  } as object,
  donutHole: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: COLORS.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTotal: { fontFamily: 'Flame-Regular', fontSize: 28, color: COLORS.navy, lineHeight: 30 },
  donutCaption: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    color: 'rgba(41,60,67,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },

  legend: { flex: 1, gap: 6, maxWidth: 420 },
  legendPress: { borderRadius: 10, transition: 'background-color 150ms ease' } as object,
  legendPressHover: { backgroundColor: 'rgba(41,60,67,0.06)' } as object,
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  dot: { width: 12, height: 12, borderRadius: 4 } as object,
  legendLabel: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.navy,
  },
  legendVals: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  legendCount: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.navy },
  legendPct: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(41,60,67,0.5)',
    width: 36,
    textAlign: 'right',
  },
});
