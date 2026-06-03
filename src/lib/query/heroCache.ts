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

/** Flattens infinite-query pages into one ordered hero list. */
export function flattenCategoryPages(data: InfiniteCategoryData | undefined): Hero[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.heroes);
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
