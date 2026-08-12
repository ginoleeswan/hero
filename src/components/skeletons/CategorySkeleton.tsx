// src/components/skeletons/CategorySkeleton.tsx
// Loading placeholder for the category screen. Mirrors the real layout —
// a navy stage (masthead, count/tagline) with a beige sheet rising over it,
// then the hero grid — using the same geometry so content swaps in without a
// jump. Search + sort/filter live in the native header, so they're not here.
//
// Three things this has to get right, and each of them was wrong:
//
//  • The SHEET'S OWN BOX is pulled up by SEAM.overlap, so its paddingTop has to
//    be the full `capHeight` for the first grid row to land `capHeight -
//    overlap` below the stage. Padding it by the difference instead started the
//    grid a whole overlap (24pt) too high.
//  • Registered universes render a brand masthead, not a title — 56pt against a
//    title line's 40. The screen knows which, synchronously, from the slug, so
//    it passes the real height and the logo's real width.
//  • The count/tagline line wraps to two lines on every category (the count,
//    a middot, and an editorial sentence do not fit 320pt at 13pt), and to one
//    on universes and franchises, which have no tagline.
import { View, StyleSheet, Dimensions } from 'react-native';
import { Skeleton } from '../ui/Skeleton';
import { SkeletonProvider } from '../ui/SkeletonProvider';
import { COLORS } from '../../constants/colors';
import { SEAM } from '../../design';
import {
  CATEGORY_GRID,
  CATEGORY_CARD_W,
  CATEGORY_CARD_H,
  CATEGORY_STAGE,
  CATEGORY_INK,
} from '../../constants/categoryGeometry';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const { columns: NUM_COLUMNS, gap: GAP, hPad: H_PAD } = CATEGORY_GRID;
const CARD_WIDTH = CATEGORY_CARD_W;
const CARD_HEIGHT = CATEGORY_CARD_H;

// Navy-tinted placeholder fill so skeletons read on the dark stage.
const STAGE_TINT = 'rgba(245,235,220,0.10)';

// Enough rows to fill the viewport below the header; extra rows clip cleanly.
const GRID_ROWS = Math.ceil(SCREEN_HEIGHT / (CARD_HEIGHT + GAP));

function GridRowSkeleton() {
  return (
    <View style={styles.row}>
      {Array.from({ length: NUM_COLUMNS }).map((_, i) => (
        <Skeleton key={i} width={CARD_WIDTH} height={CARD_HEIGHT} borderRadius={10} />
      ))}
    </View>
  );
}

/** A bar of ink centred in the line box the real text will occupy. */
function TextLine({
  boxHeight,
  ink,
  width,
  radius,
}: {
  boxHeight: number;
  ink: number;
  width: number | `${number}%`;
  radius: number;
}) {
  return (
    <View style={[styles.lineBox, { height: boxHeight }]}>
      <Skeleton width={width} height={ink} borderRadius={radius} color={STAGE_TINT} />
    </View>
  );
}

export function CategorySkeleton({
  topPadding = 0,
  mastheadHeight = CATEGORY_STAGE.titleLine,
  mastheadWidth = '50%',
  taglineLines = 1,
}: {
  topPadding?: number;
  /** `CATEGORY_STAGE.logoHeight` on a registered universe, `titleLine` otherwise. */
  mastheadHeight?: number;
  /** The brand logo's real width where there is one; a fraction for a title. */
  mastheadWidth?: number | `${number}%`;
  taglineLines?: number;
}) {
  const isLogo = mastheadHeight !== CATEGORY_STAGE.titleLine;
  return (
    <SkeletonProvider>
      <View style={styles.root}>
        {/* Navy stage */}
        {/* No eyebrow bar. The screen stopped rendering one when the count
            moved onto the tagline's line, and a placeholder for a thing that no
            longer exists is 23pt the grid has to jump when content lands. */}
        <View style={[styles.stage, { paddingTop: topPadding }]}>
          {isLogo ? (
            // A masthead is art, not type — it fills its box, so no line-box
            // inset here.
            <Skeleton
              width={mastheadWidth}
              height={mastheadHeight}
              borderRadius={8}
              color={STAGE_TINT}
            />
          ) : (
            <TextLine
              boxHeight={mastheadHeight}
              ink={CATEGORY_INK.title}
              width={mastheadWidth}
              radius={6}
            />
          )}
          <View style={styles.tagline}>
            {Array.from({ length: taglineLines }).map((_, i) => (
              <TextLine
                key={i}
                boxHeight={CATEGORY_STAGE.taglineLine}
                ink={CATEGORY_INK.tagline}
                // Last line runs short, the way a wrapped sentence does.
                width={i === taglineLines - 1 ? '62%' : '92%'}
                radius={4}
              />
            ))}
          </View>
        </View>

        {/* Beige sheet → grid */}
        <View style={styles.sheet}>
          {Array.from({ length: GRID_ROWS }).map((_, i) => (
            <GridRowSkeleton key={i} />
          ))}
        </View>
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy, overflow: 'hidden' },
  stage: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: H_PAD,
    paddingBottom: CATEGORY_STAGE.paddingBottom,
  },
  lineBox: { justifyContent: 'center' },
  tagline: { marginTop: CATEGORY_STAGE.taglineGap, maxWidth: 320 },
  sheet: {
    flex: 1,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: SEAM.radius,
    borderTopRightRadius: SEAM.radius,
    borderCurve: 'continuous',
    marginTop: -SEAM.overlap,
    // The cap is a `capHeight` box pulled up by SEAM.overlap, so its content
    // starts (capHeight - overlap) below the stage. THIS box is pulled up by
    // the same overlap, so its padding has to be the full capHeight to land in
    // the same place — padding it by the difference put the grid 24pt high.
    paddingTop: CATEGORY_STAGE.capHeight,
    paddingHorizontal: H_PAD,
  },
  row: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
});
