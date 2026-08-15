// src/components/skeletons/EventSkeleton.tsx
// Loading placeholders for the two event routes. Both keep the sheet grammar the
// real bodies use (EventIndexList / EventDossier): an ink masthead, the warm
// hairline, then paper — so the page never flips tone at the handoff.
//
// Geometry is IMPORTED from constants/eventGeometry, never copied. It used to be
// copied, and the copies were not merely stale — they were never right. The
// dossier placeholder drew NOTHING for the method paragraph (three lines, 63pt),
// gave the stat rail 40pt where a Flame 40 figure over a 10pt label occupies 65,
// and closed its stage on a 28pt pad where the real one reserves 60% of the
// readership curve's height (90pt). It came out ~180pt short, so the whole
// dossier dropped most of a screen the moment content landed. The index
// placeholder's rows were ~88pt short each, four of them.
//
// The fix is on both sides: the real components now state every line box
// explicitly instead of inheriting whatever the font's metrics gave, and both
// sides read those numbers from one module.
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { SURFACE } from '../../constants/colors';
import { PAPER_SHEET_SURFACE } from '../ui/PaperSheet';
import { EVENT_STAGE, EVENT_PAPER, EVENT_INDEX, EVENT_INK } from '../../constants/eventGeometry';

/** VenueMap's height at the dossier stage's 190pt width — the projection's box is
 *  166° of latitude over 360° of longitude, and the skeleton has to reserve the
 *  same or the stage resettles when the real map arrives. */
const EVENT_MAP_H = Math.round((190 * 166) / 360);

const PAD = EVENT_STAGE.pad;

/**
 * The band geometry the real components lay out from, at the CURRENT width.
 *
 * The placeholders were phone-only: every band hardcoded the 18pt phone gutter
 * and ran full-bleed, while EventDossier/EventHub/EventIndexList switch to a
 * 40pt gutter at 900 and centre themselves in a 900pt measure. On a desktop
 * window that meant a wall of edge-to-edge bars handing over to a narrow centred
 * column — the single most visible thing a placeholder can get wrong, because
 * the jump is horizontal and affects every line at once.
 *
 * Same rule as the vertical geometry: read it from where the page reads it.
 */
function useStageMetrics() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  return {
    wide,
    pad: wide ? EVENT_STAGE.padWide : EVENT_STAGE.pad,
    // The routes cap the reading measure and centre it. Same number here or the
    // placeholder is a different width from the page it stands in for.
    band: { width: '100%' as const, maxWidth: 1180, alignSelf: 'center' as const },
  };
}

// Placeholder fill for the ink band, where the beige base would glow.
const TILE_ART_H = 104;
const INK_TINT = 'rgba(245,235,220,0.10)';

// The lead trailer's backdrop is `aspectRatio: 16/8` at the gutter's width, so
// the placeholder is derived from the same ratio rather than guessed.
function useLeadHeight() {
  const { width } = useWindowDimensions();
  const pad = width >= 900 ? EVENT_STAGE.padWide : EVENT_STAGE.pad;
  return Math.round((Math.min(width, 1180) - pad * 2) / EVENT_PAPER.leadAspect);
}

/**
 * A bar of ink centred in the line box the real text will occupy. The BOX is
 * what sets where everything below it starts; the bar inside it is the height
 * of the glyphs, because a bar filling the whole line box reads as a slab
 * rather than as a line of type.
 */
function TextLine({
  box,
  ink,
  width,
  radius = 4,
  tint,
  style,
}: {
  box: number;
  ink: number;
  width: number | `${number}%`;
  radius?: number;
  tint?: string;
  style?: object;
}) {
  return (
    <View style={[styles.lineBox, { height: box }, style]}>
      <Skeleton width={width} height={ink} borderRadius={radius} color={tint} />
    </View>
  );
}

/**
 * One full-width tone band with the reading measure centred inside it.
 *
 * The tone (ink or paper) has to bleed edge to edge; the CONTENT inside it has
 * to sit in the same centred, gutter-padded column the real page uses. Two
 * views, exactly as EventDossier and EventHub do it.
 */
