// __tests__/lib/heroImages.test.ts
import {
  heroImageSource,
  heroGridImageSource,
  withCloudinaryTransform,
} from '../../src/constants/heroImages';

const CDN = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md';

describe('heroImageSource', () => {
  it('returns portraitUrl as uri when provided', () => {
    const result = heroImageSource('999', null, 'https://storage.example.com/999.jpg');
    expect(result).toEqual({ uri: 'https://storage.example.com/999.jpg' });
  });

  it('prefers portraitUrl over imageUrl', () => {
    const result = heroImageSource('620', 'https://cdn.example.com/620.jpg', 'https://storage.example.com/620.jpg');
    expect(result).toEqual({ uri: 'https://storage.example.com/620.jpg' });
  });

  it('falls back to imageUrl when no portrait', () => {
    const result = heroImageSource('999', 'https://cdn.example.com/999.jpg', null);
    expect(result).toEqual({ uri: 'https://cdn.example.com/999.jpg' });
  });

  it('falls back to the CDN for numeric ids when nothing else is available', () => {
    const result = heroImageSource('999', null, null);
    expect(result).toEqual({ uri: `${CDN}/999.jpg` });
  });

  it('returns an empty uri for non-numeric ids with no image', () => {
    const result = heroImageSource('cv-1234', null, null);
    expect(result).toEqual({ uri: '' });
  });

  it('treats blank/no-portrait placeholders as missing', () => {
    const blank = 'https://comicvine.gamespot.com/a/uploads/scale_medium/11122/111222211/6373148-blank.png';
    // numeric id → falls through the placeholder to the CDN
    expect(heroImageSource('999', blank, blank)).toEqual({ uri: `${CDN}/999.jpg` });
    // cv id → nothing real left, empty uri
    expect(heroImageSource('cv-1', blank, null)).toEqual({ uri: '' });
  });
});

describe('withCloudinaryTransform', () => {
  const CLOUDINARY =
    'https://res.cloudinary.com/dgrsb5o4p/image/upload/v1780861911/hero-portraits/269.jpg';

  it('injects f_auto,q_auto,w_<width> after /upload/ for Cloudinary URLs', () => {
    expect(withCloudinaryTransform(CLOUDINARY, 900)).toBe(
      'https://res.cloudinary.com/dgrsb5o4p/image/upload/f_auto,q_auto,w_900/v1780861911/hero-portraits/269.jpg',
    );
  });

  it('leaves a Supabase URL unchanged', () => {
    const supabase =
      'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/269.jpg';
    expect(withCloudinaryTransform(supabase, 900)).toBe(supabase);
  });

  it('leaves the akabab CDN URL unchanged', () => {
    const cdn = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md/620.jpg';
    expect(withCloudinaryTransform(cdn, 600)).toBe(cdn);
  });

  it('leaves an empty string unchanged', () => {
    expect(withCloudinaryTransform('', 900)).toBe('');
  });
});

describe('Cloudinary wiring', () => {
  const CLOUDINARY_BASE =
    'https://res.cloudinary.com/dgrsb5o4p/image/upload/v1780861911/hero-portraits/269.jpg';

  it('heroImageSource adds w_900 to a Cloudinary portrait', () => {
    expect(heroImageSource('269', null, CLOUDINARY_BASE)).toEqual({
      uri: 'https://res.cloudinary.com/dgrsb5o4p/image/upload/f_auto,q_auto,w_900/v1780861911/hero-portraits/269.jpg',
    });
  });

  it('heroGridImageSource adds w_600 to a Cloudinary portrait', () => {
    expect(heroGridImageSource('269', null, CLOUDINARY_BASE, null)).toEqual({
      uri: 'https://res.cloudinary.com/dgrsb5o4p/image/upload/f_auto,q_auto,w_600/v1780861911/hero-portraits/269.jpg',
    });
  });

  it('heroImageSource leaves a non-Cloudinary portrait untouched', () => {
    const supabase =
      'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/269.jpg';
    expect(heroImageSource('269', null, supabase)).toEqual({ uri: supabase });
  });
});
