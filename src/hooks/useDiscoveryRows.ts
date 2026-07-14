import { useMemo } from 'react';
import { useVersusHub } from './useVersusHub';
import { usePresetTeams } from './usePresetTeams';
import {
  buildDreamMatches,
  buildGoliathMatches,
  buildTeamMatches,
  type Matchup,
  type TeamMatchup,
} from '../lib/discovery';

/** The Battle Discovery feed's rows, derived from data the hub already fetches
 *  (rivalries + iconic pool + featured teams). Each list degrades to [].
 *  `settled` = every source has resolved — gate the whole feed on it so the
 *  sections reveal as one snapshot instead of popping in one at a time. */
export function useDiscoveryRows(): {
  rivalries: Matchup[];
  dream: Matchup[];
  goliath: Matchup[];
  teams: TeamMatchup[];
  settled: boolean;
} {
  const { rivalries, iconicPool, feedSettled } = useVersusHub();
  const { teams, loading: teamsLoading } = usePresetTeams();

  return useMemo(
    () => ({
      rivalries: uniquePairs(rivalries.map((r) => ({ a: r.a, b: r.b }))),
      dream: uniquePairs(buildDreamMatches(iconicPool, 8)),
      goliath: uniquePairs(buildGoliathMatches(iconicPool, 8)),
      teams: uniquePairs(buildTeamMatches(teams, 6)),
      settled: feedSettled && !teamsLoading,
    }),
    [rivalries, iconicPool, teams, feedSettled, teamsLoading],
  );
}

// Each list must hold unique pairs — the cards key on `${a.id}-${b.id}`, so a
// repeated pair (source data can drift daily) becomes a duplicate React key.
// Enforce the invariant here, at the derivation layer, for all four rows.
function uniquePairs<T extends { a: { id: string }; b: { id: string } }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((m) => {
    const key = `${m.a.id}-${m.b.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
