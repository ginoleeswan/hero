// src/components/skeletons/TitleSkeleton.web.tsx
// Web loading placeholder for the title (film/TV) screen. Mirrors the document-
// scrolled dossier in app/title/[id].tsx so the first paint reserves the real
// geometry (no jump, no beige flash): a deepNavy backdrop stage with the title
// block, then the white dossier cards — the two-column floating-poster layout on
// wide, a single stacked column on mobile. Uses the shared web "breath" blocks so
// the whole field pulses in unison with the rest of the app's skeletons.
import { type ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { SkeletonBlock } from '../web/Skeleton';
import { COLORS, SEAM_COLOR } from '../../constants/colors';
import { TOPBAR_HEIGHT } from '../web/TopBar';

// ── Shared card chrome ───────────────────────────────────────────────────────
// Matches the page's white dossier card (styles.card / cardTitle / cardDivider).
function SkelCard({
  titleW = 90,
  lines = 3,
  children,
  style,
}: {
  titleW?: number;
  lines?: number;
  children?: ReactNode;
  style?: object;
}) {
  return (
    <View style={[skel.card, style]}>
      <SkeletonBlock width={titleW} height={11} borderRadius={3} style={skel.cardEyebrow} />
      <View style={skel.cardDivider} />
      {children ?? (
        <View style={skel.textLines}>
          {Array.from({ length: lines }).map((_, i) => (
            <SkeletonBlock key={i} width={i === lines - 1 ? '68%' : '100%'} height={12} />
          ))}
        </View>
      )}
    </View>
  );
}

// Rails bleed to the card edges (mirrors the real `inCard` rails); the clip hides
// the overflowing tail so the row reads as a scroller at rest.
function RailCard({ titleW, children }: { titleW: number; children: ReactNode }) {
  return (
    <View style={skel.card}>
      <SkeletonBlock width={titleW} height={11} borderRadius={3} style={skel.cardEyebrow} />
      <View style={skel.cardDivider} />
      <View style={skel.railClip}>
        <View style={skel.railRow}>{children}</View>
      </View>
    </View>
  );
}

// Rail item dimensions below are measured from the real rails so each card's
// height matches its loaded counterpart exactly (cast 68² · stills 280×158 ·
// heroes 104×140 · recommendations 116×174).
function CastCard() {
  return (
    <RailCard titleW={70}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={skel.castItem}>
          <SkeletonBlock width={68} height={68} borderRadius={34} />
          <SkeletonBlock width={60} height={11} style={skel.castLine} />
          <SkeletonBlock width={42} height={10} />
          <SkeletonBlock width={34} height={10} />
        </View>
      ))}
    </RailCard>
  );
}

function StillsCard() {
  return (
    <RailCard titleW={80}>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBlock key={i} width={280} height={158} borderRadius={10} />
      ))}
    </RailCard>
  );
}

// captionLines: 0 for the heroes rail (portrait only), 2 for recommendation rails
// (poster + title + meta) — measured against the real rails.
function PosterRail({
  titleW,
  itemW,
  itemH,
  captionLines = 1,
}: {
  titleW: number;
  itemW: number;
  itemH: number;
  captionLines?: number;
}) {
  return (
    <RailCard titleW={titleW}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={skel.posterItem}>
          <SkeletonBlock width={itemW} height={itemH} borderRadius={10} />
          {Array.from({ length: captionLines }).map((_, j) => (
            <SkeletonBlock
              key={j}
              width={Math.round(itemW * (j === 0 ? 0.82 : 0.5))}
              height={11}
              style={j === 0 ? skel.castLine : undefined}
            />
          ))}
        </View>
      ))}
    </RailCard>
  );
}

// Mirrors the real Details card: a stack of label/value rows (not text lines).
function DetailsCard() {
  return (
    <View style={skel.card}>
      <SkeletonBlock width={70} height={11} borderRadius={3} style={skel.cardEyebrow} />
      <View style={skel.cardDivider} />
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={skel.infoRow}>
          <SkeletonBlock width={i % 2 ? 52 : 68} height={11} />
          <SkeletonBlock width={i % 2 ? 96 : 74} height={11} />
        </View>
      ))}
    </View>
  );
}

function WhereToWatchCard() {
  return (
    <View style={skel.card}>
      <SkeletonBlock width={120} height={11} borderRadius={3} style={skel.cardEyebrow} />
      <View style={skel.cardDivider} />
      <View style={skel.providerRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} width={46} height={46} borderRadius={12} />
        ))}
      </View>
    </View>
  );
}

