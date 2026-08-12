// Recently-viewed characters, in two layers.
//
// The server calendar (`user_view_history`) is the durable one: it follows an
// account across devices and survives a reinstall. It is also, on its own,
// unreachable for most of the people using this app — browsing is deliberately
// open, there is no login wall in front of the catalogue, and a logged-out
// reader who spent ten minutes on characters got an empty Recently Viewed rail
// on Explore and an empty Search landing, because every read was keyed on
// `user_id`. The app was declining to remember what it had just shown.
//
// So every view is ALSO mirrored to a local, ordered list of hero ids, written
// whether or not there is a session. Signed out that list is the whole answer.
// Signed in the two are merged, local first, because the local one is
// authoritative about the last few seconds and the server about the last few
// months.
//
// The mirror holds ids only — hydrating them is one `in()` query the callers
// already make, and storing hero rows would mean a cache that goes stale
// against the catalogue.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import type { FavouriteHero } from '../../types';

const LOCAL_KEY = 'viewHistory:v1';
/** Enough to outlast any surface's limit without growing without bound. */
const LOCAL_CAP = 60;

async function readLocal(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Most recent first, deduped, capped. */
async function pushLocal(heroId: string): Promise<void> {
  try {
    const prev = await readLocal();
    const next = [heroId, ...prev.filter((id) => id !== heroId)].slice(0, LOCAL_CAP);
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {
    /* a lost view is cosmetic */
  }
}

/**
 * Record a view. The local mirror is written for everyone; the server row only
 * when signed in. Fire-and-forget on both counts — this runs on the character
 * screen's mount and must never throw into it.
 */
export async function recordView(userId: string | null | undefined, heroId: string): Promise<void> {
  await pushLocal(heroId);
  if (!userId) return;
  await supabase
    .from('user_view_history')
    .upsert(
      { user_id: userId, hero_id: heroId, viewed_at: new Date().toISOString() },
      { onConflict: 'user_id,hero_id' },
    );
  // Intentionally swallow errors — fire-and-forget
}

/** The server's ids, newest first. Empty when logged out or on any failure. */
async function readServer(userId: string, limit: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_view_history')
    .select('hero_id')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r) => r.hero_id).filter((id): id is string => id !== null);
}

/**
 * Recently-viewed characters, newest first. Works signed out.
 *
 * Order is preserved through the hydration deliberately: PostgREST returns the
 * `in()` rows in whatever order it likes, and a "recently viewed" rail whose
 * order is arbitrary is not a recently-viewed rail.
 */
export async function getRecentlyViewed(
  userId: string | null | undefined,
  limit = 15,
): Promise<FavouriteHero[]> {
  const local = await readLocal();
  const server = userId ? await readServer(userId, limit) : [];
  const seen = new Set<string>();
  const heroIds: string[] = [];
  for (const id of [...local, ...server]) {
    if (seen.has(id)) continue;
    seen.add(id);
    heroIds.push(id);
    if (heroIds.length >= limit) break;
  }
  if (heroIds.length === 0) return [];

  const { data, error } = await supabase
    .from('heroes')
    .select('id, name, image_url, portrait_url')
    .in('id', heroIds);
  if (error) throw error;

  const heroMap = new Map(
    (data ?? []).map((h) => [
      h.id as string,
      {
        id: h.id,
        name: h.name,
        image_url: h.image_url,
        portrait_url: h.portrait_url,
      } as FavouriteHero,
    ]),
  );
  return heroIds.map((id) => heroMap.get(id)).filter((h): h is FavouriteHero => h !== undefined);
}
