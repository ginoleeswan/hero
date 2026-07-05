// Command-center skeleton kit — the shared placeholder primitives every domain
// skeleton is assembled from. Built on the app-wide <Skeleton> (same synced
// shimmer as the rest of the product) and the command center's own Panel/Bento
// chrome, so a loading tab has the exact panel frames of the loaded tab and the
// swap lands with zero layout shift. Fills use the house skeleton tint, which
// reads on the cream panels (#fffdf8).
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { Skeleton } from '../../../ui/Skeleton';
import { Panel } from '../Panel';
import { DENSITY } from '../format';

type Pct = `${number}%`;

/** A single placeholder line (title, label, value, list text). */
export function SkLine({
  w = '60%',
  h = 12,
  r = 6,
  style,
}: {
  w?: number | Pct;
  h?: number;
  r?: number;
  style?: ViewStyle;
}) {
  return <Skeleton width={w} height={h} borderRadius={r} style={style} />;
}

/** Panel frame with a skeletonised header (title + optional hint), then children.
 *  Uses the real Panel so padding, radius, shadow and fill/scroll behaviour match
 *  the loaded state exactly. */
export function SkPanel({
  children,
  style,
  fill,
  hint = true,
}: {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  fill?: boolean;
  hint?: boolean;
}) {
  return (
    <Panel fill={fill} scroll={false} style={style}>
      <View style={k.head}>
        <SkLine w="42%" h={14} />
        {hint ? <SkLine w="62%" h={9} style={k.headHint} /> : null}
      </View>
      {children}
    </Panel>
  );
}

/** A row of KPI tiles — mirrors StatTile geometry so the numbers land in place. */
export function SkTiles({ n = 4 }: { n?: number }) {
  return (
    <View style={k.tileRow}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={k.tile}>
          <Skeleton width="55%" height={20} borderRadius={6} />
          <Skeleton width="80%" height={9} borderRadius={5} style={k.tileLabel} />
        </View>
      ))}
    </View>
  );
}

// Deterministic, organic-looking bar heights (0–1) so the chart doesn't read as a
// flat block. Cycled for any bar count.
const BAR_HEIGHTS = [0.55, 0.8, 0.42, 0.68, 0.9, 0.5, 0.72, 0.38, 0.62, 0.85, 0.48, 0.75];

/** A bar-chart / distribution placeholder — a baseline row of varied-height bars. */
export function SkBars({ n = 12, height = 84 }: { n?: number; height?: number }) {
  return (
    <View style={[k.bars, { height }]}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={k.barCol}>
          <Skeleton
            width="100%"
            height={Math.max(6, Math.round(BAR_HEIGHTS[i % BAR_HEIGHTS.length] * height))}
            borderRadius={4}
          />
        </View>
      ))}
    </View>
  );
}

/** Horizontal labelled-bar list (coverage / breakdown rows): label line over a
 *  full-width track, repeated. */
export function SkBarList({ n = 6 }: { n?: number }) {
  return (
    <View style={k.barList}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={k.barListRow}>
          <SkLine w={`${52 + ((i * 7) % 34)}%` as Pct} h={10} />
          <Skeleton width="100%" height={8} borderRadius={4} style={k.track} />
        </View>
      ))}
    </View>
  );
}

/** A list of rows — optional leading thumbnail, a name line, a sub line. Matches
 *  the queue / top-heroes / recent-error row rhythm across domains. */
export function SkRows({
  n = 5,
  thumb = true,
  thumbRadius = 8,
}: {
  n?: number;
  thumb?: boolean;
  thumbRadius?: number;
}) {
  return (
    <View>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={k.row}>
          {thumb ? <Skeleton width={30} height={30} borderRadius={thumbRadius} /> : null}
          <View style={k.rowText}>
            <SkLine w={`${58 + ((i * 11) % 30)}%` as Pct} h={11} />
            <SkLine w={`${30 + ((i * 13) % 24)}%` as Pct} h={9} style={k.rowSub} />
          </View>
        </View>
      ))}
    </View>
  );
}

const k = StyleSheet.create({
  head: { gap: 4, marginBottom: DENSITY.gap },
  headHint: { marginTop: 1 },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: 110,
    minWidth: 96,
    backgroundColor: '#faf6ee',
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    gap: 6,
  },
  tileLabel: { marginTop: 2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 4 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barList: { gap: 12 },
  barListRow: { gap: 6 },
  track: { marginTop: 2 },
  // paddingVertical 7 + 30 thumb = 44pt row, matching the real list rows.
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
  rowText: { flex: 1, gap: 4 },
  rowSub: { marginTop: 1 },
});
