import type { QueryClient } from '@tanstack/react-query';
import type { Hero } from '../db/heroes';

export interface CategoryPage {
  heroes: Hero[];
  total: number;
}
export interface InfiniteCategoryData {
  pages: CategoryPage[];
  pageParams: unknown[];
}

/** Flattens infinite-query pages into one ordered hero list, de-duped by id.
 *  Offset pagination can repeat a row across pages when the sort has ties, which
 *  would otherwise produce duplicate React keys in the grid — drop the repeats. */
export function flattenCategoryPages(data: InfiniteCategoryData | undefined): Hero[] {
  if (!data) return [];
  const seen = new Set<string>();
  const out: Hero[] = [];
  for (const page of data.pages) {
    for (const hero of page.heroes) {
      if (seen.has(hero.id)) continue;
      seen.add(hero.id);
      out.push(hero);
    }
  }
  return out;
}

/**
 * Scans every cached category list for a hero with this id, so the detail
 * screen can paint name + portrait instantly from data already in memory.
 */
export function findCachedHero(client: QueryClient, id: string): Hero | undefined {
  const entries = client.getQueriesData<InfiniteCategoryData>({
    queryKey: ['heroes', 'category'],
  });
  for (const [, data] of entries) {
    const hit = flattenCategoryPages(data).find((h) => h.id === id);
    if (hit) return hit;
  }
  return undefined;
}
