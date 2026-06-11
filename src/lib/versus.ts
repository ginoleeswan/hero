/**
 * Pick two distinct items from a pool uniformly at random. Returns null when the
 * pool has fewer than 2 items. `rng` is injectable for deterministic tests.
 *
 * The second index is drawn over `length - 1` slots and shifted past the first
 * when it would collide — this keeps the pair distinct without the bias a
 * resample-on-collision loop introduces.
 */
export function pickRandomPair<T extends { id: string }>(
  pool: T[],
  rng: () => number = Math.random,
): [T, T] | null {
  if (pool.length < 2) return null;
  const i = Math.floor(rng() * pool.length);
  let j = Math.floor(rng() * (pool.length - 1));
  if (j >= i) j += 1;
  return [pool[i], pool[j]];
}
