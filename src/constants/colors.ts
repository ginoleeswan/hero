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
 * Dark headers/stages: a vertical ink→navy gradient (`SURFACE_GRADIENT.stage`)
 * over a `navy` base — deepNavy under the status bar (fusing with the ink chrome)
 * easing into navy where the title/search sit. The gradient gives the band depth;
 * give the header generous top padding so the fade sits well clear of the title.
 */
export const SURFACE_GRADIENT = {
  /** Ink→navy stage for a dark-topped header. Pair with `backgroundColor: navy`. */
  stage: `linear-gradient(180deg, ${COLORS.deepNavy} 0%, ${COLORS.navy} 100%)`,
} as const;

/** The seam — a warm orange hairline where a dark band meets beige content. */
export const SEAM_COLOR = 'rgba(231,115,51,0.20)';
