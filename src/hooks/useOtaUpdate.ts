import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

// Don't re-check more often than this. Returning to the app is a frequent
// event — someone flicking between Mythique and Messages would otherwise fire a
// manifest request every few seconds for no benefit.
const MIN_CHECK_INTERVAL_MS = 60_000;

/**
 * Surfaces a downloaded-and-staged OTA update, and applies it on request.
 *
 * The gap this fills: expo-updates checks once, at launch, and downloads in the
 * background. The downloaded update then sits there until the *next* cold
 * start. So a user who has the app open when an update lands keeps running the
 * old JS, sees no sign that anything happened, and has to fully quit and reopen
 * — twice, if the download hadn't finished the first time. Nothing in the app
 * called any of the expo-updates APIs at all before this.
 *
 * The deliberate choice here is to prompt rather than auto-reload. Calling
 * `reloadAsync()` the moment an update is pending — which is what the
 * expo-updates docs example does — restarts the app under the user, discarding
 * whatever they were in the middle of. Fine in a demo, hostile in a real one.
 */
export function useOtaUpdate() {
  const { isUpdatePending } = Updates.useUpdates();
  const [applying, setApplying] = useState(false);
  const lastCheck = useRef(0);

  // Re-check when the app comes back to the front. Without this, a session that
  // stays alive for days never learns about anything published after launch.
  useEffect(() => {
    if (!Updates.isEnabled) return;

    const check = async () => {
      const now = Date.now();
      if (now - lastCheck.current < MIN_CHECK_INTERVAL_MS) return;
      lastCheck.current = now;
      try {
        const result = await Updates.checkForUpdateAsync();
        // fetchUpdateAsync only stages it — `isUpdatePending` flips as a result,
        // which is what shows the prompt. It does not restart anything.
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline, or the manifest endpoint is unhappy. Silence is correct:
        // failing to find an update is not a thing to tell the user about.
      }
    };

    const onChange = (status: AppStateStatus) => {
      if (status === 'active') void check();
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  const apply = useCallback(async () => {
    setApplying(true);
    try {
      await Updates.reloadAsync();
    } catch {
      // If the reload fails the app is still perfectly usable on the old
      // bundle, so drop the spinner and leave the prompt up to try again.
      setApplying(false);
    }
  }, []);

  return {
    // `isEnabled` is false in Expo Go and when running off a dev server, where
    // a "restart to update" prompt would be nonsense.
    ready: Updates.isEnabled && isUpdatePending,
    applying,
    apply,
  };
}
