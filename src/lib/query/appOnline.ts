// src/lib/query/appOnline.ts — teach React Query when the device has a network.
//
// The sibling of `appFocus.ts`. React Query decides whether it is "online" from
// the browser's `navigator.onLine` plus online/offline events. On React Native
// none of that exists, so the onlineManager sits permanently on its default of
// `true` and the library behaves as if every request should succeed.
//
// That default is not harmless. When a phone loses signal, fetches don't fail
// fast — they hang until the OS times them out, retry twice (queryClient sets
// `retry: 2`), and only then surface an error. The user watches a spinner for
// tens of seconds and is told nothing. Worse, nothing refetches when signal
// comes back, because React Query never learned it had gone.
//
// With this wired, React Query pauses queries while offline (`fetchStatus:
// 'paused'`, which is what `useIsOffline` below surfaces to the UI) and resumes
// them the moment connectivity returns — no spinner marathon, no manual pull to
// refresh.
//
// NetInfo is a native module, so unlike `appFocus.ts` this cannot ship over the
// air: a binary without it will crash on the import. It landed together with
// the EAS build that includes it.
import { Platform } from 'react-native';
import { onlineManager } from '@tanstack/react-query';

interface NetInfoState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}

/**
 * Returns an unsubscribe. Web is left alone — the browser's own online/offline
 * events are exactly what React Query expects there, and replacing them with
 * NetInfo's polling would be strictly worse.
 */
export function startAppOnlineTracking(): () => void {
  if (Platform.OS === 'web') return () => {};

  // Required lazily so the web bundle never reaches for the native module —
  // and inside a try, because this file ships over the air while the module it
  // needs does not. An update carrying this code can legitimately land on an
  // older binary that predates the NetInfo build (same runtimeVersion, same
  // channel, so expo-updates considers them compatible). Throwing there would
  // take the whole app down on launch, which is far worse than the problem this
  // file exists to solve. Degrade to React Query's old always-online default
  // instead: queries just try, exactly as before.
  let NetInfo: { addEventListener: (cb: (s: NetInfoState) => void) => () => void };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NetInfo = require('@react-native-community/netinfo').default;
    if (!NetInfo?.addEventListener) return () => {};
  } catch {
    return () => {};
  }

  // `setEventListener` returns void — the manager keeps the cleanup the setup
  // function hands back, but never gives it to us. So hold the NetInfo
  // subscription here to honour this function's own unsubscribe contract (and
  // match `startAppFocusTracking`, whose call site expects one).
  let unsubscribeNetInfo: (() => void) | undefined;

  onlineManager.setEventListener((setOnline) => {
    unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      // `isInternetReachable` is the honest signal — it distinguishes "joined a
      // wifi network" from "that wifi actually routes anywhere", which is the
      // captive-portal / hotel-wifi case. It is null while NetInfo is still
      // determining reachability, and treating that null as offline would
      // wrongly pause every query during the first moments after launch, so it
      // falls back to `isConnected`.
      setOnline(state.isInternetReachable ?? state.isConnected ?? true);
    });
    return () => unsubscribeNetInfo?.();
  });

  return () => unsubscribeNetInfo?.();
}
