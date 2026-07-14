import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { getUserFavouriteHeroes, type FavouriteHero } from '../lib/db/favourites';
import { getBattleRecord, type BattleRecord } from '../lib/db/matchupVotes';
import { getMyContributions, type MyContribution } from '../lib/db/contributions';
import { getTasteProfile, type TasteProfile } from '../lib/db/taste';
import { getMyTakes, type MyTake } from '../lib/db/takes';

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
  /** True once ALL four sources have settled (not just favourites). Use this —
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
 * favourites, battle record, contributions, and taste profile. Both
 * `app/(tabs)/profile.tsx` and `profile.web.tsx` consume this so the fetch
 * logic lives once; each view keeps its own refetch trigger (native
 * `useFocusEffect` / pull-to-refresh, web `visibilitychange`).
 *
 * Avatar/cover/display-name editing stays in `useProfile`.
 */
export function useProfileData(userId: string | undefined): ProfileData {
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [battle, setBattle] = useState<BattleRecord | null>(null);
  const [contributions, setContributions] = useState<MyContribution[]>([]);
  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const [takes, setTakes] = useState<MyTake[]>([]);
  const [loading, setLoading] = useState(true);
  const [settled, setSettled] = useState(false);

  const refetch = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    // Fetch all five sources in parallel but apply them as ONE snapshot once
    // every request has settled. Applying each as it landed made the profile
    // sections mount one after another during the initial load (contributions
    // popping in, then takes, …) — a visible layout stagger. One snapshot =
    // one reveal; on refetch the previous data stays up until the new
    // snapshot swaps in, so there's no flicker either.
    const done: Promise<void> = Promise.allSettled([
      getBattleRecord(),
      getTasteProfile(),
      getMyContributions(),
      getMyTakes(userId),
      getUserFavouriteHeroes(userId),
    ]).then(([battleR, tasteR, contribR, takesR, favR]) => {
      // React batches these into a single render. Rejected sources keep their
      // previous value (initial load: the empty default).
      if (battleR.status === 'fulfilled') setBattle(battleR.value);
      if (tasteR.status === 'fulfilled') setTaste(tasteR.value);
      if (contribR.status === 'fulfilled') setContributions(contribR.value);
      setTakes(takesR.status === 'fulfilled' ? takesR.value : []);
      setFavourites(favR.status === 'fulfilled' ? favR.value : []);
      setLoading(false);
      // `settled` flips only once every source has resolved, so consumers can
      // gate full-picture logic (fan tier / milestone nudge) on a complete
      // snapshot.
      setSettled(true);
    });
    return done;
  }, [userId]);

  return {
    favourites,
    setFavourites,
    battle,
    contributions,
    taste,
    takes,
    setTakes,
    loading,
    settled,
    refetch,
  };
}
