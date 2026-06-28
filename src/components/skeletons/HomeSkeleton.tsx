// src/components/skeletons/HomeSkeleton.tsx
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Mirror the real layout (see HomeHeroRow / SpotlightCarousel / PublisherGrid).
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const CARD_HEIGHT = Math.round(CARD_WIDTH * ((SCREEN_HEIGHT * 0.66) / SCREEN_WIDTH));
const CARD_GAP = 12;
const H_PAD = 16;
const TILE_GAP = 10;
const TILE_W = (SCREEN_WIDTH - H_PAD * 2 - TILE_GAP) / 2;
const TILE_H = 88; // matches PublisherGrid card minHeight

function SpotlightSkeleton({ insetTop }: { insetTop: number }) {
  const height = insetTop + Math.round(SCREEN_HEIGHT * 0.5);
  return (
    <View>
      <Skeleton width="100%" height={height} borderRadius={0} />
      {/* Rounded beige lip — mirrors SpotlightCarousel's edge into the sheet. */}
      <View style={styles.lip} pointerEvents="none" />
    </View>
  );
}

function DailyBannerSkeleton() {
  return (
    <View style={styles.dailyBanner}>
      <Skeleton width="100%" height={102} borderRadius={20} />
    </View>
  );
}

function MatchupSkeleton() {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <Skeleton width="22%" height={10} borderRadius={4} />
          <Skeleton width="46%" height={22} borderRadius={6} style={styles.titleSkeleton} />
        </View>
      </View>
      <View style={styles.matchupCard}>
        <Skeleton width="100%" height={210} borderRadius={20} />
      </View>
    </View>
  );
}

function PublisherGridSkeleton() {
  return (
    <View style={styles.publisherGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} width={TILE_W} height={TILE_H} borderRadius={14} />
      ))}
    </View>
  );
}

function PortraitRowSkeleton() {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Skeleton width="42%" height={22} borderRadius={6} />
        <Skeleton width={46} height={13} borderRadius={4} style={styles.seeAllSkeleton} />
      </View>
      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.portraitRow}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            borderRadius={64}
            style={styles.portraitCard}
          />
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
      <ScrollView scrollEnabled={false} showsVerticalScrollIndicator={false} style={styles.scroll}>
        <SpotlightSkeleton insetTop={insets.top} />
        <View style={styles.sheet}>
          <DailyBannerSkeleton />
          <PublisherGridSkeleton />
          <MatchupSkeleton />
          {Array.from({ length: 5 }).map((_, i) => (
            <PortraitRowSkeleton key={i} />
          ))}
        </View>
      </ScrollView>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.navy },
  sheet: { backgroundColor: COLORS.beige },
  lip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 24,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
  },
  section: { paddingTop: 14, paddingBottom: 4 },
  sectionHeader: {
    paddingHorizontal: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerLeft: { gap: 2 },
  titleSkeleton: { marginTop: 2 },
  seeAllSkeleton: { marginBottom: 4 },
  dailyBanner: {
    paddingHorizontal: 15,
    paddingTop: 16,
    paddingBottom: 4,
  },
  matchupCard: {
    paddingHorizontal: 15,
  },
  publisherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
    paddingHorizontal: H_PAD,
    paddingTop: 16,
    paddingBottom: 8,
  },
  portraitRow: {
    paddingHorizontal: 15,
    gap: CARD_GAP,
    paddingVertical: 8,
  },
  portraitCard: {
    borderCurve: 'continuous',
  },
});
