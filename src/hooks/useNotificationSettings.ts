// src/hooks/useNotificationSettings.ts — the state behind the settings rows.
//
// Three states have to be distinguishable, because the right control differs
// for each and showing a dead switch is worse than showing nothing:
//
//   undetermined  the OS has never been asked. A switch CAN turn this on,
//                 because flipping it raises the real prompt.
//   granted       the OS said yes. The switch is ours to honour.
//   denied        the OS said no, and iOS will not ask again. A switch here
//                 would do nothing when flipped, so the row becomes a link
//                 into system Settings instead — the only place it can change.
import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import {
  DEFAULT_PREFS,
  cancelAllScheduled,
  getOsPermission,
  loadPrefs,
  requestOsPermission,
  savePrefs,
  syncStreakReminder,
  type NotificationPrefs,
  type OsPermission,
} from '../lib/notifications';
import { notificationsActive } from '../lib/notifications/policy';
import { registerDeviceToken, unregisterDeviceToken } from '../lib/notifications/deviceToken';

export function useNotificationSettings(input?: { streak?: number; playedToday?: boolean }) {
  const [os, setOs] = useState<OsPermission>('undetermined');
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [nextOs, nextPrefs] = await Promise.all([getOsPermission(), loadPrefs()]);
    setOs(nextOs);
    setPrefs(nextPrefs);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enabled = notificationsActive(os, prefs);

  /** The master switch. Turning it on may raise the OS prompt. */
  const setEnabled = useCallback(
    async (next: boolean) => {
      setBusy(true);
      try {
        if (!next) {
          // Off means off: drop our flag AND clear anything already queued, or
          // a reminder scheduled an hour ago still arrives after the switch.
          const p = await savePrefs({ enabledAt: null });
          await cancelAllScheduled();
          // Drop the server's route to this device too. Cancelling local
          // schedules alone would leave the daily push arriving from the cron.
          await unregisterDeviceToken();
          setPrefs(p);
          return;
        }
        let nextOs = os;
        if (os === 'undetermined') nextOs = await requestOsPermission();
        setOs(nextOs);
        if (nextOs !== 'granted') {
          // The prompt was declined. Leave the switch off rather than showing
          // it on over a permission we do not have.
          setPrefs(await loadPrefs());
          return;
        }
        const p = await savePrefs({ enabledAt: Date.now() });
        setPrefs(p);
        // Best-effort: the local reminder works without a token, so a failed
        // registration must not fail the toggle.
        void registerDeviceToken();
        await syncStreakReminder({
          streak: input?.streak ?? 0,
          playedToday: input?.playedToday ?? false,
        });
      } finally {
        setBusy(false);
      }
    },
    [os, input?.streak, input?.playedToday],
  );

  const setStreakReminder = useCallback(
    async (next: boolean) => {
      const p = await savePrefs({ streakReminder: next });
      setPrefs(p);
      await syncStreakReminder({
        streak: input?.streak ?? 0,
        playedToday: input?.playedToday ?? false,
      });
    },
    [input?.streak, input?.playedToday],
  );

  /** The only route back from a denial. */
  const openSystemSettings = useCallback(() => {
    void Linking.openSettings().catch(() => {});
  }, []);

  return {
    /** False off native — there is nothing to configure there. */
    supported: Platform.OS !== 'web',
    ready,
    busy,
    os,
    prefs,
    enabled,
    setEnabled,
    setStreakReminder,
    openSystemSettings,
    refresh,
  };
}
