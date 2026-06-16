// src/components/skeletons/CategorySkeleton.tsx
// Loading placeholder for the category screen. Mirrors the real layout —
// a navy stage (eyebrow, title, tagline) with a beige sheet rising over it,
// then the hero grid — using the same geometry so content swaps in without a
// jump. Search + sort/filter live in the native header, so they're not here.
import { View, StyleSheet, Dimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_COLUMNS = SCREEN_WIDTH >= 768 ? 4 : 3;
const GAP = 8;
const H_PAD = 16;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.35);

// Navy-tinted placeholder fill so skeletons read on the dark stage.
const STAGE_TINT = 'rgba(245,235,220,0.10)';

// Enough rows to fill the viewport below the header; extra rows clip cleanly.
const GRID_ROWS = Math.ceil(SCREEN_HEIGHT / (CARD_HEIGHT + GAP));

function GridRowSkeleton() {
  return (
    <View style={styles.row}>
      {Array.from({ length: NUM_COLUMNS }).map((_, i) => (
        <Skeleton key={i} width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={10} />
      ))}
    </View>
  );
}

export function CategorySkeleton({ topPadding = 0 }: { topPadding?: number }) {
  return (
    <SkeletonProvider>
      <View style={styles.root}>
        {/* Navy stage */}
        <View style={[styles.stage, { paddingTop: topPadding }]}>
          <Skeleton
            width={140}
            height={11}
            borderRadius={4}
            color={STAGE_TINT}
            style={styles.eyebrow}
          />
          <Skeleton
            width="50%"
            height={30}
            borderRadius={6}
            color={STAGE_TINT}
            style={styles.title}
          />
          <Skeleton width="72%" height={13} borderRadius={4} color={STAGE_TINT} />
        </View>

        {/* Beige sheet → grid */}
        <View style={styles.sheet}>
          {Array.from({ length: GRID_ROWS }).map((_, i) => (
            <GridRowSkeleton key={i} />
          ))}
        </View>
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  stage: { backgroundColor: COLORS.navy, paddingHorizontal: H_PAD, paddingBottom: 26 },
  eyebrow: { marginBottom: 12 },
  title: { marginBottom: 10 },
  sheet: {
    flex: 1,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
    marginTop: -16,
    paddingTop: 26,
    paddingHorizontal: H_PAD,
  },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
});
