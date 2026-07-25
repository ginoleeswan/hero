import { topStatEdges, matchupVerdict, type Powerstats } from '../../../src/lib/graph/statEdge';

const stats = (o: Partial<Powerstats>): Powerstats => ({
  intelligence: null,
  strength: null,
  speed: null,
  durability: null,
  power: null,
  combat: null,
  ...o,
});

describe('topStatEdges', () => {
  it('surfaces the most lopsided stats first', () => {
    const a = stats({ speed: 20, strength: 90, combat: 50 });
    const b = stats({ speed: 95, strength: 85, combat: 50 });
    const out = topStatEdges(a, b);
    expect(out.map((s) => s.label)).toEqual(['Speed', 'Strength', 'Combat']);
    expect(out[0].delta).toBe(75);
  });

  it('signs the delta toward the focused character', () => {
    const [edge] = topStatEdges(stats({ strength: 80 }), stats({ strength: 30 }));
    expect(edge.delta).toBe(-50);
    expect(edge.subject).toBe(80);
    expect(edge.node).toBe(30);
  });

  it('respects the limit', () => {
    const a = stats({ intelligence: 1, strength: 2, speed: 3, durability: 4, power: 5, combat: 6 });
    const b = stats({ intelligence: 90, strength: 80, speed: 70, durability: 60, power: 50, combat: 40 });
    expect(topStatEdges(a, b, 2)).toHaveLength(2);
  });

  // Missing stats are common on lesser-known characters. Treating null as zero
  // would invent a landslide out of absent data.
  it('drops a stat when either side is unknown', () => {
    const out = topStatEdges(stats({ speed: 50, strength: 40 }), stats({ speed: 90 }));
    expect(out.map((s) => s.label)).toEqual(['Speed']);
  });

  it('ignores stats that are zero on both sides', () => {
    expect(topStatEdges(stats({ speed: 0 }), stats({ speed: 0 }))).toEqual([]);
  });

  it('returns nothing when either character has no stats at all', () => {
    expect(topStatEdges(null, stats({ speed: 10 }))).toEqual([]);
    expect(topStatEdges(stats({ speed: 10 }), null)).toEqual([]);
  });
});

describe('matchupVerdict', () => {
  it('calls a dominant winner', () => {
    expect(matchupVerdict(200, 400, 'Hulk', 'Supergirl')).toBe('Hulk dominates on paper');
  });

  it('calls a narrow winner', () => {
    expect(matchupVerdict(400, 440, 'Hulk', 'Supergirl')).toBe('Hulk edges it on paper');
  });

  it('names the subject when the subject wins', () => {
    expect(matchupVerdict(500, 200, 'Hulk', 'Supergirl')).toBe('Supergirl dominates on paper');
  });

  it('calls a near-tie dead even', () => {
    expect(matchupVerdict(400, 405, 'Hulk', 'Supergirl')).toBe('Dead even on paper');
  });

  it('stays silent without totals', () => {
    expect(matchupVerdict(null, 400, 'a', 'b')).toBeNull();
    expect(matchupVerdict(400, 0, 'a', 'b')).toBeNull();
  });
});
