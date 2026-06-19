// Reads the locally-stored daily-game streak so home-screen surfaces (the
// Explore banner) can show it without pulling in the whole game hook. Refreshes
// whenever the screen regains focus, so a streak earned today shows up on
// return without a reload.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_STREAK, type StreakState } from '../lib/game/streak';

const STREAK_KEY = 'dh_streak_v1';

export function useDailyStreak(): number {
  const [current, setCurrent] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(STREAK_KEY)
        .then((raw) => {
          if (!active || !raw) return;
          const s = JSON.parse(raw) as StreakState;
          setCurrent(s?.current ?? EMPTY_STREAK.current);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  return current;
}
