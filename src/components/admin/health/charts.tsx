// Self-contained chart primitives for the catalog-health dashboard.
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { COLORS } from '../../../constants/colors';
import type { HealthSnapshot } from '../../../lib/db/catalogHealth';
import { healthColor } from './format';

// ── Completeness gauge ────────────────────────────────────────────────────────
export function Gauge({ value, size = 150 }: { value: number; size?: number }) {
  const small = size < 110;
  const stroke = small ? 8 : size < 130 ? 10 : 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tint = healthColor(value);
  const offset = c * (1 - value / 100);
  // Scale the centre readout to the ring (≈46px at the 150 desktop size, so the
  // desktop gauge is unchanged) so a 76px mobile gauge stays legible & tight.
  const numSize = Math.round(size * 0.31);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tint}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </Svg>
      <View style={styles.gaugeCenter}>
        <View style={styles.gaugeNumRow}>
          <Text style={[styles.gaugeNum, { fontSize: numSize, lineHeight: numSize + 2 }]}>
            {value}
          </Text>
          <Text style={[styles.gaugePct, { fontSize: Math.round(numSize * 0.42) }]}>%</Text>
        </View>
        {!small && <Text style={[styles.gaugeCaption, { color: tint }]}>complete</Text>}
      </View>
    </View>
  );
}

// Segmented ring (alignment split).
export function Donut({
  segments,
  total,
}: {
  segments: { value: number; color: string; label: string }[];
  total: number;
}) {
  const size = 132;
  const stroke = 17;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fracs = segments.map((s) => (total > 0 ? s.value / total : 0));
  // Cumulative fraction preceding each segment — the ring's rotation offset.
  const offsets = fracs.map((_, i) => fracs.slice(0, i).reduce((sum, f) => sum + f, 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#efe6d6"
          strokeWidth={stroke}
          fill="none"
        />
        {segments.map((s, i) => (
          <Circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={s.color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${fracs[i] * c} ${c}`}
            strokeDashoffset={-offsets[i] * c}
          />
        ))}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={styles.donutNum}>{total.toLocaleString()}</Text>
        <Text style={styles.donutLabel}>heroes</Text>
      </View>
    </View>
  );
}

// Horizontal stat row — label + value on top, then a FULL-WIDTH bar beneath.
// The track is a plain block (stretched to full width by its column parent), so
// the % fill resolves; a % inside a flex-sized track collapses to 0 in Yoga.
export function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const p = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barHead}>
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barValue}>{value.toLocaleString()}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${p}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// Completeness-over-time area+line. Fixed 0–100 Y scale; size measured on layout
// so the chart fills whatever panel height it's given (min 150).
export function CompletenessChart({ snaps }: { snaps: HealthSnapshot[] }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const w = size.w;
  const H = size.h || 160;
  const padT = 12;
  const padB = 22;
  const vals = snaps.map((s) => {
    const ms = [s.portrait, s.image, s.stats, s.summary, s.first_issue].map((m) =>
      s.total > 0 ? (m / s.total) * 100 : 0,
    );
    return Math.round(ms.reduce((a, b) => a + b, 0) / ms.length);
  });
  const yOf = (v: number) => padT + (1 - v / 100) * (H - padT - padB);
  const xOf = (i: number) => (vals.length <= 1 ? w / 2 : (i / (vals.length - 1)) * w);
  const line = vals.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  const area = vals.length
    ? `M0,${H - padB} ` +
      vals.map((v, i) => `L${xOf(i)},${yOf(v)}`).join(' ') +
      ` L${w},${H - padB} Z`
    : '';
  return (
    <View
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ flex: 1, minHeight: 150 }}
    >
      {w > 0 && (
        <Svg width={w} height={H}>
          {[0, 50, 100].map((g) => (
            <Polyline
              key={g}
              points={`0,${yOf(g)} ${w},${yOf(g)}`}
              stroke="#efe6d6"
              strokeWidth={1}
            />
          ))}
          {area ? <Path d={area} fill={COLORS.green + '1f'} /> : null}
          {vals.length > 1 && (
            <Polyline points={line} fill="none" stroke={COLORS.green} strokeWidth={2.5} />
          )}
          {vals.map((v, i) => (
            <Circle
              key={i}
              cx={xOf(i)}
              cy={yOf(v)}
              r={vals.length === 1 ? 5 : 3.5}
              fill={COLORS.green}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gaugeCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  gaugeNumRow: { flexDirection: 'row', alignItems: 'baseline' },
  gaugeNum: { fontFamily: 'Flame-Regular', fontSize: 46, color: '#fff', lineHeight: 48 },
  gaugePct: { fontFamily: 'Flame-Regular', fontSize: 19, color: 'rgba(255,255,255,0.55)' },
  gaugeCaption: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  donutNum: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.black, lineHeight: 28 },
  donutLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.grey },
  barRow: { gap: 8, paddingVertical: 6 },
  barHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },
  barLabel: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.black },
  barTrack: {
    height: 12,
    backgroundColor: 'rgba(41,60,67,0.08)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: { height: 12, borderRadius: 6 },
  barValue: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.navy },
});
