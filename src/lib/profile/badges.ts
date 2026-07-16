// src/lib/profile/badges.ts — pure achievement logic for the profile.
// Badges are *derived* from data we already store (account age, favourites,
// matchup votes/streak, taste) — no new tables. Definitions live here so they're
// easy to tune and unit-test; the profile screens just render the result.

export interface BadgeInput {
  /** auth user's created_at (ISO), for tenure badges. */
  accountCreatedAt: string | null;
  /** Number of favourited heroes. */
  favourites: number;
  /** Matchups voted on (Battle Record total). */
  votes: number;
  /** Current daily-vote streak. */
  streak: number;
  /** Short top-publisher name from the taste profile, or null. */
  topPublisher: string | null;
  /** user_profiles.is_supporter — the one stored-flag badge (Ko-fi supporters,
   *  set by an admin). Optional so older call sites/tests need no change. */
  isSupporter?: boolean;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  /** Ionicons glyph name. */
  icon: string;
  earned: boolean;
  /** Progress toward earning, for locked count-based badges. */
  progress?: { current: number; target: number };
}

const DAY = 86_400_000;

function tenureDays(iso: string | null, now: number): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY));
}

/** Flavourful label for the publisher-loyalty badge. */
function loyaltyLabel(pub: string | null): string {
  if (!pub) return 'True Believer';
  const p = pub.toLowerCase();
  if (p.includes('marvel')) return 'Marvel Loyalist';
  if (p.includes('dc')) return 'DC Devotee';
  return `${pub} Fan`;
}

/**
 * Compute the full badge set (earned + locked-with-progress) for a user.
 * `now` is injectable so tenure badges are deterministic in tests.
 */
export function computeBadges(input: BadgeInput, now: number = Date.now()): Badge[] {
  const { accountCreatedAt, favourites, votes, streak, topPublisher, isSupporter } = input;
  const days = tenureDays(accountCreatedAt, now);

  const badges: Badge[] = [
    {
      id: 'supporter',
      label: 'Supporter',
      description: 'Keeps Mythique free for everyone',
      icon: 'star',
      earned: !!isSupporter,
    },
    {
      id: 'day-one',
      label: 'Day One',
      description: 'Joined the Mythique community',
      icon: 'sparkles',
      earned: !!accountCreatedAt,
    },
    {
      id: 'veteran',
      label: 'Veteran',
      description: 'Six months in the multiverse',
      icon: 'ribbon',
      earned: days >= 180,
      progress: { current: days, target: 180 },
    },
    {
      id: 'curator',
      label: 'Curator',
      description: 'Favourited 10 characters',
      icon: 'heart',
      earned: favourites >= 10,
      progress: { current: favourites, target: 10 },
    },
    {
      id: 'archivist',
      label: 'Archivist',
      description: 'Favourited 50 characters',
      icon: 'library',
      earned: favourites >= 50,
      progress: { current: favourites, target: 50 },
    },
    {
      id: 'oracle',
      label: 'Oracle',
      description: 'Called 10 daily battles',
      icon: 'flash',
      earned: votes >= 10,
      progress: { current: votes, target: 10 },
    },
    {
      id: 'on-fire',
      label: 'On Fire',
      description: 'A 3-day voting streak',
      icon: 'flame',
      earned: streak >= 3,
      progress: { current: streak, target: 3 },
    },
    {
      id: 'loyalist',
      label: loyaltyLabel(topPublisher),
      description: 'Your taste has a clear allegiance',
      icon: 'shield',
      earned: !!topPublisher && favourites >= 5,
      progress: { current: favourites, target: 5 },
    },
  ];

  // Earned first, otherwise keep definition order — gives a satisfying wall of
  // unlocked badges with goals trailing.
  return badges.sort((a, b) => Number(b.earned) - Number(a.earned));
}

/** How many of the computed badges are earned (for a "3 of 7" header). */
export function earnedCount(badges: Badge[]): number {
  return badges.filter((b) => b.earned).length;
}
