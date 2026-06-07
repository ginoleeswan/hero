// __tests__/lib/heroImages.test.ts
import { heroImageSource } from '../../src/constants/heroImages';

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