function Band({
  tone,
  style,
  children,
}: {
  tone: object;
  style?: object;
  children: React.ReactNode;
}) {
  const m = useStageMetrics();
  return (
    <View style={[tone, style]}>
      <View style={[m.band, { paddingHorizontal: m.pad }]}>{children}</View>
    </View>
  );
}

/** A wrapped paragraph, at the line count the real one is boxed to. */
function Paragraph({
  lines,
  box,
  ink,
  tint,
  style,
  widths,
}: {
  lines: number;
  box: number;
  ink: number;
  tint?: string;
  style?: object;
  widths: readonly (number | `${number}%`)[];
}) {
  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, i) => (
        <TextLine key={i} box={box} ink={ink} tint={tint} width={widths[i] ?? '100%'} />
      ))}
    </View>
  );
}

/** One column of the dossier's stat rail — a figure over its label. */
function StatSkeleton({
  valueBox,
  valueInk,
  valueWidth,
  radius,
}: {
  valueBox: number;
  valueInk: number;
  valueWidth: number;
  radius: number;
}) {
  return (
    <View style={styles.stat}>
      <TextLine box={valueBox} ink={valueInk} width={valueWidth} radius={radius} tint={INK_TINT} />
      <TextLine
        box={EVENT_STAGE.statLabelLine}
        ink={EVENT_INK.statLabel}
        width={valueWidth - 14}
        tint={INK_TINT}
      />
    </View>
  );
}

/** app/event/index.tsx — the record: masthead over a list of detected events. */
export function EventIndexSkeleton() {
  return (
    <SkeletonProvider>
      <View>
        <Band tone={styles.indexStage}>
          <TextLine
            box={EVENT_INDEX.eyebrowLine}
            ink={EVENT_INK.eyebrow}
            width={110}
            tint={INK_TINT}
            style={styles.indexEyebrow}
          />
          <TextLine
            box={EVENT_INDEX.titleLine}
            ink={EVENT_INK.title}
            width="76%"
            radius={6}
            tint={INK_TINT}
          />
          <Paragraph
            lines={EVENT_INDEX.methodLines}
            box={EVENT_INDEX.methodLine}
            ink={EVENT_INK.method}
            tint={INK_TINT}
            style={styles.indexMethod}
            widths={['100%', '96%', '62%']}
          />
          {/* The live event's spotlight, which lives on ink above the seam. */}
          <View style={styles.spotRule} />
          <TextLine box={16} ink={11} width={150} tint={INK_TINT} />
          <Skeleton width={200} height={62} borderRadius={8} style={styles.spotMark} />
          <TextLine box={21} ink={14} width="58%" tint={INK_TINT} style={styles.spotStat} />
        </Band>
        {/* Two quarters of tiles. The real page groups events by the quarter
            they happen in and renders each as a mark on an accent wash, so the
            placeholder is a season heading over a two-up grid — mirroring the
            layout rather than approximating an older one. It used to mirror
            four full-width curve rows, which the page no longer has. */}
        <Band tone={styles.indexPaper}>
          {Array.from({ length: 2 }).map((_, q) => (
            <View key={q}>
              <View style={styles.seasonHead}>
                <TextLine box={18} ink={11} width={104} radius={3} />
                <View style={styles.seasonRule} />
              </View>
              <View style={styles.tileGrid}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <View key={i} style={styles.tile}>
                    {/* Ink ground, mirroring the real tile — otherwise the grid appears
                        to darken on load. */}
                    <Skeleton width="100%" height={TILE_ART_H} borderRadius={12} color={INK_TINT} />
                    <TextLine box={20} ink={15} width="72%" radius={4} />
                    <TextLine box={15} ink={11} width="88%" />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Band>
      </View>
    </SkeletonProvider>
  );
}

/**
 * app/event/[slug]/index.tsx when the event is NOT live — the series hub.
 *
 * It was borrowing EventDossierSkeleton, which promises a stat rail, a curve and
 * four content sections the hub does not have. A placeholder that mirrors a
 * different page is worse than none: it makes the real page look like it lost
 * something on arrival.
 */
export function EventHubSkeleton() {
  const { wide } = useStageMetrics();
  return (
    <SkeletonProvider>
      <View>
        <Band tone={styles.hubStage}>
          {/* The eyebrow row: a standing line on the left, the "All events"
              pill on the right. Both are real elements at this width, so both
              are reserved — the pill especially, since it is the only thing in
              the masthead a reader can click. */}
          <View style={styles.hubEyebrowRow}>
            <TextLine
              box={EVENT_STAGE.eyebrowLine}
              ink={EVENT_INK.eyebrow}
              width={128}
              tint={INK_TINT}
            />
            <Skeleton width={104} height={26} borderRadius={999} color={INK_TINT} />
          </View>
          {/* The mark. Boxed at markMinHeight rather than the fitted height of
              whichever brand is coming — that is not knowable before the hub
              resolves, and the reservation has to be the same for all of them. */}
          <Skeleton
            width={wide ? 300 : 200}
            height={EVENT_STAGE.markMinHeight}
            borderRadius={8}
            color={INK_TINT}
          />
          <Paragraph
            lines={3}
            box={EVENT_STAGE.methodLine}
            ink={EVENT_INK.method}
            tint={INK_TINT}
            style={styles.hubMethod}
            widths={['100%', '94%', '48%']}
          />
        </Band>
        <Band tone={styles.hubPaper}>
          <TextLine box={30} ink={23} width={128} radius={5} />
          <TextLine box={18} ink={13} width={186} style={styles.hubNote} />
          {/* An edition row, as it is actually built now: year and window on
              one line with a face strip opposite, the recap under it, then the
              counts and the proportion bar. Mirroring the pre-recap two-line
              row left every row ~40pt short, so the whole list jumped up on
              arrival. */}
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={styles.hubRow}>
              <View style={styles.hubRowTop}>
                <View style={styles.hubRowMain}>
                  <TextLine box={30} ink={23} width={72} radius={5} />
                  <TextLine box={16} ink={12} width={148} />
                </View>
                <View style={styles.hubFaces}>
                  {Array.from({ length: 3 }).map((_, f) => (
                    <Skeleton key={f} width={34} height={34} borderRadius={999} />
                  ))}
                </View>
              </View>
              <TextLine box={19} ink={14} width="88%" />
              <TextLine box={17} ink={13} width="52%" />
              <Skeleton width="100%" height={3} borderRadius={999} style={styles.hubBar} />
            </View>
          ))}
        </Band>
      </View>
    </SkeletonProvider>
  );
}

