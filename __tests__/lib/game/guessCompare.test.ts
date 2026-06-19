import { compareGuess, parseFirstYear, type GuessHero } from '../../../src/lib/game/guessCompare';
import { buildShareGrid } from '../../../src/lib/game/shareGrid';

const target: GuessHero = {
  id: 'superman',
  name: 'Superman',
  imageUrl: null,
  portraitUrl: null,
  publisher: 'DC Comics',
  alignment: 'good',
  origin: 'alien',
  gender: 'Male',
  firstYear: 1938,
  powerTotal: 500,
  powers: ['Flight', 'Super Strength', 'Heat Vision'],
};

function hero(overrides: Partial<GuessHero>): GuessHero {
  return {
    id: 'x',
    name: 'X',
    imageUrl: null,
    portraitUrl: null,
    publisher: null,
    alignment: null,
    origin: null,
    gender: null,
    firstYear: null,
    powerTotal: null,
    powers: [],
    ...overrides,
  };
}

describe('parseFirstYear', () => {
  it('extracts a 4-digit year from assorted formats', () => {
    expect(parseFirstYear('Action Comics #1 (1938)')).toBe(1938);
    expect(parseFirstYear('1962')).toBe(1962);
    expect(parseFirstYear('Detective Comics #27, May 2011')).toBe(2011);
  });
  it('returns null when there is no year', () => {
    expect(parseFirstYear('unknown')).toBeNull();
    expect(parseFirstYear(null)).toBeNull();
    expect(parseFirstYear('issue #27')).toBeNull();
  });
});

describe('compareGuess', () => {
  it('flags an exact self-guess as correct with all hits', () => {
    const c = compareGuess(target, target);
    expect(c.correct).toBe(true);
    expect(c.publisher.match).toBe('hit');
    expect(c.alignment.match).toBe('hit');
    expect(c.origin.match).toBe('hit');
    expect(c.gender.match).toBe('hit');
    expect(c.firstYear.match).toBe('hit');
    expect(c.firstYear.direction).toBe('equal');
    expect(c.powerTotal.match).toBe('hit');
    expect(c.powers.match).toBe('hit');
  });

  it('marks category hits/misses correctly', () => {
    const g = compareGuess(
      hero({
        id: 'bats',
        publisher: 'DC Comics',
        alignment: 'good',
        origin: 'human',
        gender: 'Male',
      }),
      target,
    );
    expect(g.correct).toBe(false);
    expect(g.publisher.match).toBe('hit'); // DC === DC
    expect(g.alignment.match).toBe('hit'); // good === good
    expect(g.origin.match).toBe('miss'); // human !== alien
    expect(g.gender.match).toBe('hit'); // Male === Male
  });

  it('is case-insensitive and treats sentinels as blank misses', () => {
    const g = compareGuess(hero({ publisher: 'dc comics', alignment: '-' }), target);
    expect(g.publisher.match).toBe('hit');
    expect(g.alignment.match).toBe('miss');
  });

  it('gives numeric direction + close/hit bands for first appearance', () => {
    expect(compareGuess(hero({ firstYear: 1930 }), target).firstYear).toMatchObject({
      match: 'close', // within a decade
      direction: 'up', // target (1938) is later
    });
    expect(compareGuess(hero({ firstYear: 1990 }), target).firstYear).toMatchObject({
      match: 'miss',
      direction: 'down', // target is earlier
    });
  });

  it('bands the power total and points the right way', () => {
    expect(compareGuess(hero({ powerTotal: 505 }), target).powerTotal.match).toBe('hit'); // within 10
    expect(compareGuess(hero({ powerTotal: 460 }), target).powerTotal).toMatchObject({
      match: 'close', // within 50
      direction: 'up', // need to go higher to reach 500
    });
    expect(compareGuess(hero({ powerTotal: 100 }), target).powerTotal.match).toBe('miss');
  });

  it('counts shared powers (close on partial, hit only on a full match)', () => {
    expect(compareGuess(hero({ powers: ['Flight'] }), target).powers).toMatchObject({
      shared: 1,
      match: 'close',
    });
    expect(compareGuess(hero({ powers: ['Magic'] }), target).powers.match).toBe('miss');
    expect(
      compareGuess(hero({ powers: ['flight', 'super strength', 'heat vision'] }), target).powers
        .match,
    ).toBe('hit');
  });
});

describe('buildShareGrid', () => {
  it('renders a spoiler-free emoji grid with header + score', () => {
    const guesses = [
      compareGuess(hero({ id: 'bats', publisher: 'DC Comics', alignment: 'good' }), target),
      compareGuess(target, target),
    ];
    const grid = buildShareGrid({ number: 7, guesses, solved: true, maxGuesses: 6 });
    expect(grid).toContain('Guess the Hero #7  2/6');
    expect(grid).toContain('🟩'); // some hits
    expect(grid).toContain('⬛'); // some misses on the first guess
    // last row is the correct answer → all green
    expect(grid.trim().split('\n').pop()).toBe('🟩🟩🟩🟩🟩🟩🟩');
  });

  it('shows X/N when unsolved', () => {
    const grid = buildShareGrid({ number: 7, guesses: [], solved: false, maxGuesses: 6 });
    expect(grid).toContain('#7  X/6');
  });
});
