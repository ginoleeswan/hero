// src/components/skeletons/EventSkeleton.tsx
// Loading placeholders for the two event routes. Both keep the seam grammar the
// real bodies use (EventIndexList / EventDossier): an ink masthead, the warm
// hairline, then paper — so the page never flips tone at the handoff.
//
// Geometry is copied from those components: 18px gutter on phones, the 28px
// stage top pad, and the paper rows' 22px vertical rhythm.
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { SEAM_COLOR, SURFACE } from '../../constants/colors';

const PAD = 18;

// Placeholder fill for the ink band, where the beige base would glow.
const INK_TINT = 'rgba(245,235,220,0.10)';

/** Ink masthead: eyebrow, headline, then a couple of lines of method copy. */
function MastheadSkeleton({ titleHeight }: { titleHeight: number }) {
  return (
    <View style={styles.stage}>
      <Skeleton width={110} height={11} borderRadius={4} color={INK_TINT} style={styles.eyebrow} />
      <Skeleton width="76%" height={titleHeight} borderRadius={6} color={INK_TINT} />
      <Skeleton width="92%" height={14} borderRadius={4} color={INK_TINT} style={styles.method} />
      <Skeleton width="68%" height={14} borderRadius={4} color={INK_TINT} style={styles.line} />
    </View>
  );
}

/** app/event/index.tsx — the record: masthead over a list of detected events. */
export function EventIndexSkeleton() {
  return (
    <SkeletonProvider>
      <View>
        <MastheadSkeleton titleHeight={36} />
        <View style={styles.seam} />
        <View style={styles.paper}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.row}>
              <Skeleton width="58%" height={24} borderRadius={5} />
              <Skeleton width="100%" height={44} borderRadius={6} style={styles.curve} />
              <Skeleton width="42%" height={13} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>
    </SkeletonProvider>
  );
}

/** app/event/[slug].tsx — the dossier: masthead + stat rail over paper sections. */
export function EventDossierSkeleton() {
  return (
    <SkeletonProvider>
      <View>
        <View style={styles.stage}>
          <Skeleton
            width={130}
            height={11}
            borderRadius={4}
            color={INK_TINT}
            style={styles.eyebrow}
          />
          <Skeleton width="70%" height={34} borderRadius={6} color={INK_TINT} />
          <Skeleton
            width={180}
            height={13}
            borderRadius={4}
            color={INK_TINT}
            style={styles.method}
          />
          <View style={styles.stats}>
            <Skeleton width={92} height={40} borderRadius={6} color={INK_TINT} />
            <Skeleton width={72} height={40} borderRadius={6} color={INK_TINT} />
            <Skeleton width={72} height={40} borderRadius={6} color={INK_TINT} />
          </View>
        </View>
        <View style={styles.seam} />
        <View style={styles.paper}>
          <Skeleton width="46%" height={21} borderRadius={5} style={styles.sectionTitle} />
          <Skeleton width="100%" height={168} borderRadius={10} style={styles.lead} />
          <Skeleton width="38%" height={21} borderRadius={5} style={styles.sectionTitle} />
          <Skeleton width="100%" height={14} borderRadius={4} style={styles.line} />
          <Skeleton width="88%" height={14} borderRadius={4} />
        </View>
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: SURFACE.ink,
    paddingHorizontal: PAD,
    paddingTop: 28,
    paddingBottom: 28,
  },
  eyebrow: { marginBottom: 12 },
  method: { marginTop: 10 },
  line: { marginTop: 10 },
  stats: { flexDirection: 'row', gap: 30, marginTop: 20 },
  seam: { height: 1, backgroundColor: SEAM_COLOR },
  paper: {
    backgroundColor: SURFACE.paper,
    paddingHorizontal: PAD,
    paddingTop: 30,
    paddingBottom: 64,
  },
  row: { paddingVertical: 22, gap: 8 },
  curve: { marginTop: 2 },
  sectionTitle: { marginTop: 8, marginBottom: 16 },
  lead: { marginBottom: 26 },
});
