import { getCategoryPage, getCategoryFacetCounts } from '../../../src/lib/db/heroes';
import { DEFAULT_FILTERS } from '../../../src/lib/db/categoryFilters';

let mockResolveWith: { data: unknown; error: unknown; count?: number } = {
  data: [],
  error: null,
  count: 0,
};
let mockRpcResolveWith: { data: unknown; error: unknown } = { data: {}, error: null };

jest.mock('../../../src/lib/supabase', () => {
  const methods = [
    'select',
    'eq',
    'gte',
    'lte',
    'neq',
    'or',
    'ilike',
    'not',
    'order',
    'limit',
    'range',
  ];
  const chain: Record<string, unknown> = {};
  methods.forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(mockResolveWith).then(resolve);
  const mockFrom = jest.fn().mockReturnValue(chain);
  const mockRpc = jest.fn(() => Promise.resolve(mockRpcResolveWith));
  return {
    supabase: { from: mockFrom, rpc: mockRpc },
    __chain: chain,
    __mockFrom: mockFrom,
    __mockRpc: mockRpc,
  };
});

const { __chain: chain, __mockRpc: mockRpc } = jest.requireMock('../../../src/lib/supabase') as {
  __chain: Record<string, jest.Mock>;
  __mockRpc: jest.Mock;
};
const methods = [
  'select',
  'eq',
  'gte',
  'lte',
  'neq',
  'or',
  'ilike',
  'not',
  'order',
  'limit',
  'range',
];

beforeEach(() => {
  jest.clearAllMocks();
  methods.forEach((m) => chain[m].mockReturnValue(chain));
  mockResolveWith = { data: [], error: null, count: 0 };
  mockRpcResolveWith = { data: {}, error: null };
});

describe('getCategoryPage filter mapping', () => {
  const opts = (over = {}) => ({ page: 0, pageSize: 48, ...DEFAULT_FILTERS, ...over });

  it('applies the marvel publisher filter', async () => {
    await getCategoryPage('popular', opts({ publisher: 'marvel' }));
    expect(chain.ilike).toHaveBeenCalledWith('publisher', '%marvel%');
  });
  it('applies the "other" publisher filter (not marvel and not dc)', async () => {
    await getCategoryPage('popular', opts({ publisher: 'other' }));
    expect(chain.not).toHaveBeenCalledWith('publisher', 'ilike', '%marvel%');
    expect(chain.not).toHaveBeenCalledWith('publisher', 'ilike', '%dc%');
  });
  it('applies alignment=bad', async () => {
    await getCategoryPage('popular', opts({ alignment: 'bad' }));
    expect(chain.eq).toHaveBeenCalledWith('alignment', 'bad');
  });
  it('applies gender=female case-insensitively', async () => {
    await getCategoryPage('popular', opts({ gender: 'female' }));
    expect(chain.ilike).toHaveBeenCalledWith('gender', 'female');
  });
  it('applies hasStats as powerstats_total > 0', async () => {
    await getCategoryPage('popular', opts({ hasStats: true }));
    expect(chain.gte).toHaveBeenCalledWith('powerstats_total', 1);
  });
  it('orders by powerstats_total for the power sort', async () => {
    await getCategoryPage('popular', opts({ sort: 'power' }));
    expect(chain.order).toHaveBeenCalledWith('powerstats_total', {
      ascending: false,
      nullsFirst: false,
    });
  });
  it('orders by name for the az sort', async () => {
    await getCategoryPage('popular', opts({ sort: 'az' }));
    expect(chain.order).toHaveBeenCalledWith('name');
  });
  it('returns heroes and total from the response', async () => {
    mockResolveWith = { data: [{ id: '1' }], error: null, count: 7 };
    const res = await getCategoryPage('popular', opts());
    expect(res.total).toBe(7);
    expect(res.heroes).toHaveLength(1);
  });
  it('throws on supabase error', async () => {
    mockResolveWith = { data: null, error: { message: 'boom' }, count: 0 };
    await expect(getCategoryPage('popular', opts())).rejects.toThrow('boom');
  });
});

describe('getCategoryFacetCounts', () => {
  it('calls the RPC with mapped params and returns its data', async () => {
    mockRpcResolveWith = {
      data: {
        total: 3,
        publisher: { all: 3, marvel: 1, dc: 1, other: 1 },
        alignment: { good: 0, bad: 3, neutral: 0 },
        gender: { male: 2, female: 1 },
        has_stats: 2,
      },
      error: null,
    };
    const res = await getCategoryFacetCounts('villain', {
      ...DEFAULT_FILTERS,
      gender: 'female',
      hasStats: true,
      search: 'x',
    });
    expect(mockRpc).toHaveBeenCalledWith('category_facet_counts', {
      p_slug: 'villain',
      p_publisher: 'all',
      p_alignment: 'any',
      p_gender: 'female',
      p_has_stats: true,
      p_search: 'x',
    });
    expect(res.total).toBe(3);
  });
  it('throws on RPC error', async () => {
    mockRpcResolveWith = { data: null, error: { message: 'rpc fail' } };
    await expect(getCategoryFacetCounts('villain', DEFAULT_FILTERS)).rejects.toThrow('rpc fail');
  });
});
