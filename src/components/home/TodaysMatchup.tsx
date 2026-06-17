// src/components/home/TodaysMatchup.tsx — native "Today's Battle" card.
// A daily, deterministic matchup (see src/lib/matchup.ts) with a "Who would win?"
// vote: tap a fighter to cast a pick, which persists for the day and reveals the
// stat scorecard ("tale of the tape") + the AI verdict. The card taps through to
// the full compare arena.
import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import {
  matchupVoteKey,
  statSplit,
  statLead,
  type MatchupSide,
} from '../../lib/home/matchupVote';
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
        style={StyleSheet.absoluteFill}
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
  const [vote, setVote] = useState<MatchupSide | null>(null);
  const [loaded, setLoaded] = useState(false);
  const key = matchupVoteKey(heroA.id, heroB.id);

  // Restore any pick made earlier today so the reveal persists across launches.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then((v) => {
        if (!active) return;
        if (v === 'a' || v === 'b') setVote(v);
        setLoaded(true);
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [key]);

  const castVote = useCallback(
    (side: MatchupSide) => {
      if (vote) return; // one vote per day's matchup
      setVote(side);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      AsyncStorage.setItem(key, side).catch(() => {});
    },
    [vote, key],
  );

  const { pctA, pctB } = statSplit(winsA, winsB);
  const revealed = vote !== null;

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
            picked={vote === 'a'}
            dimmed={revealed && vote !== 'a'}
            onVote={() => castVote('a')}
          />
          <View style={m.vsBadge}>
            <Text style={m.vsText}>VS</Text>
          </View>
          <Fighter
            hero={heroB}
            side="b"
            picked={vote === 'b'}
            dimmed={revealed && vote !== 'b'}
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
            {/* Tale of the tape — the stat scorecard split. */}
            <View style={m.barTrack}>
              <View style={[m.barFillA, { flex: Math.max(pctA, 1) }]} />
              <View style={[m.barFillB, { flex: Math.max(pctB, 1) }]} />
            </View>
            <View style={m.barLabels}>
              <Text style={[m.barPct, { color: COLORS.orange }]}>{pctA}%</Text>
              <Text style={m.lead}>{statLead(winsA, winsB, heroA.name, heroB.name)}</Text>
              <Text style={[m.barPct, { color: COLORS.blue }]}>{pctB}%</Text>
            </View>
            <Text style={m.verdict} numberOfLines={3}>
              “{matchup.verdict}”
            </Text>
            <Pressable
              onPress={() => onOpen(`/compare/${heroA.id}/${heroB.id}`)}
              style={m.linkRow}
            >
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
