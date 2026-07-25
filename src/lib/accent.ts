import { COLORS } from '../constants/colors';
import { brandForPublisher } from '../constants/publishers';

/**
 * Per-character ambient palette for the Character Dossier page, derived from
 * the portrait's blurhash average color. See spec:
 * docs/superpowers/specs/2026-07-02-character-dossier-redesign-design.md §1.
 */
export interface CharacterTheme {
  /** Chroma-boosted, lightness-clamped hue for chips, icons, badges on paper. */
  accent: string;
  /** Darker variant for glows on the ink band. */
  accentDeep: string;
  /** ~7% alpha wash for paper-side band backgrounds. */
  accentWash: string;
}

const B83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

function decode83(str: string): number | null {
  let value = 0;
  for (const c of str) {
    const digit = B83.indexOf(c);
    if (digit === -1) return null;
    value = value * 83 + digit;
  }
  return value;
}

/**
 * Average color of a blurhash — decodes only the DC component (chars 2-5),
 * which the format stores as packed 24-bit sRGB. '' is the app's
 * attempted-no-hash sentinel and returns null like any invalid input.
 */
export function blurhashAverageColor(
  blurhash: string | null | undefined,
): { r: number; g: number; b: number } | null {
  if (!blurhash || blurhash.length < 6) return null;
  const dc = decode83(blurhash.slice(2, 6));
  if (dc === null) return null;
  return { r: dc >> 16, g: (dc >> 8) & 255, b: dc & 255 };
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const to255 = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  if (s === 0) return `#${to255(l)}${to255(l)}${to255(l)}`;
  return `#${to255(hue(h + 1 / 3))}${to255(hue(h))}${to255(hue(h - 1 / 3))}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A portrait this desaturated has no usable hue — fall through to the brand. */
const MIN_USABLE_SATURATION = 0.08;

/**
 * Derive the page theme. Fallback chain: blurhash DC color (if saturated
 * enough) → publisher brand color → COLORS.blue. Chroma is boosted and
 * lightness clamped so muddy portraits still yield a legible accent.
 */
export function deriveCharacterTheme(hero: {
  portrait_blurhash?: string | null;
  publisher?: string | null;
}): CharacterTheme {
  let base: { r: number; g: number; b: number } | null = null;
  const avg = blurhashAverageColor(hero.portrait_blurhash);
  if (avg && rgbToHsl(avg.r, avg.g, avg.b)[1] >= MIN_USABLE_SATURATION) base = avg;
  if (!base) {
    const brand = brandForPublisher(hero.publisher)?.color ?? COLORS.blue;
    base = hexToRgb(brand);
  }
  const [h, s, l] = rgbToHsl(base.r, base.g, base.b);
  const accentS = clamp(s * 1.35, 0.42, 0.85);
  const accent = hslToHex(h, accentS, clamp(l, 0.34, 0.56));
  const accentDeep = hslToHex(h, accentS, 0.3);
  const { r, g, b } = hexToRgb(accent);
  const accentWash = `rgba(${r},${g},${b},0.07)`;
  return { accent, accentDeep, accentWash };
}

/**
 * WCAG relative luminance of an sRGB colour (0 = black, 1 = white).
 * The gamma expansion matters: naive channel averaging rates mid greens far too
 * dark and mid blues far too light, which is exactly where accents land.
 */
function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colours, 1 (identical) to 21 (black/white). */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexToRgb(hexA));
  const b = relativeLuminance(hexToRgb(hexB));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pick the app ink that stays legible on a given background.
 *
 * Character accents are derived per hero, so a filled button's background is
 * whatever colour that portrait happened to yield — the engine clamps lightness
 * to [0.34, 0.56], and dark ink on the bottom of that range fails badly. Rather
 * than guessing from a luminance threshold, this measures both candidates and
 * takes the higher contrast, so the label is readable for every character
 * instead of most of them.
 */
export function readableInkOn(background: string): string {
  const dark = COLORS.black;
  const light = COLORS.beige;
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}

/** WCAG AA for normal-size text. */
const AA_CONTRAST = 4.5;

/**
 * A filled button in a character's colour that is guaranteed to be readable.
 *
 * Choosing the better of dark/light ink is NOT sufficient here, which a test
 * caught: a mid crimson like #8a2d2d manages only 3.47:1 against BOTH inks, so
 * whichever you pick, the label loses. The fill itself has to move.
 *
 * So this keeps the character's hue and saturation — the part that carries their
 * identity — and slides only lightness until the ink clears AA. Both directions
 * are tried and the smaller shift wins, so the colour stays as close to the
 * portrait's own as legibility allows.
 */
export function accentButtonColors(accent: string): { background: string; ink: string } {
  const { r, g, b } = hexToRgb(accent);
  const [h, s, l0] = rgbToHsl(r, g, b);

  const search = (ink: string, dir: 1 | -1): { background: string; shift: number } | null => {
    for (let step = 0; step <= 48; step++) {
      const l = clamp(l0 + dir * step * 0.02, 0.04, 0.96);
      const candidate = hslToHex(h, s, l);
      if (contrastRatio(candidate, ink) >= AA_CONTRAST) {
        return { background: candidate, shift: step };
      }
      if (l <= 0.04 || l >= 0.96) break;
    }
    return null;
  };

  const lighter = search(COLORS.black, 1);
  const darker = search(COLORS.beige, -1);

  if (lighter && (!darker || lighter.shift <= darker.shift)) {
    return { background: lighter.background, ink: COLORS.black };
  }
  if (darker) return { background: darker.background, ink: COLORS.beige };

  // Unreachable for real hues, but never return an unreadable pair.
  return { background: COLORS.beige, ink: COLORS.black };
}
