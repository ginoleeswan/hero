// src/components/skeletons/HouseSkeleton.tsx
// Loading placeholder for a house page.
//
// The house page used to open on a beige void with "Loading the house…" set in
// 13px grey, and then slam into a dark banner over a two-column workspace — a
// blank screen followed by a jump, which is the worst of both.
//
// Two things fix that. First, the banner isn't guessed: `useHouse` fetches the
// house row beside the graph, so the crest, name, words, seat and member count
// are real from the first frame and never move. Only the parts that genuinely
// have to wait — the lineage chart and the roster — are placeholders. Second,
// the placeholders carry the real geometry (card radii, the 132px axis gutter,
// the 306px rail), so when the graph lands nothing reflows.
import { View, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { COLORS, SURFACE_GRADIENT, SEAM_COLOR } from '../../constants/colors';
import { HouseBanner, BANNER_NATIVE_CLEARANCE } from '../family/HouseBanner';
import type { HouseChrome } from '../../hooks/useHouse';

/** Placeholder fill for the ink band, where the beige base would glow. */
const INK_TINT = 'rgba(245,235,220,0.10)';

/** One line of the 11–12.5px labels these bars stand in for. */
const TEXT_LINE = 15;

/** A generation row: 52px face + 8px gap + a 9px name plate. */
const ROW_H = 69;
/** Vertical room between generations, roughly the real chart's at rest. */
const ROW_GAP = 54;

/** Roster name lengths — irregular on purpose, in the rhythm of real names. */
const NAME_WIDTHS = ['64%', '48%', '72%', '55%', '80%', '43%', '68%', '58%', '75%'] as const;

export function HouseSkeleton({
  chrome,
  twoColumn = false,
  stageHeight,
  maxWidth = 1320,
}: {
  /** The house's own row, when it has arrived. Given, the band is the real one. */
  chrome?: HouseChrome | null;
  twoColumn?: boolean;
  stageHeight?: number;
  maxWidth?: number;
}) {
  // FamilyCanvas's own breakpoint. Below it the chart drops its card and its
  // generation gutter, so a skeleton that keeps them is drawing a screen that
  // never arrives.
  const { width } = useWindowDimensions();
  const wide = width >= 700;

  return (
    <SkeletonProvider>
      <View style={styles.root}>
        {chrome ? (
          <HouseBanner
            name={chrome.name}
            universe={chrome.universe}
            words={chrome.words}
            seat={chrome.seat}
            blurb={chrome.blurb}
            memberCount={chrome.memberCount}
            tint={chrome.sigil_tint ?? COLORS.orange}
            maxWidth={maxWidth}
          />
        ) : (
          <BannerSkeleton maxWidth={maxWidth} />
        )}

        <View
          style={
            [styles.workspace, { maxWidth }, twoColumn && styles.workspaceWide] as unknown as object
          }
        >
          <View style={[styles.stageCol, twoColumn && styles.stageColWide] as object}>
            <ConsoleSkeleton />
            <ChartSkeleton height={stageHeight ?? (wide ? 460 : 360)} wide={wide} />
          </View>
          <View style={[styles.rail, twoColumn && styles.railWide] as object}>
            <RosterSkeleton />
          </View>
        </View>
      </View>
    </SkeletonProvider>
  );
}

/** Only seen if the house row itself is slow — brief, but it must not jump. */
function BannerSkeleton({ maxWidth }: { maxWidth: number }) {
  const insets = useSafeAreaInsets();
  const paddingTop = Platform.OS === 'web' ? undefined : insets.top + BANNER_NATIVE_CLEARANCE;
  return (
    <View style={[styles.band, paddingTop !== undefined && { paddingTop }] as object}>
      <View style={[styles.bandInner, { maxWidth }] as object}>
        <Skeleton width={101} height={116} borderRadius={12} color={INK_TINT} />
        <View style={styles.bandIdentity}>
          <Skeleton width={140} height={10} borderRadius={4} color={INK_TINT} />
          <Skeleton width="46%" height={40} borderRadius={8} color={INK_TINT} />
          <Skeleton width={190} height={16} borderRadius={5} color={INK_TINT} />
          <Skeleton width="72%" height={13} borderRadius={4} color={INK_TINT} />
          <Skeleton width="58%" height={13} borderRadius={4} color={INK_TINT} />
          <View style={styles.bandFacts}>
            <Skeleton width={54} height={30} borderRadius={6} color={INK_TINT} />
            <Skeleton width={104} height={30} borderRadius={6} color={INK_TINT} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** "Trace the line" — the two seats, one filled, one waiting. */
function ConsoleSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.textLine}>
        <Skeleton width={104} height={10} borderRadius={4} />
      </View>
      <View style={styles.seats}>
        <View style={styles.seat}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View style={styles.seatMeta}>
            <View style={styles.seatNameLine}>
              <Skeleton width={124} height={14} borderRadius={5} />
            </View>
            <View style={styles.seatCaptionLine}>
              <Skeleton width={82} height={9} borderRadius={4} />
            </View>
          </View>
        </View>
        <View style={styles.emptySeat} />
      </View>
    </View>
  );
}

/**
 * The chart card: title line, then the stage with its generation gutter.
 *
 * The rows are placed where generations actually sit rather than as an even
 * stack — a lineage narrows as it climbs, and mirroring that is what keeps the
 * placeholder from reading as a generic content block.
 */
