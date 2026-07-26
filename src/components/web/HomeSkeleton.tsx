import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useSkeletonAnim, SkeletonBlock } from './Skeleton';
import { COLORS, pageGutter } from '../../constants/colors';
import { spotlightLayout } from './home/spotlightLayout';
import { TOPBAR_HEIGHT } from './TopBar';

const ROW_CARD_WIDTH = 220;
const ROW_CARD_HEIGHT = 310;

type Opacity = ReturnType<typeof useSkeletonAnim>;

function SpotlightSkeleton({ opacity, dark }: { opacity: Opacity; dark: boolean }) {
  const { width } = useWindowDimensions();
  // Same source of truth as the real stage, so the page doesn't nudge when the
  // spotlight swaps in. The skeleton IS the layout, minus the content.
  const { state, stageHeight, cardWidth, tail, gutter } = spotlightLayout(width);

  if (state === 'stacked') {
    return (
      <View style={{ gap: 14, marginTop: 6, marginBottom: 22, paddingHorizontal: gutter }}>
        <View style={{ alignSelf: 'center' }}>
          <SkeletonBlock
            opacity={opacity}
            dark={dark}
            width={cardWidth}
            height={stageHeight}
            borderRadius={18}
          />
        </View>
        <SkeletonBlock opacity={opacity} dark={dark} height={64} borderRadius={10} />
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 16,
        height: stageHeight,
        marginBottom: 24,
        paddingHorizontal: gutter,
      }}
    >
      {[cardWidth, ...tail].map((w, i) => (
        <SkeletonBlock
          key={i}
          opacity={opacity}
          dark={dark}
          width={w}
          height={stageHeight}
          borderRadius={14}
        />
      ))}
      {/* Info panel */}
      <View style={{ flex: 1 }}>
        <SkeletonBlock opacity={opacity} dark={dark} height={stageHeight} borderRadius={16} />
      </View>
    </View>
  );
}

function StatPodsSkeleton({ opacity, pagePad }: { opacity: Opacity; pagePad: number }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // Desktop: 4-up row. Tablet & mobile: 2×2 grid (mirrors StatPods).
  if (!isDesktop) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: pagePad }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={{ flexGrow: 1, flexBasis: 'calc(50% - 5px)' } as object}>
            <SkeletonBlock opacity={opacity} dark height={84} borderRadius={14} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: pagePad }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ flex: 1 }}>
          <SkeletonBlock opacity={opacity} dark height={84} borderRadius={14} />
        </View>
      ))}
    </View>
  );
}

// Engage row — mirrors the real matchup + daily-game pair under the pods.
function EngageSkeleton({
  opacity,
  pagePad,
  isMobile,
}: {
  opacity: Opacity;
  pagePad: number;
  isMobile: boolean;
}) {
  if (isMobile) {
    // paddingHorizontal on the wrapper, not marginHorizontal on each block: the
    // blocks are width:100%, which ignores their own margin and overflows.
    return (
      <View style={{ marginTop: 12, paddingHorizontal: pagePad }}>
        <SkeletonBlock
          opacity={opacity}
          dark
          height={210}
          borderRadius={16}
          style={{ marginBottom: 12 }}
        />
        <SkeletonBlock opacity={opacity} dark height={96} borderRadius={20} />
      </View>
    );
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 20,
        paddingHorizontal: pagePad,
        marginTop: 16,
      }}
    >
      <View style={{ flex: 1.7 }}>
        <SkeletonBlock opacity={opacity} dark height={192} borderRadius={16} />
      </View>
      {/* Matches the daily card's tall variant beside the matchup (was a short bar). */}
      <View style={{ flex: 1, maxWidth: 440 }}>
        <SkeletonBlock opacity={opacity} dark height={192} borderRadius={20} />
      </View>
    </View>
  );
}

// Right Now — mirrors the dark editorial zone under the ticker: a big campaign
// hero beside a ranked "What's Hot" sidebar (stacked on mobile).
function RightNowSkeleton({ pagePad, isMobile }: { pagePad: number; isMobile: boolean }) {
  return (
    <View style={skel.rightNow}>
      <View style={{ paddingHorizontal: pagePad }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 18 }}>
          <SkeletonBlock dark width={4} height={20} borderRadius={2} />
          <SkeletonBlock dark width={120} height={12} borderRadius={3} />
        </View>
        {isMobile ? (
          <>
            <SkeletonBlock dark height={300} borderRadius={16} style={{ marginBottom: 12 }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBlock
                key={i}
                dark
                height={54}
                borderRadius={12}
                style={{ marginBottom: 8 }}
              />
            ))}
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: 20, alignItems: 'stretch' }}>
            <View style={{ flex: 1.6 }}>
              <SkeletonBlock dark height={312} borderRadius={18} />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBlock key={i} dark height={54} borderRadius={12} />
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function RowHeader({
  opacity,
  pagePad,
  dark = false,
}: {
  opacity: Opacity;
  pagePad: number;
  dark?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 14,
        marginBottom: 16,
        paddingLeft: pagePad,
      }}
    >
      <SkeletonBlock opacity={opacity} dark={dark} width={4} height={44} borderRadius={2} />
      <View style={{ gap: 2, justifyContent: 'center' }}>
        <SkeletonBlock opacity={opacity} dark={dark} width={60} height={9} borderRadius={3} />
        <SkeletonBlock opacity={opacity} dark={dark} width={180} height={32} borderRadius={4} />
      </View>
    </View>
  );
}

