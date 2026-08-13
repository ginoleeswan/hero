// src/components/skeletons/TeamSkeleton.tsx
// Loading placeholder for the team roster grid in app/team/[id].tsx.
//
// The brand-washed navy stage is the FlatList's ListHeaderComponent, so it is
// already on screen while the roster loads — only the grid is genuinely
// pending, and only the grid is drawn here. Card geometry is copied from that
// screen's NUM_COLUMNS / GAP / H_PAD / CARD_WIDTH / CARD_HEIGHT constants; if
// they change there, change them here in the same PR.
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { categoryGrid } from '../../constants/categoryGeometry';

// The roster grid IS the category grid — the screen it stands in for now reads
// from categoryGrid(), so this must too or the placeholder drifts the moment an
// iPad rotates.
const GAP = 8;
const H_PAD = 16;

/** One roster row. `rows={1}` is the paginating footer — where the next page lands. */
function TeamRosterRowSkeleton() {
  const { width } = useWindowDimensions();
  const grid = categoryGrid(width);
  return (
    <View style={styles.row}>
      {Array.from({ length: grid.columns }).map((_, i) => (
        <Skeleton key={i} width={grid.cardW} height={grid.cardH} borderRadius={10} />
      ))}
    </View>
  );
}

export function TeamSkeleton({ rows }: { rows?: number }) {
  // Enough rows to fill the viewport; extra rows clip cleanly. Live, because on
  // a rotated iPad both the card height and the viewport change.
  const { width, height } = useWindowDimensions();
  const gridRows = rows ?? Math.ceil(height / (categoryGrid(width).cardH + GAP));
  return (
    <SkeletonProvider>
      <View style={styles.grid}>
        {Array.from({ length: gridRows }).map((_, i) => (
          <TeamRosterRowSkeleton key={i} />
        ))}
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  grid: { paddingTop: 4 },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP, paddingHorizontal: H_PAD },
});
