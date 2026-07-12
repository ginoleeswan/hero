import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import { useMatchupTakes } from '../../src/hooks/useMatchupTakes';
import { useAuth } from '../../src/hooks/useAuth';
import {
  getTakes,
  postTake,
  deleteTake,
  toggleAgree,
  type Take,
} from '../../src/lib/db/takes';
import { getVoterKey } from '../../src/lib/voterKey';

jest.mock('../../src/lib/db/takes', () => ({
  getTakes: jest.fn(),
  postTake: jest.fn(),
  deleteTake: jest.fn(),
  toggleAgree: jest.fn(),
}));

jest.mock('../../src/lib/voterKey', () => ({
  getVoterKey: jest.fn(),
}));

jest.mock('../../src/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

const mockGetTakes = getTakes as jest.MockedFunction<typeof getTakes>;
const mockPostTake = postTake as jest.MockedFunction<typeof postTake>;
const mockDeleteTake = deleteTake as jest.MockedFunction<typeof deleteTake>;
const mockToggleAgree = toggleAgree as jest.MockedFunction<typeof toggleAgree>;
const mockGetVoterKey = getVoterKey as jest.MockedFunction<typeof getVoterKey>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const HERO_A = 'hero-a';
const HERO_B = 'hero-b';

function makeTake(overrides: Partial<Take> = {}): Take {
  return {
    id: 't1',
    heroAId: HERO_A,
    heroBId: HERO_B,
    userId: 'user-1',
    pickedId: HERO_A,
    body: 'A takes it easily',
    agreeCount: 3,
    createdAt: '2026-07-12T00:00:00Z',
    displayName: 'Some Fan',
    ...overrides,
  };
}

const wrapper = ({ children }: { children: ReactNode }) =>
  React.createElement(QueryClientProvider, { client: new QueryClient() }, children);

describe('useMatchupTakes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVoterKey.mockResolvedValue('vk_test');
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuth>);
  });

  it('exposes the sorted takes returned by getTakes', async () => {
    const takes = [makeTake({ id: 't1', agreeCount: 5 }), makeTake({ id: 't2', agreeCount: 1 })];
    mockGetTakes.mockResolvedValue(takes);

    const { result } = renderHook(() => useMatchupTakes(HERO_A, HERO_B), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.takes.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('submit requires auth: returns false and never calls postTake when logged out', async () => {
    mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    mockGetTakes.mockResolvedValue([]);

    const { result } = renderHook(() => useMatchupTakes(HERO_A, HERO_B), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submit(HERO_A, 'A takes it');
    });

    expect(ok).toBe(false);
    expect(mockPostTake).not.toHaveBeenCalled();
  });

  it('agree optimistically bumps agreeCount and membership, rolling back on null', async () => {
    const take = makeTake({ id: 't1', agreeCount: 3 });
    mockGetTakes.mockResolvedValue([take]);

    const { result } = renderHook(() => useMatchupTakes(HERO_A, HERO_B), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Success path: agreeCount bumps, id joins agreedIds.
    mockToggleAgree.mockResolvedValueOnce({ agreed: true, agreeCount: 4 });
    act(() => {
      result.current.agree('t1');
    });
    expect(result.current.takes.find((t) => t.id === 't1')?.agreeCount).toBe(4);
    expect(result.current.agreedIds.has('t1')).toBe(true);
    await waitFor(() => expect(mockToggleAgree).toHaveBeenCalledWith('t1', 'vk_test'));

    // Rollback path: toggleAgree resolves null.
    mockToggleAgree.mockResolvedValueOnce(null);
    act(() => {
      result.current.agree('t1');
    });
    // Optimistic: un-agree, count drops to 3.
    expect(result.current.takes.find((t) => t.id === 't1')?.agreeCount).toBe(3);
    expect(result.current.agreedIds.has('t1')).toBe(false);

    await waitFor(() => expect(result.current.agreedIds.has('t1')).toBe(true));
    expect(result.current.takes.find((t) => t.id === 't1')?.agreeCount).toBe(4);
  });
});
