import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import { useSkeletonAnim, SkeletonBlock } from '../Skeleton';
import { matchupVoteKey, statSplit, statLead, type MatchupSide } from '../../../lib/home/matchupVote';
import {
  getMatchupTally,
  castMatchupVote,
  type MatchupTally,
} from '../../../lib/db/matchupVotes';
import type { TodaysMatchup as Matchup } from '../../../lib/matchup';

interface TodaysMatchupProps {
  matchup: Matchup;
  onOpen: (path: string) => void;
}

function Fighter({
  hero,
  side,
  size = PORTRAIT,
  picked,
  dimmed,
  onVote,
}: {
  hero: Matchup['heroA'];
  side: 'a' | 'b';
  size?: number;
  picked: boolean;
  dimmed: boolean;
  onVote: () => void;
}) {
  return (
    <Pressable
      onPress={onVote}
      style={
        [
          m.portrait,
          { width: size, height: size },
          side === 'b' && (m.portraitB as object),
          picked && (m.portraitPicked as object),
          dimmed && (m.portraitDimmed as object),
        ] as object
      }
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        contentPosition="top"
        style={[StyleSheet.absoluteFill, side === 'b' && (m.faceInward as object)]}
        recyclingKey={hero.id}
      />
      {picked && (
        <View style={m.pickedTag as object}>
          <Text style={m.pickedTagText as object}>Your pick</Text>
        </View>
      )}
    </Pressable>
  );
}

// The post-vote reveal: crowd split bar (falls back to the stat scorecard until
// anyone has voted) + caption + AI verdict + link to the full breakdown.
function Result({
  matchup,
  tally,
  onOpen,
  centered,
}: {
  matchup: Matchup;
  tally: MatchupTally | null;
  onOpen: (path: string) => void;
  centered?: boolean;
}) {
  const { heroA, heroB, winsA, winsB } = matchup;
  const usingVotes = !!tally && tally.total > 0;
  const { pctA, pctB } = usingVotes
    ? statSplit(tally!.votesA, tally!.votesB)
    : statSplit(winsA, winsB);
  const caption = usingVotes
    ? `${tally!.total} ${tally!.total === 1 ? 'fan' : 'fans'} voted`
    : statLead(winsA, winsB, heroA.name, heroB.name);
  return (
    <>
      <View style={m.barTrack as object}>
        <View style={[m.barFillA, { flex: Math.max(pctA, 1) }] as object} />
        <View style={[m.barFillB, { flex: Math.max(pctB, 1) }] as object} />
      </View>
      <View style={m.barLabels as object}>
        <Text style={[m.barPct, { color: COLORS.orange }] as object}>{pctA}%</Text>
        <Text style={m.lead as object}>{caption}</Text>
        <Text style={[m.barPct, { color: COLORS.blue }] as object}>{pctB}%</Text>
      </View>
      <Text style={[m.verdict, centered && (m.textCenter as object)] as object} numberOfLines={3}>
        “{matchup.verdict}”
      </Text>
      <Pressable onPress={() => onOpen(`/compare/${heroA.id}/${heroB.id}`)} style={m.linkRow as object}>
        <Text style={m.link}>See full breakdown →</Text>
      </Pressable>
    </>
  );
}

function VotePrompt({
  heroA,
  heroB,
  onVote,
  centered,
}: {
  heroA: Matchup['heroA'];
  heroB: Matchup['heroB'];
  onVote: (side: MatchupSide) => void;
  centered?: boolean;
}) {
  return (
    <>
      <Text style={[m.prompt, centered && (m.textCenter as object)] as object}>
        Who would win? Cast your vote.
      </Text>
      <View style={m.voteRow as object}>
        <Pressable
          onPress={() => onVote('a')}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [m.voteBtn, hovered && (m.voteBtnHover as object)] as object
          }
        >
          <Text style={m.voteBtnText} numberOfLines={1}>
            {heroA.name}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onVote('b')}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [m.voteBtn, hovered && (m.voteBtnHover as object)] as object
          }
        >
          <Text style={m.voteBtnText} numberOfLines={1}>
            {heroB.name}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

