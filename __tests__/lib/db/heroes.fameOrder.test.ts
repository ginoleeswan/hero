import { getAllHeroesBySlug } from '../../../src/lib/db/heroes';

let mockRangeWith: { data: unknown; error: unknown } = { data: [], error: null };

jest.mock('../../../src/lib/supabase', () => {
  const methods = ['select', 'eq', 'gte', 'lte', 'neq', 'or', 'ilike', 'not', 'order', 'limit'];
  const chain: Record<string, unknown> = {};
  methods.forEach((m) => (chain[m] = jest.fn().mockReturnValue(chain)));
  // fetchAllPages terminates the loop on a short page, so range resolves directly.
  chain.range = jest.fn(() => Promise.resolve(mockRangeWith));
  return { supabase: { from: jest.fn().mockReturnValue(chain) }, __chain: chain };
});

const { __chain: chain } = jest.requireMock('../../../src/lib/supabase') as {
  __chain: Record<string, jest.Mock>;
};

beforeEach(() => {
  jest.clearAllMocks();
  ['select', 'eq', 'not', 'or', 'ilike', 'order', 'limit'].forEach((m) =>
    chain[m].mockReturnValue(chain),
  );
  chain.range.mockReturnValue(Promise.resolve(mockRangeWith));
  mockRangeWith = { data: [], error: null };
});

const FAME = { ascending: false, nullsFirst: false };

describe('fame_score ordering', () => {
  it('orders most-iconic by fame_score desc (not issue_count)', async () => {
    await getAllHeroesBySlug('most-iconic');
    expect(chain.order).toHaveBeenCalledWith('fame_score', FAME);
    expect(chain.order).not.toHaveBeenCalledWith('issue_count', FAME);
  });

  it('orders popular by fame_score desc (no longer alphabetical by name)', async () => {
    await getAllHeroesBySlug('popular');
    expect(chain.order).toHaveBeenCalledWith('fame_score', FAME);
    expect(chain.order).not.toHaveBeenCalledWith('name');
  });
});
