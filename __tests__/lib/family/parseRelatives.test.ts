// __tests__/lib/family/parseRelatives.test.ts
import { parseRelatives } from '../../../src/lib/family/parseRelatives';

describe('parseRelatives', () => {
  it('returns [] for empty/sentinel input', () => {
    expect(parseRelatives(null)).toEqual([]);
    expect(parseRelatives('')).toEqual([]);
    expect(parseRelatives('-')).toEqual([]);
  });

  it('parses simple name (role) entries', () => {
    const out = parseRelatives('Matt McGinnis (brother)');
    expect(out).toEqual([{ name: 'Matt McGinnis', alias: null, role: 'brother', position: 0 }]);
  });

  it('treats the last comma-segment as role and the rest as alias', () => {
    const out = parseRelatives('Supergirl (Kara Zor-El, cousin)');
    expect(out[0]).toMatchObject({ name: 'Supergirl', alias: 'Kara Zor-El', role: 'cousin' });
  });

  it('keeps status inside the role segment', () => {
    const out = parseRelatives('Warren McGinnis (father, deceased)');
    expect(out[0]).toMatchObject({ name: 'Warren McGinnis', role: 'deceased', alias: 'father' });
  });

  it('does not split on commas inside parentheses', () => {
    const out = parseRelatives('Jor-El (father, deceased), Lara (mother, deceased)');
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.name)).toEqual(['Jor-El', 'Lara']);
  });

  it('splits on semicolons too', () => {
    const out = parseRelatives('Jarvis Pennyworth (father, deceased); Bruce Wayne (Batman, legal ward)');
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ name: 'Bruce Wayne', alias: 'Batman', role: 'legal ward' });
  });

  it('handles missing space before the paren', () => {
    const out = parseRelatives('Mary Parker(mother, deceased)');
    expect(out[0]).toMatchObject({ name: 'Mary Parker', role: 'deceased' });
  });

  it('handles a bare name with no parentheses', () => {
    const out = parseRelatives('King Snake (father), Unknown Person');
    expect(out[1]).toMatchObject({ name: 'Unknown Person', alias: null, role: '' });
  });

  it('does not crash on a large ancestor list', () => {
    const raw = Array.from({ length: 30 }, (_, i) => `Forebear${i} (ancestor)`).join(', ');
    expect(parseRelatives(raw)).toHaveLength(30);
  });

  it('assigns increasing positions', () => {
    const out = parseRelatives('A (son), B (daughter)');
    expect(out.map((m) => m.position)).toEqual([0, 1]);
  });
});
