// Per-domain command-center skeletons. Each mirrors the macro layout of its
// loaded domain — same Bento rows, same panel arrangement, same list/chart/tile
// rhythm — so the fill-in reads as a swap, not a jump. Assembled purely from the
// kit primitives; import these from health.web.tsx and render while a tab's data
// is loading. Wrap the content slot once in <SkeletonProvider> so every block
// pulses in sync (the app-wide shimmer).
import { View, StyleSheet } from 'react-native';
import { Bento } from '../Bento';
import { Skeleton } from '../../../ui/Skeleton';
import { SkPanel, SkTiles, SkBars, SkBarList, SkRows, SkLine } from './kit';

export { SkPanel, SkTiles, SkBars, SkBarList, SkRows, SkLine } from './kit';

/** A row of pill placeholders (sub-tabs, status filters). Flexible widths —
 *  4 × fixed 92px overflowed a 390px viewport (the pills poked past the edge
 *  and let the whole page pan sideways while loading). */
function SkPills({ n = 4 }: { n?: number }) {
  return (
    <View style={s.pills}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={s.pillFlex}>
          <Skeleton width="100%" height={30} borderRadius={9} />
        </View>
      ))}
    </View>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
// Mirrors the command-center Overview: live pulse band, a 6-tile instrument
// cluster, then the activity feed beside the needs-you + traffic-pulse column.
export function CommandHomeSkeleton({ narrow }: { narrow: boolean }) {
  const fill = !narrow;
  return (
    <Bento fill={fill}>
      {/* Live pulse band */}
      <View style={s.pulseBand}>
        <SkLine w={140} h={22} r={7} />
        <View style={s.pulseGrow} />
        <SkLine w={120} h={26} r={999} />
      </View>
      {/* Instrument cluster — 6 vitals */}
      <SkTiles n={6} />
      {/* Ops floor: activity feed | needs-you + traffic pulse */}
      <Bento.Row narrow={narrow} fill>
        <SkPanel fill={fill} style={s.flex13}>
          <SkRows n={narrow ? 5 : 8} thumb thumbRadius={7} />
        </SkPanel>
        <View style={[s.rightCol, fill && s.rightColFill]}>
          {/* Needs attention — content-sized, mirrors the live panel. */}
          <SkPanel>
            <SkRows n={3} thumb thumbRadius={8} />
          </SkPanel>
          {/* Traffic pulse — absorbs the remaining height. */}
          <SkPanel fill={fill} style={s.stack}>
            <SkBars n={14} height={48} />
            <SkLine w={160} h={9} style={s.gapAbove} />
          </SkPanel>
        </View>
      </Bento.Row>
    </Bento>
  );
}

// ── Catalog (coverage / distributions default view) ─────────────────────────────
export function CatalogSkeleton({ narrow }: { narrow: boolean }) {
  const fill = !narrow;
  return (
    <Bento fill={fill}>
      <SkPills n={4} />
      <Bento.Row narrow={narrow} fill>
        <SkPanel fill={fill} style={s.flex1}>
          <SkBarList n={5} />
        </SkPanel>
        <SkPanel fill={fill} style={s.flex15}>
          <SkRows n={6} thumb />
        </SkPanel>
      </Bento.Row>
      <Bento.Row narrow={narrow} fill>
        <SkPanel fill={fill} style={s.flex1}>
          <SkBars n={8} height={96} />
        </SkPanel>
        <SkPanel fill={fill} style={s.flex1}>
          <SkBars n={10} height={96} />
        </SkPanel>
        <SkPanel fill={fill} style={s.flex1}>
          <SkBarList n={6} />
        </SkPanel>
      </Bento.Row>
    </Bento>
  );
}

// ── Build / pipelines ───────────────────────────────────────────────────────────
export function PipelinesSkeleton({ narrow }: { narrow: boolean }) {
  const fill = !narrow;
  return (
    <Bento fill={fill}>
      {/* Add heroes */}
      <SkPanel>
        <SkLine w="34%" h={12} />
        <View style={s.chipRow}>
          <Skeleton width={110} height={30} borderRadius={9} />
          <Skeleton width={90} height={30} borderRadius={9} />
        </View>
      </SkPanel>
      <Bento.Row narrow={narrow} fill>
        {/* Build & status funnel */}
        <SkPanel fill={fill} style={s.flex14}>
          <SkBars n={6} height={96} />
        </SkPanel>
        {/* Needs you */}
        <SkPanel fill={fill} style={s.flex1}>
          <SkRows n={4} thumb={false} />
        </SkPanel>
      </Bento.Row>
      {/* AI generation */}
      <SkPanel>
        <SkTiles n={3} />
        <View style={s.gap12}>
          <SkBarList n={2} />
        </View>
      </SkPanel>
      <Bento.Row narrow={narrow} fill>
        <SkPanel fill={fill} style={s.flex1}>
          <SkRows n={5} thumb={false} />
        </SkPanel>
        <SkPanel fill={fill} style={s.flex1}>
          <SkRows n={4} thumb />
        </SkPanel>
        <SkPanel fill={fill} style={s.flex1}>
          <SkRows n={4} thumb={false} />
        </SkPanel>
      </Bento.Row>
    </Bento>
  );
}