export function TodaysMatchup({ matchup, onOpen }: TodaysMatchupProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { heroA, heroB } = matchup;

  const [pickedId, setPickedId] = useState<string | null>(null);
  const [tally, setTally] = useState<MatchupTally | null>(null);
  const [loaded, setLoaded] = useState(false);
  const key = matchupVoteKey(heroA.id, heroB.id);

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
      if (pickedId) return;
      const picked = side === 'a' ? heroA.id : heroB.id;
      setPickedId(picked);
      AsyncStorage.setItem(key, side).catch(() => {});
      castMatchupVote(heroA.id, heroB.id, picked)
        .then((t) => t && setTally(t))
        .catch(() => {});
    },
    [pickedId, key, heroA.id, heroB.id],
  );

  const revealed = pickedId !== null;

  // ── Mobile: a centred "fight poster" — face-off portraits, then vote / reveal ──
  if (!isDesktop) {
    return (
      <View style={[m.card, m.cardMobile] as object}>
        <Text style={[m.eyebrow, m.textCenter] as object}>⚔ Today&apos;s Battle</Text>
        <View style={m.fightersMobile as object}>
          <Fighter
            hero={heroA}
            side="a"
            size={92}
            picked={pickedId === heroA.id}
            dimmed={revealed && pickedId !== heroA.id}
            onVote={() => castVote('a')}
          />
          <View style={m.vsBadge as object}>
            <Text style={m.vsText}>VS</Text>
          </View>
          <Fighter
            hero={heroB}
            side="b"
            size={92}
            picked={pickedId === heroB.id}
            dimmed={revealed && pickedId !== heroB.id}
            onVote={() => castVote('b')}
          />
        </View>
        <Text style={[m.title, m.textCenter] as object} numberOfLines={1}>
          {heroA.name} vs {heroB.name}
        </Text>
        {!loaded ? null : revealed ? (
          <Result matchup={matchup} tally={tally} onOpen={onOpen} centered />
        ) : (
          <VotePrompt heroA={heroA} heroB={heroB} onVote={castVote} centered />
        )}
      </View>
    );
  }

  return (
    <View style={[m.card, m.cardDesktop] as object}>
      <View style={m.fighters}>
        <Fighter
          hero={heroA}
          side="a"
          picked={pickedId === heroA.id}
          dimmed={revealed && pickedId !== heroA.id}
          onVote={() => castVote('a')}
        />
        <View style={m.vsBadge as object}>
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

      <View style={m.info}>
        <Text style={m.eyebrow as object}>⚔ Today&apos;s Battle</Text>
        <Text style={m.title} numberOfLines={1}>
          {heroA.name} vs {heroB.name}
        </Text>
        {!loaded ? null : revealed ? (
          <Result matchup={matchup} tally={tally} onOpen={onOpen} />
        ) : (
          <VotePrompt heroA={heroA} heroB={heroB} onVote={castVote} />
        )}
      </View>
    </View>
  );
}

/**
 * Placeholder that reserves the matchup slot while the (multi-hop + AI verdict)
 * query resolves, so the card fills in without shoving the page below it down.
 * Reuses the real card's container/portrait styles so its height matches.
 */
