// src/components/skeletons/TitleSkeleton.tsx
// Native loading placeholder for the title (film/TV) screen. Mirrors the real
// stacked layout in app/title/[id].tsx — a dark backdrop stage (poster + meta)
// fused to the beige body via the orange seam, then overview, the horizontal
// rails (where-to-watch / cast / stills / heroes), and the details rows — so
// content swaps in without a jump.
import { View, ScrollView, StyleSheet } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { COLORS, SEAM_COLOR } from '../../constants/colors';

// Warm-white tint so blocks read as elevated surfaces on the dark backdrop stage.
const STAGE_TINT = 'rgba(245,235,220,0.12)';

function StageSkeleton({ insetTop }: { insetTop: number }) {
  return (
    <View style={[styles.stage, { paddingTop: insetTop + 60 }]}>
      <View style={styles.stageRow}>
        <Skeleton width={112} height={168} borderRadius={12} color={STAGE_TINT} />
        <View style={styles.stageMeta}>
          <Skeleton width={70} height={11} borderRadius={4} color={STAGE_TINT} />
          <Skeleton width="88%" height={26} borderRadius={7} color={STAGE_TINT} />
          <Skeleton width="55%" height={26} borderRadius={7} color={STAGE_TINT} />
          <View style={styles.statRail}>
            {[44, 52, 40].map((w) => (
              <Skeleton key={w} width={w} height={13} borderRadius={4} color={STAGE_TINT} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function SectionHeader({ width = 90 }: { width?: number }) {
  return <Skeleton width={width} height={11} borderRadius={4} style={styles.eyebrow} />;
}

function OverviewSkeleton() {
  return (
    <View style={styles.section}>
      <SectionHeader width={86} />
      <View style={styles.overviewLines}>
        {['100%', '96%', '90%', '72%'].map((w) => (
          <Skeleton key={w} width={w as `${number}%`} height={12} borderRadius={5} />
        ))}
      </View>
    </View>
  );
}

function WhereToWatchSkeleton() {
  return (
    <View style={styles.railSection}>
      <View style={styles.railHeader}>
        <SectionHeader width={120} />
      </View>
      <View style={styles.providerRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width={54} height={54} borderRadius={14} />
        ))}
      </View>
    </View>
  );
}

function CastRailSkeleton() {
  return (
    <View style={styles.railSection}>
      <View style={styles.railHeader}>
        <SectionHeader width={70} />
      </View>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railRow}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={styles.castItem}>
            <Skeleton width={72} height={72} borderRadius={36} />
            <Skeleton width={64} height={10} borderRadius={4} style={styles.castLine} />
            <Skeleton width={44} height={9} borderRadius={4} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function StillsRailSkeleton() {
  return (
    <View style={styles.railSection}>
      <View style={styles.railHeader}>
        <SectionHeader width={80} />
      </View>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railRow}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width={208} height={117} borderRadius={12} />
        ))}
      </ScrollView>
    </View>
  );
}

function PortraitRail({ titleW }: { titleW: number }) {
  return (
    <View style={styles.railSection}>
      <View style={styles.railHeader}>
        <SectionHeader width={titleW} />
      </View>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railRow}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={styles.heroItem}>
            <Skeleton width={112} height={150} borderRadius={16} />
            <Skeleton width={84} height={11} borderRadius={4} style={styles.castLine} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function HeroesRailSkeleton() {
  return <PortraitRail titleW={140} />;
}

function DetailsSkeleton() {
  return (
    <View style={styles.section}>
      <SectionHeader width={70} />
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={styles.infoRow}>
          <Skeleton width="30%" height={13} borderRadius={5} />
          <Skeleton width="45%" height={13} borderRadius={5} />
        </View>
      ))}
    </View>
  );
}

interface TitleSkeletonProps {
  insets: { top: number };
}

// The stacked beige body, on its own — rendered under the real header once the
// title is seeded/loaded (header from seed, body still gated), and reused inside
// the full TitleSkeleton for the cold (no-seed) load.
export function TitleBodySkeleton() {
  return (
    <SkeletonProvider>
      <View style={styles.body}>
        <OverviewSkeleton />
        <WhereToWatchSkeleton />
        <CastRailSkeleton />
        <StillsRailSkeleton />
        <HeroesRailSkeleton />
        <DetailsSkeleton />
      </View>
    </SkeletonProvider>
  );
}

export function TitleSkeleton({ insets }: TitleSkeletonProps) {
  return (
    <SkeletonProvider>
      <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} style={styles.scroll}>
        <StageSkeleton insetTop={insets.top} />
        <TitleBodySkeleton />
      </ScrollView>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  // Dark backdrop stage fused to the beige body via the orange seam.
  stage: {
    backgroundColor: COLORS.navy,
    minHeight: 340,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
  },
  stageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  stageMeta: { flex: 1, gap: 12, paddingBottom: 4 },
  statRail: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },

  body: { backgroundColor: COLORS.beige, paddingBottom: 40 },

  // Stacked sections — mirror the page's section / railSection geometry.
  section: { paddingHorizontal: 20, paddingTop: 24 },
  railSection: { paddingTop: 24 },
  railHeader: { paddingHorizontal: 20 },
  eyebrow: { marginBottom: 8 },
  overviewLines: { gap: 7 },

  providerRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12 },
  railRow: { gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  castItem: { alignItems: 'center', gap: 8, width: 72 },
  castLine: { marginTop: 2 },
  heroItem: { gap: 8 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
});
