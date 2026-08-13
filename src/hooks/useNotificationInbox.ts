// src/hooks/useNotificationInbox.ts — fetches the three signals the inbox is
// derived from and hands them to the pure builder.
//
// Every rule about what to show, and more importantly what to stay quiet about,
// lives in lib/notifications/inbox.ts. This hook only gathers.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './useAuth';
import { getMyTakes } from '../lib/db/takes';
import { getYesterdayResult, yesterdayIso, todayIso } from '../lib/db/dailyDebate';
import { getHeroesByIds } from '../lib/db/heroes';
import {
  EMPTY_SEEN,
  buildInbox,
  markSeen,
  unreadCount,
  type InboxItem,
  type InboxSeen,
} from '../lib/notifications/inbox';
import { type StreakState } from '../lib/game/streak';

const SEEN_KEY = 'inbox_seen_v1';
/** The daily game's own streak store — read, never written, from here. */
const STREAK_KEY = 'dh_streak_v1';

async function loadSeen(): Promise<InboxSeen> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return EMPTY_SEEN;
    return { ...EMPTY_SEEN, ...(JSON.parse(raw) as Partial<InboxSeen>) };
  } catch {
    return EMPTY_SEEN;
  }
}

async function loadStreak(): Promise<StreakState | null> {
  try {
    const raw = await AsyncStorage.getItem(STREAK_KEY);
    return raw ? (JSON.parse(raw) as StreakState) : null;
  } catch {
    return null;
  }
}

export function useNotificationInbox() {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seen, setSeen] = useState<InboxSeen>(EMPTY_SEEN);
  const [yesterdayDate, setYesterdayDate] = useState<string | null>(null);
  const [brokenStreak, setBrokenStreak] = useState<number | null>(null);
  const [takeCounts, setTakeCounts] = useState<{ id: string; agreeCount: number }[]>([]);
  // The clock the list renders relative times against. Captured here, inside
  // the load, because calling Date.now() during render is an impure call and
  // React 19's lint rule rightly refuses it.
  const [builtAt, setBuiltAt] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [currentSeen, streak, yesterday] = await Promise.all([
        loadSeen(),
        loadStreak(),
        getYesterdayResult(),
      ]);
      const myTakes = user ? await getMyTakes(user.id) : [];

      // A streak is "broken" when the last recorded day is older than
      // yesterday — the daily store only writes on a played day, so a gap is
      // the signal. `current` is already 0 by then, hence `max` for the value
      // that was lost.
      const yIso = yesterdayIso();
      const broken =
        !!streak && streak.lastDate !== null && streak.lastDate < yIso && streak.current === 0;

      let yesterdayInput = null as Parameters<typeof buildInbox>[0]['yesterday'];
      if (yesterday) {
        const heroes = await getHeroesByIds([yesterday.heroAId, yesterday.heroBId]);
        const nameOf = (id: string) => heroes.find((h) => h.id === id)?.name ?? 'a hero';
        yesterdayInput = {
          date: yIso,
          nameA: nameOf(yesterday.heroAId),
          nameB: nameOf(yesterday.heroBId),
          votesA: yesterday.finalVotesA,
          votesB: yesterday.finalVotesB,
          // The crowned take carries a display name, not an id, so ownership is
          // matched on the reader's own takes for that pair rather than assumed.
          myTakeCrowned:
            !!yesterday.topTake &&
            myTakes.some(
              (t) =>
                t.body === yesterday.topTake?.body &&
                (t.heroAId === yesterday.heroAId || t.heroBId === yesterday.heroAId),
            ),
        };
      }

      const lostStreak = broken && streak ? streak.max : null;
      const now = Date.now();
      const built = buildInbox({
        seen: currentSeen,
        now,
        myTakes: myTakes.map((t) => ({
          id: t.id,
          heroAId: t.heroAId,
          heroBId: t.heroBId,
          agreeCount: t.agreeCount,
          createdAt: t.createdAt,
        })),
        yesterday: yesterdayInput,
        streak: lostStreak ? { previous: lostStreak, broken: true } : null,
      });

      setSeen(currentSeen);
      setYesterdayDate(yesterdayInput ? yesterdayInput.date : null);
      setBrokenStreak(lostStreak);
      setTakeCounts(myTakes.map((t) => ({ id: t.id, agreeCount: t.agreeCount })));
      setBuiltAt(now);
      setItems(built);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Persist the marker. Called when the reader has actually SEEN the list, not
   * when it was fetched — a badge that clears because something prefetched in
   * the background is a badge nobody trusts.
   */
  const acknowledge = useCallback(async () => {
    const next = markSeen({
      seen,
      now: Date.now(),
      myTakes: takeCounts,
      yesterdayDate,
      brokenStreak,
    });
    setSeen(next);
    try {
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      /* the list still reads correctly this session */
    }
  }, [seen, takeCounts, yesterdayDate, brokenStreak]);

  return {
    items,
    loading,
    builtAt,
    unread: unreadCount(items),
    reload: load,
    acknowledge,
    todayIso,
  };
}
