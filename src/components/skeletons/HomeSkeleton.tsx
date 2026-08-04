// src/components/skeletons/HomeSkeleton.tsx
//
// Mirrors app/(tabs)/explore.tsx's feed. Two things it must get right, or the
// skeleton→feed handoff visibly jumps:
//
//  • Row ORDER matches the real `rows` array: spotlight → publishers →
//    matchup → daily → (beige zone) portrait rows.
//  • Zone COLOUR matches DARK_ROWS: the first rows sit on the deep-navy stage,
//    and beige paper only begins where the real page's first Library row does.
//
// Geometry is IMPORTED from ./homeGeometry, never copied. The previous version
// hand-copied the numbers under a "keep in sync" comment and they drifted —
// the daily-banner height had been lifted from a tile inside the banner rather
// than the banner itself. A comment can't enforce agreement; a shared import
// can, so a change to the real layout moves these placeholders with it.
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { COLORS } from '../../constants/colors';
import { spotlightHeight } from '../home/SpotlightCarousel';
import {
  DAILY_BANNER,
  FEED_H_PAD,
  HERO_ROW,
  MATCHUP_CARD,
  PAPER_SEAM_RADIUS,
  PUBLISHER_GRID,
  SPOTLIGHT,
} from '../home/homeGeometry';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Placeholder fills for the dark stage. Beige at 8% was almost invisible on
// deepNavy — the billboard read as a broken void rather than a placeholder.
const ON_DARK = 'rgba(245,235,220,0.13)';
const ON_DARK_SOFT = 'rgba(245,235,220,0.07)';

// A flat block over half the screen reads as a void, so the slide's own
// furniture is sketched in at its real offsets: the name block and the pager
// dots, both positioned from SPOTLIGHT.
function SpotlightSkeleton({ insetTop }: { insetTop: number }) {
  return (
    <View style={{ height: spotlightHeight(insetTop) }}>
      {/* The real slide is a full-bleed portrait under a bottom scrim, so the
          placeholder carries the same weight distribution — light at the crown
          where the face sits, sinking into the stage where the scrim takes over. */}
      <LinearGradient
        colors={['rgba(245,235,220,0.10)', 'rgba(245,235,220,0.05)', 'rgba(11,24,32,0)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.spotlightMeta}>
        <Skeleton
          width={Math.round(SCREEN_WIDTH * 0.52)}
          height={34}
          borderRadius={8}
          color={ON_DARK}
        />
        <Skeleton
          width={Math.round(SCREEN_WIDTH * 0.28)}
          height={12}
          borderRadius={4}
          color={ON_DARK_SOFT}
          style={styles.spotlightSub}
        />
      </View>
      <View style={styles.spotlightDots}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton
            key={i}
            width={i === 0 ? SPOTLIGHT.dotActiveWidth : SPOTLIGHT.dotSize}
            height={SPOTLIGHT.dotSize}
            borderRadius={SPOTLIGHT.dotSize / 2}
            color={i === 0 ? ON_DARK : ON_DARK_SOFT}
          />
        ))}
      </View>
    </View>
  );
}

function PublisherGridSkeleton() {
  return (
    <View style={styles.publisherGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton
          key={i}
          width={PUBLISHER_GRID.tileWidth}
          height={PUBLISHER_GRID.tileMinHeight}
          borderRadius={PUBLISHER_GRID.radius}
          color={ON_DARK}
        />
      ))}
    </View>
  );
}

function MatchupSkeleton() {
  return (
    <View style={styles.darkSection}>
      <View style={styles.headerLeft}>
        <Skeleton width="22%" height={10} borderRadius={4} color={ON_DARK} />
        <Skeleton
          width="52%"
          height={22}
          borderRadius={6}
          color={ON_DARK}
          style={styles.titleGap}
        />
      </View>
      <View style={styles.matchupCard}>
        <Skeleton
          width="100%"
          height={MATCHUP_CARD.approxHeight}
          borderRadius={MATCHUP_CARD.radius}
          color={ON_DARK}
        />
      </View>
    </View>
  );
}

function DailyBannerSkeleton() {
  return (
    <View style={styles.dailyBanner}>
      <Skeleton
        width="100%"
        height={DAILY_BANNER.approxHeight}
        borderRadius={DAILY_BANNER.radius}
        color={ON_DARK}
      />
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
            width={HERO_ROW.cardWidth}
            height={HERO_ROW.cardHeight}
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
        {/* The dark stage — the same row types the real feed keeps on navy. */}
        <View style={styles.stage}>
          <PublisherGridSkeleton />
          <MatchupSkeleton />
          <DailyBannerSkeleton />
        </View>
        {/* Beige paper begins where the real first Library row does. */}
        <View style={styles.sheet}>
          {Array.from({ length: 3 }).map((_, i) => (
            <PortraitRowSkeleton key={i} />
          ))}
        </View>
      </ScrollView>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  // deepNavy, matching explore's root/content — NOT navy, which flipped the
  // whole background tone at the handoff.
  scroll: { flex: 1, backgroundColor: COLORS.deepNavy },
  stage: { backgroundColor: COLORS.deepNavy },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: PAPER_SEAM_RADIUS,
    borderTopRightRadius: PAPER_SEAM_RADIUS,
    borderCurve: 'continuous',
    marginTop: 10,
    overflow: 'hidden',
  },
  spotlightMeta: {
    position: 'absolute',
    bottom: SPOTLIGHT.metaBottom,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  spotlightSub: { marginTop: 9 },
  spotlightDots: {
    position: 'absolute',
    bottom: SPOTLIGHT.dotsBottom,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPOTLIGHT.dotGap,
  },
  publisherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PUBLISHER_GRID.gap,
    paddingHorizontal: PUBLISHER_GRID.hPad,
    // The real grid rides up into the spotlight's fade (explore's podsOverlap).
    marginTop: -SPOTLIGHT.overlap,
    paddingTop: PUBLISHER_GRID.paddingTop,
    paddingBottom: PUBLISHER_GRID.paddingBottom,
  },
  darkSection: { paddingTop: 12, paddingBottom: 4 },
  headerLeft: { gap: 2, paddingHorizontal: FEED_H_PAD, marginBottom: 10 },
  titleGap: { marginTop: 2 },
  matchupCard: { paddingHorizontal: MATCHUP_CARD.hMargin },
  dailyBanner: {
    paddingHorizontal: DAILY_BANNER.hMargin,
    paddingTop: DAILY_BANNER.marginTop,
    paddingBottom: DAILY_BANNER.marginBottom,
  },
  section: { paddingTop: 14, paddingBottom: 4 },
  sectionHeader: {
    paddingHorizontal: FEED_H_PAD,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  seeAllSkeleton: { marginBottom: 4 },
  portraitRow: {
    paddingHorizontal: FEED_H_PAD,
    gap: HERO_ROW.cardGap,
    paddingVertical: 8,
  },
  portraitCard: { borderCurve: 'continuous' },
});
