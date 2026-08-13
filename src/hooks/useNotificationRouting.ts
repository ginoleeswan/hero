// src/hooks/useNotificationRouting.ts — a tapped notification has to land
// somewhere specific.
//
// Every notification the app sends carries `data.url` (a route path). Without a
// handler the tap just foregrounds the app on whatever screen it was last on,
// which reads as the notification having done nothing — the reader came for the
// thing you promised and got the tab they left open.
//
// Two entry points matter and both must be handled:
//   • tapped while running (or backgrounded) → the response listener
//   • tapped from cold, launching the app     → the LAST response, read once at
//     startup. Miss this one and the deep link works only when the app happens
//     to already be alive, which is the case you notice least in testing.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { track } from '../lib/analytics';
import { pathKind } from '../lib/analytics/events';

type NotificationsModule = typeof import('expo-notifications');

function mod(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // Lazy by design: a static import would fail at module LOAD on a build
    // without the native module, rather than here where the caller handles it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/** Only in-app paths, and only ones we recognise — a payload is untrusted input. */
function safePath(data: unknown): string | null {
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== 'string') return null;
  // Must be a rooted in-app path. Anything absolute (or protocol-relative)
  // would be an open redirect out of the app via a push payload.
  if (!url.startsWith('/') || url.startsWith('//')) return null;
  return url;
}

export function useNotificationRouting() {
  const router = useRouter();
  // The cold-start response is delivered every time the listener mounts, so
  // without this it re-navigates on any remount (a fast refresh, a re-login).
  const coldStartHandled = useRef(false);

  useEffect(() => {
    const N = mod();
    if (!N) return;

    const go = (data: unknown, coldStart: boolean) => {
      const path = safePath(data);
      if (!path) return;
      track('deep_link_opened', { path_kind: pathKind(path), cold_start: coldStart });
      router.push(path as Parameters<typeof router.push>[0]);
    };

    // Cold start: whatever tap launched us, once.
    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      void N.getLastNotificationResponseAsync()
        .then((res) => {
          if (res) go(res.notification.request.content.data, true);
        })
        .catch(() => {});
    }

    const sub = N.addNotificationResponseReceivedListener((res) => {
      go(res.notification.request.content.data, false);
    });
    return () => sub.remove();
  }, [router]);
}

/**
 * How a notification behaves when it arrives with the app already open.
 *
 * Shown, deliberately. The alternative — swallowing it because "they're already
 * here" — means a reader who is on the profile tab when the daily reminder
 * fires never learns it fired, and the streak they were reminded about breaks
 * anyway. Registered once, at the root.
 */
export function configureNotificationHandler(): void {
  const N = mod();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    /* no native module */
  }
}
