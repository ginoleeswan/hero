// The Traffic tab's headline chart: daily page views (bars) with a visitors line
// overlaid, on a readable frame — a left value axis, gridlines, X date ticks, and a
// hover/press tooltip (day · views · visitors). Fixes the old bare-bars chart that
// gave an admin no way to read a day or a magnitude. Width is measured on layout
// (like CompletenessChart); height is fixed by the caller.
import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../../../ui/Text';
import Svg, { Rect, Line, Polyline, Circle } from 'react-native-svg';
import { COLORS } from '../../../../../constants/colors';
import type { TrafficSeriesPoint } from '../../../../../lib/db/traffic';

const VIEWS = COLORS.blue;
const VISITORS = COLORS.navy;
const GRID = '#efe6d6';
const PAD_L = 34; // value-axis gutter
const PAD_T = 12;
const PAD_B = 22;

const fmtDay = (
  day: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, opts);

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);

export function TrafficTrendChart({
  series,
  height = 200,
}: {
  series: TrafficSeriesPoint[];
  height?: number;
}) {
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  const n = series.length;
  const maxV = Math.max(1, ...series.map((d) => d.views));
  const plotH = height - PAD_T - PAD_B;
  const baseY = height - PAD_B;
  const colW = n > 0 ? (w - PAD_L) / n : 0;
  const barW = Math.max(2, Math.min(22, colW * 0.55));
  const xCenter = (i: number) => PAD_L + (i + 0.5) * colW;
  const yOf = (v: number) => PAD_T + (1 - v / maxV) * plotH;

  // ~5 evenly-spaced date ticks, always including the last day. The last label
  // is clamped off the right edge, which on narrow widths drags it left onto its
  // step neighbour ("Jul 11Jul 16") — cull any tick the clamped label would cover.
  const step = Math.max(1, Math.ceil(n / 5));
  const tickIdx = new Set<number>();
  for (let i = 0; i < n; i += step) tickIdx.add(i);
  if (n > 0) tickIdx.add(n - 1);
  const tickLeft = (i: number) => Math.max(PAD_L, Math.min(w - 54, xCenter(i) - 27));
  const lastTickLeft = n > 0 ? tickLeft(n - 1) : 0;
  const ticks = Array.from(tickIdx)
    .sort((a, b) => a - b)
    .filter((i) => i === n - 1 || lastTickLeft - tickLeft(i) >= 50);

  const gridVals = [0, 0.5, 1].map((f) => Math.round(maxV * f));
  const visitorLine = series
    .map((d, i) => `${xCenter(i).toFixed(1)},${yOf(d.visitors).toFixed(1)}`)
    .join(' ');
  const hv = hover != null ? series[hover] : null;

  return (
    <View style={styles.wrap}>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: VIEWS }]} />
          <Text style={styles.legendText}>Views</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: VISITORS }]} />
          <Text style={styles.legendText}>Visitors</Text>
        </View>
      </View>

      <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Svg width={w} height={height}>
            {/* Gridlines */}
            {gridVals.map((v, gi) => {
              const y = yOf(v);
              return (
                <Line key={gi} x1={PAD_L} y1={y} x2={w} y2={y} stroke={GRID} strokeWidth={1} />
              );
            })}
            {/* Hover guide */}
            {hover != null && (
              <Line
                x1={xCenter(hover)}
                y1={PAD_T}
                x2={xCenter(hover)}
                y2={baseY}
                stroke="rgba(41,60,67,0.25)"
                strokeWidth={1}
              />
            )}
            {/* Views bars */}
            {series.map((d, i) => {
              const y = yOf(d.views);
              return (
                <Rect
                  key={i}
                  x={xCenter(i) - barW / 2}
                  y={y}
                  width={barW}
                  height={Math.max(0, baseY - y)}
                  rx={Math.min(3, barW / 2)}
                  fill={hover === i ? COLORS.orange : VIEWS}
                  opacity={hover == null || hover === i ? 1 : 0.5}
                />
              );
            })}
            {/* Visitors line + points */}
            {n > 1 && (
              <Polyline
                points={visitorLine}
                fill="none"
                stroke={VISITORS}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            )}
            {series.map((d, i) => (
              <Circle
                key={i}
                cx={xCenter(i)}
                cy={yOf(d.visitors)}
                r={hover === i ? 3.5 : 2}
                fill={VISITORS}
              />
            ))}
          </Svg>
        )}

        {/* Value-axis labels, in the left gutter on each gridline */}
        {w > 0 &&
          gridVals.map((v, gi) => (
            <Text key={gi} style={[styles.yLabel, { top: yOf(v) - 7 }]}>
              {compact(v)}
            </Text>
          ))}

        {/* Hover / press capture: one transparent column per day (after the gutter) */}
        <View style={styles.captureRow} pointerEvents="box-none">
          {series.map((d, i) => (
            <Pressable
              key={i}
              style={styles.captureCol}
              onHoverIn={() => setHover(i)}
              onHoverOut={() => setHover((h) => (h === i ? null : h))}
              onPress={() => setHover((h) => (h === i ? null : i))}
            />
          ))}
        </View>

        {/* Tooltip */}
        {hv && hover != null && w > 0 && (
          <View
            style={[styles.tip, { left: Math.max(PAD_L, Math.min(w - 150, xCenter(hover) - 75)) }]}
            pointerEvents="none"
          >
            <Text style={styles.tipDay}>
              {fmtDay(hv.day, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <View style={styles.tipRow}>
              <View style={[styles.legendDot, { backgroundColor: VIEWS }]} />
              <Text style={styles.tipMetric}>Views</Text>
              <Text style={styles.tipVal}>{hv.views.toLocaleString()}</Text>
            </View>
            <View style={styles.tipRow}>
              <View style={[styles.legendDot, { backgroundColor: VISITORS }]} />
              <Text style={styles.tipMetric}>Visitors</Text>
              <Text style={styles.tipVal}>{hv.visitors.toLocaleString()}</Text>
            </View>
          </View>
        )}
      </View>

      {/* X date ticks */}
      {w > 0 && (
        <View style={styles.ticks} pointerEvents="none">
          {ticks.map((i) => (
            <Text key={i} style={[styles.tick, { left: tickLeft(i) }]}>
              {fmtDay(series[i].day)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  legend: { flexDirection: 'row', gap: 14, marginBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 999 },
  legendText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },
  yLabel: {
    position: 'absolute',
    left: 0,
    width: PAD_L - 6,
    textAlign: 'right',
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    color: COLORS.grey,
  },
  captureRow: {
    position: 'absolute',
    top: 0,
    left: PAD_L,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  captureCol: { flex: 1, height: '100%' },
  tip: {
    position: 'absolute',
    top: 2,
    width: 150,
    backgroundColor: COLORS.deepNavy,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
    shadowOffset: { width: 0, height: 4 },
  },
  tipDay: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff', marginBottom: 2 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipMetric: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  tipVal: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  ticks: { height: 14, position: 'relative' },
  tick: {
    position: 'absolute',
    width: 54,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    color: COLORS.grey,
  },
});
