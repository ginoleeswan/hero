import { QueryClient } from '@tanstack/react-query';
import { flattenCategoryPages, findCachedHero } from '../../../src/lib/query/heroCache';
import type { Hero } from '../../../src/lib/db/heroes';

const hero = (id: string, name: string) => ({ id, name } as unknown as Hero);

describe('flattenCategoryPages', () => {
  it('returns [] for undefined', () => {
    expect(flattenCategoryPages(undefined)).toEqual([]);
  });
  it('concatenates heroes across pages in order', () => {
    const data = {
      pageParams: [0, 1],
      pages: [
        { heroes: [hero('1', 'A')], total: 2 },
        { heroes: [hero('2', 'B')], total: 2 },
      ],
    };
    expect(flattenCategoryPages(data).map((h) => h.id)).toEqual(['1', '2']);
  });
});

describe('findCachedHero', () => {
  it('finds a hero seeded in any cached category list', () => {
    const client = new QueryClient();
    client.setQueryData(['heroes', 'category', 'popular', {}], {
      pageParams: [0],
      pages: [{ heroes: [hero('42', 'Batman')], total: 1 }],
    });
    expect(findCachedHero(client, '42')?.name).toBe('Batman');
  });
  it('returns undefined when the hero is not cached', () => {
    const client = new QueryClient();
    expect(findCachedHero(client, '99')).toBeUndefined();
  });
});
