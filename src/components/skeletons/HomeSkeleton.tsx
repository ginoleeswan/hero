import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const CARD_HEIGHT = 300;
const CARD_GAP = 12;
const CARDS_PER_ROW = 3;

function HeroCardSkeleton() {
  return <Skeleton width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={36} style={styles.card} />;
}

function SectionSkeleton() {
  return (
    <View style={styles.section}>
      {/* Section title + icon */}
      <View style={styles.sectionHeader}>
        <Skeleton width="38%" height={24} borderRadius={8} />
        <Skeleton width={26} height={26} borderRadius={13} style={styles.sectionIcon} />
      </View>

      {/* Horizontal card row */}
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
      >
        {Array.from({ length: CARDS_PER_ROW }).map((_, i) => (
          <HeroCardSkeleton key={i} />
        ))}
      </ScrollView>
    </View>
  );
}

export function HomeSkeleton() {
  return (
    <SkeletonProvider>
      <View>
        {/* Header */}
        <View style={styles.header}>
          <Skeleton width="28%" height={38} borderRadius={8} />
          <Skeleton width="50%" height={8} borderRadius={4} style={styles.headerSubtitle} />
        </View>

        {/* 3 sections */}
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 2,
    gap: 6,
  },
  headerSubtitle: {
    marginTop: -2,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    marginBottom: 10,
    gap: 8,
  },
  sectionIcon: {},
  cardRow: {
    paddingLeft: 15,
    paddingRight: 15,
    gap: CARD_GAP,
  },
  card: {
    marginBottom: 16,
    marginTop: 8,
  },
});
