// src/components/skeletons/HomeSkeleton.tsx
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const CARD_HEIGHT = 300;
const CARD_GAP = 12;

function SpotlightSkeleton({ insetTop }: { insetTop: number }) {
  const height = insetTop + Math.round(SCREEN_HEIGHT * 0.42);
  return <Skeleton width="100%" height={height} borderRadius={0} />;
}

function ThumbRowSkeleton() {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Skeleton width="20%" height={10} borderRadius={4} />
        <Skeleton width="35%" height={22} borderRadius={6} style={styles.titleSkeleton} />
      </View>
      <View style={styles.thumbRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width={90} height={58} borderRadius={8} />
        ))}
      </View>
    </View>
  );
}

function PortraitRowSkeleton() {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Skeleton width="40%" height={22} borderRadius={6} />
      </View>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.portraitRow}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={36} />
        ))}
      </ScrollView>
    </View>
  );
}

interface HomeSkeletonProps {
  insets: { top: number };
}

export function HomeSkeleton({ insets }: HomeSkeletonProps) {
  return (
    <SkeletonProvider>
      <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false}>
        <SpotlightSkeleton insetTop={insets.top} />
        <ThumbRowSkeleton />
        <PortraitRowSkeleton />
        <PortraitRowSkeleton />
        <PortraitRowSkeleton />
      </ScrollView>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 4 },
  sectionHeader: { paddingHorizontal: 15, marginBottom: 10, gap: 4 },
  titleSkeleton: { marginTop: 2 },
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 15,
  },
  portraitRow: {
    paddingHorizontal: 15,
    gap: CARD_GAP,
  },
});
