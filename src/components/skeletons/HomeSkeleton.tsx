// src/components/skeletons/HomeSkeleton.tsx
//
// This must MIRROR app/(tabs)/explore.tsx's real feed, or the handoff jumps.
// Two things it gets right that a generic skeleton cannot:
//
//  • Row ORDER matches the real `rows` array: spotlight → publishers →
//    matchup → daily → (beige zone) portrait rows.
//  • Zone COLOUR matches DARK_ROWS: the first four rows sit on the deep-navy
//    stage, and beige paper only begins where the real page's first Library
//    row does. The old skeleton put beige directly under the spotlight, so the
//    whole background flipped dark↔beige at the handoff.
//
// Geometry constants are copied from the real components (cited inline). If
// one of those changes, change it here in the same PR.
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Placeholder fill for the dark stage. 8% beige on deepNavy was almost
// invisible — the billboard read as a broken void rather than a placeholder —
// so the base is lifted and the billboard itself gets a slightly stronger
// wash to separate it from the stage rows beneath.
const ON_DARK = 'rgba(245,235,220,0.13)';
const ON_DARK_SOFT = 'rgba(245,235,220,0.07)';

// PublisherGrid: H_PAD 16, GAP 10, tile minHeight 84, radius 16.
const H_PAD = 16;
const TILE_GAP = 10;
const TILE_W = (SCREEN_WIDTH - H_PAD * 2 - TILE_GAP) / 2;
const TILE_H = 84;

// HomeHeroRow portrait cards.
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
const CARD_HEIGHT = Math.round(CARD_WIDTH * ((SCREEN_HEIGHT * 0.66) / SCREEN_WIDTH));
const CARD_GAP = 12;

// SpotlightCarousel.spotlightHeight(): insetTop + 50% of the screen. Rendered
// with showLip={false} on the feed, so NO beige lip here either.
//
// A bare rectangle over half the screen reads as "something is broken", not
// "a billboard is coming" — so the slide's own furniture is sketched in at its
// real offsets: the name (SpotlightSlide.meta, bottom 40) and the pager dots
// (SpotlightCarousel.dots, bottom 22, 5×5 with a 14-wide active pill).
function SpotlightSkeleton({ insetTop }: { insetTop: number }) {
  const height = insetTop + Math.round(SCREEN_HEIGHT * 0.5);
  return (
    <View style={{ height }}>
      {/* A flat block over half the screen reads as a void. The real slide is a
          full-bleed portrait under a bottom scrim, so the placeholder is a
          gradient with the same weight distribution — light at the crown where
          the face sits, sinking into the stage where the scrim takes over. */}
      <LinearGradient
        colors={['rgba(245,235,220,0.10)', 'rgba(245,235,220,0.05)', 'rgba(11,24,32,0)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Placeholders on the stage stay in the stage's own tone. At the default
          (light beige) fill these read as solid blocks pasted over the dark. */}
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
            width={i === 0 ? 14 : 5}
            height={5}
            borderRadius={2.5}
            color={i === 0 ? ON_DARK : ON_DARK_SOFT}
          />
        ))}
      </View>
    </View>
  );
}

// PublisherGrid — four tiles, two columns, on the dark stage.
function PublisherGridSkeleton() {
  return (
    <View style={styles.publisherGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} width={TILE_W} height={TILE_H} borderRadius={16} color={ON_DARK} />
      ))}
    </View>
  );
}

// TodaysMatchup — kicker + title, then the glass card (96px portraits +
// 20px vertical padding + the vote row).
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
        <Skeleton width="100%" height={206} borderRadius={18} color={ON_DARK} />
      </View>
    </View>
  );
}

// DailyChallengeBanner on the dark stage.
function DailyBannerSkeleton() {
  return (
    <View style={styles.dailyBanner}>
      <Skeleton width="100%" height={94} borderRadius={20} color={ON_DARK} />
    </View>
  );
}

// A Library row on beige paper.
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
        {/* The dark stage — same four row types the real feed keeps on navy. */}
        <View style={styles.stage}>
          <PublisherGridSkeleton />
          <MatchupSkeleton />
          <DailyBannerSkeleton />
        </View>
        {/* Beige paper begins exactly where the real first Library row does,
            with the same rounded seam lip. */}
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
  // SpotlightSlide.meta: absolute, bottom 40, centred.
  spotlightMeta: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  spotlightSub: { marginTop: 9 },
  // SpotlightCarousel.dots: absolute, bottom 22, centred row, gap 6.
  spotlightDots: {
    position: 'absolute',
    bottom: 22,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderCurve: 'continuous',
    marginTop: 10,
    overflow: 'hidden',
  },
  publisherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
    paddingHorizontal: H_PAD,
    // podsOverlap: the real grid rides -14 up into the spotlight's fade.
    marginTop: -14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  darkSection: { paddingTop: 12, paddingBottom: 4 },
  headerLeft: { gap: 2, paddingHorizontal: 15, marginBottom: 10 },
  titleGap: { marginTop: 2 },
  matchupCard: { paddingHorizontal: 15 },
  dailyBanner: { paddingHorizontal: 15, paddingTop: 12, paddingBottom: 16 },
  section: { paddingTop: 14, paddingBottom: 4 },
  sectionHeader: {
    paddingHorizontal: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  seeAllSkeleton: { marginBottom: 4 },
  portraitRow: {
    paddingHorizontal: 15,
    gap: CARD_GAP,
    paddingVertical: 8,
  },
  portraitCard: {
    borderCurve: 'continuous',
  },
});
