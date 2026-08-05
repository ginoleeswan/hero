// This hook moved from useState to React Query, and three of its behaviours are
// load-bearing for the Profile screen in ways nothing else would catch:
// one-snapshot reveal, a stable `refetch` identity (it goes into a
// useFocusEffect dep array), and optimistic edits that survive a remount.
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import { useProfileData } from '../../src/hooks/useProfileData';
import { getUserFavouriteHeroes } from '../../src/lib/db/favourites';
import { getBattleRecord } from '../../src/lib/db/matchupVotes';
import { getMyContributions } from '../../src/lib/db/contributions';
import { getTasteProfile } from '../../src/lib/db/taste';
import { getMyTakes } from '../../src/lib/db/takes';

jest.mock('../../src/lib/db/favourites', () => ({ getUserFavouriteHeroes: jest.fn() }));
jest.mock('../../src/lib/db/matchupVotes', () => ({ getBattleRecord: jest.fn() }));
jest.mock('../../src/lib/db/contributions', () => ({ getMyContributions: jest.fn() }));
jest.mock('../../src/lib/db/taste', () => ({ getTasteProfile: jest.fn() }));
jest.mock('../../src/lib/db/takes', () => ({ getMyTakes: jest.fn() }));

const favs = getUserFavouriteHeroes as jest.Mock;
const battle = getBattleRecord as jest.Mock;
const contribs = getMyContributions as jest.Mock;
const taste = getTasteProfile as jest.Mock;
const takes = getMyTakes as jest.Mock;

// retry:false so a rejection test doesn't sit through the default backoff.
const makeWrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
};

const hero = (id: string) => ({ id, name: id }) as never;

describe('useProfileData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    favs.mockResolvedValue([hero('batman')]);
    battle.mockResolvedValue({ wins: 3, losses: 1 });
    contribs.mockResolvedValue([{ id: 'c1' }]);
    taste.mockResolvedValue({ top: 'DC' });
    takes.mockResolvedValue([{ id: 't1' }]);
  });

  it('stays idle when logged out rather than reporting an empty profile', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProfileData(undefined), { wrapper });
    expect(favs).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.settled).toBe(false);
  });

  it('reveals all five sources together, not one at a time', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProfileData('u1'), { wrapper });
    await waitFor(() => expect(result.current.settled).toBe(true));
    // The whole point of the single key: no render exists where some sections
    // have arrived and others haven't.
    expect(result.current.favourites).toHaveLength(1);
    expect(result.current.battle).toEqual({ wins: 3, losses: 1 });
    expect(result.current.contributions).toHaveLength(1);
    expect(result.current.taste).toEqual({ top: 'DC' });
    expect(result.current.takes).toHaveLength(1);
  });

  it('lets one dead source degrade without blanking the profile', async () => {
    contribs.mockRejectedValue(new Error('boom'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProfileData('u1'), { wrapper });
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.contributions).toEqual([]);
    expect(result.current.favourites).toHaveLength(1);
  });

  it('keeps a stable refetch identity across renders', async () => {
    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(() => useProfileData('u1'), { wrapper });
    await waitFor(() => expect(result.current.settled).toBe(true));
    const first = result.current.refetch;
    rerender({});
    // An unstable identity here means useFocusEffect refetches on every render
    // instead of every focus.
    expect(result.current.refetch).toBe(first);
  });

  it('applies optimistic un-favourite to the cache, so it survives a remount', async () => {
    const { client, wrapper } = makeWrapper();
    const first = renderHook(() => useProfileData('u1'), { wrapper });
    await waitFor(() => expect(first.result.current.settled).toBe(true));

    act(() => first.result.current.setFavourites((prev) => prev.filter((h) => h.id !== 'batman')));
    // React Query batches observer notifications through a microtask, so the
    // re-render lands just after the synchronous act() rather than inside it.
    await waitFor(() => expect(first.result.current.favourites).toHaveLength(0));

    // Remount against the same client — the useState version reverted here,
    // silently resurrecting a hero the user had just removed.
    first.unmount();
    const second = renderHook(() => useProfileData('u1'), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(second.result.current.favourites).toHaveLength(0);
  });

  it('supports optimistic take deletion the same way', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProfileData('u1'), { wrapper });
    await waitFor(() => expect(result.current.settled).toBe(true));
    act(() => result.current.setTakes((prev) => prev.filter((t) => t.id !== 't1')));
    await waitFor(() => expect(result.current.takes).toHaveLength(0));
  });

  it('refetches every source on demand', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useProfileData('u1'), { wrapper });
    await waitFor(() => expect(result.current.settled).toBe(true));
    favs.mockResolvedValue([hero('batman'), hero('robin')]);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.favourites).toHaveLength(2));
  });
});
