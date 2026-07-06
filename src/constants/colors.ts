export const COLORS = {
  beige: '#f5ebdc',
  orange: '#E77333',
  navy: '#293C43',
  deepNavy: '#0b1820',
  grey: '#A2A19B',
  red: '#B5302B',
  yellow: '#F9B222',
  green: '#63A936',
  skin: '#F7D173',
  blue: '#15A1AB',
  black: '#2D2D2D',
  brown: '#502314',
  purple: '#7c3aed',
  gold: '#b07d00',
  goldAccent: '#CE9B33',
} as const;

/**
 * Semantic surface roles — every page background resolves to exactly one of
 * these. The two darks are a depth scale of one material ("ink"): `ink` is the
 * floor, `band` is the same ink lifted one step. `paper` is the light content
 * canvas. Pages declare their top + canvas through `useScreenChrome`, never by
 * reaching for a raw navy hex.
 */
/**
 * Share-card identity — the dark cinematic posters + OG cards that carry the
 * brand outside the app (iMessage, X, IG, Discord). ONE system for all three
 * renderers (native view-shot, web canvas, edge/satori OG) so a shared card
 * looks identical wherever it's drawn. This block is pure data with no RN
 * imports, so `api/` may import it directly (keeps the OG route RN-free while
 * still sharing the exact palette instead of re-hardcoding a drifting one).
 *
 * Roles are deliberate: the wordmark is always beige lowercase Righteous (quiet
 * authority, never colored); `accent` gold is the single brand-label colour
 * (eyebrows, winner crown); orange + teal stay reserved for *competitive*
 * meaning (the VS badge, the A/B vote split) so identity never fights gameplay.
 */
export const SHARE_CARD = {
  ink: COLORS.deepNavy,
  beige: COLORS.beige,
  /** The one prestige/label accent. */
  accent: COLORS.goldAccent,
  /** Competitive accents — semantic (data), never branding. */
  sideA: COLORS.orange,
  sideB: COLORS.blue,
  /** Vertical vignette stops (top→bottom): a lifted crown easing to the ink floor. */
  bg: [
    { at: 0, color: '#22333c' },
    { at: 0.55, color: '#13232c' },
    { at: 1, color: COLORS.deepNavy },
  ],
  /** Wordmark family — same face, different registration name per renderer. */
  wordmarkFamilyRN: 'Righteous_400Regular',
  wordmarkFamilyOG: 'Righteous',
} as const;

/** CSS `linear-gradient(...)` for the share-card vignette (canvas/satori/RNW). */
export const shareCardBgCss = (angle = '180deg'): string =>
  `linear-gradient(${angle}, ${SHARE_CARD.bg
    .map((s) => `${s.color} ${Math.round(s.at * 100)}%`)
    .join(', ')})`;

export const SURFACE = {
  /** Content bodies + the iOS Safari bottom-toolbar zone. */
  paper: COLORS.beige,
  /** Raised top bands / section blocks sitting over paper. */
  band: COLORS.navy,
  /** Immersive hero stages, full-dark screens, the document floor. */
  ink: COLORS.deepNavy,
} as const;

/**
 * Two dark-stage variants, both built from the `ink`/`band` darks so they never
 * drift in hue:
 *
 * - `stage` — vertical ink→navy gradient for a dark band that *lands on paper*
 *   (deepNavy under the status bar fusing with the ink chrome, easing into navy
 *   where the title sits). Pair with `backgroundColor: navy` and the `SEAM_COLOR`
 *   hairline at the dark→beige edge.
 * - `stageImmersive` — an off-top radial spotlight (lifted navy at the crown
 *   easing to deep ink at the edges) for *full-dark* screens that never reach
 *   paper (Explore, Versus). Same hue family as `stage`, more theatrical
 *   geometry. A deepNavy top-cap layer holds the bleed-under band (status bar +
 *   nav clearance) flat deep-ink — matching the body and the declared `top` —
 *   so the spotlight blooms *below* the floating nav and the top fuses with the
 *   chrome without relying on the (now removed) bar scrim to hide a seam.
 *
 * Give the header generous top padding so the fade sits well clear of the title.
 */
export const SURFACE_GRADIENT = {
  /** Ink→navy stage for a dark band that lands on paper. Pair with `backgroundColor: navy`. */
  stage: `linear-gradient(180deg, ${COLORS.deepNavy} 0%, ${COLORS.navy} 100%)`,
  /** Radial spotlight for full-dark immersive screens. Pair with `backgroundColor: deepNavy`.
   *  Top-cap (first layer) keeps the bleed-under band flat deep-ink; spotlight blooms below. */
  stageImmersive:
    `linear-gradient(to bottom, ${COLORS.deepNavy} 0, ${COLORS.deepNavy} calc(env(safe-area-inset-top) + 44px), transparent calc(env(safe-area-inset-top) + 96px)), ` +
    `radial-gradient(130% 100% at 50% -5%, ${COLORS.navy} 0%, ${COLORS.deepNavy} 70%)`,
} as const;

/** The seam — a warm orange hairline where a dark band meets beige content. */
export const SEAM_COLOR = 'rgba(231,115,51,0.20)';

/**
 * Soft, warm-dark drop shadow for cards resting on the beige paper canvas — a
 * deep-navy tint (never pure black) so components feel like they *rise from* the
 * warm surface rather than float on a cold grey one. Web (RNW box-shadow string).
 */
export const CARD_SHADOW = '0 6px 22px -12px rgba(11,24,32,0.32)';

/**
 * Elevation scale for the paper canvas — all deep-navy tinted (never pure
 * black) so lifted cards keep the warm "ink on paper" material story.
 * `rest` = sitting on the surface, `hover` = the standard hover lift,
 * `lifted` = hero/feature cards that float higher. Web box-shadow strings.
 */
export const ELEVATION = {
  rest: CARD_SHADOW,
  hover: '0 20px 48px -12px rgba(11,24,32,0.45)',
  lifted: '0 26px 64px -16px rgba(11,24,32,0.55)',
} as const;

/**
 * Text-on-ink opacity ramp. Supporting text on the dark stages must never drop
 * below `faint` — beige under 0.55α on deepNavy fails the 4.5:1 contrast floor.
 */
export const INK_TEXT = {
  primary: COLORS.beige,
  muted: 'rgba(245,235,220,0.72)',
  faint: 'rgba(245,235,220,0.6)',
} as const;

/**
 * The house eyebrow — the small orange uppercase kicker above titles. One size
 * everywhere: 11px is the legibility floor for tracked uppercase; the old 8–9px
 * variants read as timid. Spread into a StyleSheet entry and override `color`
 * only when the eyebrow sits muted (not accent) in context.
 */
export const EYEBROW = {
  fontFamily: 'Nunito_700Bold',
  fontSize: 11,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: COLORS.orange,
} as const;

/** Standard hover-lift recipe (web) — one duration, one spring-ish curve. */
export const HOVER_TRANSITION =
  'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Content width cap for the web home/library zones. Sections stay visually
 * full-bleed (backgrounds run edge to edge) but their content gutters widen so
 * text and grids never dissolve on ultra-wide displays.
 */
export const CONTENT_MAX_WIDTH = 1440;

/** Horizontal page gutter: 16 on phones, 32 on desktop, centered past 1440+64. */
export function pageGutter(width: number): number {
  if (width < 640) return 16;
  return Math.max(32, Math.round((width - CONTENT_MAX_WIDTH) / 2));
}
