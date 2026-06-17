import { dominantAlignment, shortPublisher, type TasteProfile } from '../../../src/lib/db/taste';

const base: TasteProfile = {
  basedOn: 0,
  publishers: [],
  franchises: [],
  tags: [],
  alignment: { good: 0, bad: 0, neutral: 0 },
};

describe('dominantAlignment', () => {
  it('returns the label of the highest-weighted alignment', () => {
    expect(dominantAlignment({ ...base, alignment: { good: 10, bad: 3, neutral: 1 } })).toBe(
      'Heroes',
    );
    expect(dominantAlignment({ ...base, alignment: { good: 2, bad: 9, neutral: 1 } })).toBe(
      'Villains',
    );
    expect(dominantAlignment({ ...base, alignment: { good: 1, bad: 2, neutral: 8 } })).toBe(
      'Anti-Heroes',
    );
  });

  it('returns null when there is no alignment signal', () => {
    expect(dominantAlignment(base)).toBeNull();
  });

  it('breaks ties toward Heroes, then Villains', () => {
    expect(dominantAlignment({ ...base, alignment: { good: 5, bad: 5, neutral: 0 } })).toBe(
      'Heroes',
    );
    expect(dominantAlignment({ ...base, alignment: { good: 0, bad: 5, neutral: 5 } })).toBe(
      'Villains',
    );
  });
});

describe('shortPublisher', () => {
  it('strips a trailing "Comics"', () => {
    expect(shortPublisher('DC Comics')).toBe('DC');
    expect(shortPublisher('Dark Horse Comics')).toBe('Dark Horse');
  });

  it('leaves other names untouched', () => {
    expect(shortPublisher('Marvel')).toBe('Marvel');
    expect(shortPublisher('Image')).toBe('Image');
  });
});
