import AsyncStorage from '@react-native-async-storage/async-storage';

export const VOTER_KEY_STORAGE_KEY = 'mythique.voterKey';

let cached: string | null = null;

/** Stable anonymous participant id for votes/agreements. Not a security
 *  boundary — a dedup key for a fun poll. auth users are keyed server-side
 *  by uid; this key is only consulted when logged out. */
export async function getVoterKey(): Promise<string> {
  if (cached) return cached;
  const existing = await AsyncStorage.getItem(VOTER_KEY_STORAGE_KEY).catch(() => null);
  if (existing && existing.length >= 8) {
    cached = existing;
    return existing;
  }
  const fresh = `vk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  cached = fresh;
  AsyncStorage.setItem(VOTER_KEY_STORAGE_KEY, fresh).catch(() => {});
  return fresh;
}