/** app/event/[slug].tsx — the dossier: masthead + stat rail over paper sections. */
export function EventDossierSkeleton() {
  const leadHeight = useLeadHeight();
  return (
    <SkeletonProvider>
      <View>
        <Band tone={styles.stage}>
          <TextLine
            box={EVENT_STAGE.eyebrowLine}
            ink={EVENT_INK.eyebrow}
            width={130}
            tint={INK_TINT}
            style={styles.eyebrow}
          />
          <TextLine
            box={EVENT_STAGE.titleLine}
            ink={EVENT_INK.title}
            width="70%"
            radius={6}
            tint={INK_TINT}
          />
          <TextLine
            box={EVENT_STAGE.windowLine}
            ink={EVENT_INK.window}
            width={180}
            tint={INK_TINT}
            style={styles.window}
          />
          <Paragraph
            lines={EVENT_STAGE.methodLines}
            box={EVENT_STAGE.methodLine}
            ink={EVENT_INK.method}
            tint={INK_TINT}
            style={styles.method}
            widths={['100%', '94%', '58%']}
          />
          {/* The rail's own height comes from the big stat; the margin below it
              is the clearance the real stage keeps so the readership curve
              behind it can be read. */}
          <View style={styles.stats}>
            <StatSkeleton
              valueBox={EVENT_STAGE.statBigLine}
              valueInk={EVENT_INK.statBig}
              valueWidth={92}
              radius={6}
            />
            {/* One block, not two figures. The rail lost "reads on the peak
                day" and "article edits" — both instrument readings a reader has
                no use for — and gained the venue map, which is a wide graphic
                over a caption rather than a figure over a label. A skeleton that
                still promised two small stats would settle into something a
                different shape. */}
            <View style={styles.statMap}>
              <Skeleton height={EVENT_MAP_H} borderRadius={6} color={INK_TINT} />
              <TextLine box={16} ink={11} width={112} tint={INK_TINT} />
            </View>
          </View>
        </Band>
        <Band tone={styles.paper}>
          <TextLine
            box={EVENT_PAPER.sectionTitleLine}
            ink={EVENT_INK.sectionTitle}
            width="46%"
            radius={5}
          />
          <TextLine
            box={EVENT_PAPER.sectionNoteLine}
            ink={EVENT_INK.sectionNote}
            width="64%"
            style={styles.sectionNote}
          />
          <Skeleton width="100%" height={leadHeight} borderRadius={EVENT_PAPER.leadRadius} />
        </Band>
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  lineBox: { justifyContent: 'center' },

  // ── dossier ──
  // No paddingBottom: the real stage closes on the stat rail's curve clearance.
  stage: {
    backgroundColor: SURFACE.ink,
    paddingTop: EVENT_STAGE.paddingTop,
  },
  eyebrow: { marginBottom: EVENT_STAGE.eyebrowGap },
  window: { marginTop: EVENT_STAGE.windowGap },
  method: { marginTop: EVENT_STAGE.methodGap },
  stats: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 30,
    marginTop: EVENT_STAGE.statsGap,
    marginBottom: EVENT_STAGE.curveH * EVENT_STAGE.curveClearance,
  },
  stat: { gap: EVENT_STAGE.statInnerGap },
  // Matches VenueMap: 190 wide at the dossier's stage, 166/360 of that tall.
  statMap: { width: 190, gap: 10 },
  paper: {
    ...PAPER_SHEET_SURFACE,
    paddingTop: EVENT_PAPER.paddingTop,
    paddingBottom: EVENT_PAPER.paddingBottom,
  },
  sectionNote: { marginBottom: EVENT_PAPER.sectionBodyGap },

  // ── index ──
  indexStage: {
    backgroundColor: SURFACE.ink,
    paddingTop: EVENT_STAGE.paddingTop,
    paddingBottom: EVENT_INDEX.stagePaddingBottom,
  },
  indexEyebrow: { marginBottom: EVENT_INDEX.eyebrowGap },
  indexMethod: { marginTop: EVENT_INDEX.methodGap },
  indexPaper: {
    ...PAPER_SHEET_SURFACE,
    paddingTop: EVENT_INDEX.paperPaddingTop,
    paddingBottom: EVENT_INDEX.paperPaddingBottom,
  },
  spotRule: {
    height: 1,
    backgroundColor: 'rgba(245,235,220,0.16)',
    marginTop: 24,
    marginBottom: 18,
  },
  spotMark: { marginTop: 12 },
  spotStat: { marginTop: 14 },
  seasonHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 30,
    marginBottom: 14,
  },
  seasonRule: { flex: 1, height: 1, backgroundColor: 'rgba(11,24,32,0.12)' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Two-up, matching the real grid's minimum column count.
  tile: { width: '47%', gap: 7 },

  // ── hub ──
  // Its own stage rather than the index's: the hub leads with a mark and a
  // method paragraph where the index leads with a headline and a spotlight, so
  // borrowing the index's rhythm put the seam in the wrong place.
  hubStage: {
    backgroundColor: SURFACE.ink,
    paddingTop: EVENT_STAGE.paddingTop,
    paddingBottom: 34,
  },
  hubEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: EVENT_STAGE.eyebrowGap,
  },
  hubMethod: { marginTop: EVENT_STAGE.methodGap },
  hubPaper: {
    ...PAPER_SHEET_SURFACE,
    paddingTop: 30,
    paddingBottom: 48,
  },
  hubNote: { marginTop: 4, marginBottom: 20 },
  hubRow: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(11,24,32,0.10)', gap: 4 },
  hubRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  hubRowMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  hubFaces: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  hubBar: { marginTop: 6 },

  indexRow: {
    paddingVertical: EVENT_INDEX.rowPaddingVertical,
    gap: EVENT_INDEX.rowGap,
    borderBottomWidth: EVENT_INDEX.rowBorder,
    borderBottomColor: 'rgba(11,24,32,0.10)',
  },
  indexRowCurve: {
    marginTop: EVENT_INDEX.rowCurveGap,
    marginBottom: EVENT_INDEX.rowCurveGap,
    marginHorizontal: -PAD,
  },
});
