import {
  contrastRatio,
  readableInkOn,
  accentButtonColors,
  deriveCharacterTheme,
} from '../../src/lib/accent';
import { COLORS } from '../../src/constants/colors';

describe('contrastRatio', () => {
  it('rates black against white at the theoretical maximum', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('rates a colour against itself as 1', () => {
    expect(contrastRatio('#B5302B', '#B5302B')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#15A1AB', '#2D2D2D')).toBeCloseTo(
      contrastRatio('#2D2D2D', '#15A1AB'),
      6,
    );
  });

  // Gamma expansion is the point: a naive channel average misjudges exactly the
  // mid greens and blues that accents land on.
  it('rates mid green as light and mid blue as dark', () => {
    expect(contrastRatio('#63A936', COLORS.black)).toBeGreaterThan(
      contrastRatio('#63A936', COLORS.beige),
    );
    expect(contrastRatio('#2b3fa8', COLORS.beige)).toBeGreaterThan(
      contrastRatio('#2b3fa8', COLORS.black),
    );
  });
});

describe('readableInkOn', () => {
  it('uses dark ink on a light background', () => {
    expect(readableInkOn('#f5d76e')).toBe(COLORS.black);
  });

  it('uses light ink on a dark background', () => {
    expect(readableInkOn('#1b2a4a')).toBe(COLORS.beige);
  });

  it('picks the higher-contrast ink of the two', () => {
    for (const bg of ['#f5d76e', '#1b2a4a', '#63A936', '#2b3fa8']) {
      const ink = readableInkOn(bg);
      const other = ink === COLORS.black ? COLORS.beige : COLORS.black;
      expect(contrastRatio(bg, ink)).toBeGreaterThanOrEqual(contrastRatio(bg, other));
    }
  });
});

describe('accentButtonColors', () => {
  // The cases that prove ink-swapping alone is not enough. Mid olive and mid
  // periwinkle are the worst points on the wheel: both clear only ~3.2-3.6:1
  // against EITHER ink, so whichever you pick the label loses and the fill has
  // to move. (Found by sweeping hue x lightness, not by guessing.)
  it.each(['#8a7a2f', '#5c7ad6'])('rescues %s, which fails against both inks', (bg) => {
    expect(contrastRatio(bg, COLORS.black)).toBeLessThan(4.5);
    expect(contrastRatio(bg, COLORS.beige)).toBeLessThan(4.5);
    const { background, ink } = accentButtonColors(bg);
    expect(contrastRatio(background, ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('guarantees AA for every accent the engine can produce', () => {
    const hashes = [
      'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
      'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
      'L~M@]|ofoLj[~qfQfQfQofj[fQfQ',
      'LgFFm;of00WB~qofM{WB9Fj[t7of',
      'L34e-@~q00_3~qM{9F%M00IU-;WB',
    ];
    const publishers = ['Marvel Comics', 'DC Comics', null, 'Dark Horse Comics'];
    for (const portrait_blurhash of hashes) {
      for (const publisher of publishers) {
        const { accent } = deriveCharacterTheme({ portrait_blurhash, publisher });
        const { background, ink } = accentButtonColors(accent);
        expect(contrastRatio(background, ink)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('holds AA across the full hue wheel at awkward lightness', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const l of [0.34, 0.45, 0.56]) {
        const accent = hslHex(h / 360, 0.6, l);
        const { background, ink } = accentButtonColors(accent);
        expect(contrastRatio(background, ink)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the character hue rather than falling back to a neutral', () => {
    const { background } = accentButtonColors('#8a2d2d');
    // still unmistakably red: red channel dominant over blue
    const r = parseInt(background.slice(1, 3), 16);
    const b = parseInt(background.slice(5, 7), 16);
    expect(r).toBeGreaterThan(b + 40);
  });

  it('shifts as little as it can get away with', () => {
    // A colour needing only a nudge should not be dragged to an extreme.
    const { background } = accentButtonColors('#8a7a2f');
    const l = (parseInt(background.slice(1, 3), 16) + parseInt(background.slice(5, 7), 16)) / 2;
    expect(l).toBeGreaterThan(0);
    expect(contrastRatio('#8a7a2f', background)).toBeLessThan(3);
  });

  it('leaves an already-readable colour close to where it was', () => {
    const start = '#f5d76e';
    const { background, ink } = accentButtonColors(start);
    expect(ink).toBe(COLORS.black);
    expect(background).toBe(start);
  });
});

/** Minimal HSL→hex so the sweep above does not depend on module internals. */
function hslHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
