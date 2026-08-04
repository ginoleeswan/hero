// src/components/skeletons/TeamSkeleton.tsx
// Loading placeholder for the team roster grid in app/team/[id].tsx.
//
// The brand-washed navy stage is the FlatList's ListHeaderComponent, so it is
// already on screen while the roster loads — only the grid is genuinely
// pending, and only the grid is drawn here. Card geometry is copied from that
// screen's NUM_COLUMNS / GAP / H_PAD / CARD_WIDTH / CARD_HEIGHT constants; if
// they change there, change them here in the same PR.
import { View, StyleSheet, Dimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_COLUMNS = SCREEN_WIDTH >= 768 ? 4 : 3;
const GAP = 8;
const H_PAD = 16;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.35);

// Enough rows to fill the viewport below the stage; extra rows clip cleanly.
const GRID_ROWS = Math.ceil(SCREEN_HEIGHT / (CARD_HEIGHT + GAP));

/** One roster row. `rows={1}` is the paginating footer — where the next page lands. */
function TeamRosterRowSkeleton() {
  return (
    <View style={styles.row}>
      {Array.from({ length: NUM_COLUMNS }).map((_, i) => (
        <Skeleton key={i} width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={10} />
      ))}
    </View>
  );
}

export function TeamSkeleton({ rows = GRID_ROWS }: { rows?: number }) {
  return (
    <SkeletonProvider>
      <View style={styles.grid}>
        {Array.from({ length: rows }).map((_, i) => (
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
