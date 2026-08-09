import {
  hasRealArt,
  heroNodeTextureSource,
  withHeadDiscTransform,
} from '../../src/constants/heroImages';

const AVATAR = 'https://res.cloudinary.com/dgrsb5o4p/image/upload/v1784980146/hero-avatars/346.png';
const PORTRAIT =
  'https://res.cloudinary.com/dgrsb5o4p/image/upload/v1781820117/hero-portraits/cv-51969.jpg';

describe('heroNodeTextureSource', () => {
  it('prefers the cut-out avatar and keeps its alpha-safe WebP transform', () => {
    const src = heroNodeTextureSource(AVATAR, PORTRAIT, 256);
    expect(src?.tier).toBe('avatar');
    expect(src?.uri).toContain('/upload/f_webp,q_auto,w_256/');
    expect(src?.uri).not.toContain('r_max');
  });

  it('falls back to a padded, desaturated head disc when there is no avatar', () => {
    const src = heroNodeTextureSource(null, PORTRAIT, 256);
    expect(src?.tier).toBe('portrait');
    expect(src?.uri).toContain('ar_1:1,c_fill,g_north,r_max,w_200/');
    expect(src?.uri).toContain('c_lpad,w_256,h_256,b_transparent/');
    expect(src?.uri).toContain('e_saturation:-30');
    expect(src?.uri).not.toContain('g_face');
  });

  it('returns null with no art, so the caller draws its monogram', () => {
    expect(heroNodeTextureSource(null, null)).toBeNull();
    expect(heroNodeTextureSource(undefined, undefined)).toBeNull();
  });

  it('refuses a portrait it cannot crop rather than drawing a rectangle', () => {
    const offHost = 'https://comicvine.gamespot.com/a/uploads/scale_large/1/15776/9971293-hulk.jpg';
    expect(heroNodeTextureSource(null, offHost)).toBeNull();
  });

  it('treats a source placeholder as no art at all', () => {
    const blank = 'https://comicvine.gamespot.com/a/uploads/scale_large/11/113/blank.png';
    expect(heroNodeTextureSource(blank, null)).toBeNull();
    expect(heroNodeTextureSource(null, blank)).toBeNull();
  });

  it('scales the disc with the requested texture width', () => {
    expect(withHeadDiscTransform(PORTRAIT, 128)).toContain('r_max,w_100/');
    expect(withHeadDiscTransform(PORTRAIT, 128)).toContain('c_lpad,w_128,h_128');
  });

  // ComicVine serves several different stand-ins for "no art", and the guard
  // used to enumerate filenames — so `img_broken.png` sailed through and 89
  // heroes rendered a grey broken-image graphic in the feed. Matching the
  // /images/core/ directory covers the whole family, including variants that
  // have not appeared yet.
  it('rejects every ComicVine core placeholder, not just the ones already seen', () => {
    const core = 'https://comicvine.gamespot.com/a/bundles/phoenixsite/images/core/loose/';
    expect(hasRealArt(`${core}img_broken.png`)).toBe(false);
    // A sibling nobody has reported yet must fail on the same rule.
    expect(hasRealArt(`${core}some_future_placeholder.png`)).toBe(false);
    expect(
      hasRealArt('https://comicvine.gamespot.com/a/uploads/scale_large/11/113/blank.png'),
    ).toBe(false);
    expect(hasRealArt('https://cdn.example.com/heroes/no-portrait.png')).toBe(false);
  });

  it('still accepts real art', () => {
    expect(
      hasRealArt('https://comicvine.gamespot.com/a/uploads/scale_large/1/15776/9971293-hulk.jpg'),
    ).toBe(true);
  });
});
