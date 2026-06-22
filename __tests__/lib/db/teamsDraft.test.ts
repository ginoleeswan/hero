const mockFrom = jest.fn();
jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));

import { getDraftRoster } from '../../../src/lib/db/teams';

function mockSelect(rows: unknown[] | null, error: { message: string } | null) {
  // .from('heroes').select(cols).in('id', ids) resolves to { data, error }
  const inFn = jest.fn().mockResolvedValue({ data: rows, error });
  const selectFn = jest.fn().mockReturnValue({ in: inFn });
  mockFrom.mockReturnValue({ select: selectFn });
}

describe('getDraftRoster', () => {
  beforeEach(() => mockFrom.mockReset());

  it('returns [] for empty input without querying', async () => {
    const r = await getDraftRoster([]);
    expect(r).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns heroes in the order of the requested ids (not DB order)', async () => {
    mockSelect(
      [
        { id: 'b', name: 'B', intelligence: 1, strength: 1, speed: 1, durability: 1, power: 1, combat: 1 },
        { id: 'a', name: 'A', intelligence: 2, strength: 2, speed: 2, durability: 2, power: 2, combat: 2 },
      ],
      null,
    );
    const r = await getDraftRoster(['a', 'b']);
    expect(r.map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('skips ids with no matching hero', async () => {
    mockSelect([{ id: 'a', name: 'A', intelligence: 1, strength: 1, speed: 1, durability: 1, power: 1, combat: 1 }], null);
    const r = await getDraftRoster(['a', 'missing']);
    expect(r.map((h) => h.id)).toEqual(['a']);
  });

  it('caps at 5 ids', async () => {
    mockSelect([], null);
    await getDraftRoster(['1', '2', '3', '4', '5', '6', '7']);
    const inArg = (mockFrom.mock.results[0].value.select.mock.results[0].value.in as jest.Mock).mock.calls[0][1];
    expect(inArg).toHaveLength(5);
  });

  it('returns [] on error', async () => {
    mockSelect(null, { message: 'boom' });
    const r = await getDraftRoster(['a']);
    expect(r).toEqual([]);
  });
});
