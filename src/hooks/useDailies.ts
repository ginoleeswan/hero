// Today's dailies state for the Arena ledger: which of the three surfaces are
// done today, plus the signed-in cross-surface streak.
//
// Refetches on focus so ticks light up when the player returns from a completed
// daily — AND subscribes to the completion mirror, because the debate is voted
// ON this screen. Focus alone meant the row you had just satisfied kept saying
// OPEN until you left the tab and came back.
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getMyDailyStreak, subscribeToDailies, type DailyStreak } from '../lib/db/dailies';

const EMPTY: DailyStreak = {
  current: 0,
  longest: 0,
  today: { puzzle: false, debate: false, team_battle: false },
  tracked: false,
};

export function useDailies(): DailyStreak {
  const [state, setState] = useState<DailyStreak>(EMPTY);
  const [nonce, setNonce] = useState(0);

  useEffect(() => subscribeToDailies(() => setNonce((n) => n + 1)), []);

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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nonce]),
  );

  return state;
}
