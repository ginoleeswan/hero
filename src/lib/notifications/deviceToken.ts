// src/lib/notifications/deviceToken.ts — registers this device with Expo Push
// and stores the token, so the daily sender can reach native.
//
// Same authorization shape as src/lib/push.ts on web: the client writes its own
// row through the owner RLS policy, with no edge function in the register path.
// The cron sender reads every row with the service-role key.
//
// Signed-in only, deliberately. A token with no user cannot be matched to a
// favourite, a streak or a debate, so it could only ever receive the generic
// message — and an anonymous row that can never be cleaned up when the person
// signs out is a device we keep notifying with no way to stop.
import { Platform } from 'react-native';
import { supabase } from '../supabase';

/**
 * The row this module writes.
 *
 * `device_push_tokens` is created by
 * supabase/migrations/20260812180000_device_push_tokens.sql, which has NOT been
 * applied yet — so `database.generated.ts` does not know the table and
 * `supabase.from('device_push_tokens')` will not typecheck. That file is
 * generated and must never be hand-edited, so the access goes through a
 * narrowly-typed view of the client instead: the shape below is the contract,
 * stated explicitly rather than inferred.
 *
 * WHEN THE MIGRATION IS APPLIED: regenerate the types and delete `tokensTable`
 * in favour of a plain `supabase.from('device_push_tokens')`. The row type here
 * is what the generated one should match.
 */
interface DevicePushTokenRow {
  token: string;
  user_id: string;
  platform: 'ios' | 'android';
  failed_at: string | null;
}

interface TokensTable {
  upsert: (
    row: DevicePushTokenRow,
    opts: { onConflict: string },
  ) => Promise<{ error: { message: string } | null }>;
  delete: () => {
    eq: (column: 'token', value: string) => Promise<{ error: { message: string } | null }>;
  };
}

const tokensTable = (): TokensTable =>
  (supabase as unknown as { from: (t: string) => TokensTable }).from('device_push_tokens');

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

function isDevice(): boolean {
  try {
    // Lazy by design: a static import would fail at module LOAD on a build
    // without the native module, rather than here where the caller handles it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device') as typeof import('expo-device');
    return Device.isDevice;
  } catch {
    return false;
  }
}

/** The EAS project id the push service addresses tokens against. */
function projectId(): string | undefined {
  try {
    // Lazy by design: a static import would fail at module LOAD on a build
    // without the native module, rather than here where the caller handles it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as typeof import('expo-constants').default;
    return (
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants.easConfig as { projectId?: string } | undefined)?.projectId
    );
  } catch {
    return undefined;
  }
}

export type RegisterResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'unsupported' | 'simulator' | 'no-permission' | 'no-user' | 'error' };

/**
 * Fetch this install's Expo push token and upsert it.
 *
 * Never throws — every caller treats push as a bonus, and a device that cannot
 * register still has its local streak reminder, which needs none of this.
 */
export async function registerDeviceToken(): Promise<RegisterResult> {
  const N = mod();
  if (!N) return { ok: false, reason: 'unsupported' };
  // A simulator has no APNs registration, so requesting a token throws rather
  // than returning one. Checking first keeps the log clean in development.
  if (!isDevice()) return { ok: false, reason: 'simulator' };

  try {
    const { status } = await N.getPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'no-permission' };

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return { ok: false, reason: 'no-user' };

    if (Platform.OS === 'android') {
      // Android needs a channel or nothing is delivered at all — and the
      // channel's importance, not the payload, is what decides whether a
      // notification is allowed to interrupt.
      await N.setNotificationChannelAsync('default', {
        name: 'Daily reminders',
        importance: N.AndroidImportance.DEFAULT,
        lightColor: '#E77333',
      });
    }

    const { data } = await N.getExpoPushTokenAsync({ projectId: projectId() });
    const token = data;
    if (!token) return { ok: false, reason: 'error' };

    const { error } = await tokensTable().upsert(
      {
        token,
        user_id: userId,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        failed_at: null,
      },
      { onConflict: 'token' },
    );
    if (error) return { ok: false, reason: 'error' };
    return { ok: true, token };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/**
 * Drop this device's row.
 *
 * Called when notifications are switched off and on sign-out. Without it a
 * signed-out device keeps receiving another account's personalized nudges,
 * which is both wrong and unfixable from the reader's side.
 */
export async function unregisterDeviceToken(): Promise<void> {
  const N = mod();
  if (!N || !isDevice()) return;
  try {
    const { data } = await N.getExpoPushTokenAsync({ projectId: projectId() });
    if (!data) return;
    await tokensTable().delete().eq('token', data);
  } catch {
    /* nothing registered, or offline — the row is pruned on first
       DeviceNotRegistered from the sender either way */
  }
}
