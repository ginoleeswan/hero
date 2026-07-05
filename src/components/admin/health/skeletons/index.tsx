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

/** A row of pill placeholders (sub-tabs, status filters). */
function SkPills({ n = 4 }: { n?: number }) {
  return (
    <View style={s.pills}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} width={92} height={30} borderRadius={9} />
      ))}
    </View>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
export function CommandHomeSkeleton({ narrow }: { narrow: boolean }) {
  const fill = !narrow;
  return (
    <Bento fill={fill}>
      <Bento.Row narrow={narrow} fill>
        {/* Catalogue health — big % + trend chart */}
        <SkPanel fill={fill} style={s.flex15}>
          <SkLine w={96} h={40} r={8} />
          <SkLine w={130} h={9} style={s.gapAbove} />
          <SkBars n={12} height={92} />
        </SkPanel>
        {/* Needs attention — actionable rows */}
        <SkPanel fill={fill} style={s.flex1}>
          <SkRows n={3} thumb thumbRadius={8} />
        </SkPanel>
      </Bento.Row>
      <Bento.Row narrow={narrow} fill>
        {/* Backfill queue — hero rows */}
        <SkPanel fill={fill} style={s.flex15}>
          <SkRows n={4} thumb />
        </SkPanel>
        {/* Spend — big number + mini bars */}
        <SkPanel fill={fill} style={s.flex1}>
          <SkLine w={80} h={26} r={6} />
          <SkLine w={92} h={9} style={s.gapAbove} />
          <SkBars n={14} height={44} />
        </SkPanel>
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
      <Bento.Row narrow={narrow}>
        <SkPanel style={s.flex1}>
          <SkRows n={5} thumb />
        </SkPanel>
        <SkPanel style={s.flex1}>
          <SkRows n={5} thumb />
        </SkPanel>
      </Bento.Row>
    </Bento>
  );
}

// ── Traffic ──────────────────────────────────────────────────────────────────────
export function TrafficSkeleton({ narrow }: { narrow: boolean }) {
  return (
    <Bento>
      <Bento.Row narrow={narrow}>
        <SkPanel style={s.flex15}>
          <SkTiles n={3} />
        </SkPanel>
        <SkPanel style={s.flex1}>
          <SkBars n={5} height={72} />
        </SkPanel>
      </Bento.Row>
      <SkPanel>
        <SkBars n={20} height={96} />
      </SkPanel>
      <Bento.Row narrow={narrow}>
        <SkPanel style={s.flex1}>
          <SkRows n={5} thumb={false} />
        </SkPanel>
        <SkPanel style={s.flex1}>
          <SkRows n={5} thumb={false} />
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
  flex14: { flex: 1.4 },
  flex15: { flex: 1.5 },
  pills: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  gapAbove: { marginTop: 6, marginBottom: 12 },
  gap12: { marginTop: 12 },
  gap14: { marginTop: 14 },
});
