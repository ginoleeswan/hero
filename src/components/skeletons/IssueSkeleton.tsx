// src/components/skeletons/IssueSkeleton.tsx
// Loading placeholder for app/issue/[id].tsx.
//
// Mirrors the narrow stacked layout the screen renders on phones: the dark
// cover stage (blurred-cover header with the cover + masthead centered over
// it), then beige paper carrying the synopsis and the "Featuring" cast strip.
//
// Geometry is copied from that screen (cited inline). If it changes there,
// change it here in the same PR.
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { COLORS, SEAM_COLOR } from '../../constants/colors';

// Placeholder fill for the dark header — beige at 10% reads as "not yet here".
const ON_DARK = 'rgba(245,235,220,0.10)';

// n.header: minHeight 430, paddingBottom 28, content gap 18, paddingHorizontal 20.
const HEADER_MIN_H = 430;
// cast.frame: 104 × 142, radius 12, laid out in styles.castStrip (gap 12, pad 20).
const CAST_W = 104;
const CAST_H = 142;

export function IssueSkeleton({ contentTop }: { contentTop: number }) {
  const { width } = useWindowDimensions();
  // narrowCoverW from the screen: min(190, width * 0.48), cover ratio 1.5.
  const coverW = Math.min(190, width * 0.48);
  const coverH = Math.round(coverW * 1.5);

  return (
    <SkeletonProvider>
      <View style={styles.root}>
        <View style={[styles.header, { minHeight: HEADER_MIN_H, paddingTop: contentTop }]}>
          <Skeleton width={coverW} height={coverH} borderRadius={12} color={ON_DARK} />
          {/* Masthead: publisher mark, title, story line, stat rail. */}
          <Skeleton width={92} height={14} borderRadius={4} color={ON_DARK} />
          <Skeleton width="72%" height={32} borderRadius={6} color={ON_DARK} />
          <Skeleton width="50%" height={15} borderRadius={4} color={ON_DARK} />
          <Skeleton width="62%" height={13} borderRadius={4} color={ON_DARK} />
        </View>

        <View style={styles.paper}>
          <View style={styles.synSection}>
            <Skeleton width={84} height={13} borderRadius={4} style={styles.heading} />
            <Skeleton width="100%" height={14} borderRadius={4} style={styles.line} />
            <Skeleton width="96%" height={14} borderRadius={4} style={styles.line} />
            <Skeleton width="98%" height={14} borderRadius={4} style={styles.line} />
            <Skeleton width="70%" height={14} borderRadius={4} />
          </View>

          <View style={styles.section}>
            <Skeleton width={90} height={13} borderRadius={4} style={styles.sectionLabel} />
            <View style={styles.castStrip}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} width={CAST_W} height={CAST_H} borderRadius={12} />
              ))}
            </View>
          </View>
        </View>
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  header: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 20,
    paddingBottom: 28,
    backgroundColor: COLORS.deepNavy,
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
  },
  paper: { backgroundColor: COLORS.beige },
  synSection: { paddingHorizontal: 20, paddingTop: 22 },
  heading: { marginBottom: 12 },
  line: { marginBottom: 10 },
  section: { paddingTop: 22, paddingBottom: 10 },
  sectionLabel: { paddingHorizontal: 20, marginBottom: 14 },
  castStrip: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 4 },
});
