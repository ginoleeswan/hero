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
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** The feed's standard content gutter (rails and cards sit on 15). */
export const FEED_H_PAD = 15;

/** SpotlightCarousel — the full-bleed billboard. */
export const SPOTLIGHT = {
  /** insetTop + half the screen. The carousel's exported spotlightHeight()
   *  is the canonical accessor; this is the ratio behind it. */
  heightRatio: 0.5,
  /** SpotlightSlide.meta — the name block's distance from the slide's bottom. */
  metaBottom: 40,
  /** SpotlightCarousel.dots */
  dotsBottom: 22,
  // Segmented progress (ported from the web billboard): each slide is a bar,
  // the active one fills over the autoplay interval. Encodes position, count
  // AND time-to-advance — the dots this replaced only whispered position.
  segH: 3,
  segGap: 5,
  segMaxW: 210,
  /** The dark stage rides up into the billboard's fade (explore's podsOverlap). */
  overlap: 14,
} as const;

/** PublisherGrid — the 2×2 brand tiles on the dark stage. */
export const PUBLISHER_GRID = {
  hPad: 16,
  gap: 10,
  tileWidth: (SCREEN_WIDTH - 16 * 2 - 10) / 2,
  tileMinHeight: 84,
  radius: 16,
  paddingTop: 12,
  paddingBottom: 6,
} as const;

/** TodaysMatchup — the glass card carrying two 96pt portraits. */
export const MATCHUP_CARD = {
  hMargin: FEED_H_PAD,
  radius: 18,
  portrait: 96,
  paddingVertical: 20,
  /** Portraits + vertical padding + the vote row beneath them. */
  approxHeight: 206,
} as const;

/** DailyChallengeBanner — content-driven, so the skeleton approximates. */
export const DAILY_BANNER = {
  hMargin: FEED_H_PAD,
  radius: 20,
  marginTop: 16,
  marginBottom: 4,
  /** Not a fixed height on the real banner — a placeholder stand-in. */
  approxHeight: 104,
} as const;

/** HomeHeroRow — the portrait cards in every Library rail. */
const PORTRAIT_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.6);
// Matches the character screen's hero image aspect (full width x 66% of the
// screen), so the Apple Zoom morph fills the card edge to edge with no
// background peeking through mid-transition.
const DETAIL_HERO_RATIO = (SCREEN_HEIGHT * 0.66) / SCREEN_WIDTH;
export const HERO_ROW = {
  cardWidth: PORTRAIT_CARD_WIDTH,
  cardHeight: Math.round(PORTRAIT_CARD_WIDTH * DETAIL_HERO_RATIO),
  /** Ranked rows derive a shorter card from this same aspect. */
  cardAspect: DETAIL_HERO_RATIO,
  cardGap: 12,
  /** Feature rows render the first card slightly larger. */
  featureScale: 1.06,
} as const;

/** The rounded beige seam where the Library zone begins. */
export const PAPER_SEAM_RADIUS = 24;
