import { factsFor, hasEnoughFacts, FACTS_FLOOR } from '../../../src/components/character/factsGrid';
import type { CharacterData } from '../../../src/types';

const build = (): CharacterData =>
  ({
    stats: {
      biography: {
        alignment: 'good',
        'full-name': 'Bruce Banner',
        'alter-egos': '-',
        'place-of-birth': 'Dayton, Ohio',
        'first-appearance': 'Incredible Hulk #1',
        aliases: ['Green Goliath', '-'],
        publisher: 'Marvel',
      },
      appearance: {
        gender: 'Male',
        race: 'Human / Radiation',
        height: ["8'0", '244 cm'],
        weight: ['1400 lb', '630 kg'],
      },
      work: { occupation: 'Physicist', base: '-' },
      connections: { 'group-affiliation': 'Avengers' },
    },
    details: { origin: 'Radiation', teams: [] },
    firstIssue: null,
  }) as unknown as CharacterData;

describe('factsFor', () => {
  // '-' is the catalogue's own blank marker and it is everywhere: most of the
  // 34k rows carry it in most fields. A grid that renders it says "we know
  // nothing" in twelve tiles instead of showing the three things we do know.
  it('drops blanks rather than rendering an empty tile', () => {
    const keys = factsFor(build(), true).map((f) => f.key);
    expect(keys).not.toContain('base');
    expect(keys).not.toContain('alter-egos');
    expect(keys).toContain('occupation');
  });

  it('filters the blank marker out of a joined list too', () => {
    expect(factsFor(build(), true).find((f) => f.key === 'aliases')?.value).toBe('Green Goliath');
  });

  it('honours includeFirstAppearance', () => {
    expect(factsFor(build(), true).map((f) => f.key)).toContain('first-appearance');
    expect(factsFor(build(), false).map((f) => f.key)).not.toContain('first-appearance');
  });

  // Scalars tile two-up; prose runs full width. Backwards, a 60-character
  // occupation lands in a half tile and wraps to four lines.
  it('marks short scalars narrow and prose wide', () => {
    const by = Object.fromEntries(factsFor(build(), true).map((f) => [f.key, f.wide]));
    expect(by.alignment).toBe(false);
    expect(by.height).toBe(false);
    expect(by['full-name']).toBe(true);
    expect(by.affiliations).toBe(true);
  });

  // 'good' is the storage vocabulary, not the reader's. Every other surface
  // title-cases it; a raw lowercase value in a tile is the vocabulary leaking.
  it('title-cases the alignment', () => {
    expect(factsFor(build(), true).find((f) => f.key === 'alignment')?.value).toBe('Good');
  });

  it('joins the two-unit measurements', () => {
    expect(factsFor(build(), true).find((f) => f.key === 'height')?.value).toBe("8'0 / 244 cm");
  });
});

describe('hasEnoughFacts', () => {
  // A card headed "Quick Facts" holding one fact frames the gap instead of
  // filling it, so the grid declines to draw rather than advertising how little
  // is known.
  it('declines below the floor', () => {
    expect(hasEnoughFacts([])).toBe(false);
    expect(hasEnoughFacts(factsFor(build(), true).slice(0, FACTS_FLOOR - 1))).toBe(false);
    expect(hasEnoughFacts(factsFor(build(), true).slice(0, FACTS_FLOOR))).toBe(true);
  });
});