// ── Sources ─────────────────────────────────────────────────────────────────────
export function SourcesSkeleton({ narrow }: { narrow: boolean }) {
  const fill = !narrow;
  return (
    <Bento fill={fill}>
      <Bento.Row narrow={narrow} fill>
        <SkPanel fill={fill} style={s.flex1}>
          <SkBarList n={5} />
        </SkPanel>
        <SkPanel fill={fill} style={s.flex1}>
          <SkBarList n={5} />
        </SkPanel>
      </Bento.Row>
      <Bento.Row narrow={narrow} fill>
        <SkPanel fill={fill} style={s.flex1}>
          <SkBarList n={6} />
        </SkPanel>
        <SkPanel fill={fill} style={s.flex1}>
          <SkBarList n={6} />
        </SkPanel>
      </Bento.Row>
    </Bento>
  );
}

// ── Spend ───────────────────────────────────────────────────────────────────────
export function SpendSkeleton() {
  return (
    <SkPanel>
      <SkLine w={96} h={30} r={6} />
      <SkLine w={150} h={9} style={s.gapAbove} />
      <SkBars n={28} height={72} />
      <View style={s.gap14}>
        <SkRows n={5} thumb={false} />
      </View>
    </SkPanel>
  );
}

// ── Community ────────────────────────────────────────────────────────────────────
export function CommunitySkeleton({ narrow }: { narrow: boolean }) {
  return (
    <Bento>
      <Bento.Row narrow={narrow}>
        <SkPanel style={s.flex15}>
          <SkTiles n={6} />
        </SkPanel>
        <SkPanel style={s.flex1}>
          <SkRows n={4} thumb />
        </SkPanel>
      </Bento.Row>
      {/* Members roster */}
      <SkPanel>
        <SkRows n={5} thumb />
      </SkPanel>
      {/* Hero leaderboards — three compact columns */}
      <Bento.Row narrow={narrow}>
        <SkPanel style={s.flex1}>
          <SkRows n={5} thumb />
        </SkPanel>
        <SkPanel style={s.flex1}>
          <SkRows n={5} thumb />
        </SkPanel>
        <SkPanel style={s.flex1}>
          <SkRows n={5} thumb />
        </SkPanel>
      </Bento.Row>
      {/* Contributors + activity */}
      <Bento.Row narrow={narrow}>
        <SkPanel style={s.flex1}>
          <SkRows n={4} thumb />
        </SkPanel>
        <SkPanel style={s.flex15}>
          <SkRows n={6} thumb />
        </SkPanel>
      </Bento.Row>
    </Bento>
  );
}

// ── Traffic ──────────────────────────────────────────────────────────────────────
export function TrafficSkeleton({ narrow }: { narrow: boolean }) {
  return (
    <Bento>
      {/* Headline KPI band */}
      <SkTiles n={4} />
      {/* Trend chart */}
      <SkPanel>
        <SkBars n={narrow ? 16 : 24} height={narrow ? 150 : 180} />
      </SkPanel>
      {/* Top heroes + live */}
      <Bento.Row narrow={narrow}>
        <SkPanel style={s.flex15}>
          <SkRows n={6} thumb />
        </SkPanel>
        <SkPanel style={s.flex1}>
          <SkRows n={6} thumb={false} />
        </SkPanel>
      </Bento.Row>
      {/* Breakdowns */}
      <Bento.Row narrow={narrow}>
        <SkPanel style={s.flex1}>
          <SkBarList n={5} />
        </SkPanel>
        <SkPanel style={s.flex1}>
          <SkBarList n={5} />
        </SkPanel>
        <SkPanel style={s.flex1}>
          <SkBarList n={4} />
        </SkPanel>
      </Bento.Row>
    </Bento>
  );
}

// ── Errors ───────────────────────────────────────────────────────────────────────
export function ErrorsSkeleton({ narrow }: { narrow: boolean }) {
  return (
    <Bento>
      <Bento.Row narrow={narrow}>
        <SkPanel style={s.flex1}>
          <SkTiles n={4} />
        </SkPanel>
      </Bento.Row>
      <SkPanel>
        <SkRows n={5} thumb={false} />
      </SkPanel>
      <SkPanel>
        <SkRows n={6} thumb={false} />
      </SkPanel>
    </Bento>
  );
}

// Reports / Review / Campaigns render their real Panel + title/pills immediately and
// only defer the list body, so they skeleton at the row level with <SkRows> in place
// rather than replacing the whole panel — see those domain files.

const s = StyleSheet.create({
  flex1: { flex: 1 },
  flex13: { flex: 1.3 },
  flex14: { flex: 1.4 },
  flex15: { flex: 1.5 },
  rightCol: { gap: 10 },
  rightColFill: { flex: 1, minHeight: 0 },
  stack: { flex: 1 },
  pulseBand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.16)',
  },
  pulseGrow: { flex: 1 },
  pills: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  pillFlex: { flex: 1, maxWidth: 110, minWidth: 0 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  gapAbove: { marginTop: 6, marginBottom: 12 },
  gap12: { marginTop: 12 },
  gap14: { marginTop: 14 },
});
