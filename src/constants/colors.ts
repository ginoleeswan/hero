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
