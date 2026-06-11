import { pickRandomPair } from '../../src/lib/versus';

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
