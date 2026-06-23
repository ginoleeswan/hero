const mockRpc = jest.fn();
jest.mock('../../../src/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));

import { fetchCommunityOverview } from '../../../src/lib/db/community';

const fullOverview = {
  authorized: true,
  totals: { members: 2, favourites: 5, views: 30, compares: 82, votes: 12, contributions: 3 },
  online: {
    onlineNow: 1,
    activeToday: 2,
    recent: [{ userId: 'u1', displayName: 'Gino', lastSeenAt: '2026-06-23T00:00:00Z', live: true }],
  },
  topViewed: [{ id: 'h1', name: 'Spawn', image_url: null, publisher: 'Image', count: 9 }],
  topFavourited: [],
  topBacked: [
    { id: 'h1', name: 'Spawn', image_url: null, publisher: 'Image', count: 4, winRate: 67 },
  ],
  topContributors: [{ userId: 'u1', displayName: 'Gino', approved: 3, level: 'curator' }],
  contributionsByStatus: { pending: 1, approved: 2, rejected: 0 },
  recent: [
    { kind: 'view', at: '2026-06-23T00:00:00Z', heroId: 'h1', heroName: 'Spawn', text: null },
  ],
};

describe('fetchCommunityOverview', () => {
  beforeEach(() => mockRpc.mockReset());

  it('strips the authorized flag and returns the typed overview', async () => {
    mockRpc.mockResolvedValue({ data: fullOverview, error: null });
    const r = await fetchCommunityOverview();
    expect(mockRpc).toHaveBeenCalledWith('admin_community_overview');
    expect(r).not.toBeNull();
    expect(r!.totals.views).toBe(30);
    expect(r!.online.onlineNow).toBe(1);
    expect(r!.topBacked[0].winRate).toBe(67);
    // The `authorized` flag must not leak into the returned object.
    expect((r as unknown as Record<string, unknown>).authorized).toBeUndefined();
  });

  it('returns null for a non-admin caller', async () => {
    mockRpc.mockResolvedValue({ data: { authorized: false }, error: null });
    expect(await fetchCommunityOverview()).toBeNull();
  });

  it('returns null on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await fetchCommunityOverview()).toBeNull();
  });
});
