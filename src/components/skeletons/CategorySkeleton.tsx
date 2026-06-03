// src/components/skeletons/CategorySkeleton.tsx
// Loading placeholder for the category screen. Mirrors the real layout —
// featured banner, search bar, sort/filter controls, count label, then the
// hero grid — using the same geometry so content swaps in without a jump.
import { View, StyleSheet, Dimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_COLUMNS = SCREEN_WIDTH >= 768 ? 4 : 3;
const PADDING = 12;
const GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.35);
// Segmented control fills the row beside the 36pt filter button.
const FILTER_BTN = 36;
const SEGMENTED_WIDTH = SCREEN_WIDTH - PADDING * 2 - GAP - FILTER_BTN;

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

export function CategorySkeleton() {
  return (
    <SkeletonProvider>
      <View style={styles.container}>
        {/* Featured banner */}
        <Skeleton width="100%" height={140} borderRadius={14} style={styles.featured} />

        {/* Search bar */}
        <Skeleton width="100%" height={38} borderRadius={10} style={styles.search} />

        {/* Sort segmented control + filter button */}
        <View style={styles.controls}>
          <Skeleton width={SEGMENTED_WIDTH} height={36} borderRadius={8} />
          <Skeleton width={FILTER_BTN} height={36} borderRadius={8} />
        </View>

        {/* Count label */}
        <Skeleton width="45%" height={11} borderRadius={4} style={styles.count} />

        {/* Hero grid */}
        {Array.from({ length: GRID_ROWS }).map((_, i) => (
          <GridRowSkeleton key={i} />
        ))}
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: PADDING },
  featured: { borderCurve: 'continuous', marginBottom: 12 },
  search: { marginBottom: 8 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  count: { marginBottom: 10 },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
});
