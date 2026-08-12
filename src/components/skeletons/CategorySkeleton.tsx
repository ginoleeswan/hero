// src/components/skeletons/CategorySkeleton.tsx
// Loading placeholder for the category screen. Mirrors the real layout —
// a navy stage (eyebrow, title, tagline) with a beige sheet rising over it,
// then the hero grid — using the same geometry so content swaps in without a
// jump. Search + sort/filter live in the native header, so they're not here.
import { View, StyleSheet, Dimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { COLORS } from '../../constants/colors';
import { SEAM } from '../../design';
import {
  CATEGORY_GRID,
  CATEGORY_CARD_W,
  CATEGORY_CARD_H,
  CATEGORY_STAGE,
} from '../../constants/categoryGeometry';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const { columns: NUM_COLUMNS, gap: GAP, hPad: H_PAD } = CATEGORY_GRID;
const CARD_WIDTH = CATEGORY_CARD_W;
const CARD_HEIGHT = CATEGORY_CARD_H;

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
        {/* No eyebrow bar. The screen stopped rendering one when the count
            moved onto the tagline's line, and a placeholder for a thing that no
            longer exists is 23pt the grid has to jump when content lands. */}
        <View style={[styles.stage, { paddingTop: topPadding }]}>
          <Skeleton
            width="50%"
            height={CATEGORY_STAGE.titleLine}
            borderRadius={6}
            color={STAGE_TINT}
          />
          <Skeleton
            width="72%"
            height={CATEGORY_STAGE.taglineLine}
            borderRadius={4}
            color={STAGE_TINT}
            style={styles.tagline}
          />
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
  stage: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: H_PAD,
    paddingBottom: CATEGORY_STAGE.paddingBottom,
  },
  tagline: { marginTop: CATEGORY_STAGE.taglineGap },
  sheet: {
    flex: 1,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: SEAM.radius,
    borderTopRightRadius: SEAM.radius,
    borderCurve: 'continuous',
    marginTop: -SEAM.overlap,
    // The real screen's cap is a `capHeight` box pulled up by SEAM.overlap, so
    // its first grid row sits (capHeight - overlap) below the stage. Match that
    // exactly rather than approximately.
    paddingTop: CATEGORY_STAGE.capHeight - SEAM.overlap,
    paddingHorizontal: H_PAD,
  },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
});
