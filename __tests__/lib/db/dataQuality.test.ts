import { fetchDataQuality } from '../../../src/lib/db/dataQuality';

const mockRpc = jest.fn();

jest.mock('../../../src/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

beforeEach(() => mockRpc.mockReset());

describe('fetchDataQuality', () => {
  const checks = [
    { key: 'staleDone', label: 'Stale enrichment', count: 0, sample: [] },
    {
      key: 'famousDupNames',
      label: 'Famous duplicate names (same publisher)',
      count: 2,
      sample: [{ id: 'h1', name: 'Hulk', fame_score: 89 }],
    },
  ];

  it('unwraps an authorized report', async () => {
    mockRpc.mockResolvedValue({
      data: { authorized: true, generatedAt: '2026-07-16T08:00:00Z', checks },
      error: null,
    });
    const report = await fetchDataQuality();
    expect(mockRpc).toHaveBeenCalledWith('admin_data_quality');
    expect(report).toEqual({ generatedAt: '2026-07-16T08:00:00Z', checks });
  });

  it('returns null for non-admins (authorized:false)', async () => {
    mockRpc.mockResolvedValue({ data: { authorized: false }, error: null });
    await expect(fetchDataQuality()).resolves.toBeNull();
  });

  it('returns null on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchDataQuality()).resolves.toBeNull();
  });
});
