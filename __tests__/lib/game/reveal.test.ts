import {
  parseFirstYear,
  decadeOf,
  alignmentLabel,
  isBlank,
  blurForGuess,
  buildClues,
  visibleClues,
  type RevealHero,
} from '../../../src/lib/game/reveal';
import { buildShareGrid } from '../../../src/lib/game/shareGrid';

const hero = (overrides: Partial<RevealHero> = {}): RevealHero => ({
  id: 'superman',
  name: 'Superman',
  imageUrl: null,
  portraitUrl: null,
  publisher: 'DC Comics',
  alignment: 'good',
  origin: 'alien',
  gender: 'Male',
  firstAppearance: 'Action Comics #1 (1938)',
  powers: ['Flight', 'Super Strength', 'Heat Vision'],
  ...overrides,
});

describe('parseFirstYear / decadeOf', () => {
  it('extracts a year and floors it to a decade', () => {
    expect(parseFirstYear('Action Comics #1 (1938)')).toBe(1938);
    expect(decadeOf('Action Comics #1 (1938)')).toBe('1930s');
    expect(decadeOf('1962')).toBe('1960s');
    expect(decadeOf('Detective Comics #27, May 2011')).toBe('2010s');
  });
  it('returns null when there is no year', () => {
    expect(parseFirstYear('issue #27')).toBeNull();
    expect(decadeOf('unknown')).toBeNull();
    expect(decadeOf(null)).toBeNull();
  });
});

describe('isBlank / alignmentLabel', () => {
  it('treats sentinels and empties as blank', () => {
    expect(isBlank('-')).toBe(true);
    expect(isBlank('  Unknown ')).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank('Marvel')).toBe(false);
  });
  it('maps alignment to a player-facing label', () => {
    expect(alignmentLabel('good')).toBe('Hero');
    expect(alignmentLabel('bad')).toBe('Villain');
    expect(alignmentLabel('neutral')).toBe('Anti-hero');
    expect(alignmentLabel('-')).toBeNull();
  });
});

describe('blurForGuess', () => {
  it('starts heavy, eases per guess, and clears when finished', () => {
    expect(blurForGuess(0, false)).toBeGreaterThan(blurForGuess(3, false));
    expect(blurForGuess(3, false)).toBeGreaterThan(0);
    expect(blurForGuess(2, true)).toBe(0); // finished overrides
  });
});

describe('buildClues / visibleClues', () => {
  it('builds an ordered ladder and drops blanks', () => {
    const clues = buildClues(hero({ origin: '-' }));
    expect(clues.map((c) => c.label)).toEqual([
      'Publisher',
      'First appeared',
      'Alignment',
      'Signature power',
    ]);
    expect(clues[1].value).toBe('1930s');
    expect(clues[2].value).toBe('Hero');
    expect(clues[3].value).toBe('Flight');
  });

  it('reveals one clue free, then one per wrong guess, all when finished', () => {
    const clues = buildClues(hero());
    expect(visibleClues(clues, 0, false)).toHaveLength(1); // one free at the start
    expect(visibleClues(clues, 2, false)).toHaveLength(3);
    expect(visibleClues(clues, 1, true)).toEqual(clues); // finished reveals everything
  });
});

describe('buildShareGrid', () => {
  it('renders a single result row with header + score', () => {
    expect(buildShareGrid({ number: 7, attempts: 3, solved: true, maxGuesses: 6 })).toBe(
      'Guess the Hero #7  3/6\n🟥🟥🟩',
    );
  });
  it('shows X/N and all misses when lost', () => {
    expect(buildShareGrid({ number: 7, attempts: 6, solved: false, maxGuesses: 6 })).toBe(
      'Guess the Hero #7  X/6\n🟥🟥🟥🟥🟥🟥',
    );
  });
  it('a first-guess win is a lone green square', () => {
    expect(buildShareGrid({ number: 1, attempts: 1, solved: true, maxGuesses: 6 })).toBe(
      'Guess the Hero #1  1/6\n🟩',
    );
  });
});
