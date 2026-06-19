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

  const refetch = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    getBattleRecord()
      .then(setBattle)
      .catch(() => {});
    getTasteProfile()
      .then(setTaste)
      .catch(() => {});
    getMyContributions()
      .then(setContributions)
      .catch(() => {});
    return getUserFavouriteHeroes(userId)
      .then(setFavourites)
      .catch(() => setFavourites([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return { favourites, setFavourites, battle, contributions, taste, loading, refetch };
}
