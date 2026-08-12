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

/**
 * The immersive dark stage, as a colour array for expo-linear-gradient (native).
 * Lifted ink at the top easing to the floor — the "lobby" depth the Arena, the
 * builder and the daily game all want.
 *
 * It exists because two screens hand-rolled `['#1c2f5a','#13203a','#0c1526']`,
 * which is a ~220° BLUE. Every other dark surface in the app — deepNavy, navy,
 * the daily game, the boot stage, the profile cover — sits at ~195-200°, a
 * teal ink. A 20-25° hue gap is obvious the moment two of those screens are
 * seen in sequence, and no token was stopping it because the values were raw
 * literals. Reach for this instead of writing a stage gradient by hand.
 */
export const STAGE_INK = ['#16323d', '#0d2029', COLORS.deepNavy] as const;

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
  /** Input placeholders on ink. Placeholder copy is text under WCAG 1.4.3, so
   *  it holds the same floor as `faint` (6.13:1) rather than fading to a hint. */
  placeholder: 'rgba(245,235,220,0.6)',
} as const;

/**
 * Text-on-PAPER ramp — the beige counterpart to INK_TEXT, and the reason the
 * contrast rule kept being broken: dark surfaces had a documented ramp, light
 * surfaces had none, so every muted label on beige invented its own alpha and
 * every one of them failed. Navy needs far more opacity on beige than beige
 * needs on ink: measured against COLORS.beige, navy at 0.4a is 2.11:1 and even
 * 0.65a is only 3.79:1 — nothing under ~0.73a clears the 4.5:1 floor.
 *
 * Ratios below are measured, not estimated.
 */
export const PAPER_TEXT = {
  /** Solid navy — 9.77:1. */
  primary: COLORS.navy,
  /** Supporting copy — 5.61:1. */
  muted: 'rgba(41,60,67,0.8)',
  /** The floor for readable text on paper — 4.89:1. */
  faint: 'rgba(41,60,67,0.75)',
  /**
   * Input placeholders. Placeholder copy is still text under WCAG 1.4.3, so it
   * gets the same floor — the old 0.3a placeholders measured 1.72:1, which is
   * effectively invisible rather than merely low-contrast.
   */
  placeholder: 'rgba(41,60,67,0.75)',
} as const;

/**
 * Orange for TEXT on light surfaces. The brand orange is a fill colour, not an
 * ink one: COLORS.orange measures 2.58:1 on beige and 3.04:1 on white, so it
 * fails AA as body text or a link everywhere it sits on paper. This deeper
 * burnt tone measures 4.97:1 on beige and 5.87:1 on white.
 *
 * Keep COLORS.orange for fills, accents and orange-on-dark (which passes at
 * ~5.9:1 against deepNavy). Reach for this only when orange is the text.
 * Distinct from the #C2551B used as a BUTTON FILL behind white text — that one
 * is measured for white-on-orange, which is the opposite direction.
 */
export const ORANGE_INK = '#A84718';

/**
 * Arena gold as *text* on the deep-ink stage. The gold accent (#ce9b33) is a
 * fill/stroke colour; at 0.7a it measured 4.09:1, just under the floor. Solid
 * gold on deepNavy is 7.17:1, so eyebrows and verdict labels use this.
 */
export const GOLD_INK = COLORS.goldAccent;

/**
 * The semantic accents as *text on paper* — ORANGE_INK generalised. Every
 * COLORS accent is tuned as a fill, and most of them are unreadable as ink:
 * green 2.45:1, blue 2.65:1, gold 3.08:1, goldAccent 2.13:1 against beige. The
 * tinted taxonomy chips (alignment/origin on the character page) paint accent
 * text over a 12-18% wash of the same hue, which lands barely off beige — so
 * the chip label was inheriting the fill colour's failing ratio.
 *
 * Each entry is the fill hue darkened until it clears the floor, so it still
 * reads as the same colour. `red`, `purple`, `black` and `brown` already pass
 * as ink and are re-exported unchanged rather than restated, which keeps this
 * map the single place to ask "what is <accent> when it's text?".
 */
export const ACCENT_INK = {
  /** 4.70:1 beige / 5.55:1 white — matches ORANGE_INK's role. */
  orange: ORANGE_INK,
  /** 4.67:1 beige. */
  green: '#437523',
  /** 4.62:1 beige. */
  blue: '#0C757C',
  /** 4.72:1 beige. */
  gold: '#8D5F00',
  /** 4.68:1 beige — the goldAccent hue, darkened for paper. */
  goldAccent: '#85631D',
  /** Already 5.20:1 as a fill. */
  red: COLORS.red,
  /** Already 4.83:1. */
  purple: COLORS.purple,
  /** Already 11.67:1. */
  black: COLORS.black,
  /** Already 11.18:1. */
  brown: COLORS.brown,
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

/**
 * The same eyebrow on the beige canvas. The colour is the ONLY difference —
 * COLORS.orange is 5.92:1 on ink but 2.58:1 on paper, so a shared spread was
 * silently failing every time a section header landed in a light zone (the
 * Explore Library rows, the character dossier, the film sections). Spread this
 * instead of EYEBROW whenever the eyebrow sits on paper.
 */
/**
 * The houses/family-tree module's warm parchment ink. That domain deliberately
 * runs a warmer canvas than the rest of the app (#fdf9f4 cards on beige), and
 * it had grown its own muted tone, #a99b84 — which measured 2.31:1 on beige and
 * 2.72:1 on white. This is the same hue darkened to 4.61:1 beige / 5.44:1 white,
 * so the module keeps its taupe character instead of being flattened into the
 * navy PAPER_TEXT ramp.
 */
export const HOUSE_INK = '#756852';

export const EYEBROW_ON_PAPER = { ...EYEBROW, color: ORANGE_INK } as const;

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

/**
 * The tab bar's selected tint in DARK appearance. The light-appearance half is
 * `ORANGE_INK`, and `app/(tabs)/_layout.tsx` pairs them with `DynamicColorIOS`
 * so the tint resolves from the same trait collection iOS uses to choose the
 * bar's material.
 *
 * That pairing is the whole point: a fixed orange cannot work, because the
 * bar's backdrop swings from cream in light appearance to near-black in dark
 * and no orange clears 4.5:1 on both — the best manages about 3.5 on its worse
 * side, since the two sit on opposite sides of the hue's luminance.
 *
 * A tint is not a fill. `COLORS.orange` is tuned to carry large areas of
 * colour, and it measures 2.20–3.04:1 on a light bar; a 24pt glyph and a 10pt
 * label need more separation than a card does. This is that orange lifted for
 * small marks on dark: 4.56–7.21:1 across the dark materials, and lifted
 * further than strictly needed because on a DARK bar lighter and legible pull
 * the same way — the light half has no such room, which is the whole reason
 * the two halves are different colours rather than one compromise.
 */
export const TAB_ACTIVE = '#FF9459';
