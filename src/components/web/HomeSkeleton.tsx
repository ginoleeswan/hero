import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSkeletonAnim, SkeletonBlock } from './Skeleton';
import { COLORS } from '../../constants/colors';
import { NAV_HEIGHT } from './TopNav';

const ROW_CARD_WIDTH = 220;
const ROW_CARD_HEIGHT = 310;

type Opacity = ReturnType<typeof useSkeletonAnim>;

function SpotlightSkeleton({ opacity, dark }: { opacity: Opacity; dark: boolean }) {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 640;
  const pagePad = isMobile ? 16 : 32;

  if (isMobile) {
    const contentHeight = 240;
    return (
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          height: contentHeight,
          marginVertical: 20,
          paddingHorizontal: pagePad,
        }}
      >
        <SkeletonBlock
          opacity={opacity}
          dark={dark}
          width={150}
          height={contentHeight}
          borderRadius={10}
        />
        <View style={{ flex: 1 }}>
          <SkeletonBlock opacity={opacity} dark={dark} height={contentHeight} borderRadius={10} />
        </View>
      </View>
    );
  }

  const contentHeight = Math.min(460, height * 0.58);
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 16,
        height: contentHeight,
        marginBottom: 24,
        paddingHorizontal: pagePad,
      }}
    >
      {/* Accordion strip — mirror the large scale breakpoint widths */}
      {[280, 140, 100, 76].map((w, i) => (
        <SkeletonBlock
          key={i}
          opacity={opacity}
          dark={dark}
          width={w}
          height={contentHeight}
          borderRadius={14}
        />
      ))}
      {/* Info panel */}
      <View style={{ flex: 1 }}>
        <SkeletonBlock opacity={opacity} dark={dark} height={contentHeight} borderRadius={16} />
      </View>
    </View>
  );
}

function StatPodsSkeleton({ opacity, pagePad }: { opacity: Opacity; pagePad: number }) {
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

function RowHeader({ opacity, pagePad, dark = false }: { opacity: Opacity; pagePad: number; dark?: boolean }) {
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
      <View style={{ flexDirection: 'row', gap: 16, paddingLeft: pagePad }}>
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

function DarkRowSkeleton({ opacity, pagePad }: { opacity: Opacity; pagePad: number }) {
  return (
    <View style={skel.darkSection}>
      <RowHeader opacity={opacity} pagePad={pagePad} dark />
      <View style={{ flexDirection: 'row', gap: 16, paddingLeft: pagePad }}>
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
  );
}

export function WebHomeSkeleton() {
  const opacity = useSkeletonAnim();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isMobile = width < 640;
  const pagePad = width < 640 ? 16 : 32;

  return (
    <ScrollView
      style={[skel.scroll, isDesktop && (skel.scrollDark as object)] as object}
      contentContainerStyle={
        [skel.content, isMobile && { paddingTop: NAV_HEIGHT }] as object
      }
    >
      {isDesktop ? (
        <>
          <View style={skel.darkStage}>
            <SpotlightSkeleton opacity={opacity} dark />
            <StatPodsSkeleton opacity={opacity} pagePad={pagePad} />
          </View>
          <View style={skel.ticker} />
        </>
      ) : (
        <SpotlightSkeleton opacity={opacity} dark={false} />
      )}

      {/* Beige carousel canvas — mirrors the curated row order in explore.web */}
      <View style={skel.beigeCanvas}>
        <RowSkeleton opacity={opacity} pagePad={pagePad} />
        <DarkRowSkeleton opacity={opacity} pagePad={pagePad} />
        <RowSkeleton opacity={opacity} pagePad={pagePad} />
        <RowSkeleton opacity={opacity} pagePad={pagePad} />
        <DarkRowSkeleton opacity={opacity} pagePad={pagePad} />
        <RowSkeleton opacity={opacity} pagePad={pagePad} />
      </View>
    </ScrollView>
  );
}

const skel = StyleSheet.create({
  scroll: { flex: 1 },
  scrollDark: { backgroundColor: COLORS.deepNavy } as object,
  content: { paddingBottom: 0 },
  darkStage: {
    backgroundColor: COLORS.deepNavy,
    paddingTop: NAV_HEIGHT + 24,
    paddingBottom: 28,
  },
  ticker: { height: 38, backgroundColor: COLORS.orange },
  beigeCanvas: {
    backgroundColor: COLORS.beige,
    paddingTop: 40,
    paddingBottom: 100,
  },
  section: { marginBottom: 52 },
  darkSection: {
    backgroundColor: COLORS.navy,
    paddingTop: 28,
    paddingBottom: 8,
    marginBottom: 52,
  },
});
