import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useSkeletonAnim, SkeletonBlock } from './Skeleton';
import { COLORS } from '../../constants/colors';

const ROW_CARD_WIDTH = 220;
const ROW_CARD_HEIGHT = 310;

type Opacity = ReturnType<typeof useSkeletonAnim>;

function SpotlightSkeleton({ opacity }: { opacity: Opacity }) {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 640;
  const pagePad = isMobile ? 16 : 32;
  const contentHeight = isMobile ? 240 : Math.min(320, height * 0.6);

  if (isMobile) {
    return (
      <View
        style={{ flexDirection: 'row', gap: 10, height: contentHeight, marginVertical: 20, paddingHorizontal: pagePad }}
      >
        <SkeletonBlock opacity={opacity} width={150} height={contentHeight} borderRadius={10} />
        <View style={{ flex: 1 }}>
          <SkeletonBlock opacity={opacity} height={contentHeight} borderRadius={10} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={{ flexDirection: 'row', gap: 12, height: contentHeight, marginVertical: 32, paddingHorizontal: pagePad }}
    >
      {/* Accordion strip — mirror the large scale breakpoint widths */}
      {[280, 140, 100, 76].map((w, i) => (
        <SkeletonBlock key={i} opacity={opacity} width={w} height={contentHeight} borderRadius={14} />
      ))}
      {/* Info panel */}
      <View style={{ flex: 1 }}>
        <SkeletonBlock opacity={opacity} height={contentHeight} borderRadius={14} />
      </View>
    </View>
  );
}

function RowHeader({ opacity, pagePad, dark = false }: { opacity: Opacity; pagePad: number; dark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 14, marginBottom: 16, paddingLeft: pagePad }}>
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
          <SkeletonBlock key={i} opacity={opacity} width={ROW_CARD_WIDTH} height={ROW_CARD_HEIGHT} borderRadius={10} />
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
          <SkeletonBlock key={i} opacity={opacity} dark width={ROW_CARD_WIDTH} height={ROW_CARD_HEIGHT} borderRadius={10} />
        ))}
      </View>
    </View>
  );
}

export function WebHomeSkeleton() {
  const opacity = useSkeletonAnim();
  const { width } = useWindowDimensions();
  const pagePad = width < 640 ? 16 : 32;

  return (
    <ScrollView style={skel.scroll} contentContainerStyle={skel.content}>
      <SpotlightSkeleton opacity={opacity} />
      {/* Mirrors the curated row order in index.web.tsx */}
      <RowSkeleton opacity={opacity} pagePad={pagePad} />       {/* Most Iconic */}
      <DarkRowSkeleton opacity={opacity} pagePad={pagePad} />   {/* Villains */}
      <RowSkeleton opacity={opacity} pagePad={pagePad} />       {/* Marvel Universe */}
      <RowSkeleton opacity={opacity} pagePad={pagePad} />       {/* DC Universe */}
      <DarkRowSkeleton opacity={opacity} pagePad={pagePad} />   {/* Anti-Heroes */}
      <RowSkeleton opacity={opacity} pagePad={pagePad} />       {/* Strongest Heroes */}
      <DarkRowSkeleton opacity={opacity} pagePad={pagePad} />   {/* X-Men */}
      <RowSkeleton opacity={opacity} pagePad={pagePad} />       {/* Brightest Minds */}
      <RowSkeleton opacity={opacity} pagePad={pagePad} />       {/* Recently Added */}
    </ScrollView>
  );
}

const skel = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },
  section: { marginBottom: 52 },
  darkSection: {
    backgroundColor: COLORS.navy,
    paddingTop: 28,
    paddingBottom: 8,
    marginBottom: 52,
  },
});
