// One place that decides how the Explore billboard behaves at every width.
//
// The old version fixed the stage at 516px tall and shrank only the card
// WIDTHS, so the portrait's aspect ratio collapsed as the window narrowed —
// 0.54 at 1440, 0.35 at 900, 0.31 at 820, where the active "portrait" is a
// ribbon and the character's face is cropped out of it. Portrait art is the
// best asset in the product; it should never be the thing that gives way.
//
// So: the card's aspect ratio is the invariant and the stage height follows the
// card width. And an accordion needs a real deck behind it to mean anything —
// below that the answer isn't a smaller accordion, it's a different component.
//
//   gallery  ≥1280   active card + a tapering deck, name as scenery
//   duo      1000+   active card + two slivers
//   caption  720+    one correctly-proportioned portrait beside the panel
//   stacked  <720    one column: full-width portrait, everything under it
import { pageGutter } from '../../../constants/colors';

export type SpotlightState = 'gallery' | 'duo' | 'caption' | 'stacked';

/** How much of the panel's content survives at this width. */
export type SpotlightDetail = 'full' | 'trim' | 'lean' | 'minimal';

export interface SpotlightLayout {
  state: SpotlightState;
  /** Stage (and active card) height. */
  stageHeight: number;
  /** Active card width. In `stacked` this is the full column width. */
  cardWidth: number;
  /** Sliver widths after the active card, widest first. Empty unless gallery/duo. */
  tail: number[];
  detail: SpotlightDetail;
  /** Type-as-scenery needs negative space to be scenery. */
  showGhostName: boolean;
  /** Ceiling on the panel so a wide window doesn't stretch a short read across
   *  600px of glass. Undefined where the panel should simply take the rest. */
  panelMaxWidth?: number;
  gutter: number;
}

/** Card w/h. 0.55 is what the gallery has always been — a tall portrait crop
 *  that still frames a figure. Below ~0.45 it reads as a sliced ribbon. */
const ASPECT = 0.55;
const GAP = 16; // strip ↔ panel
const CARD_GAP = 12; // between cards
/** The panel's text measure floor (its own padding is 30 a side). */
const PANEL_MIN = 330;
/** A billboard past this is a wall, not a hero. */
const STAGE_MAX = 540;
const STAGE_MIN = 300;

/** Sliver widths as a fraction of the active card. At a 280 card these are the
 *  140/100/76/54/39/28/20 the gallery already used — the deck's taper, kept. */
const TAIL_RATIOS = [0.5, 0.357, 0.271, 0.193, 0.139, 0.1, 0.071];
/** The first two slivers have to read as cards. A lone 40px smear does not. */
const SLIVER_FLOOR = 64;

function clamp(min: number, v: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Fit the taper into the space left beside the active card, widest first. */
function buildTail(cardWidth: number, space: number): number[] {
  const tail: number[] = [];
  let left = space;
  for (const ratio of TAIL_RATIOS) {
    const w = Math.round(cardWidth * ratio);
    if (w < 20 || left < w + CARD_GAP) break;
    tail.push(w);
    left -= w + CARD_GAP;
  }
  // A deck or nothing: two readable slivers are the price of entry, and the
  // rest may taper to an edge. One 40px sliver is noise.
  if (tail.length < 2 || tail[1] < SLIVER_FLOOR) return [];
  return tail;
}

export function spotlightLayout(width: number): SpotlightLayout {
  const gutter = pageGutter(width);
  // pageGutter already centres the content band at CONTENT_MAX_WIDTH on wide
  // displays, so the gutter IS the centring — subtract it, don't cap twice.
  const available = width - gutter * 2;

  // ── Stacked: one column, portrait leads ──────────────────────────────────
  if (width < 720) {
    // Full-bleed on a phone; on a wide-but-short window the poster stops
    // growing and centres instead, because a 655px-wide crop of portrait art is
    // a letterbox with the head cut off. Capped at 480 so the aspect stays in
    // poster territory rather than turning into a banner.
    const raw = Math.min(available, 480);
    const stageHeight = Math.round(clamp(320, raw / 0.85, 460));
    return {
      state: 'stacked',
      cardWidth: Math.min(raw, Math.round(stageHeight * 0.85)),
      stageHeight,
      tail: [],
      detail: 'minimal',
      showGhostName: false,
      gutter,
    };
  }

  // ── Caption: one portrait, correctly proportioned, beside the panel ──────
  // The portrait takes 40% and the panel is capped, so the pair centres with
  // air either side rather than stretching a five-line read across 600px of
  // glass. At 32% and an uncapped panel the art was the junior partner in its
  // own billboard.
  if (width < 1000) {
    const raw = clamp(240, available * 0.4, 340);
    const stageHeight = Math.round(clamp(STAGE_MIN, raw / ASPECT, 500));
    return {
      state: 'caption',
      cardWidth: Math.round(Math.min(raw, stageHeight * ASPECT)),
      stageHeight,
      tail: [],
      detail: 'lean',
      showGhostName: false,
      panelMaxWidth: 520,
      gutter,
    };
  }

  // ── Duo / gallery: the deck ──────────────────────────────────────────────
  const gallery = width >= 1280;
  const panelTarget = gallery ? 460 : 400;
  const strip = Math.max(240, available - Math.max(PANEL_MIN, panelTarget) - GAP);
  const raw = clamp(240, strip * (gallery ? 0.42 : 0.5), gallery && width >= 1600 ? 320 : 280);
  const stageHeight = Math.round(clamp(STAGE_MIN, raw / ASPECT, STAGE_MAX));
  // If the height clamped, the card comes back down with it so the crop holds.
  const cardWidth = Math.round(Math.min(raw, stageHeight * ASPECT));
  const tail = buildTail(cardWidth, strip - cardWidth - CARD_GAP);

  return {
    state: tail.length ? (gallery ? 'gallery' : 'duo') : 'caption',
    cardWidth,
    stageHeight,
    tail,
    detail: tail.length === 0 ? 'lean' : gallery ? 'full' : 'trim',
    showGhostName: tail.length > 0,
    panelMaxWidth: tail.length === 0 ? 520 : undefined,
    gutter,
  };
}