export function TodaysMatchupSkeleton() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const opacity = useSkeletonAnim();

  if (!isDesktop) {
    return (
      <View style={[m.card, m.cardMobile] as object}>
        <SkeletonBlock opacity={opacity} dark width={110} height={9} />
        <View style={m.fightersMobile as object}>
          <SkeletonBlock opacity={opacity} dark width={92} height={92} borderRadius={14} />
          <View style={[m.vsBadge, { backgroundColor: 'rgba(245,235,220,0.15)' }] as object} />
          <SkeletonBlock opacity={opacity} dark width={92} height={92} borderRadius={14} />
        </View>
        <SkeletonBlock opacity={opacity} dark width={200} height={20} />
        <SkeletonBlock opacity={opacity} dark width={260} height={14} />
        <View style={m.footerMobile as object}>
          <SkeletonBlock opacity={opacity} dark width={90} height={10} />
          <SkeletonBlock opacity={opacity} dark width={120} height={10} />
        </View>
      </View>
    );
  }

  return (
    <View style={[m.card, m.cardDesktop] as object}>
      <View style={m.fighters}>
        <SkeletonBlock opacity={opacity} dark width={PORTRAIT} height={PORTRAIT} borderRadius={14} />
        <View
          style={
            [
              m.vsBadge,
              { marginHorizontal: -12, backgroundColor: 'rgba(245,235,220,0.15)' },
            ] as object
          }
        />
        <SkeletonBlock opacity={opacity} dark width={PORTRAIT} height={PORTRAIT} borderRadius={14} />
      </View>
      <View style={m.info}>
        <SkeletonBlock opacity={opacity} dark width={110} height={9} style={{ marginBottom: 8 }} />
        <SkeletonBlock opacity={opacity} dark width={220} height={20} style={{ marginBottom: 8 }} />
        <SkeletonBlock opacity={opacity} dark width="80%" height={14} style={{ marginBottom: 12 }} />
        <View style={m.footer}>
          <SkeletonBlock opacity={opacity} dark width={90} height={10} />
          <SkeletonBlock opacity={opacity} dark width={120} height={10} />
        </View>
      </View>
    </View>
  );
}

const PORTRAIT = 76;

const m = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    padding: 18,
    marginTop: 12,
  } as object,
  cardDesktop: { marginHorizontal: 32 } as object,
  cardMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 22,
    marginHorizontal: 16,
  } as object,

  fighters: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  fightersMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  } as object,
  textCenter: { textAlign: 'center', marginBottom: 0 } as object,
  footerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 4,
  } as object,
  portrait: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 2,
    borderColor: 'rgba(11,24,32,0.9)',
    cursor: 'pointer',
    transition: 'opacity 150ms ease, border-color 150ms ease',
  } as object,
  portraitB: { marginLeft: -16 } as object,
  // Mirror the right fighter so they face inward, toward the left fighter.
  faceInward: { transform: [{ scaleX: -1 }] } as object,
  portraitPicked: { borderColor: COLORS.orange } as object,
  portraitDimmed: { opacity: 0.5 } as object,
  pickedTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.orange,
    paddingVertical: 2,
    alignItems: 'center',
  } as object,
  pickedTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as object,
  vsBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginHorizontal: -12,
    zIndex: 2,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0b1820',
  } as object,
  vsText: { fontFamily: 'Flame-Regular', fontSize: 12, color: '#fff' },

  info: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 5,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.beige,
    lineHeight: 25,
    marginBottom: 8,
  },
  prompt: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.7)',
    marginBottom: 10,
  } as object,
  voteRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' } as object,
  voteBtn: {
    flex: 1,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  voteBtnHover: { backgroundColor: 'rgba(245,235,220,0.14)' } as object,
  voteBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.beige },

  barTrack: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.1)',
    marginBottom: 8,
  } as object,
  barFillA: { backgroundColor: COLORS.orange } as object,
  barFillB: { backgroundColor: COLORS.blue } as object,
  barLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: 8,
    marginBottom: 10,
  } as object,
  barPct: { fontFamily: 'Flame-Regular', fontSize: 15 } as object,
  verdict: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(245,235,220,0.7)',
    lineHeight: 19,
    marginBottom: 10,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  lead: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.45)',
  } as object,
  linkRow: { alignSelf: 'flex-start', cursor: 'pointer' } as object,
  link: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 0.3,
  },
});
