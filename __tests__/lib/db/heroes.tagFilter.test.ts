import { getCategoryPage } from '../../../src/lib/db/heroes';
import { DEFAULT_FILTERS } from '../../../src/lib/db/categoryFilters';

// Chain mock that records calls and resolves the range() terminal.

let mockResult: { data: unknown[]; error: unknown; count: number } = {
  data: [],
  error: null,
  count: 0,
};

jest.mock('../../../src/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'or', 'ilike', 'not', 'gte', 'order'].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.range = jest.fn().mockImplementation(() => Promise.resolve(mockResult));
  const mockFrom = jest.fn().mockReturnValue(chain);
  return { supabase: { from: mockFrom }, __chain: chain, __mockFrom: mockFrom };
});

const { __chain: chain } = jest.requireMock('../../../src/lib/supabase');

describe('getCategoryPage tag filter', () => {
  beforeEach(() => {
    mockResult = { data: [], error: null, count: 0 };
    Object.values(chain).forEach((fn) => (fn as jest.Mock).mockClear?.());
  });

  it('does not add a hero_tags filter when no tags selected', async () => {
    await getCategoryPage('popular', { ...DEFAULT_FILTERS, page: 0 });
    const selectArg = (chain.select as jest.Mock).mock.calls[0][0] as string;
    expect(selectArg).not.toContain('hero_tags');
  });

  it('aliases the hero_tags inner join and filters the alias', async () => {
    await getCategoryPage('popular', { ...DEFAULT_FILTERS, tags: ['anti-hero'], page: 0 });
    const selectArg = (chain.select as jest.Mock).mock.calls[0][0] as string;
    expect(selectArg).toContain('t0:hero_tags!inner(tag)');
    expect(chain.eq).toHaveBeenCalledWith('t0.tag', 'anti-hero');
  });

  it('gives each tag its OWN aliased join so multiple tags AND (not an impossible single-row match)', async () => {
    await getCategoryPage('popular', {
      ...DEFAULT_FILTERS,
      tags: ['comic-relief', 'wholesome'],
      page: 0,
    });
    const selectArg = (chain.select as jest.Mock).mock.calls[0][0] as string;
    // Two distinct aliased joins, not one shared embed.
    expect(selectArg).toContain('t0:hero_tags!inner(tag)');
    expect(selectArg).toContain('t1:hero_tags!inner(tag)');
    // Each tag filters its own alias — never two .eq on the same key.
    expect(chain.eq).toHaveBeenCalledWith('t0.tag', 'comic-relief');
    expect(chain.eq).toHaveBeenCalledWith('t1.tag', 'wholesome');
  });

  it('double-quotes the search value so commas/parens do not break the .or() filter', async () => {
    await getCategoryPage('popular', {
      ...DEFAULT_FILTERS,
      search: 'Spider-Man (2099)',
      page: 0,
    });
    const orArg = (chain.or as jest.Mock).mock.calls[0][0] as string;
    expect(orArg).toBe('name.ilike."%Spider-Man (2099)%",full_name.ilike."%Spider-Man (2099)%"');
  });
});
