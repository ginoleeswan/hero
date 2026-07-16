// Today's dailies state for the hub strip: the signed-in cross-surface streak
// + which of the three surfaces are done today. Refetches on focus so checks
// light up when the player returns from a completed daily. Logged out it
// resolves to zeros/unchecked (the strip still works as a launcher).
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getMyDailyStreak, type DailyStreak } from '../lib/db/dailies';

const EMPTY: DailyStreak = {
  current: 0,
  longest: 0,
  today: { puzzle: false, debate: false, team_battle: false },
};

export function useDailies(): DailyStreak {
  const [state, setState] = useState<DailyStreak>(EMPTY);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getMyDailyStreak()
        .then((s) => {
          if (active) setState(s);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  return state;
}
