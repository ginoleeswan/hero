// src/lib/review/index.ts — the device side of the rating ask.
//
// Same shape as lib/notifications/index.ts: everything is a no-op off native,
// expo-store-review is `require`d lazily so a dev client without the native
// module fails at the call rather than at import, and every rule lives in
// ./policy.ts where it can be tested without a device.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_REVIEW_PREFS,
  recordAsk,
  shouldRequestReview,
  type ReviewPrefs,
  type ReviewTrigger,
} from './policy';

const PREFS_KEY = 'review_prefs_v1';
const isNative = Platform.OS !== 'web';

type StoreReviewModule = typeof import('expo-store-review');

function mod(): StoreReviewModule | null {
  if (!isNative) return null;
  try {
    // Lazy by design: a static import would fail at module LOAD on a build
    // without the native module, rather than here where the caller handles it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-store-review') as StoreReviewModule;
  } catch {
    return null;
  }
}

export async function loadReviewPrefs(): Promise<ReviewPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_REVIEW_PREFS;
    return { ...DEFAULT_REVIEW_PREFS, ...(JSON.parse(raw) as Partial<ReviewPrefs>) };
  } catch {
    return DEFAULT_REVIEW_PREFS;
  }
}

async function saveReviewPrefs(next: ReviewPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // A device that cannot persist this asks again next season at worst.
  }
}

/**
 * Stamp the first-open time if it is not already known.
 *
 * Called from the root so the grace period is measured from a real first open
 * rather than from whenever the reader first happened to reach a trigger — an
 * unstamped install would otherwise look brand new forever and never ask.
 */
export async function noteAppOpened(now = Date.now()): Promise<void> {
  const prefs = await loadReviewPrefs();
  if (prefs.firstSeenAt !== null) return;
  await saveReviewPrefs({ ...prefs, firstSeenAt: now });
}

/** How many arena battles this device has finished. Cheap, local, no account. */
const ARENA_COUNT_KEY = 'review_arena_finished_v1';

export async function noteArenaFinished(): Promise<number> {
  try {
    const n = Number((await AsyncStorage.getItem(ARENA_COUNT_KEY)) ?? '0') + 1;
    await AsyncStorage.setItem(ARENA_COUNT_KEY, String(n));
    return n;
  } catch {
    return 0;
  }
}

export async function arenaFinishedCount(): Promise<number> {
  try {
    return Number((await AsyncStorage.getItem(ARENA_COUNT_KEY)) ?? '0');
  } catch {
    return 0;
  }
}

/**
 * Ask, if the moment has earned it. Returns whether the sheet was requested.
 *
 * `true` does NOT mean a review sheet appeared: iOS resolves `requestReview()`
 * identically whether it showed the sheet or silently dropped it against its
 * own yearly cap, and it exposes no way to tell. So the ask is recorded as
 * spent either way — the alternative is to treat a swallowed ask as unspent and
 * retry it, which is how an app burns all three slots in a fortnight.
 */
export async function maybeRequestReview(input: {
  trigger: ReviewTrigger;
  streak: number;
  arenaFinished: number;
  blocked: boolean;
  now?: number;
}): Promise<boolean> {
  const now = input.now ?? Date.now();
  const prefs = await loadReviewPrefs();
  if (!shouldRequestReview({ ...input, prefs, now })) return false;

  const S = mod();
  if (!S) return false;
  try {
    if (!(await S.hasAction())) return false;
    await saveReviewPrefs(recordAsk(prefs, now));
    await S.requestReview();
    return true;
  } catch {
    return false;
  }
}

export { DEFAULT_REVIEW_PREFS, type ReviewPrefs, type ReviewTrigger };
