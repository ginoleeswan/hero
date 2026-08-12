// src/constants/tokens.ts — the native design scale.
//
// WHY THIS EXISTS: an audit counted 30 distinct border radii, 27 distinct
// letterSpacings and 8 different screen-level gutters across native. Nothing
// here is invented — each step is one of the values the codebase already
// reaches for most (radius 8/12/16/20 and the 999 pill cover the large
// majority of uses; 20 is the plurality screen gutter). The point is to give
// new code an obvious thing to pick so the spread stops widening.
//
// DELIBERATELY NOT a mass migration. Rewriting ~700 existing radius call sites
// to snap to this scale would be a large diff whose only verification is
// visual, and plenty of those values are deliberate (a 2px progress bar, a 26px
// squircle mask tuned to its art). Use these for new work and when you are
// already editing a rule; converge opportunistically, not in one sweep.

/** Corner radii. `pill` for fully-rounded chips/buttons. */
export const RADIUS = {
  /** Hairlines, bars, tiny indicators. */
  xs: 4,
  /** Badges, small inline chips. */
  sm: 8,
  /** The workhorse — cards in rails and grids. */
  md: 12,
  /** Larger cards and tiles. */
  lg: 16,
  /** Panels and hero cards. */
  xl: 20,
  /** Sheets and the beige seam lip. */
  xxl: 24,
  /** Fully rounded. */
  pill: 999,
} as const;

/** Spacing steps. Screen gutters use SCREEN_PAD, not these. */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/**
 * The screen-level horizontal gutter. 20 is already the plurality across
 * `app/`; the failure mode this prevents is TWO gutters on one scroll, which
 * is the classic unfinished tell (title/[id] shipped 20 and 24 together).
 */
export const SCREEN_PAD = 20;

/**
 * Letter-spacing scale. The wide end is for the uppercase eyebrows the home
 * rails established (9px/2 over a Flame title); `widest` is for the rarer
 * ceremonial kickers (arena stage).
 */
export const TRACKING = {
  tight: -0.3,
  normal: 0,
  wide: 0.4,
  wider: 1.2,
  widest: 2,
} as const;

/**
 * The beige sheet's seam — the rounded cap that rises over a dark stage on the
 * character, category, team and compare screens.
 *
 * `overlap` MUST be >= `radius`. The cap's corner cut-outs show whatever is
 * BEHIND them, and behind the cap is the list's content background, which on
 * these screens is beige. Overlap the dark stage by less than the radius and
 * the bottom of each corner curve sits over beige instead of over the stage —
 * so the cut-out is filled in, and the curve looks truncated where it meets the
 * straight edge rather than running cleanly to it. Five screens shipped with
 * overlaps of 14–18 against a 24 radius; `character/[id]` was the only one that
 * tied the two together, and it was the only seam that looked right.
 */
export const SEAM = { radius: 24, overlap: 24 } as const;
