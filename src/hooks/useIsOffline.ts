import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

/**
 * Whether React Query currently considers the device offline.
 *
 * Reads the onlineManager rather than NetInfo directly, deliberately: the
 * manager is the thing that actually governs behaviour (paused queries, resumed
 * refetches), so a banner driven by it can never disagree with what the data
 * layer is doing. It also keeps NetInfo — a native module — out of the web
 * bundle, since on web the manager is fed by the browser's own online/offline
 * events instead. See `src/lib/query/appOnline.ts`.
 */
export function useIsOffline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => !onlineManager.isOnline(),
    // Static-export snapshot. Rendering "offline" into prerendered HTML would
    // flash a false banner on every web page load before hydration.
    () => false,
  );
}
