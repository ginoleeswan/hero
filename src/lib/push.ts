import { supabase } from './supabase';

// Web Push client (daily-debate re-engagement). Web-only in practice — every
// function guards on browser support and no-ops elsewhere, so the platform-
// neutral Settings screen can call these without a .web split. Subscriptions
// are written straight to push_subscriptions via supabase-js (RLS owner policy),
// so no edge function is needed for subscribe/unsubscribe.

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

export type PushState = 'subscribed' | 'unsubscribed' | 'denied' | 'unsupported';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!VAPID_PUBLIC_KEY
  );
}

// VAPID public keys are base64url; the Push API wants a Uint8Array.
// Exported for unit testing (the trickiest bit of the flow).
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Current subscription state for the toggle. Never throws. */
export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

/**
 * Request permission, subscribe via the SW, and upsert the row for this user.
 * Returns the resulting state (or an error string). Requires a signed-in user id.
 */
export async function subscribeToPush(userId: string): Promise<{ error: string | null }> {
  if (!isPushSupported()) return { error: 'Push notifications are not supported here.' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { error: 'Notifications are blocked.' };

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast: TS's DOM lib wants a BufferSource over a plain ArrayBuffer; our
      // Uint8Array is exactly that at runtime.
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string) as BufferSource,
    });

    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!sub.endpoint || !p256dh || !auth) return { error: 'Could not read the subscription.' };

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: userId, endpoint: sub.endpoint, p256dh, auth },
        { onConflict: 'endpoint' },
      );
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Subscribe failed.' };
  }
}

/** Unsubscribe from the browser and delete the row. Never throws. */
export async function unsubscribeFromPush(): Promise<{ error: string | null }> {
  if (!isPushSupported()) return { error: null };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { error: null };
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return { error: error ? error.message : null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unsubscribe failed.' };
  }
}
