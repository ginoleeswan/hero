import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserFavouriteHeroes, type FavouriteHero } from '../lib/db/favourites';
import { getBattleRecord, type BattleRecord } from '../lib/db/matchupVotes';
import { getMyContributions, type MyContribution } from '../lib/db/contributions';
import { getTasteProfile, type TasteProfile } from '../lib/db/taste';
import { getMyTakes, type MyTake } from '../lib/db/takes';
import { queryKeys } from '../lib/query/keys';

/** The five sources as one value. Kept together deliberately — see below. */
interface ProfileSnapshot {
  favourites: FavouriteHero[];
  battle: BattleRecord | null;
  contributions: MyContribution[];
  taste: TasteProfile | null;
  takes: MyTake[];
}

const EMPTY: ProfileSnapshot = {
  favourites: [],
  battle: null,
  contributions: [],
  taste: null,
  takes: [],
};

export interface ProfileData {
  favourites: FavouriteHero[];
  /** Exposed so the views can optimistically drop a hero on un-favourite. */
  setFavourites: Dispatch<SetStateAction<FavouriteHero[]>>;
  battle: BattleRecord | null;
  contributions: MyContribution[];
  taste: TasteProfile | null;
  takes: MyTake[];
  /** Exposed so the views can optimistically drop a take on delete. */
  setTakes: Dispatch<SetStateAction<MyTake[]>>;
  loading: boolean;
  /** True once ALL five sources have settled (not just favourites). Use this —
   *  not `loading` — to gate anything that reads the full picture (e.g. the fan
   *  tier / milestone detector), so it never runs on a partially-loaded snapshot. */
  settled: boolean;
  /** Re-fetch all profile data. Resolves when the full snapshot has been
   *  applied (all five sources settled), so callers can drive their own
   *  pull-to-refresh spinner off the promise. */
  refetch: () => Promise<void>;
}

/**
 * Platform-neutral data layer for the Profile screen: the signed-in user's
 * favourites, battle record, contributions, taste profile and takes. Both
 * `app/(tabs)/profile.tsx` and `profile.web.tsx` consume this so the fetch
 * logic lives once; each view keeps its own refetch trigger (native
 * `useFocusEffect` / pull-to-refresh, web `visibilitychange`).
 *
 * Avatar/cover/display-name editing stays in `useProfile`.
 *
 * **All five sources live under one query key on purpose.** Splitting them into
 * five queries would make the profile sections mount one after another during
 * the initial load — contributions popping in, then takes, then favourites — a
 * visible layout stagger. `Promise.allSettled` inside a single queryFn keeps the
 * original "one snapshot, one reveal" behaviour while still getting caching,
 * retry, request dedup and offline pausing from React Query. A rejected source
 * degrades to its empty default rather than failing the whole snapshot, so one
 * dead endpoint can't blank the profile.
 */
export function useProfileData(userId: string | undefined): ProfileData {
  const queryClient = useQueryClient();
  const key = queryKeys.profileData(userId ?? '');

  const query = useQuery({
    queryKey: key,
    // Logged out has nothing to fetch. `enabled` keeps the query idle rather
    // than resolving an empty snapshot that would then look like real data.
    enabled: !!userId,
    queryFn: async (): Promise<ProfileSnapshot> => {
      const [battleR, tasteR, contribR, takesR, favR] = await Promise.allSettled([
        getBattleRecord(),
        getTasteProfile(),
        getMyContributions(),
        getMyTakes(userId as string),
        getUserFavouriteHeroes(userId as string),
      ]);
      return {
        battle: battleR.status === 'fulfilled' ? battleR.value : null,
        taste: tasteR.status === 'fulfilled' ? tasteR.value : null,
        contributions: contribR.status === 'fulfilled' ? contribR.value : [],
        takes: takesR.status === 'fulfilled' ? takesR.value : [],
        favourites: favR.status === 'fulfilled' ? favR.value : [],
      };
    },
  });

  const data = query.data ?? EMPTY;

  // Optimistic edits write straight to the cache instead of to local state, so
  // they survive the screen unmounting and remounting (tab switch) — the old
  // useState version silently reverted an un-favourite in that case.
  const patch = useCallback(
    (edit: (prev: ProfileSnapshot) => ProfileSnapshot) => {
      queryClient.setQueryData<ProfileSnapshot>(key, (prev) => edit(prev ?? EMPTY));
    },
    // `key` is a fresh array each render; depend on its contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, userId],
  );

  const setFavourites = useCallback<Dispatch<SetStateAction<FavouriteHero[]>>>(
    (action) =>
      patch((prev) => ({
        ...prev,
        favourites: typeof action === 'function' ? action(prev.favourites) : action,
      })),
    [patch],
  );

  const setTakes = useCallback<Dispatch<SetStateAction<MyTake[]>>>(
    (action) =>
      patch((prev) => ({
        ...prev,
        takes: typeof action === 'function' ? action(prev.takes) : action,
      })),
    [patch],
  );

  // Goes through the client rather than `query.refetch` on purpose: the query
  // object is a new reference every render, so a `refetch` closed over it would
  // be too — and the views pass this straight into `useFocusEffect`'s dep array
  // (`app/(tabs)/profile.tsx`), where an unstable identity means a refetch on
  // every render rather than on every focus.
  const refetch = useCallback(async (): Promise<void> => {
    if (!userId) return;
    await queryClient.refetchQueries({ queryKey: queryKeys.profileData(userId) });
  }, [queryClient, userId]);

  return useMemo(
    () => ({
      favourites: data.favourites,
      setFavourites,
      battle: data.battle,
      contributions: data.contributions,
      taste: data.taste,
      takes: data.takes,
      setTakes,
      // Only the first load is "loading". A background revalidation keeps the
      // previous snapshot on screen, which is what the old implementation did
      // by holding state across refetches.
      loading: query.isPending && !!userId,
      settled: query.isSuccess,
      refetch,
    }),
    [data, setFavourites, setTakes, query.isPending, query.isSuccess, userId, refetch],
  );
}
