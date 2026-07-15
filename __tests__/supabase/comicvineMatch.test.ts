import {
  pickComicvineMatch,
  normalizePublisher,
  type CvCandidate,
} from '../../supabase/functions/_shared/comicvineMatch';

const cand = (
  id: number,
  name: string,
  issues: number,
  publisher?: string,
): CvCandidate => ({
  id,
  name,
  count_of_issue_appearances: issues,
  publisher: publisher ? { name: publisher } : null,
});

describe('normalizePublisher', () => {
  it('collapses house aliases', () => {
    expect(normalizePublisher('Marvel')).toBe('marvel');
    expect(normalizePublisher('Marvel Comics')).toBe('marvel');
    expect(normalizePublisher('DC Comics')).toBe('dc');
    expect(normalizePublisher('DC')).toBe('dc');
    expect(normalizePublisher('Dark Horse Comics')).toBe('dark horse');
    expect(normalizePublisher('Image Comics')).toBe('image');
  });
  it('treats non-comic sentinels + empties as absent', () => {
    expect(normalizePublisher(null)).toBeNull();
    expect(normalizePublisher('')).toBeNull();
    expect(normalizePublisher('Company-Licensed')).toBeNull();
    expect(normalizePublisher('Creator-Owned')).toBeNull();
  });
  it('keeps other publishers (normalized) distinct', () => {
    expect(normalizePublisher('J. R. R. Tolkien')).toBe('j r r tolkien');
  });
});

describe('pickComicvineMatch', () => {
  it('the Aragorn case: publisher disagrees → needs_review, never a match', () => {
    // Hand-curated Aragorn (Tolkien) vs the Marvel winged horse (id 6810).
    const d = pickComicvineMatch([cand(6810, 'Aragorn', 500, 'Marvel')], {
      name: 'Aragorn',
      publisher: 'J. R. R. Tolkien',
    });
    expect(d.kind).toBe('needs_review');
  });

  it('picks the publisher-agreeing candidate even if a rival is more published', () => {
    const marvel = cand(1, 'Vision', 100, 'Marvel');
    const dc = cand(2, 'Vision', 9999, 'DC Comics');
    const d = pickComicvineMatch([dc, marvel], { name: 'Vision', publisher: 'Marvel Comics' });
    expect(d).toEqual({ kind: 'match', cvId: '1' });
  });

  it('accepts a Marvel↔Marvel Comics alias agreement', () => {
    const d = pickComicvineMatch([cand(5, 'Wolverine', 4000, 'Marvel Comics')], {
      name: 'Wolverine',
      publisher: 'Marvel',
    });
    expect(d).toEqual({ kind: 'match', cvId: '5' });
  });

  it('no exact name hit → unmatched', () => {
    const d = pickComicvineMatch([cand(1, 'Wolfsbane', 50, 'Marvel')], {
      name: 'Bane',
      publisher: 'DC Comics',
    });
    expect(d.kind).toBe('unmatched');
  });

  it('no-publisher hero + single candidate → match', () => {
    const d = pickComicvineMatch([cand(7, 'Spawn', 300, 'Image Comics')], {
      name: 'Spawn',
      publisher: null,
    });
    expect(d).toEqual({ kind: 'match', cvId: '7' });
  });

  it('no-publisher hero + candidates from different publishers → needs_review', () => {
    const d = pickComicvineMatch(
      [cand(1, 'Atlas', 10, 'Marvel'), cand(2, 'Atlas', 20, 'DC Comics')],
      { name: 'Atlas', publisher: null },
    );
    expect(d.kind).toBe('needs_review');
  });

  it('no-publisher hero + same-publisher candidates → most-published match', () => {
    const d = pickComicvineMatch(
      [cand(1, 'Sentry', 30, 'Marvel'), cand(2, 'Sentry', 80, 'Marvel Comics')],
      { name: 'Sentry', publisher: null },
    );
    expect(d).toEqual({ kind: 'match', cvId: '2' });
  });

  it('matches on the name-before-"(" fallback', () => {
    const d = pickComicvineMatch([cand(9, 'Spawn (Simmons)', 300, 'Image')], {
      name: 'Spawn',
      publisher: 'Image Comics',
    });
    expect(d).toEqual({ kind: 'match', cvId: '9' });
  });

  it('hero has a publisher but candidate has none → needs_review (no agreement)', () => {
    const d = pickComicvineMatch([cand(1, 'Rogue', 100)], {
      name: 'Rogue',
      publisher: 'Marvel Comics',
    });
    expect(d.kind).toBe('needs_review');
  });
});
