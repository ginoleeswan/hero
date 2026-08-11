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

/**
 * Spread a rivalries rail so no fighter leads two cards in a row.
 *
 * `get_top_rivalries` orders by the two fighters' summed fame, which is a fine
 * ranking and a poor SEQUENCE: the single most famous character is in many of
 * the top pairs, so the rail opens with them three or four times running and
 * twelve curated rivalries look like one hero versus a queue.
 *
 * Greedy and lossless: emit the highest-ranked remaining pair that shares no
 * fighter with the card just emitted, falling back to the highest-ranked
 * remaining pair when every candidate shares one (a rail of nothing but Batman
 * rivalries cannot be spread, and pretending otherwise would mean dropping
 * cards). Nothing is dropped, so the count shown beside the rail stays true,
 * and rank order survives wherever the constraint does not bite.
 */
export function spreadRivalries<T extends { a: { id: string }; b: { id: string } }>(
  rivalries: T[],
): T[] {
  const remaining = [...rivalries];
  const out: T[] = [];
  let prev: T | undefined;
  while (remaining.length > 0) {
    let i = prev
      ? remaining.findIndex(
          (r) =>
            r.a.id !== prev!.a.id &&
            r.a.id !== prev!.b.id &&
            r.b.id !== prev!.a.id &&
            r.b.id !== prev!.b.id,
        )
      : 0;
    if (i === -1) i = 0;
    prev = remaining.splice(i, 1)[0];
    out.push(prev);
  }
  return out;
}
