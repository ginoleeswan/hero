export interface ProfileStat {
  key: 'saved' | 'battles' | 'streak' | 'crowd' | 'badges';
  label: string;
  value: string;
  loading?: boolean;
}

export interface ProfileStatInput {
  savedCount: number;
  favouritesLoading: boolean;
  battle: { total: number; agreePct: number; streak: number } | null;
  badgesEarned: number;
}

/**
 * Builds the profile "you at a glance" stat strip: a fixed-order, zero-filtered
 * list of tiles. Saved renders as a skeleton tile while favourites load; every
 * other tile appears only when its value is > 0. An all-zero loaded state
 * returns [] so the caller renders no strip.
 */
export function buildProfileStats(input: ProfileStatInput): ProfileStat[] {
  const { savedCount, favouritesLoading, battle, badgesEarned } = input;
  const stats: ProfileStat[] = [];

  if (favouritesLoading) {
    stats.push({ key: 'saved', label: 'Saved', value: '', loading: true });
  } else if (savedCount > 0) {
    stats.push({ key: 'saved', label: 'Saved', value: String(savedCount), loading: undefined });
  }

  if (battle && battle.total > 0) {
    stats.push({
      key: 'battles',
      label: 'Battles',
      value: String(battle.total),
      loading: undefined,
    });
    if (battle.streak > 0) {
      stats.push({
        key: 'streak',
        label: 'Streak',
        value: String(battle.streak),
        loading: undefined,
      });
    }
    if (battle.agreePct > 0) {
      stats.push({
        key: 'crowd',
        label: 'Crowd',
        value: `${battle.agreePct}%`,
        loading: undefined,
      });
    }
  }

  if (badgesEarned > 0) {
    stats.push({ key: 'badges', label: 'Badges', value: String(badgesEarned), loading: undefined });
  }

  return stats;
}
