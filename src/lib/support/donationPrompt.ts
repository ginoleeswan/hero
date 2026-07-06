import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tierRank } from '../profile/fanTier';

export interface DonationPromptState {
  lastShownAt: number | null;
  lastDismissedAt: number | null;
  lastConvertedAt: number | null;
  lastSeenTier: string | null;
  seenBadgeIds: string[];
}

export const MIN_DAYS_BETWEEN_SHOWS = 30;
export const BACKOFF_DAYS_AFTER_ACTION = 90;
const DAY = 86_400_000;
const KEY = 'mythique.donationPrompt.v1';

export const DEFAULT_STATE: DonationPromptState = {
  lastShownAt: null,
  lastDismissedAt: null,
  lastConvertedAt: null,
  lastSeenTier: null,
  seenBadgeIds: [],
};

/** Very gentle: ≥30d since any show, ≥90d since a dismiss or convert. */
export function shouldPrompt(state: DonationPromptState, now: number): boolean {
  const sinceShown = state.lastShownAt == null ? Infinity : now - state.lastShownAt;
  const lastAction = Math.max(
    state.lastDismissedAt ?? -Infinity,
    state.lastConvertedAt ?? -Infinity,
  );
  const sinceAction = lastAction === -Infinity ? Infinity : now - lastAction;
  return (
    sinceShown >= MIN_DAYS_BETWEEN_SHOWS * DAY && sinceAction >= BACKOFF_DAYS_AFTER_ACTION * DAY
  );
}

/** Which new milestone fired (if any). Null-tier prev = first-run seed → never fires. */
export function detectMilestone(
  prev: Pick<DonationPromptState, 'lastSeenTier' | 'seenBadgeIds'>,
  current: { tier: string; earnedBadgeIds: string[] },
): 'tier' | 'badge' | null {
  if (prev.lastSeenTier === null) return null;
  if (tierRank(current.tier) > tierRank(prev.lastSeenTier)) return 'tier';
  const prevSet = new Set(prev.seenBadgeIds);
  if (current.earnedBadgeIds.some((id) => !prevSet.has(id))) return 'badge';
  return null;
}

// ── Cross-platform storage (mirrors supabase.ts SSR guard) ───────────────────
function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(null);
    return Promise.resolve(window.localStorage.getItem(key));
  }
  return AsyncStorage.getItem(key);
}
function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve();
    window.localStorage.setItem(key, value);
    return Promise.resolve();
  }
  return AsyncStorage.setItem(key, value);
}

export async function loadPromptState(): Promise<DonationPromptState> {
  try {
    const raw = await getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<DonationPromptState>;
    return { ...DEFAULT_STATE, ...parsed, seenBadgeIds: parsed.seenBadgeIds ?? [] };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function savePromptState(patch: Partial<DonationPromptState>): Promise<void> {
  try {
    const current = await loadPromptState();
    await setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Best-effort; a failed write just means we may ask again sooner.
  }
}
