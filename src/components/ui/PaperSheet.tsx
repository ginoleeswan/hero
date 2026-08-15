// src/components/ui/PaperSheet.tsx
// The beige content band, drawn as a sheet of paper laid on the ink.
//
// The app's surface grammar is ink = the claim, paper = the record, and for a
// long time the boundary between them was a flat, full-width colour change:
// navy stops, beige starts, and nothing says which surface is on top of which.
// It reads as two fields butted together, which is the "harsh and boring"
// division — and it is the same edge on a dozen screens, so it is worth owning
// in one place rather than re-deciding per screen.
//
// The device is the one PageEndCap already uses to close a page: a rounded
// sheet. Three parts, all load-bearing:
//
//   1. A WARM TOP EDGE. The seam hairline used to be a separate 1pt View above
//      the band. As this band's own border it curves with the corners instead
//      of running flat across a rounded thing.
//   2. AN OVERLAP. A rounded corner shows whatever is behind it. Butted against
//      the band above, the corner cut a hole through to the ROUTE's background,
//      which is a flat navy — while the stage it appears to lift off usually
//      ends on a gradient. Measured on the event page: (11,23,31) showing
//      through beside a band ending at (14,68,76), i.e. a black wedge either
//      side of the lip. Overlapping the band above by exactly the radius puts
//      the corners on that band's own ground, so whatever is up there simply
//      runs under the sheet — which is what a sheet lying on something looks
//      like.
//   3. A FOOT, only when ink follows. The rounded bottom plus a downward shadow
//      is what makes it read as LIFTED rather than merely rounded. Omit it when
//      the sheet is the last band before PageEndCap, which draws its own
//      closing foot — two feet stack into a beige lip on a beige lip.
//
// A wave was the other candidate and is wrong for this brand: a landing-page
// device against an editorial register, and one that would have to be drawn at
// every boundary on a page — novel once, tiresome by the third.
//
// NOTE for adopters: if the band directly above sets `borderBottomColor:
// SEAM_COLOR` (StageHeader, HouseBanner and FilmBackdropHeader all do), remove
// it. The seam moves to the sheet, and a straight hairline left behind above a
// rounded corner is worse than the flat edge it replaced.
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { SEAM_COLOR, SURFACE } from '../../constants/colors';

/** The radius, and therefore also the overlap. One number: the two are the same
 *  measurement seen from either side, and they drift apart the moment they are
 *  written twice. On the app's radius scale. */
export const PAPER_SHEET_RADIUS = 24;

/**
 * The sheet as a bare style, for the places a component will not fit — a
 * `contentContainerStyle`, an `Animated.View`, a band that already exists and
 * only needs the surface. Mirrors PAPER_CARD_SURFACE.
 */
export const PAPER_SHEET_SURFACE: ViewStyle = {
  backgroundColor: SURFACE.paper,
  borderTopWidth: 1,
  borderTopColor: SEAM_COLOR,
  borderTopLeftRadius: PAPER_SHEET_RADIUS,
  borderTopRightRadius: PAPER_SHEET_RADIUS,
  marginTop: -PAPER_SHEET_RADIUS,
};

/** The lifted foot. Add only when an INK band follows the sheet. */
export const PAPER_SHEET_FOOT: ViewStyle = {
  borderBottomLeftRadius: PAPER_SHEET_RADIUS,
  borderBottomRightRadius: PAPER_SHEET_RADIUS,
  // Pure black: the ground below is already near-black, and anything lighter
  // reads as a glow rather than a shadow. Tight and pushed downward — wide and
  // soft, it bleeds up past the top corners and darkens the band above, which
  // looks like dirt in the corners rather than like depth.
  shadowColor: '#000',
  shadowOpacity: 0.38,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};

export function PaperSheet({
  /** True when an INK band follows this one. False — the default — when the
   *  sheet is the page's last band and PageEndCap closes it. */
  foot = false,
  style,
  children,
}: {
  foot?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return <View style={[s.sheet, foot ? s.foot : null, style]}>{children}</View>;
}

const s = StyleSheet.create({
  sheet: PAPER_SHEET_SURFACE,
  foot: PAPER_SHEET_FOOT,
});
