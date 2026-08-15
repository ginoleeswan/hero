// Lives in constants/ — NOT in components/web/ — because both platforms read
// it. The native deck and the web spotlight derive their card widths, stage
// height and deck taper from this one function, which is the only thing that
// keeps them from drifting apart the way the character screen's native/web
// pair did. It is pure arithmetic: no React, no platform APIs.

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
import { pageGutter } from './colors';

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
  /** Type-as-scenery needs negative space to be scenery — so, gallery only. */
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

  // ── Stacked: the poster IS the masthead ──────────────────────────────────
  // Edge to edge and running up under the floating nav, so the art is the first
  // thing on the page rather than a card sitting on a dark band. cardWidth is
  // the viewport, not the gutter-inset column; `gutter` still spaces the copy
  // beneath it. Height is the visible part below the nav — the component adds
  // the bar's own height on top for the part that passes behind it.
  if (width < 720) {
    return {
      state: 'stacked',
      cardWidth: width,
      // Tall enough to lead the page, short enough that the row under it is
      // visible before you scroll.
      stageHeight: Math.round(clamp(360, width * 1.14, 500)),
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
    // `full` at duo as well as gallery. `trim` was dropping the first-appearance
    // line at 1000-1279 — but the panel's height is set by the card deck beside
    // it, not by its own content, so trimming the copy does not shrink the panel:
    // it leaves a hole. Measured on an iPad in portrait (1032pt): the stat pills
    // ended at pt 435 and the panel at pt 581, with 146pt of nothing between
    // them. The trim tier is for when space is short, and at duo it is not.
    detail: tail.length === 0 ? 'lean' : 'full',
    // Gallery only. The duo deck fills its stage, so scenery type there is just
    // the name printed twice — see the 2026-08-14 iPad spotlight spec.
    showGhostName: tail.length > 0 && gallery,
    panelMaxWidth: tail.length === 0 ? 520 : undefined,
    gutter,
  };
}
