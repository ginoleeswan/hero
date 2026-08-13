// src/components/skeletons/EventSkeleton.tsx
// Loading placeholders for the two event routes. Both keep the seam grammar the
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
import { SEAM_COLOR, SURFACE } from '../../constants/colors';
import { EVENT_STAGE, EVENT_PAPER, EVENT_INDEX, EVENT_INK } from '../../constants/eventGeometry';

const PAD = EVENT_STAGE.pad;

// Placeholder fill for the ink band, where the beige base would glow.
const INK_TINT = 'rgba(245,235,220,0.10)';

// The lead trailer's backdrop is `aspectRatio: 16/8` at the gutter's width, so
// the placeholder is derived from the same ratio rather than guessed.
function useLeadHeight() {
  const { width } = useWindowDimensions();
  return Math.round((width - PAD * 2) / EVENT_PAPER.leadAspect);
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
        <View style={styles.indexStage}>
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
        </View>
        <View style={styles.seam} />
        <View style={styles.indexPaper}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={styles.indexRow}>
              <TextLine
                box={EVENT_INDEX.rowTitleLine}
                ink={EVENT_INK.sectionTitle}
                width="58%"
                radius={5}
              />
              <TextLine box={EVENT_INDEX.rowWindowLine} ink={EVENT_INK.window} width="42%" />
              {/* The real row's curve bleeds past the gutter to the band's
                  edges, which on a phone is the screen's edge. */}
              <Skeleton
                width="100%"
                height={EVENT_INDEX.rowCurveH}
                borderRadius={0}
                style={styles.indexRowCurve}
              />
              <TextLine box={EVENT_INDEX.rowStatLine} ink={EVENT_INK.method} width="66%" />
            </View>
          ))}
        </View>
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
        <View style={styles.stage}>
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
            {[74, 74].map((w, i) => (
              <StatSkeleton
                key={i}
                valueBox={EVENT_STAGE.statValueLine}
                valueInk={EVENT_INK.statValue}
                valueWidth={w}
                radius={5}
              />
            ))}
          </View>
        </View>
        <View style={styles.seam} />
        <View style={styles.paper}>
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
        </View>
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  lineBox: { justifyContent: 'center' },
  seam: { height: 1, backgroundColor: SEAM_COLOR },

  // ── dossier ──
  // No paddingBottom: the real stage closes on the stat rail's curve clearance.
  stage: {
    backgroundColor: SURFACE.ink,
    paddingHorizontal: PAD,
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
  paper: {
    backgroundColor: SURFACE.paper,
    paddingHorizontal: PAD,
    paddingTop: EVENT_PAPER.paddingTop,
    paddingBottom: EVENT_PAPER.paddingBottom,
  },
  sectionNote: { marginBottom: EVENT_PAPER.sectionBodyGap },

  // ── index ──
  indexStage: {
    backgroundColor: SURFACE.ink,
    paddingHorizontal: PAD,
    paddingTop: EVENT_STAGE.paddingTop,
    paddingBottom: EVENT_INDEX.stagePaddingBottom,
  },
  indexEyebrow: { marginBottom: EVENT_INDEX.eyebrowGap },
  indexMethod: { marginTop: EVENT_INDEX.methodGap },
  indexPaper: {
    backgroundColor: SURFACE.paper,
    paddingHorizontal: PAD,
    paddingTop: EVENT_INDEX.paperPaddingTop,
    paddingBottom: EVENT_INDEX.paperPaddingBottom,
  },
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
