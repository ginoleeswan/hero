// src/components/home/homeGeometry.ts — the measurements the Explore feed and
// its skeleton MUST agree on.
//
// HomeSkeleton used to hand-copy these with "keep in sync" comments, and they
// drifted: the skeleton's daily-banner height was lifted from a tile *inside*
// the banner rather than the banner itself, and the row order and zone colours
// had gone stale too — which is why the skeleton→feed handoff visibly jumped.
// A comment cannot enforce agreement; a shared import can. Both sides now read
// from here, so a change to the real layout moves the placeholder with it.
//
// SCOPE: only what the skeleton has to mirror. This is not a general style
// dumping ground — per-component styling that the placeholder doesn't imitate
// stays in its own component.
// WIDTH IS A PARAMETER HERE, NOT A CONSTANT. These used to be computed once
// from Dimensions.get('window') at import. That is free on a phone and wrong on
// an iPad, where the window changes on rotation and on every Split View drag —
// a value captured at launch stays wrong for the rest of the session. Each
// width-dependent group is now a function, so the feed and its skeleton can
// both call it with the same live number and still agree, which is the whole
// reason this file exists.
import { heroImageAspect, isTabletWidth, pagePadding, railCardWidth } from '../../constants/layout';

/** The feed's standard content gutter — 15 on a phone, wider on a tablet. */
export const FEED_H_PAD = 15;
export const feedHPad = (width: number): number => pagePadding(width);

/** SpotlightCarousel — the full-bleed billboard. */
export const SPOTLIGHT = {
  /** insetTop + half the screen. The carousel's exported spotlightHeight()
   *  is the canonical accessor; this is the ratio behind it. */
  heightRatio: 0.5,
  /** SpotlightSlide.meta — the name block's distance from the slide's bottom. */
  metaBottom: 40,
  /** SpotlightCarousel.dots */
  dotsBottom: 22,
  // Dots for the slides you are not on, a pill for the one you are — and the
  // pill is a track that FILLS over the autoplay interval. Position and count
  // from the dots (which kept the billboard's light footing), time-to-advance
  // from the fill. A row of full-width bars said the same thing far louder.
  dotSize: 5,
  // Wider than the old 14 so the fill has room to read as a clock rather than
  // as a flicker; still a pill, not a bar.
  dotActiveWidth: 20,
  dotGap: 6,
  /** The dark stage rides up into the billboard's fade (explore's podsOverlap). */
  overlap: 14,
} as const;

/**
 * PublisherGrid — the brand tiles on the dark stage.
 *
 * Two columns on a phone, four on a tablet. Two 500pt-wide brand tiles on an
 * iPad would be billboards for a logo; the tile is a button, and a button does
 * not get better by being enormous.
 */
export function publisherGrid(width: number) {
  // Tablet: the same gutter as the deck and every other feed edge (see
  // matchupCard/dailyBanner below) — a device pass on an iPad Pro 13" found
  // three different left margins stepping down the page. Phone keeps its
  // tuned 16, deliberately NOT feedHPad(width) (15) — that one point of drift
  // never showed on a phone, so there is nothing to fix there.
  const hPad = isTabletWidth(width) ? feedHPad(width) : 16;
  const gap = 10;
  const columns = isTabletWidth(width) ? 4 : 2;
  return {
    hPad,
    gap,
    columns,
    tileWidth: (width - hPad * 2 - gap * (columns - 1)) / columns,
    tileMinHeight: 84,
    radius: 16,
    paddingTop: 12,
    paddingBottom: 6,
  };
}

/** TodaysMatchup — the glass card carrying two 96pt portraits. */
export const MATCHUP_CARD = {
  hMargin: FEED_H_PAD,
  radius: 18,
  portrait: 96,
  paddingVertical: 20,
  /** Portraits + vertical padding + the vote row beneath them. */
  approxHeight: 206,
} as const;

/**
 * Width-aware version of MATCHUP_CARD. Phone keeps the tuned FEED_H_PAD (15)
 * unchanged; tablet widths switch to feedHPad(width) so the card's edge lines
 * up with the deck, publisherGrid and dailyBanner instead of sitting a step
 * in from them.
 */
export function matchupCard(width: number): Omit<typeof MATCHUP_CARD, 'hMargin'> & {
  hMargin: number;
} {
  return { ...MATCHUP_CARD, hMargin: isTabletWidth(width) ? feedHPad(width) : FEED_H_PAD };
}

/** DailyChallengeBanner — content-driven, so the skeleton approximates. */
export const DAILY_BANNER = {
  hMargin: FEED_H_PAD,
  radius: 20,
  marginTop: 16,
  marginBottom: 4,
  /** Not a fixed height on the real banner — a placeholder stand-in. */
  approxHeight: 104,
} as const;

/** Width-aware version of DAILY_BANNER — see matchupCard() above. */
export function dailyBanner(width: number): Omit<typeof DAILY_BANNER, 'hMargin'> & {
  hMargin: number;
} {
  return { ...DAILY_BANNER, hMargin: isTabletWidth(width) ? feedHPad(width) : FEED_H_PAD };
}

/**
 * HomeHeroRow — the portrait cards in every Library rail.
 *
 * The card was 60% of the window, which is a well-judged 234pt on a phone and
 * an absurd 716pt on a landscape iPad — one and a half cards on screen, so the
 * rail stops reading as a rail. Above the tablet threshold it becomes a fixed
 * 260pt instead: the same card, more of them.
 */
export function heroRow(width: number, height: number) {
  const cardWidth = railCardWidth(width, 0.6, 260);
  // Shared with the character screen's hero image — see heroImageAspect. The
  // Apple Zoom morph only fills edge to edge while the two agree, so the ratio
  // is imported rather than restated.
  const cardAspect = heroImageAspect(width, height);
  return {
    cardWidth,
    cardHeight: Math.round(cardWidth * cardAspect),
    /** Ranked rows derive a shorter card from this same aspect. */
    cardAspect,
    cardGap: 12,
    /** Feature rows render the first card slightly larger. */
    featureScale: 1.06,
  };
}

/** The rounded beige seam where the Library zone begins. */
export const PAPER_SEAM_RADIUS = 24;
