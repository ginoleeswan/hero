import { fetchActivityFeed } from '../../../src/lib/db/activityFeed';

const mockRpc = jest.fn();
jest.mock('../../../src/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));

const item = (at: string, kind = 'view') => ({
  kind,
  at,
  heroId: null,
  heroName: null,
  route: '/',
  path: '/',
  sessionId: 's',
  signedIn: false,
  country: null,
  city: null,
  device: null,
  browser: null,
  os: null,
  runId: null,
  runStatus: null,
  runDone: null,
  text: null,
});

describe('fetchActivityFeed', () => {
  beforeEach(() => mockRpc.mockReset());

  it('passes cursor, page size and kind through and exposes the next cursor', async () => {
    mockRpc.mockResolvedValue({
      data: {
        authorized: true,
        items: [item('2026-09-15T10:00:00Z'), item('2026-09-15T09:00:00Z')],
      },
      error: null,
    });
    const page = await fetchActivityFeed({
      before: '2026-09-15T11:00:00Z',
      limit: 2,
      kind: 'view',
    });
    expect(mockRpc).toHaveBeenCalledWith('admin_activity_feed', {
      p_before: '2026-09-15T11:00:00Z',
      p_limit: 2,
      p_kind: 'view',
    });
    expect(page?.items).toHaveLength(2);
    // A full page means there may be more: cursor = oldest row's `at`.
    expect(page?.nextBefore).toBe('2026-09-15T09:00:00Z');
  });

  it('ends pagination on a short page', async () => {
    mockRpc.mockResolvedValue({
      data: { authorized: true, items: [item('2026-09-15T10:00:00Z')] },
      error: null,
    });
    const page = await fetchActivityFeed({ limit: 40 });
    expect(page?.nextBefore).toBeNull();
  });

  it('returns null for non-admins and on RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: { authorized: false }, error: null });
    expect(await fetchActivityFeed()).toBeNull();
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await fetchActivityFeed()).toBeNull();
    warn.mockRestore();
  });
});
