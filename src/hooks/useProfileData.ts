import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { getUserFavouriteHeroes, type FavouriteHero } from '../lib/db/favourites';
import { getBattleRecord, type BattleRecord } from '../lib/db/matchupVotes';
import { getMyContributions, type MyContribution } from '../lib/db/contributions';
import { getTasteProfile, type TasteProfile } from '../lib/db/taste';

export interface ProfileData {
  favourites: FavouriteHero[];
  /** Exposed so the views can optimistically drop a hero on un-favourite. */
  setFavourites: Dispatch<SetStateAction<FavouriteHero[]>>;
  battle: BattleRecord | null;
  contributions: MyContribution[];
  taste: TasteProfile | null;
  loading: boolean;
  /** True once ALL four sources have settled (not just favourites). Use this —
   *  not `loading` — to gate anything that reads the full picture (e.g. the fan
   *  tier / milestone detector), so it never runs on a partially-loaded snapshot. */
  settled: boolean;
  /** Re-fetch all profile data. Resolves when the favourites fetch settles, so
   *  callers can drive their own pull-to-refresh spinner off the promise. */
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
  const [loading, setLoading] = useState(true);
  const [settled, setSettled] = useState(false);

  const refetch = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    const battleP = getBattleRecord()
      .then(setBattle)
      .catch(() => {});
    const tasteP = getTasteProfile()
      .then(setTaste)
      .catch(() => {});
    const contribP = getMyContributions()
      .then(setContributions)
      .catch(() => {});
    const favP = getUserFavouriteHeroes(userId)
      .then(setFavourites)
      .catch(() => setFavourites([]))
      .finally(() => setLoading(false));
    // `settled` flips only once every source has resolved, so consumers can gate
    // full-picture logic (fan tier / milestone nudge) on a complete snapshot.
    void Promise.allSettled([battleP, tasteP, contribP, favP]).then(() => setSettled(true));
    return favP;
  }, [userId]);

  return { favourites, setFavourites, battle, contributions, taste, loading, settled, refetch };
}
