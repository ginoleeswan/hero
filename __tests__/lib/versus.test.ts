import { pickRandomPair, spreadRivalries } from '../../src/lib/versus';

const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

describe('pickRandomPair', () => {
  it('returns null for pools smaller than 2', () => {
    expect(pickRandomPair([])).toBeNull();
    expect(pickRandomPair([{ id: 'a' }])).toBeNull();
  });

  it('returns two distinct items', () => {
    for (let k = 0; k < 50; k++) {
      const pair = pickRandomPair(pool);
      expect(pair).not.toBeNull();
      expect(pair![0].id).not.toBe(pair![1].id);
    }
  });

  it('uses the injected rng for deterministic indices', () => {
    // rng sequence: first call picks i, second call picks j (over length-1).
    const rng = jest
      .fn<number, []>()
      .mockReturnValueOnce(0) // i = floor(0 * 4) = 0
      .mockReturnValueOnce(0); // j = floor(0 * 3) = 0; 0 >= 0 → j += 1 → 1
    const pair = pickRandomPair(pool, rng);
    expect(pair).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('skips past i when the second index would collide (boundary)', () => {
    const rng = jest
      .fn<number, []>()
      .mockReturnValueOnce(0.5) // i = floor(0.5 * 4) = 2
      .mockReturnValueOnce(0.7); // j = floor(0.7 * 3) = 2; 2 >= 2 → j += 1 → 3
    const pair = pickRandomPair(pool, rng);
    expect(pair).toEqual([{ id: 'c' }, { id: 'd' }]);
  });
});

describe('spreadRivalries', () => {
  const r = (a: string, b: string) => ({ a: { id: a }, b: { id: b } });

  it('keeps every rivalry — the count beside the rail must stay true', () => {
    const input = [r('cap', 'joker'), r('cap', 'superman'), r('cap', 'thanos')];
    const out = spreadRivalries(input);
    expect(out).toHaveLength(3);
    expect(new Set(out)).toEqual(new Set(input));
  });

  // The actual complaint: get_top_rivalries orders by summed fame, so the most
  // famous fighter leads several cards in a row and twelve curated rivalries
  // read as one hero versus a queue.
  it('never lets one fighter lead two cards in a row', () => {
    const out = spreadRivalries([
      r('cap', 'joker'),
      r('cap', 'superman'),
      r('cap', 'thanos'),
      r('bats', 'ras'),
      r('xavier', 'magneto'),
    ]);
    for (let i = 1; i < out.length; i++) {
      const prev = [out[i - 1].a.id, out[i - 1].b.id];
      const cur = [out[i].a.id, out[i].b.id];
      expect(cur.some((id) => prev.includes(id))).toBe(false);
    }
  });

  it('preserves rank order within a pass', () => {
    const out = spreadRivalries([r('a', 'b'), r('c', 'd'), r('a', 'e')]);
    expect(out.map((x) => `${x.a.id}${x.b.id}`)).toEqual(['ab', 'cd', 'ae']);
  });

  // Not every rail CAN be spread — a set of pure Batman rivalries has no
  // arrangement without repeats. Dropping cards to fake one would make the
  // count beside the rail a lie, so the constraint yields and everything ships.
  it('yields rather than drops when every pair shares a fighter', () => {
    const input = [r('a', 'b'), r('a', 'c'), r('a', 'd')];
    const out = spreadRivalries(input);
    expect(out).toHaveLength(3);
    expect(new Set(out)).toEqual(new Set(input));
  });

  it('handles an empty rail', () => {
    expect(spreadRivalries([])).toEqual([]);
  });
});
