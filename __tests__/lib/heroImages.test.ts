// __tests__/lib/heroImages.test.ts
jest.mock('../../assets/images/spiderman.jpg', () => 1, { virtual: true });
jest.mock('../../assets/images/ironman.jpg', () => 2, { virtual: true });

import { heroImageSource } from '../../src/constants/heroImages';

describe('heroImageSource', () => {
  it('returns portraitUrl as uri when provided', () => {
    const result = heroImageSource('999', null, 'https://storage.example.com/999.jpg');
    expect(result).toEqual({ uri: 'https://storage.example.com/999.jpg' });
  });

  it('prefers portraitUrl over local HERO_IMAGES', () => {
    // id '620' has a local bundled image
    const result = heroImageSource('620', null, 'https://storage.example.com/620.jpg');
    expect(result).toEqual({ uri: 'https://storage.example.com/620.jpg' });
  });

  it('falls back to local HERO_IMAGES when portraitUrl is null', () => {
    const result = heroImageSource('620', null, null);
    expect(typeof result).toBe('number'); // bundled require() returns a number
  });

  it('falls back to imageUrl when no portrait and no local image', () => {
    const result = heroImageSource('999', 'https://cdn.example.com/999.jpg', null);
    expect(result).toEqual({ uri: 'https://cdn.example.com/999.jpg' });
  });

  it('falls back to CDN when nothing else is available', () => {
    const result = heroImageSource('999', null, null);
    expect(result).toEqual({ uri: 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md/999.jpg' });
  });
});
