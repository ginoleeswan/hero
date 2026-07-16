// The streak number for home-screen surfaces (the Explore banner, the dailies
// hub) without pulling in the whole game hook. Two sources, merged:
//   - local: the on-device puzzle streak (works logged out — the original).
//   - server: the signed-in cross-surface daily streak (get_my_daily_streak),
//     which counts puzzle OR debate vote OR team-battle vote per UTC day.
// We show max(local, server) so a signed-in player whose local puzzle history
// predates the server calendar never sees their number drop on upgrade.
// Refreshes on focus, so a streak earned today shows up on return.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_STREAK, type StreakState } from '../lib/game/streak';
import { getMyDailyStreak } from '../lib/db/dailies';

const STREAK_KEY = 'dh_streak_v1';

export function useDailyStreak(): number {
  const [current, setCurrent] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const localP = AsyncStorage.getItem(STREAK_KEY)
        .then((raw) => {
          if (!raw) return 0;
          const s = JSON.parse(raw) as StreakState;
          return s?.current ?? EMPTY_STREAK.current;
        })
        .catch(() => 0);
      const serverP = getMyDailyStreak()
        .then((s) => s.current)
        .catch(() => 0);
      Promise.all([localP, serverP]).then(([local, server]) => {
        if (active) setCurrent(Math.max(local, server));
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return current;
}
