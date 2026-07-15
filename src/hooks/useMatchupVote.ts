// src/hooks/useMatchupVote.ts — shared "Who would win?" vote state for the
// daily-matchup card and the Compare arena, so the two surfaces never drift.
//
// Cold-launch rule: anonymous votes are real votes. A logged-out visitor can
// vote with NO sign-up wall, and their pick persists server-side against a
// stable per-device voter key (see lib/voterKey), same as a signed-in vote.
// The pick is also mirrored to AsyncStorage for an instant local reveal and
// as a fallback if the RPC is unreachable (offline, transient error) — the
// caller falls back to the stat-split when the crowd tally is empty either way.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './useAuth';
import { matchupVoteKey, type MatchupSide } from '../lib/home/matchupVote';
import { getMatchupTallyV2, castMatchupVoteV2, type MatchupTally } from '../lib/db/matchupVotes';
import { getVoterKey } from '../lib/voterKey';
import { trackEvent } from '../lib/analytics';

export interface MatchupVoteState {
  /** The picked hero id, or null before the user has voted. */
  pickedId: string | null;
  /** Crowd tally (signed-in + anonymous votes), or null until loaded / when empty. */
  tally: MatchupTally | null;
  /** True once the initial tally + local-pick lookup has settled. */
  loaded: boolean;
  /** Whether the viewer has revealed their pick. */
  revealed: boolean;
  /** Cast a pick for `side`. No-op once a pick exists. */
  castVote: (side: MatchupSide) => void;
}

export function useMatchupVote(heroAId: string, heroBId: string): MatchupVoteState {
  const { user } = useAuth();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [tally, setTally] = useState<MatchupTally | null>(null);
  const [loaded, setLoaded] = useState(false);
  const key = matchupVoteKey(heroAId, heroBId);

  useEffect(() => {
    let active = true;
    // Reset before the fetch so an in-place pair swap (same mounted instance)
    // can't render the new matchup as already-revealed with the prior pair's
    // pick/tally carried over. All current callers mount fresh per pair, but the
    // hook must be correct on its own contract.
    setPickedId(null);
    setTally(null);
    setLoaded(false);
    getVoterKey()
      .then((vk) => getMatchupTallyV2(heroAId, heroBId, vk))
      .then(async (t) => {
        if (!active) return;
        if (t) {
          setTally(t);
          if (t.myPick) setPickedId(t.myPick);
        }
        // No server-side pick (logged out, or hasn't voted) — fall back to the
        // on-device pick so a returning anonymous visitor still sees their vote.
        if (!t || !t.myPick) {
          const local = await AsyncStorage.getItem(key).catch(() => null);
          if (active && (local === 'a' || local === 'b')) {
            setPickedId(local === 'a' ? heroAId : heroBId);
          }
        }
        if (active) setLoaded(true);
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [key, heroAId, heroBId]);

  const castVote = useCallback(
    (side: MatchupSide) => {
      if (pickedId) return;
      const picked = side === 'a' ? heroAId : heroBId;
      // Optimistic local reveal — instant, no account required.
      setPickedId(picked);
      AsyncStorage.setItem(key, side).catch(() => {});
      trackEvent('matchup_vote', { authed: !!user });
      getVoterKey()
        .then((vk) => castMatchupVoteV2(heroAId, heroBId, picked, vk))
        .then((t) => t && setTally(t))
        .catch(() => {});
    },
    [pickedId, user, key, heroAId, heroBId],
  );

  return { pickedId, tally, loaded, revealed: pickedId !== null, castVote };
}
