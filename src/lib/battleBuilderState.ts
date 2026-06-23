/** A lightweight hero as held by the builder — the fields the trays/synergy/route
 *  need, captured from the grid/rail item on tap (no extra fetch). */
export interface PickedHero {
  id: string;
  name: string;
  portrait_url?: string | null;
  image_url?: string | null;
  publisher?: string | null;
}

export type Side = 'A' | 'B';
export const MAX_SIDE = 5;

/** Append to a side unless it is full or the hero already sits on either side.
 *  Returns the same array reference when unchanged (cheap no-op for React). */
export function addToSide(side: PickedHero[], other: PickedHero[], hero: PickedHero): PickedHero[] {
  if (side.length >= MAX_SIDE) return side;
  if (side.some((h) => h.id === hero.id) || other.some((h) => h.id === hero.id)) return side;
  return [...side, hero];
}

/** Append many heroes to a side through addToSide's guards (cap, cross-side
 *  dedupe). Returns the same reference when nothing is added. */
export function fillSide(
  side: PickedHero[],
  other: PickedHero[],
  heroes: PickedHero[],
): PickedHero[] {
  let next = side;
  for (const hero of heroes) next = addToSide(next, other, hero);
  return next;
}

export function removeFromSide(side: PickedHero[], id: string): PickedHero[] {
  return side.filter((h) => h.id !== id);
}

export function canBattle(a: PickedHero[], b: PickedHero[]): boolean {
  return a.length >= 1 && b.length >= 1;
}

function pubKey(p?: string | null): 'marvel' | 'dc' | 'other' {
  const s = (p ?? '').toLowerCase();
  if (s.includes('marvel')) return 'marvel';
  if (s.includes('dc')) return 'dc';
  return 'other';
}

/** 'marvel' | 'dc' only when the roster has ≥2 heroes that all share that
 *  publisher; otherwise null (mixed, non-major, or too few to be notable). */
export function derivePublisher(heroes: PickedHero[]): 'marvel' | 'dc' | null {
  if (heroes.length < 2) return null;
  const keys = heroes.map((h) => pubKey(h.publisher));
  const first = keys[0];
  if (first === 'other') return null;
  return keys.every((k) => k === first) ? first : null;
}