// ── Backdrop stage (mirrors FilmBackdropHeader) ──────────────────────────────
function StageMeta({ wide }: { wide: boolean }) {
  return (
    <View style={skel.meta}>
      <SkeletonBlock dark width={100} height={13} borderRadius={4} />
      {/* One title bar only. A second line pushes the wide meta past the header's
          500px floor, making the stage ~23px taller than a real one-line title
          (e.g. "Toy Story 5") and shoving the body down — measured and matched. */}
      <SkeletonBlock
        dark
        width="64%"
        height={wide ? 46 : 28}
        borderRadius={8}
        style={skel.titleLine}
      />
      <View style={skel.statRail}>
        {[58, 70, 52, 82].map((w) => (
          <SkeletonBlock key={w} dark width={w} height={15} borderRadius={4} />
        ))}
      </View>
      <View style={skel.tagRow}>
        {[64, 78, 58].map((w) => (
          <SkeletonBlock key={w} dark width={w} height={24} borderRadius={12} />
        ))}
      </View>
      <SkeletonBlock dark width={154} height={42} borderRadius={10} style={skel.cta} />
    </View>
  );
}

interface TitleSkeletonProps {
  insets: { top: number };
}

// The white dossier body, on its own — rendered under the real header once the
// title is seeded/loaded (header from seed, body still gated + crossfaded), and
// reused inside the full TitleSkeleton for the cold (no-seed) load.
export function TitleBodySkeleton() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  return (
    <View style={skel.bodyWrap}>
      {wide ? (
        <>
          <View style={skel.bodyRowWide}>
            <View style={skel.posterColWide}>
              <SkeletonBlock width={300} height={450} borderRadius={16} style={skel.posterFloat} />
              <DetailsCard />
              <WhereToWatchCard />
            </View>
            <View style={skel.mainCol}>
              <SkelCard titleW={92} lines={3} />
              <CastCard />
              <StillsCard />
              <PosterRail titleW={150} itemW={104} itemH={140} captionLines={0} />
            </View>
          </View>
          <View style={skel.fullStack}>
            <PosterRail titleW={164} itemW={116} itemH={174} captionLines={2} />
            <PosterRail titleW={132} itemW={116} itemH={174} captionLines={2} />
          </View>
        </>
      ) : (
        <View style={skel.bodyCol}>
          <SkelCard titleW={92} lines={3} />
          <CastCard />
          <StillsCard />
          <PosterRail titleW={150} itemW={104} itemH={140} captionLines={0} />
          <PosterRail titleW={164} itemW={116} itemH={174} captionLines={2} />
          <DetailsCard />
          <WhereToWatchCard />
        </View>
      )}
    </View>
  );
}

export function TitleSkeleton({ insets }: TitleSkeletonProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  return (
    <View style={skel.page}>
      {/* Dark backdrop stage */}
      <View style={[skel.stage, wide ? skel.stageWide : skel.stageMobile]}>
        {wide ? (
          <View style={[skel.contentRow, skel.contentRowWide]}>
            <StageMeta wide />
          </View>
        ) : (
          <View style={[skel.contentRow, { paddingTop: insets.top + 60 }]}>
            <SkeletonBlock dark width={158} height={237} borderRadius={12} />
            <StageMeta wide={false} />
          </View>
        )}
      </View>

      {/* White dossier body */}
      <TitleBodySkeleton />
    </View>
  );
}

const skel = StyleSheet.create({
  page: { width: '100%', backgroundColor: COLORS.beige, paddingBottom: 40 },

  // ── Stage ──
  stage: {
    backgroundColor: COLORS.deepNavy,
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
  } as object,
  stageWide: { minHeight: 500, paddingBottom: 150 },
  stageMobile: { minHeight: 420, paddingBottom: 26 },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    gap: 18,
  },
  contentRowWide: {
    maxWidth: 1180,
    alignSelf: 'center',
    width: '100%',
    paddingLeft: 24 + 320,
    paddingRight: 24,
    paddingTop: TOPBAR_HEIGHT + 44,
    gap: 28,
  } as object,
  meta: { flex: 1, gap: 12, paddingBottom: 4 },
  titleLine: { marginTop: 2 },
  statRail: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 2 },
  cta: { marginTop: 8 },

  // ── Body ──
  bodyWrap: { maxWidth: 1180, alignSelf: 'center', width: '100%' },
  bodyCol: { padding: 20, gap: 16 },
  mainCol: { flex: 1, minWidth: 0, gap: 18 } as object,
  bodyRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    paddingHorizontal: 24,
    marginTop: -128,
  },
  posterColWide: { width: 300, flexShrink: 0, gap: 18 } as object,
  fullStack: { paddingHorizontal: 24, paddingTop: 18, gap: 18 },
  posterFloat: {
    marginTop: -260,
    boxShadow: '0 30px 60px -22px rgba(0,0,0,0.6)',
  } as object,

  // ── Card chrome (matches page styles.card) ──
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    boxShadow: '0 14px 36px -12px rgba(41,60,67,0.16)',
    overflow: 'hidden',
  } as object,
  cardEyebrow: { marginBottom: 10 },
  cardDivider: { height: 1, backgroundColor: '#ede5da', marginBottom: 14 },
  textLines: { gap: 9 },

  // ── Rails inside cards ──
  railClip: { overflow: 'hidden' } as object,
  railRow: { flexDirection: 'row', gap: 14 },
  castItem: { alignItems: 'center', gap: 8, width: 68 },
  castLine: { marginTop: 2 },
  posterItem: { gap: 8 },
  providerRow: { flexDirection: 'row', gap: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
});
