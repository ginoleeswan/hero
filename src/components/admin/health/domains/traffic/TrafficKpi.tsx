// Headline KPI tile for the Traffic tab: a big tinted value with a period-over-
// period delta chip and an optional trend sparkline — so a number carries
// direction and shape, not just magnitude. `live` adds a pulsing dot; `footer`
// slots a custom element (e.g. the signed-in/anon split bar).
import { useEffect, useRef, type ReactNode } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../../constants/colors';
import { Sparkline } from './Sparkline';

/** Percent change of `cur` vs `prev`; null when there's no prior baseline. */
export function pctDelta(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function DeltaChip({ delta }: { delta: number }) {
  const up = delta >= 0;
  const c = up ? COLORS.green : COLORS.red;
  return (
    <View style={[styles.chip, { backgroundColor: c + '1a' }]}>
      <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={10} color={c} />
      <Text style={[styles.chipText, { color: c }]}>{Math.abs(delta)}%</Text>
    </View>
  );
}

function LiveDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[styles.liveDot, { opacity: pulse }]} />;
}

export function TrafficKpi({
  label,
  value,
  tint = COLORS.navy,
  delta = null,
  spark,
  live = false,
  footer,
  style,
}: {
  label: string;
  value: string;
  tint?: string;
  /** Percent change vs previous window; null hides the chip. */
  delta?: number | null;
  spark?: number[];
  live?: boolean;
  footer?: ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  const narrow = useWindowDimensions().width < 760;
  return (
    <View style={[styles.tile, narrow && styles.tileNarrow, style as ViewStyle]}>
      {/* Value + label group, top-aligned */}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.valueWrap}>
            {live ? (
              <View style={styles.liveRow}>
                <LiveDot />
                <Text style={styles.liveLabel}>LIVE</Text>
              </View>
            ) : null}
            <Text style={[styles.value, { color: tint }]} numberOfLines={1}>
              {value}
            </Text>
          </View>
          {spark && spark.length > 1 ? <Sparkline values={spark} color={tint} /> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
      {/* Footer pinned to the bottom so it aligns across every tile */}
      {(delta != null || footer) && (
        <View style={styles.footerRow}>
          {delta != null ? <DeltaChip delta={delta} /> : null}
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 140,
    backgroundColor: '#faf6ee',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 13,
    // Value/label group at top, footer at bottom; `gap` is the minimum spacing
    // when the tile is content-height, space-between pins the footer once it
    // stretches to the tallest sibling so every footer aligns.
    justifyContent: 'space-between',
    gap: 12,
  },
  tileNarrow: { flexBasis: 140, minWidth: 130 },
  body: { gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  valueWrap: { flexShrink: 1, gap: 1 },
  value: { fontFamily: 'Flame-Regular', fontSize: 25, lineHeight: 27 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: COLORS.grey,
    textTransform: 'uppercase',
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: COLORS.green },
  liveLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.green,
  },
});
