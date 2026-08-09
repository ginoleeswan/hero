// src/design/type.ts — the type scale.
//
// WHY: an audit counted **52 distinct fontSize values** across native, with no
// scale to snap to. Radius and spacing had `tokens.ts`; type had nothing, which
// is why 13 / 12.5 / 13.5 / 12 / 11.5 / 11 all coexist doing the same job.
//
// Like `RADIUS`, this is DESCRIPTIVE — every step is a value the codebase
// already reaches for. It is not an invented system, and it is not a mass
// migration. Use it for new work and when you're already editing a rule.
//
// Three families, three jobs, and they do not swap:
//
//   Flame        display only — titles, hero names, pull quotes.
//   FlameSans    long-form body copy — summaries, blurbs, prose.
//   Nunito       UI — labels, buttons, stats, captions, eyebrows.
//
// **Every Flame step here satisfies lineHeight >= 1.22 x fontSize.** That is
// not cosmetic: Flame's ink spans ~119% of its em box, so a clamped
// (`numberOfLines`) Flame style with a tighter line-height loses its
// descenders — RNW turns `numberOfLines` into `-webkit-line-clamp` +
// `overflow: hidden` and cuts the g/y/p. Picking a step from this scale means
// you can clamp it safely; that rule used to live only in a CLAUDE.md comment,
// where it had to be remembered rather than inherited.

/** Display — Flame. Big, editorial, never for UI chrome. */
export const DISPLAY = {
  /** Full-bleed house / universe titles on a wide layout. */
  xl: { fontFamily: 'Flame-Regular', fontSize: 46, lineHeight: 58 },
  /** Spotlight hero names, screen-opening titles. */
  lg: { fontFamily: 'Flame-Regular', fontSize: 38, lineHeight: 50 },
  /** Stage headers, section-opening titles. */
  md: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 38 },
  /** Narrow-layout titles, pull-quote leads. */
  sm: { fontFamily: 'Flame-Regular', fontSize: 23, lineHeight: 32 },
  /** In-card headings. */
  xs: { fontFamily: 'Flame-Regular', fontSize: 18, lineHeight: 24 },
} as const;

/** Body — FlameSans. Prose that is meant to be read, not scanned. */
export const BODY = {
  /** Lead paragraphs and summaries. */
  lg: { fontFamily: 'FlameSans-Regular', fontSize: 15, lineHeight: 24 },
  /** The default body step. */
  md: { fontFamily: 'FlameSans-Regular', fontSize: 14.5, lineHeight: 23 },
  /** Secondary prose, captions under art. */
  sm: { fontFamily: 'FlameSans-Regular', fontSize: 13.5, lineHeight: 21 },
} as const;

/** UI — Nunito. Labels, values, chrome. Scanned, not read. */
export const LABEL = {
  /** Buttons and primary row labels. */
  lg: { fontFamily: 'Nunito_700Bold', fontSize: 15, lineHeight: 20 },
  /** The workhorse UI label. */
  md: { fontFamily: 'Nunito_700Bold', fontSize: 13, lineHeight: 18 },
  /** Dense chrome — chips, stat lines, meta rows. */
  sm: { fontFamily: 'Nunito_700Bold', fontSize: 12, lineHeight: 16 },
  /** The floor. Below this, use an icon instead of shrinking text further. */
  xs: { fontFamily: 'Nunito_700Bold', fontSize: 11, lineHeight: 14 },
  /** Regular weight, for values that sit beside a bold label. */
  regular: { fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 18 },
} as const;

/**
 * The uppercase kicker above a title. Colour is deliberately NOT set here —
 * it changes per canvas (gold on ink, orange on paper), so callers spread this
 * and add the colour from the semantic text roles.
 */
export const EYEBROW_TYPE = {
  fontFamily: 'Nunito_700Bold',
  fontSize: 10,
  lineHeight: 13,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
} as const;

/** Everything, for the rare consumer that wants to switch on a step name. */
export const TYPE = { display: DISPLAY, body: BODY, label: LABEL, eyebrow: EYEBROW_TYPE } as const;
