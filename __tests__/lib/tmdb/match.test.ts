import { normalizeTitle, pickBestMatch, type TmdbSearchResult } from '../../../src/lib/tmdb/match';

const r = (id: number, title: string, date: string | null): TmdbSearchResult => ({
  id,
  title,
  release_date: date,
});

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation and articles', () => {
    expect(normalizeTitle('The Batman: Part II')).toBe('batman part ii');
    expect(normalizeTitle('Spider-Man  (2002)')).toBe('spiderman 2002');
  });
});

describe('pickBestMatch', () => {
  it('returns the exact-title candidate', () => {
    const best = pickBestMatch('Superman', [r(1, 'Superman Returns', '2006'), r(2, 'Superman', '1978')], null);
    expect(best?.id).toBe(2);
  });

  it('uses the year hint to break ties', () => {
    const best = pickBestMatch('Batman', [r(1, 'Batman', '1989'), r(2, 'Batman', '1966')], '1966');
    expect(best?.id).toBe(2);
  });

  it('returns null when nothing clears the similarity threshold', () => {
    expect(pickBestMatch('Aztec Batman Clash of Empires', [r(1, 'Unrelated Film', '2001')], null)).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    expect(pickBestMatch('Anything', [], null)).toBeNull();
  });
});
