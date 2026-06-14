import { getCategoryPage } from '../../../src/lib/db/heroes';
import { DEFAULT_FILTERS } from '../../../src/lib/db/categoryFilters';

// Chain mock that records calls and resolves the range() terminal.
// eslint-disable-next-line prefer-const
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

  it('inner-joins hero_tags and filters by each selected tag', async () => {
    await getCategoryPage('popular', { ...DEFAULT_FILTERS, tags: ['anti-hero'], page: 0 });
    const selectArg = (chain.select as jest.Mock).mock.calls[0][0] as string;
    expect(selectArg).toContain('hero_tags!inner');
    expect(chain.eq).toHaveBeenCalledWith('hero_tags.tag', 'anti-hero');
  });
});
