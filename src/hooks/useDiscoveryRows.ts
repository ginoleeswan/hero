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
 *  (rivalries + iconic pool + featured teams). Each list degrades to []. */
export function useDiscoveryRows(): {
  rivalries: Matchup[];
  dream: Matchup[];
  goliath: Matchup[];
  teams: TeamMatchup[];
} {
  const { rivalries, iconicPool } = useVersusHub();
  const { teams } = usePresetTeams();

  return useMemo(
    () => ({
      rivalries: rivalries.map((r) => ({ a: r.a, b: r.b })),
      dream: buildDreamMatches(iconicPool, 8),
      goliath: buildGoliathMatches(iconicPool, 8),
      teams: buildTeamMatches(teams, 6),
    }),
    [rivalries, iconicPool, teams],
  );
}
