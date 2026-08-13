// src/lib/notifications/index.ts — the device side of notifications.
//
// Everything here is a no-op off native. expo-notifications has no meaningful
// web implementation for our purposes (the browser channel is Web Push, which
// lives in src/lib/push.ts and is a different system entirely), so rather than
// a .web sibling this module guards on Platform and returns the inert answer.
// One import site, no branching at the call sites.
//
// The module is also lazy: expo-notifications is only `require`d inside the
// functions that need it. A dev client without the native module then fails at
// the call rather than at import, which keeps the app bootable — the same
// reason shareMatchupImage imports expo-sharing lazily.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_PREFS,
  nextStreakReminderAt,
  streakReminderActive,
  streakReminderBody,
  type NotificationPrefs,
  type OsPermission,
} from './policy';

const PREFS_KEY = 'notif_prefs_v1';
/** One identifier, so re-scheduling replaces rather than stacks. */
const STREAK_REMINDER_ID = 'daily-streak-reminder';

const isNative = Platform.OS !== 'web';

type NotificationsModule = typeof import('expo-notifications');

function mod(): NotificationsModule | null {
  if (!isNative) return null;
  try {
    return require('expo-notifications') as NotificationsModule;
  } catch {
    // Native module absent (Expo Go, or a build predating the dependency).
    return null;
  }
}

// ── preferences ───────────────────────────────────────────────────────────────

export async function loadPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  const next = { ...(await loadPrefs()), ...patch };
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // A device that cannot persist the preference still gets the session's
    // behaviour; losing it is better than failing the toggle.
  }
  return next;
}

// ── OS permission ─────────────────────────────────────────────────────────────

export async function getOsPermission(): Promise<OsPermission> {
  const N = mod();
  if (!N) return 'denied';
  try {
    const { status } = await N.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'denied';
  }
}

/**
 * Raise the real OS prompt. Records that the ask was spent whatever the answer,
 * because iOS will not show it a second time and pretending otherwise would let
 * the app keep offering a pre-prompt that leads nowhere.
 */
export async function requestOsPermission(): Promise<OsPermission> {
  const N = mod();
  if (!N) return 'denied';
  try {
    const { status } = await N.requestPermissionsAsync();
    const os: OsPermission =
      status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
    await savePrefs({
      askedAt: Date.now(),
      ...(os === 'granted' ? { enabledAt: Date.now() } : {}),
    });
    return os;
  } catch {
    return 'denied';
  }
}

// ── local streak reminder ─────────────────────────────────────────────────────

/**
 * Put today's streak reminder on the device, or take it off.
 *
 * Always cancels first. The reminder is re-evaluated whenever the daily state
 * changes, and without the cancel a reader who plays after it was scheduled
 * still gets told their streak is on the line — the single most corrosive
 * notification an app can send, because it is provably wrong and they know it.
 */
export async function syncStreakReminder(input: {
  streak: number;
  playedToday: boolean;
  now?: Date;
}): Promise<'scheduled' | 'cancelled' | 'unavailable'> {
  const N = mod();
  if (!N) return 'unavailable';
  try {
    await N.cancelScheduledNotificationAsync(STREAK_REMINDER_ID).catch(() => {});

    const [prefs, os] = await Promise.all([loadPrefs(), getOsPermission()]);
    if (!streakReminderActive(os, prefs)) return 'cancelled';

    const at = nextStreakReminderAt({
      now: input.now ?? new Date(),
      streak: input.streak,
      playedToday: input.playedToday,
    });
    if (!at) return 'cancelled';

    const { title, body } = streakReminderBody(input.streak);
    await N.scheduleNotificationAsync({
      identifier: STREAK_REMINDER_ID,
      content: { title, body, data: { url: '/play' } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at },
    });
    return 'scheduled';
  } catch {
    return 'unavailable';
  }
}

/** Used when the reader turns notifications off — nothing should survive it. */
export async function cancelAllScheduled(): Promise<void> {
  const N = mod();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch {
    /* nothing scheduled, or no native module */
  }
}

export { DEFAULT_PREFS, type NotificationPrefs, type OsPermission };
