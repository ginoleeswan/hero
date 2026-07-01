import {
  pickDistinctCovers,
  type BrowseCoverCandidate,
} from '../../../src/lib/db/heroes/categories';

// pickDistinctCovers is pure, but importing categories.ts evaluates its
// top-level `import { supabase }`. Stub it so no real client is created.
jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

function cand(slug: string, pos: number, id: string): BrowseCoverCandidate {
  return {
    slug,
    pos,
    id,
    name: id,
    image_url: `${id}.jpg`,
    image_md_url: null,
    portrait_url: null,
  };
}

describe('pickDistinctCovers', () => {
  it('never assigns the same hero to two slugs when a distinct fallback exists', () => {
    // Both slugs top with the shared hero X; dc must fall through to a distinct pick.
    const bySlug = new Map<string, BrowseCoverCandidate[]>([
      ['marvel', [cand('marvel', 1, 'X'), cand('marvel', 2, 'Y')]],
      ['dc', [cand('dc', 1, 'X'), cand('dc', 2, 'Z')]],
    ]);
    // rng() === 0 always selects the first (highest-weight) available candidate.
    const out = pickDistinctCovers(bySlug, ['marvel', 'dc'], () => 0);
    expect(out.marvel.name).toBe('X');
    expect(out.dc.name).toBe('Z');
  });

  it('biases selection toward higher-ranked (lower pos) candidates', () => {
    const bySlug = new Map<string, BrowseCoverCandidate[]>([
      ['marvel', [cand('marvel', 1, 'A'), cand('marvel', 2, 'B'), cand('marvel', 3, 'C')]],
    ]);
    const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
    for (let i = 0; i < 3000; i++) {
      const out = pickDistinctCovers(bySlug, ['marvel'], Math.random);
      counts[out.marvel.name] += 1;
    }
    // Weights are 1, 0.5, 0.333 — pos-1 should clearly dominate pos-3.
    expect(counts.A).toBeGreaterThan(counts.B);
    expect(counts.B).toBeGreaterThan(counts.C);
  });

  it('falls back to the first candidate when every candidate is already used', () => {
    const bySlug = new Map<string, BrowseCoverCandidate[]>([
      ['marvel', [cand('marvel', 1, 'X')]],
      ['dc', [cand('dc', 1, 'X')]], // only X, already claimed by marvel
    ]);
    const out = pickDistinctCovers(bySlug, ['marvel', 'dc'], () => 0);
    expect(out.marvel.name).toBe('X');
    expect(out.dc.name).toBe('X'); // still gets art via fallback, not dropped
  });
});
