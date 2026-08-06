import {
  getAllHeroesBySlug,
  getCategoryPage,
  getHeroesByMediaTag,
} from '../../../src/lib/db/heroes';
import { DEFAULT_FILTERS } from '../../../src/lib/db/categoryFilters';

// Tag filtering used to be an embedded inner join (`t0:hero_tags!inner(tag)`
// plus `.eq('t0.tag', …)`). Correct SQL, but PostgREST planned it off `heroes`
// — 50k rows — and the live anon endpoint returned HTTP 500 `canceling
// statement due to statement timeout` for the two categories with fewer heroes
// than one page (anime 29, horror-icon 15). Tags now resolve to ids first.
//
// These tests pin the replacement's contract, and especially the AND
// semantics: "has ALL of these tags", which the aliased joins used to provide
// and which a naive id union would silently turn into OR.

let mockHeroesResult: { data: unknown[]; error: unknown; count: number } = {
  data: [],
  error: null,
  count: 0,
};
let mockTagRows: { hero_id: string; tag: string }[] = [];

jest.mock('../../../src/lib/supabase', () => {
  const heroesChain: Record<string, unknown> = {};
  ['select', 'eq', 'or', 'ilike', 'not', 'gte', 'order', 'in'].forEach((m) => {
    heroesChain[m] = jest.fn().mockReturnValue(heroesChain);
  });
  heroesChain.range = jest.fn().mockImplementation(() => Promise.resolve(mockHeroesResult));
  // getHeroesByMediaTag awaits straight off `.limit()`; getAllHeroesBySlug pages
  // with `.range()`, so both links have to be thenable.
  heroesChain.limit = jest.fn().mockImplementation(() => Promise.resolve(mockHeroesResult));

  // hero_tags is awaited directly off `.in(...)`, so that link is the thenable.
  const tagsChain: Record<string, unknown> = {};
  tagsChain.select = jest.fn().mockReturnValue(tagsChain);
  tagsChain.in = jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockTagRows, error: null }));

  const mockFrom = jest.fn((table: string) => (table === 'hero_tags' ? tagsChain : heroesChain));
  return {
    supabase: { from: mockFrom },
    __heroes: heroesChain,
    __tags: tagsChain,
    __from: mockFrom,
  };
});

const {
  __heroes: heroes,
  __tags: tags,
  __from: from,
} = jest.requireMock('../../../src/lib/supabase');

const clear = (o: Record<string, unknown>) =>
  Object.values(o).forEach((fn) => (fn as jest.Mock).mockClear?.());

describe('getCategoryPage tag filter', () => {
  beforeEach(() => {
    mockHeroesResult = { data: [], error: null, count: 0 };
    mockTagRows = [];
    clear(heroes);
    clear(tags);
    (from as jest.Mock).mockClear();
  });

  it('never embeds hero_tags in the select', async () => {
    await getCategoryPage('popular', { ...DEFAULT_FILTERS, page: 0 });
    const selectArg = (heroes.select as jest.Mock).mock.calls[0][0] as string;
    expect(selectArg).not.toContain('hero_tags');
  });

  it('does not touch hero_tags at all when no tags are selected', async () => {
    await getCategoryPage('popular', { ...DEFAULT_FILTERS, page: 0 });
    expect((from as jest.Mock).mock.calls.flat()).not.toContain('hero_tags');
  });

  it('resolves a tag to ids and filters heroes by id', async () => {
    mockTagRows = [
      { hero_id: 'a', tag: 'anti-hero' },
      { hero_id: 'b', tag: 'anti-hero' },
    ];
    await getCategoryPage('popular', { ...DEFAULT_FILTERS, tags: ['anti-hero'], page: 0 });
    expect(tags.in).toHaveBeenCalledWith('tag', ['anti-hero']);
    expect(heroes.in).toHaveBeenCalledWith('id', ['a', 'b']);
  });

  it('ANDs multiple tags — only heroes carrying every one survive', async () => {
    // `b` has both; `a` and `c` have one each. A union would wrongly return all three.
    mockTagRows = [
      { hero_id: 'a', tag: 'comic-relief' },
      { hero_id: 'b', tag: 'comic-relief' },
      { hero_id: 'b', tag: 'wholesome' },
      { hero_id: 'c', tag: 'wholesome' },
    ];
    await getCategoryPage('popular', {
      ...DEFAULT_FILTERS,
      tags: ['comic-relief', 'wholesome'],
      page: 0,
    });
    expect(heroes.in).toHaveBeenCalledWith('id', ['b']);
  });

  it('folds a tag-backed category slug into the same path', async () => {
    // `anime` is not a column predicate — the slug IS a hero_tags tag.
    mockTagRows = [{ hero_id: 'z', tag: 'anime' }];
    await getCategoryPage('anime', { ...DEFAULT_FILTERS, page: 0 });
    expect(tags.in).toHaveBeenCalledWith('tag', ['anime']);
    expect(heroes.in).toHaveBeenCalledWith('id', ['z']);
  });

  it('returns an empty page without querying heroes when no hero has the tag', async () => {
    mockTagRows = [];
    const res = await getCategoryPage('popular', {
      ...DEFAULT_FILTERS,
      tags: ['nobody-has-this'],
      page: 0,
    });
    expect(res).toEqual({ heroes: [], total: 0 });
    expect(heroes.range).not.toHaveBeenCalled();
  });

  // The paged grid was fixed first; these two kept their own copy of the
  // embedded join for another release. getHeroesByMediaTag is the worse of the
  // pair — a thin tag (horror-icon: 15) can never fill its limit of 20, so the
  // planner walks the fame index to the very end before giving up.
  it('resolves ids first in getAllHeroesBySlug, never embedding hero_tags', async () => {
    mockTagRows = [{ hero_id: 'q', tag: 'alien' }];
    await getAllHeroesBySlug('aliens');
    expect(tags.in).toHaveBeenCalledWith('tag', ['alien']);
    expect(heroes.in).toHaveBeenCalledWith('id', ['q']);
    expect((heroes.select as jest.Mock).mock.calls[0][0]).not.toContain('hero_tags');
  });

  it('resolves ids first in getHeroesByMediaTag, never embedding hero_tags', async () => {
    mockTagRows = [{ hero_id: 'r', tag: 'horror-icon' }];
    await getHeroesByMediaTag('horror-icon');
    expect(tags.in).toHaveBeenCalledWith('tag', ['horror-icon']);
    expect(heroes.in).toHaveBeenCalledWith('id', ['r']);
    expect((heroes.select as jest.Mock).mock.calls[0][0]).not.toContain('hero_tags');
  });

  it('never queries heroes for a tag nobody carries', async () => {
    mockTagRows = [];
    expect(await getHeroesByMediaTag('nobody-has-this')).toEqual([]);
    expect(await getAllHeroesBySlug('anime')).toEqual([]);
    expect(heroes.limit).not.toHaveBeenCalled();
    expect(heroes.range).not.toHaveBeenCalled();
  });

  it('double-quotes the search value so commas/parens do not break the .or() filter', async () => {
    await getCategoryPage('popular', {
      ...DEFAULT_FILTERS,
      search: 'Spider-Man (2099)',
      page: 0,
    });
    const orArg = (heroes.or as jest.Mock).mock.calls[0][0] as string;
    expect(orArg).toBe('name.ilike."%Spider-Man (2099)%",full_name.ilike."%Spider-Man (2099)%"');
  });
});
