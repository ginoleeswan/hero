import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useBlockedUsers } from '../../src/hooks/useBlockedUsers';
import { getBlockedUsers, unblockUser, type BlockedUser } from '../../src/lib/db/blocks';

jest.mock('../../src/lib/db/blocks', () => ({
  getBlockedUsers: jest.fn(),
  unblockUser: jest.fn(),
}));

const mockGetBlockedUsers = getBlockedUsers as jest.MockedFunction<typeof getBlockedUsers>;
const mockUnblockUser = unblockUser as jest.MockedFunction<typeof unblockUser>;

function makeBlocked(overrides: Partial<BlockedUser> = {}): BlockedUser {
  return {
    userId: 'u2',
    displayName: 'Villain',
    avatarUrl: null,
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useBlockedUsers', () => {
  it('loads the block list on mount', async () => {
    const rows = [makeBlocked()];
    mockGetBlockedUsers.mockResolvedValue(rows);

    const { result } = renderHook(() => useBlockedUsers(true));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.blocked).toEqual(rows);
    expect(mockGetBlockedUsers).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when disabled (signed out)', async () => {
    const { result } = renderHook(() => useBlockedUsers(false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.blocked).toEqual([]);
    expect(mockGetBlockedUsers).not.toHaveBeenCalled();
  });

  it('unblock removes the row immediately (optimistic) and calls unblockUser', async () => {
    const rows = [makeBlocked({ userId: 'u2' }), makeBlocked({ userId: 'u3' })];
    mockGetBlockedUsers.mockResolvedValue(rows);
    mockUnblockUser.mockResolvedValue(true);

    const { result } = renderHook(() => useBlockedUsers(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean = false;
    await act(async () => {
      ok = await result.current.unblock('u2');
    });

    expect(ok).toBe(true);
    expect(mockUnblockUser).toHaveBeenCalledWith('u2');
    expect(result.current.blocked.map((r) => r.userId)).toEqual(['u3']);
    expect(result.current.unblockingId).toBeNull();
  });

  it('restores the row when the unblock call fails', async () => {
    const rows = [makeBlocked({ userId: 'u2' })];
    mockGetBlockedUsers.mockResolvedValue(rows);
    mockUnblockUser.mockResolvedValue(false);

    const { result } = renderHook(() => useBlockedUsers(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean = true;
    await act(async () => {
      ok = await result.current.unblock('u2');
    });

    expect(ok).toBe(false);
    expect(result.current.blocked.map((r) => r.userId)).toEqual(['u2']);
  });

  it('refetch re-reads the list', async () => {
    mockGetBlockedUsers.mockResolvedValueOnce([makeBlocked({ userId: 'u2' })]);
    const { result } = renderHook(() => useBlockedUsers(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGetBlockedUsers.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.blocked).toEqual([]);
    expect(mockGetBlockedUsers).toHaveBeenCalledTimes(2);
  });
});
