// src/components/home/TodaysMatchup.tsx — native "Today's Battle" card.
// A daily, deterministic matchup (see src/lib/matchup.ts) with a "Who would win?"
// vote. Tapping a fighter casts a community vote (matchup_votes via the
// cast_matchup_vote RPC) and reveals the crowd split + AI verdict. The local
// AsyncStorage pick is kept as an offline fallback so the reveal still persists
// when the network call fails. The card taps through to the full compare arena.
import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import { matchupVoteKey, statSplit, statLead, type MatchupSide } from '../../lib/home/matchupVote';
import { getMatchupTally, castMatchupVote, type MatchupTally } from '../../lib/db/matchupVotes';
import { useAuth } from '../../hooks/useAuth';
import type { TodaysMatchup as Matchup } from '../../lib/matchup';

const PORTRAIT = 96;

function Fighter({
  hero,
  side,
  picked,
  dimmed,
  onVote,
}: {
  hero: Matchup['heroA'];
  side: MatchupSide;
  picked: boolean;
  dimmed: boolean;
  onVote: () => void;
}) {
  return (
    <Pressable
      onPress={onVote}
      style={[
        m.portrait,
        side === 'b' && m.portraitB,
        picked && m.portraitPicked,
        dimmed && m.portraitDimmed,
      ]}
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        contentPosition="top"
        style={[StyleSheet.absoluteFill, side === 'b' && m.faceInward]}
        recyclingKey={hero.id}
      />
      {picked && (
        <View style={m.pickedTag}>
          <Text style={m.pickedTagText}>Your pick</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TodaysMatchup({
  matchup,
  onOpen,
}: {
  matchup: Matchup;
  onOpen: (path: string) => void;
}) {
  const { heroA, heroB, winsA, winsB } = matchup;
  const { user } = useAuth();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [tally, setTally] = useState<MatchupTally | null>(null);
  const [loaded, setLoaded] = useState(false);
  const key = matchupVoteKey(heroA.id, heroB.id);

  // Restore the crowd tally (and the caller's prior pick) from the server, with
  // the local pick as an offline fallback so the reveal persists either way.
  useEffect(() => {
    let active = true;
    getMatchupTally(heroA.id, heroB.id)
      .then(async (t) => {
        if (!active) return;
        if (t) {
          setTally(t);
          if (t.myPick) setPickedId(t.myPick);
        }
        if (!t || !t.myPick) {
          const local = await AsyncStorage.getItem(key).catch(() => null);
          if (active && (local === 'a' || local === 'b')) {
            setPickedId(local === 'a' ? heroA.id : heroB.id);
          }
        }
        if (active) setLoaded(true);
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [key, heroA.id, heroB.id]);

  const castVote = useCallback(
    (side: MatchupSide) => {
      if (pickedId) return; // one vote per day's matchup
      // Votes are per-user (RLS-locked rows); an anonymous tap fails silently
      // server-side, so send logged-out fans to sign in rather than faking a
      // reveal. They land back here to cast a real vote.
      if (!user) {
        onOpen('/(auth)/login');
        return;
      }
      const picked = side === 'a' ? heroA.id : heroB.id;
      setPickedId(picked); // optimistic
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      AsyncStorage.setItem(key, side).catch(() => {});
      castMatchupVote(heroA.id, heroB.id, picked)
        .then((t) => t && setTally(t))
        .catch(() => {});
    },
    [pickedId, user, onOpen, key, heroA.id, heroB.id],
  );

  const revealed = pickedId !== null;
  // The bar shows the crowd split once anyone has voted; before that it falls
  // back to the stat scorecard so the reveal is never an empty 50/50.
  const usingVotes = !!tally && tally.total > 0;
  const { pctA, pctB } = usingVotes
    ? statSplit(tally!.votesA, tally!.votesB)
    : statSplit(winsA, winsB);
  const caption = usingVotes
    ? `${tally!.total} ${tally!.total === 1 ? 'fan' : 'fans'} voted`
    : statLead(winsA, winsB, heroA.name, heroB.name);

  return (
    <View style={m.section}>
      <View style={m.header}>
        <View style={m.accentBar} />
        <View style={m.headerText}>
          <Text style={m.label}>Daily</Text>
          <Text style={m.title}>{"Today's Battle"}</Text>
        </View>
      </View>

      <View style={m.card}>
        <View style={m.fighters}>
          <Fighter
            hero={heroA}
            side="a"
            picked={pickedId === heroA.id}
            dimmed={revealed && pickedId !== heroA.id}
            onVote={() => castVote('a')}
          />
          <View style={m.vsBadge}>
            <Text style={m.vsText}>VS</Text>
          </View>
          <Fighter
            hero={heroB}
            side="b"
            picked={pickedId === heroB.id}
            dimmed={revealed && pickedId !== heroB.id}
            onVote={() => castVote('b')}
          />
        </View>

        <Text style={m.matchTitle} numberOfLines={1}>
          {heroA.name} vs {heroB.name}
        </Text>

        {!loaded ? null : !revealed ? (
          <>
            <Text style={m.prompt}>Who would win? Tap your pick.</Text>
            <View style={m.voteRow}>
              <Pressable style={m.voteBtn} onPress={() => castVote('a')}>
                <Text style={m.voteBtnText} numberOfLines={1}>
                  {heroA.name}
                </Text>
              </Pressable>
              <Pressable style={m.voteBtn} onPress={() => castVote('b')}>
                <Text style={m.voteBtnText} numberOfLines={1}>
                  {heroB.name}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={m.barTrack}>
              <View style={[m.barFillA, { flex: Math.max(pctA, 1) }]} />
              <View style={[m.barFillB, { flex: Math.max(pctB, 1) }]} />
            </View>
            <View style={m.barLabels}>
              <Text style={[m.barPct, { color: COLORS.orange }]}>{pctA}%</Text>
              <Text style={m.lead}>{caption}</Text>
              <Text style={[m.barPct, { color: COLORS.blue }]}>{pctB}%</Text>
            </View>
            <Text style={m.verdict} numberOfLines={3}>
              “{matchup.verdict}”
            </Text>
            <Pressable onPress={() => onOpen(`/compare/${heroA.id}/${heroB.id}`)} style={m.linkRow}>
              <Text style={m.link}>See full breakdown →</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const m = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 16 },
  header: {
    paddingHorizontal: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 11,
  },
  accentBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.orange },
  headerText: { gap: 2, justifyContent: 'center' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.orange,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.navy, lineHeight: 28 },

  card: {
    marginHorizontal: 15,
    backgroundColor: COLORS.navy,
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  fighters: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  portrait: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
    borderWidth: 2,
    borderColor: 'rgba(11,24,32,0.9)',
  },
  portraitB: { marginLeft: -14 },
  // Mirror the right fighter so they face inward, toward the left fighter.
  faceInward: { transform: [{ scaleX: -1 }] },
  portraitPicked: { borderColor: COLORS.orange },
  portraitDimmed: { opacity: 0.5 },
  pickedTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.orange,
    paddingVertical: 2,
    alignItems: 'center',
  },
  pickedTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginHorizontal: -12,
    zIndex: 2,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.deepNavy,
  },
  vsText: { fontFamily: 'Flame-Regular', fontSize: 13, color: '#fff' },

  matchTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    lineHeight: 24,
    marginBottom: 10,
    textAlign: 'center',
  },
  prompt: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.7)',
    marginBottom: 12,
  },
  voteRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  voteBtn: {
    flex: 1,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  voteBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.beige,
  },

  barTrack: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.1)',
    marginBottom: 8,
  },
  barFillA: { backgroundColor: COLORS.orange },
  barFillB: { backgroundColor: COLORS.blue },
  barLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: 8,
    marginBottom: 12,
  },
  barPct: { fontFamily: 'Flame-Regular', fontSize: 15 },
  lead: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.5)',
  },
  verdict: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(245,235,220,0.72)',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 12,
  },
  linkRow: { alignSelf: 'center' },
  link: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange, letterSpacing: 0.3 },
});
