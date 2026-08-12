// src/components/home/TodaysMatchup.tsx — native "Today's Battle" card.
// A daily, deterministic matchup (see src/lib/matchup.ts) with a "Who would win?"
// vote. Vote state (load tally, optimistic local reveal, server persist for
// signed-in users) lives in the shared useMatchupVote hook so this card and the
// web card / compare arena never drift. Logged-out fans vote with no sign-up
// wall — their pick is an on-device reveal. The card taps through to the arena.
import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Share, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { HeroImage } from '../HeroImage';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { nativeShare, shareLink, vsShareLine } from '../../lib/share';
import { crowdSplit, statLead, type MatchupSide } from '../../lib/home/matchupVote';
import { useMatchupVote } from '../../hooks/useMatchupVote';
import type { TodaysMatchup as Matchup } from '../../lib/matchup';
import { MATCHUP_CARD } from './homeGeometry';

const PORTRAIT = MATCHUP_CARD.portrait;

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
  const { pickedId, tally, loaded, revealed, castVote } = useMatchupVote(heroA.id, heroB.id);

  // Add a haptic tap to the shared vote handler on native (only on a fresh vote).
  const vote = useCallback(
    (side: MatchupSide) => {
      if (!revealed) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      castVote(side);
    },
    [revealed, castVote],
  );

  // One floor, shared with every other crowd bar — see crowdSplit. One vote is
  // usually the viewer's own, and reflecting it back as a 100% bar is a verdict
  // the app cannot support.
  const share = useCallback(() => {
    Haptics.selectionAsync();
    Share.share(
      nativeShare(
        vsShareLine(heroA.name, heroB.name, tally?.votesA ?? 0, tally?.votesB ?? 0),
        shareLink.debate(heroA.id, heroB.id),
        Platform.OS === 'ios',
      ),
    ).catch(() => {
      // dismissed sheet — not an error worth surfacing
    });
  }, [heroA.id, heroA.name, heroB.id, heroB.name, tally]);

  const { pctA, pctB, usingVotes, votes } = crowdSplit(tally, winsA, winsB);
  const caption = usingVotes
    ? `${votes} fans voted today`
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
            onVote={() => vote('a')}
          />
          <View style={m.vsBadge}>
            <Text style={m.vsText}>VS</Text>
          </View>
          <Fighter
            hero={heroB}
            side="b"
            picked={pickedId === heroB.id}
            dimmed={revealed && pickedId !== heroB.id}
            onVote={() => vote('b')}
          />
        </View>

        <Text style={m.matchTitle} numberOfLines={1}>
          {heroA.name} vs {heroB.name}
        </Text>

        {!loaded ? null : !revealed ? (
          <>
            <Text style={m.prompt}>Who would win? Tap your pick.</Text>
            <View style={m.voteRow}>
              <Pressable style={m.voteBtn} onPress={() => vote('a')}>
                <Text style={m.voteBtnText} numberOfLines={1}>
                  {heroA.name}
                </Text>
              </Pressable>
              <Pressable style={m.voteBtn} onPress={() => vote('b')}>
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
            {/* Sharing only appears once you have voted, because until then
                there is no result to send — and the debate OG card the link
                unfurls is a picture of exactly this: the split and the take. */}
            <View style={m.linkRow}>
              <Pressable onPress={() => onOpen(`/compare/${heroA.id}/${heroB.id}`)}>
                <Text style={m.link}>See full breakdown →</Text>
              </Pressable>
              <View style={m.linkDivider} />
              <Pressable
                onPress={share}
                accessibilityRole="button"
                accessibilityLabel="Share today's battle"
                hitSlop={8}
                style={m.shareBtn}
              >
                <Ionicons name="share-outline" size={14} color={COLORS.orange} />
                <Text style={m.link}>Share</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const m = StyleSheet.create({
  section: { paddingTop: 8, paddingBottom: 12 },
  header: {
    paddingHorizontal: 15,
    marginBottom: 10,
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
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },

  card: {
    marginHorizontal: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
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
    color: INK_TEXT.faint,
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
  linkRow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.18)' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  link: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange, letterSpacing: 0.3 },
});