function RowSkeleton({ opacity, pagePad }: { opacity: Opacity; pagePad: number }) {
  return (
    <View style={skel.section}>
      <RowHeader opacity={opacity} pagePad={pagePad} />
      <View style={{ flexDirection: 'row', gap: 16, paddingLeft: pagePad, overflow: 'hidden' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock
            key={i}
            opacity={opacity}
            width={ROW_CARD_WIDTH}
            height={ROW_CARD_HEIGHT}
            borderRadius={10}
          />
        ))}
      </View>
    </View>
  );
}

// One continuous dark zone holding two grouped rows — mirrors the "Dark Side".
function DarkZoneSkeleton({ opacity, pagePad }: { opacity: Opacity; pagePad: number }) {
  return (
    <View style={skel.darkZone}>
      {[0, 1].map((g) => (
        <View key={g} style={{ marginBottom: g === 0 ? 28 : 0 }}>
          <RowHeader opacity={opacity} pagePad={pagePad} dark />
          <View style={{ flexDirection: 'row', gap: 16, paddingLeft: pagePad, overflow: 'hidden' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock
                key={i}
                opacity={opacity}
                dark
                width={ROW_CARD_WIDTH}
                height={ROW_CARD_HEIGHT}
                borderRadius={10}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function WebHomeSkeleton() {
  const opacity = useSkeletonAnim();
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const pagePad = pageGutter(width);

  return (
    // Plain View (not a nested ScrollView) so the skeleton matches the loaded
    // screen's document-scroll model and bleeds under the iOS Safari toolbar.
    <View style={[skel.scroll, skel.scrollDark, skel.content] as object}>
      {/* Dark-stage skeleton at all widths — mirrors the unified dark stage
          so there's no beige flash on refresh. */}
      <View style={[skel.darkStage, isMobile && (skel.darkStageMobile as object)] as object}>
        {/* Masthead dateline — the real stage opens with "THURSDAY, JULY 16"
            above the spotlight; reserve it so the strip doesn't sit too high
            and shove the page down on load. */}
        <View style={{ paddingHorizontal: pagePad, marginBottom: 14 }}>
          <SkeletonBlock opacity={opacity} dark width={150} height={10} borderRadius={3} />
        </View>
        <SpotlightSkeleton opacity={opacity} dark />
        <StatPodsSkeleton opacity={opacity} pagePad={pagePad} />
        <EngageSkeleton opacity={opacity} pagePad={pagePad} isMobile={isMobile} />
      </View>
      <View style={skel.ticker} />

      {/* Right Now — the dark editorial zone under the ticker (campaign hero +
          What's Hot), so the first paint reserves it instead of jumping. */}
      <RightNowSkeleton pagePad={pagePad} isMobile={isMobile} />

      {/* Beige carousel canvas — generic browse rows below the fold. */}
      <View style={skel.beigeCanvas}>
        <RowSkeleton opacity={opacity} pagePad={pagePad} />
        <RowSkeleton opacity={opacity} pagePad={pagePad} />
        <RowSkeleton opacity={opacity} pagePad={pagePad} />
        <DarkZoneSkeleton opacity={opacity} pagePad={pagePad} />
        <RowSkeleton opacity={opacity} pagePad={pagePad} />
        <RowSkeleton opacity={opacity} pagePad={pagePad} />
      </View>
    </View>
  );
}

const skel = StyleSheet.create({
  scroll: { flex: 1 },
  scrollDark: { backgroundColor: COLORS.deepNavy } as object,
  content: { paddingBottom: 0 },
  darkStage: {
    backgroundColor: COLORS.deepNavy,
    paddingTop: TOPBAR_HEIGHT + 10,
    paddingBottom: 28,
  },
  darkStageMobile: { paddingTop: TOPBAR_HEIGHT - 4, paddingBottom: 16 } as object,
  ticker: { height: 38, backgroundColor: COLORS.orange },
  rightNow: { backgroundColor: COLORS.deepNavy, paddingTop: 28, paddingBottom: 28 },
  beigeCanvas: {
    backgroundColor: COLORS.beige,
    paddingTop: 40,
    paddingBottom: 100,
  },
  section: { marginBottom: 52 },
  darkZone: {
    backgroundColor: COLORS.navy,
    paddingTop: 28,
    paddingBottom: 8,
    marginBottom: 52,
  },
});
