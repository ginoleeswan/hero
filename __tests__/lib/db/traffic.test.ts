const mockRpc = jest.fn();
jest.mock('../../../src/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));

import { fetchTrafficOverview } from '../../../src/lib/db/traffic';

const overview = {
  authorized: true,
  rangeDays: 28,
  totals: { pageViews: 120, visitors: 40 },
  activeNow: 3,
  series: [{ day: '2026-06-23', views: 10, visitors: 5 }],
  topPages: [{ route: '/character/[id]', views: 60 }],
  topReferrers: [{ source: 'google.com', views: 12 }],
  devices: [{ label: 'desktop', views: 80 }],
};

describe('fetchTrafficOverview', () => {
  beforeEach(() => mockRpc.mockReset());

  it('passes the day window and returns the typed overview', async () => {
    mockRpc.mockResolvedValue({ data: overview, error: null });
    const r = await fetchTrafficOverview(28);
    expect(mockRpc).toHaveBeenCalledWith('admin_traffic_overview', { p_days: 28 });
    expect(r).not.toBeNull();
    expect(r!.totals.pageViews).toBe(120);
    expect(r!.activeNow).toBe(3);
    expect(r!.topPages[0].route).toBe('/character/[id]');
    expect((r as unknown as Record<string, unknown>).authorized).toBeUndefined();
  });

  it('returns null for a non-admin caller', async () => {
    mockRpc.mockResolvedValue({ data: { authorized: false }, error: null });
    expect(await fetchTrafficOverview()).toBeNull();
  });

  it('returns null on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await fetchTrafficOverview()).toBeNull();
  });
});