function ChartSkeleton({ height, wide }: { height: number; wide: boolean }) {
  const rows = [2, 3, 1];
  return (
    <View style={wide ? styles.chartCard : undefined}>
      {wide ? (
        <>
          <View style={styles.chartHead}>
            <Skeleton width={168} height={11} borderRadius={4} />
            <Skeleton width={132} height={10} borderRadius={4} />
          </View>
          <View style={styles.divider} />
        </>
      ) : (
        <>
          <View style={styles.mHead}>
            <Skeleton width={132} height={17} borderRadius={5} />
          </View>
          <View style={styles.mDivider} />
        </>
      )}
      <View style={[styles.stage, { height }] as object}>
        {wide ? (
          <View style={styles.gutter}>
            {rows.map((_, i) => (
              <View key={i} style={styles.gutterRow}>
                <Skeleton width={78} height={9} borderRadius={4} />
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.viewport}>
          {rows.map((count, i) => (
            <View key={i} style={styles.nodeRow}>
              {Array.from({ length: count }).map((__, j) => (
                <View key={j} style={styles.node}>
                  <Skeleton width={52} height={52} borderRadius={26} />
                  <Skeleton width={62} height={9} borderRadius={4} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** The roster rail: heading, the find-a-name field, then the line itself. */
function RosterSkeleton() {
  return (
    <View style={styles.roster}>
      <View style={styles.rosterHead}>
        <Skeleton width={118} height={20} borderRadius={6} />
        <Skeleton width={22} height={10} borderRadius={4} />
      </View>
      <View style={styles.textLine}>
        <Skeleton width="76%" height={11} borderRadius={4} />
      </View>
      <View style={styles.search} />
      <View style={styles.rosterList}>
        {/* Names run to different lengths; a column of identical bars is the
            tell that nothing real is coming. */}
        {NAME_WIDTHS.map((w, i) => (
          <View key={i} style={styles.rosterRow}>
            <Skeleton width={30} height={30} borderRadius={15} />
            <Skeleton width={w} height={12} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Web scrolls the document, so the painted root has to GROW with the content;
  // native lays out inside a flex screen.
  root: {
    backgroundColor: COLORS.beige,
    ...Platform.select({ web: { minHeight: '100lvh' } as object, default: { flex: 1 } }),
  } as object,

  // ── Band (fallback only) ────────────────────────────────────────────────────
  band: {
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
    paddingBottom: 30,
    ...Platform.select({
      web: {
        backgroundImage: SURFACE_GRADIENT.stage,
        backgroundColor: COLORS.deepNavy,
        // Matches HouseBanner's clearance for the floating web nav.
        paddingTop: 'calc(env(safe-area-inset-top) + 86px)',
      } as object,
      default: {},
    }),
  } as object,
  bandInner: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 26,
  },
  bandIdentity: { flex: 1, gap: 8, minWidth: 0 },
  bandFacts: { flexDirection: 'row', gap: 18, marginTop: 10 },

  // ── Workspace ───────────────────────────────────────────────────────────────
  workspace: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 56,
    gap: 22,
  },
  workspaceWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  stageCol: { gap: 18, minWidth: 0 },
  stageColWide: { flex: 1 },
  rail: { width: '100%' },
  railWide: { width: 306, flexGrow: 0, flexShrink: 0 },

  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eadfcb',
    padding: 18,
    gap: 14,
  },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  seat: {
    flexGrow: 1,
    flexBasis: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fffaf0',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e7dcc9',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  seatMeta: {},
  // The seated name is Flame 17/22 over a 10px caption; holding both lines is
  // what keeps the card — and everything under it — from shifting on arrival.
  seatNameLine: { height: 22, justifyContent: 'center' },
  seatCaptionLine: { height: 14, justifyContent: 'center' },
  emptySeat: {
    flexGrow: 1,
    flexBasis: 210,
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#e7dcc9',
  },

  // ── Chart ───────────────────────────────────────────────────────────────────
  // FamilyCanvas's own card metrics, not the console's — a 6px padding and 6px
  // radius difference is exactly the nudge a skeleton exists to prevent.
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    boxShadow: '0 6px 22px rgba(41,60,67,0.06)',
  } as object,
  // Rows are held at the height of the TEXT they stand in for — measured, not
  // guessed — so a lighter bar inside them still occupies a real line.
  // Mobile chart header: the page's right-aligned title over a navy rule.
  mHead: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 5 },
  mDivider: { height: 1, backgroundColor: COLORS.navy, borderRadius: 30, marginBottom: 16 },
  chartHead: {
    height: TEXT_LINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: { height: 1, backgroundColor: '#ede5da', marginTop: 10, marginBottom: 18 },
  stage: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ede5da',
    overflow: 'hidden',
  },
  // Gutter and viewport share a row height and gap so the generation labels sit
  // level with their rows — and the rows are CENTRED as a group rather than
  // spread over the full height, because the real chart opens framed on the
  // person it is rooted on, not stretched corner to corner.
  gutter: {
    width: 132,
    backgroundColor: '#f6efe4',
    borderRightWidth: 1,
    borderRightColor: '#ece3d4',
    justifyContent: 'center',
    gap: ROW_GAP,
  },
  gutterRow: { height: ROW_H, justifyContent: 'center', paddingLeft: 12 },
  viewport: { flex: 1, backgroundColor: '#fdf9f4', justifyContent: 'center', gap: ROW_GAP },
  nodeRow: { height: ROW_H, flexDirection: 'row', justifyContent: 'center', gap: 42 },
  node: { alignItems: 'center', gap: 8 },

  // ── Roster ──────────────────────────────────────────────────────────────────
  roster: { gap: 12 },
  rosterHead: {
    height: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  search: {
    backgroundColor: '#fffaf0',
    borderWidth: 1,
    borderColor: '#e7dcc9',
    borderRadius: 12,
    height: 38,
  },
  rosterList: { gap: 4 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  textLine: { height: TEXT_LINE, justifyContent: 'center' },
});
