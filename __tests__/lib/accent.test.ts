import { blurhashAverageColor, deriveCharacterTheme } from '../../src/lib/accent';

// Build test hashes programmatically: chars 0-1 (size flag / max AC) are
// irrelevant to the DC decode; chars 2-5 encode the DC as base83.
const B83 =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
const hashWithDc = (r: number, g: number, b: number) => {
  const dc = (r << 16) | (g << 8) | b;
  const enc = [3, 2, 1, 0].map((p) => B83[Math.floor(dc / 83 ** p) % 83]).join('');
  return `L5${enc}`;
};
const RED_HASH = hashWithDc(200, 30, 40);
// Grey (saturation ≈ 0) → must fall through to the publisher brand color.
const GREY_HASH = hashWithDc(120, 120, 120);

describe('blurhashAverageColor', () => {
  it('decodes the DC component to average sRGB', () => {
    expect(blurhashAverageColor(RED_HASH)).toEqual({ r: 200, g: 30, b: 40 });
  });
  it('returns null for empty-string sentinel, null, and short/garbage input', () => {
    expect(blurhashAverageColor('')).toBeNull();
    expect(blurhashAverageColor(null)).toBeNull();
    expect(blurhashAverageColor('L5M')).toBeNull();
    expect(blurhashAverageColor('L5"("(')).toBeNull(); // invalid base83 chars
  });
});

describe('deriveCharacterTheme', () => {
  it('derives a red-family accent from a red portrait hash', () => {
    const t = deriveCharacterTheme({ portrait_blurhash: RED_HASH, publisher: null });
    expect(t.accent).toMatch(/^#[0-9a-f]{6}$/);
    const r = parseInt(t.accent.slice(1, 3), 16);
    const g = parseInt(t.accent.slice(3, 5), 16);
    const b = parseInt(t.accent.slice(5, 7), 16);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    expect(t.accentWash.startsWith('rgba(')).toBe(true);
  });
  it('falls back to the publisher brand color for a grey (desaturated) hash', () => {
    const t = deriveCharacterTheme({ portrait_blurhash: GREY_HASH, publisher: 'DC Comics' });
    // DC brand is blue (#0476F2): blue channel dominates.
    const r = parseInt(t.accent.slice(1, 3), 16);
    const b = parseInt(t.accent.slice(5, 7), 16);
    expect(b).toBeGreaterThan(r);
  });
  it('falls back to COLORS.blue with no hash and no known publisher', () => {
    const t = deriveCharacterTheme({ portrait_blurhash: null, publisher: 'Nobody Comics Ltd' });
    expect(t.accent).toBeTruthy();
    expect(t.accentDeep).toBeTruthy();
    // Base is COLORS.blue; hue must stay in the cyan family (b > r).
    const r = parseInt(t.accent.slice(1, 3), 16);
    const b = parseInt(t.accent.slice(5, 7), 16);
    expect(b).toBeGreaterThan(r);
  });
});
