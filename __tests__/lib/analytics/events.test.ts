import { pathKind, scrubProps } from '../../../src/lib/analytics/events';

describe('pathKind', () => {
  // The SEGMENT, never the id: "someone opened a character" is a fact about the
  // product; which character is a fact about a person's reading.
  it('classifies by segment and keeps no id', () => {
    expect(pathKind('/character/h_batman')).toBe('character');
    expect(pathKind('/compare/a/b')).toBe('compare');
    expect(pathKind('/social-web/h_1')).toBe('social-web');
    expect(pathKind('/play')).toBe('play');
  });

  it('folds anything unrecognised into other', () => {
    expect(pathKind('/settings')).toBe('other');
    expect(pathKind('/')).toBe('other');
    expect(pathKind('')).toBe('other');
  });

  it('ignores query and hash', () => {
    expect(pathKind('/compare/a/b?debate=1')).toBe('compare');
    expect(pathKind('/play#top')).toBe('play');
  });
});

describe('scrubProps', () => {
  // The taxonomy is typed, so this should never fire — but a type is a
  // build-time promise and an analytics leak is permanent.
  it('drops anything shaped like an email', () => {
    expect(scrubProps({ who: 'a@b.com', n: 1 })).toEqual({ n: 1 });
  });

  it('drops long free text', () => {
    expect(scrubProps({ body: 'x'.repeat(65) })).toEqual({});
    expect(scrubProps({ body: 'x'.repeat(64) })).toEqual({ body: 'x'.repeat(64) });
  });

  it('keeps ids, enums, numbers and booleans', () => {
    expect(scrubProps({ side: 'a', streak: 6, won: true })).toEqual({
      side: 'a',
      streak: 6,
      won: true,
    });
  });

  it('drops undefined rather than sending a null column', () => {
    expect(scrubProps({ a: undefined, b: 2 })).toEqual({ b: 2 });
  });
});
