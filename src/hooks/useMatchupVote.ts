// src/hooks/useMatchupVote.ts — shared "Who would win?" vote state for the
// daily-matchup card and the Compare arena, so the two surfaces never drift.
//
// Cold-launch rule: a logged-out visitor can vote with NO sign-up wall. Their
// pick is an optimistic, on-device reveal (AsyncStorage) — it does not hit the
// server tally. Only signed-in votes persist via cast_matchup_vote. The reveal
// itself is always meaningful because the caller falls back to the stat-split
// when the crowd tally is empty. If public anonymous counts ever matter, add an
// anonymous-vote RPC keyed on a client-id — that change never touches auth.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './useAuth';
import { matchupVoteKey, type MatchupSide } from '../lib/home/matchupVote';
import { getMatchupTally, castMatchupVote, type MatchupTally } from '../lib/db/matchupVotes';
import { trackEvent } from '../lib/analytics';

export interface MatchupVoteState {
  /** The picked hero id, or null before the user has voted. */
  pickedId: string | null;
  /** Crowd tally (signed-in votes only), or null until loaded / when empty. */
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
    getMatchupTally(heroAId, heroBId)
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
      // Persist to the crowd tally only for signed-in users (RLS-locked rows;
      // an anonymous write would fail server-side, so we don't attempt it).
      if (user) {
        castMatchupVote(heroAId, heroBId, picked)
          .then((t) => t && setTally(t))
          .catch(() => {});
      }
    },
    [pickedId, user, key, heroAId, heroBId],
  );

  return { pickedId, tally, loaded, revealed: pickedId !== null, castVote };
}
