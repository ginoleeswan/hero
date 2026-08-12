// src/hooks/useNotificationOptIn.ts — owns the one ask.
//
// The screen says "a daily was just won"; this decides whether that earns the
// pre-prompt, raises it, and records the answer. Every rule lives in
// lib/notifications/policy.ts so it is testable without a device.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOsPermission,
  loadPrefs,
  requestOsPermission,
  savePrefs,
  syncStreakReminder,
} from '../lib/notifications';
import { shouldOfferNotifications } from '../lib/notifications/policy';

export function useNotificationOptIn() {
  const [offering, setOffering] = useState(false);
  // One offer per mount, whatever the caller does. The daily screen re-renders
  // on every guess, and an effect-driven offer would otherwise re-open a sheet
  // the reader just dismissed.
  const spent = useRef(false);

  const considerAfterWin = useCallback(async (streak: number) => {
    if (spent.current) return;
    const [os, prefs] = await Promise.all([getOsPermission(), loadPrefs()]);
    const offer = shouldOfferNotifications({
      os,
      prefs,
      justWonFirstDaily: streak >= 1,
      now: Date.now(),
    });
    if (offer) {
      spent.current = true;
      setOffering(true);
    }
  }, []);

  const allow = useCallback(async () => {
    setOffering(false);
    const os = await requestOsPermission();
    if (os === 'granted') {
      // Schedule immediately: the reader said yes about tonight, so tonight is
      // when it should appear. Waiting for the next app open would skip it.
      await syncStreakReminder({ streak: 1, playedToday: true });
    }
  }, []);

  const dismiss = useCallback(async () => {
    setOffering(false);
    await savePrefs({ softDeclinedAt: Date.now() });
  }, []);

  return { offering, considerAfterWin, allow, dismiss };
}

/**
 * Keeps the on-device streak reminder in step with the daily game's state.
 *
 * Runs on every change rather than only on a win, because the reminder has to
 * be CANCELLED as eagerly as it is scheduled — a reader who plays at 6pm must
 * not be told at 7pm that their streak is on the line.
 */
export function useStreakReminderSync(input: { streak: number; playedToday: boolean }) {
  const { streak, playedToday } = input;
  useEffect(() => {
    void syncStreakReminder({ streak, playedToday });
  }, [streak, playedToday]);
}
