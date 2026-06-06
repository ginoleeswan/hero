/**
 * In-memory handoff for the pick → arena shared-element morph (web).
 *
 * The arena loads its stats async, so without this it would paint a spinner
 * first and the View Transition would have nothing to morph into. The picker
 * stashes the art it already has for both fighters here; the arena reads it on
 * its very first render and paints the portraits immediately with the same
 * image — so the clicked card morphs cleanly into the arena portrait.
 *
 * It's a best-effort, single-navigation cache (not state) — stale entries are
 * harmless because the arena always reconciles with real stats once they load.
 */
export interface FighterArt {
  id: string;
  name?: string | null;
  image_url?: string | null;
  portrait_url?: string | null;
}

const cache = new Map<string, FighterArt>();

export function stashFighters(...fighters: (FighterArt | null | undefined)[]): void {
  for (const f of fighters) {
    if (f?.id) cache.set(f.id, f);
  }
}

export function getFighterArt(id: string | undefined): FighterArt | undefined {
  return id ? cache.get(id) : undefined;
}
