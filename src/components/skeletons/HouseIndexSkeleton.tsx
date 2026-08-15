// src/components/skeletons/HouseIndexSkeleton.tsx
// Loading placeholder for the houses index (app/house/index.tsx), which used to
// show a single line of grey "Loading…" above a void.
//
// Tiles carry HouseCard's geometry from src/components/family/HouseIndex.tsx —
// the same flexGrow/flexBasis 190/maxWidth 260 wrapping grid, 14px gap and 20px
// radius — so the crests land without a reflow. Height is that card's content
// box: the field (20 pad + 72 crest + 18 pad), the division hairline, and the
// plinth (12 pad + 23 name + 18 words + count + 14 pad).
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';

const TILE_H = 200;

export function HouseIndexSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <SkeletonProvider>
      <View style={styles.grid}>
        {Array.from({ length: tiles }).map((_, i) => (
          <View key={i} style={styles.cell}>
            <Skeleton width="100%" height={TILE_H} borderRadius={20} />
          </View>
        ))}
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cell: { flexGrow: 1, flexBasis: 190, maxWidth: 260 },
});
