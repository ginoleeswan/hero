import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

export interface FanTierInput {
  /** Heroes saved to the collection. */
  saves: number;
  /** Arena battles voted on. */
  votes: number;
  /** Contributions submitted (any status). */
  contributions: number;
  /** Badges earned. */
  badges: number;
}

export interface FanTier {
  name: string;
  icon: IoniconName;
  /** The underlying activity score (exposed for tooltips/next-tier hints). */
  score: number;
}

/**
 * A single "fan level" score blending the ways someone invests in the app.
 * Badges weigh most (each is a curated milestone); saves/votes/contributions
 * are raw activity. Pure and deterministic.
 */
export function fanScore({ saves, votes, contributions, badges }: FanTierInput): number {
  return saves + votes + contributions + badges * 3;
}

// Descending thresholds — the first one the score clears wins.
const TIERS: { min: number; name: string; icon: IoniconName }[] = [
  { min: 200, name: 'Legend', icon: 'flame' },
  { min: 100, name: 'Curator', icon: 'ribbon' },
  { min: 40, name: 'Collector', icon: 'library' },
  { min: 10, name: 'Fan', icon: 'star' },
  { min: 0, name: 'Newcomer', icon: 'sparkles' },
];

/** Maps activity to a named fan tier with an icon. */
export function fanTier(input: FanTierInput): FanTier {
  const score = fanScore(input);
  const tier = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
  return { name: tier.name, icon: tier.icon, score };
}
