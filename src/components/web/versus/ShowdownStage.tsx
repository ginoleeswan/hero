// src/components/web/versus/ShowdownStage.tsx — the Main Event of the web Arena.
// Two portrait fighter cards face off across a gold VS diamond; tapping a card
// casts your vote. Below, a ringside panel shows the head to head and — once
// voted — the crowd's split, with a gold pill into the full breakdown.
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, EYEBROW } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import { useMatchupVote } from '../../../hooks/useMatchupVote';
import { statSplit, statLead, type MatchupSide } from '../../../lib/home/matchupVote';
import type { TodaysMatchup, MatchupHero } from '../../../lib/matchup';
import type { FighterArt } from '../../../lib/compareHandoff';

const ACCENT_A = COLORS.orange;
const ACCENT_B = COLORS.blue;

// ── A portrait fighter card — the vote button. Full character render in a
// clean portrait crop, faction-accent frame, name + publisher on a bottom
// scrim. Picked → accent ring + tag; the loser dims + desaturates on reveal.
function FighterCard({
  hero,
  side,
  picked,
  dimmed,
  revealed,
  w,
  h,
  onPress,
}: {
  hero: MatchupHero;
  side: 'a' | 'b';
  picked: boolean;
  dimmed: boolean;
  revealed: boolean;
  w: number;
  h: number;
  onPress: () => void;
}) {
  const accent = side === 'a' ? ACCENT_A : ACCENT_B;
  return (
    <Pressable
      onPress={onPress}
      disabled={revealed}
      accessibilityRole="button"
      accessibilityLabel={`Vote for ${hero.name}`}
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
        [
          fc.card,
          { width: w, height: h },
          side === 'a' ? fc.tiltL : fc.tiltR,
          hovered && !revealed && (fc.cardHover as object),
          dimmed && (fc.cardDim as object),
        ] as object
      }
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        contentPosition={{ top: '8%', left: '50%' }}
        style={[StyleSheet.absoluteFill, side === 'b' && (fc.mirror as object)] as object}
      />
      <View style={fc.scrim as object} pointerEvents="none" />
      {picked && (
        <View style={[fc.pickTag, { backgroundColor: accent }] as object}>
          <Text style={fc.pickTagText as object}>Your pick</Text>
        </View>
      )}
      <View style={fc.body}>
        {!!hero.publisher && (
          <Text style={fc.pub as object} numberOfLines={1}>
            {hero.publisher}
          </Text>
        )}
        <Text style={fc.name as object} numberOfLines={2}>
          {hero.name}
        </Text>
      </View>
      <View
        style={[StyleSheet.absoluteFill, fc.frame, { borderColor: accent }] as object}
        pointerEvents="none"
      />
    </Pressable>
  );
}

// ── Head to head — one stat, two bars meeting in the middle ──────────────
function TapeRow({ label, a, b }: { label: string; a: number; b: number }) {
  return (
    <View style={t.row}>
      <Text style={[t.val, { color: ACCENT_A }, a >= b && (t.valLead as object)] as object}>
        {a}
      </Text>
      <View style={[t.track, t.trackL] as object}>
        <View
          style={[t.fill, { width: `${Math.min(100, a)}%`, backgroundColor: ACCENT_A }] as object}
        />
      </View>
      <Text style={t.label as object}>{label}</Text>
      <View style={t.track as object}>
        <View
          style={[t.fill, { width: `${Math.min(100, b)}%`, backgroundColor: ACCENT_B }] as object}
        />
      </View>
      <Text style={[t.val, { color: ACCENT_B }, b >= a && (t.valLead as object)] as object}>
        {b}
      </Text>
    </View>
  );
}

// ── The crowd's verdict — springs from an even split on a fresh vote ─────────
function CrowdBar({
  pctA,
  pctB,
  caption,
  pickedA,
  animate,
  onOpen,
}: {
  pctA: number;
  pctB: number;
  caption: string;
  pickedA: boolean;
  animate: boolean;
  onOpen: () => void;
}) {
  const [grown, setGrown] = useState(!animate);
  useEffect(() => {
    if (grown) return;
    const timer = setTimeout(() => setGrown(true), 40);
    return () => clearTimeout(timer);
  }, [grown]);
  return (
    <View style={c.reveal as object}>
      <View style={c.barTrack as object}>
        <View style={[c.barFillA, { flex: grown ? Math.max(pctA, 1) : 50 }] as object} />
        <View style={[c.barFillB, { flex: grown ? Math.max(pctB, 1) : 50 }] as object} />
      </View>
      <View style={c.barLabels as object}>
        <Text style={[c.barPct, { color: ACCENT_A }, pickedA && (c.barPctOn as object)] as object}>
          {pctA}%
        </Text>
        <Text style={c.caption as object}>{caption}</Text>
        <Text style={[c.barPct, { color: ACCENT_B }, !pickedA && (c.barPctOn as object)] as object}>
          {pctB}%
        </Text>
      </View>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
          [c.linkRow, (hovered || pressed) && (c.linkHover as object)] as object
        }
      >
        <Text style={c.link as object}>See full breakdown →</Text>
      </Pressable>
    </View>
  );
}

export function ShowdownStage({
  matchup,
  isDesktop,
  onOpen,
  onShuffle,
}: {
  matchup: TodaysMatchup;
  isDesktop: boolean;
  onOpen: (a: FighterArt, b: FighterArt) => void;
  /** Deal a fresh random bout. */
  onShuffle: () => void;
}) {
  const { heroA, heroB, winsA, winsB } = matchup;
  const { revealed, pickedId, tally, castVote } = useMatchupVote(heroA.id, heroB.id);

  const [justVoted, setJustVoted] = useState(false);
  const vote = (side: MatchupSide) => {
    setJustVoted(true);
    castVote(side);
  };

  const usingVotes = !!tally && tally.total > 0;
  const { pctA, pctB } = usingVotes
    ? statSplit(tally!.votesA, tally!.votesB)
    : statSplit(winsA, winsB);
  const caption = usingVotes
    ? `${tally!.total} ${tally!.total === 1 ? 'fan' : 'fans'} voted`
    : statLead(winsA, winsB, heroA.name, heroB.name);
  const pickedA = pickedId === heroA.id;

  const cardW = isDesktop ? 260 : 150;
  const cardH = isDesktop ? 346 : 200;
  const coin = isDesktop ? 76 : 54;

  // Head to head — rows render only when both fighters have the stat.
  const tape = (
    [
      ['INT', heroA.intelligence, heroB.intelligence],
      ['STR', heroA.strength, heroB.strength],
      ['SPD', heroA.speed, heroB.speed],
    ] as const
  ).filter(([, a, b]) => a != null && b != null) as [string, number, number][];

  return (
    <View style={c.wrap}>
      <View style={c.deck}>
        <FighterCard
          hero={heroA}
          side="a"
          picked={pickedA}
          dimmed={revealed && !pickedA}
          revealed={revealed}
          w={cardW}
          h={cardH}
          onPress={() => vote('a')}
        />

        <View style={c.center}>
          <View
            style={[c.coin, { width: coin, height: coin, borderRadius: 14 }] as object}
            pointerEvents="none"
          >
            <Text style={[c.coinText, { fontSize: coin * 0.3 }] as object}>VS</Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={onShuffle}
            accessibilityRole="button"
            accessibilityLabel="Shuffle to a random matchup"
            style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
              [c.shuffle, (hovered || pressed) && (c.shuffleHover as object)] as object
            }
          >
            <Ionicons name="shuffle" size={15} color={COLORS.beige} />
          </Pressable>
        </View>

        <FighterCard
          hero={heroB}
          side="b"
          picked={pickedId === heroB.id}
          dimmed={revealed && pickedId !== heroB.id}
          revealed={revealed}
          w={cardW}
          h={cardH}
          onPress={() => vote('b')}
        />
      </View>

      {/* Ringside panel: the head to head + the call to pick a side,
          resolving into the crowd's verdict after the vote. */}
      <View style={c.panel as object}>
        {tape.length > 0 && (
          <>
            <Text style={c.panelKicker as object}>Head to head</Text>
            <View style={t.tape as object}>
              {tape.map(([label, a, b]) => (
                <TapeRow key={label} label={label} a={a} b={b} />
              ))}
            </View>
            <View style={c.panelRule as object} />
          </>
        )}
        {!revealed ? (
          <Text style={c.prompt as object}>Who takes it? Tap a card.</Text>
        ) : (
          <CrowdBar
            pctA={pctA}
            pctB={pctB}
            caption={caption}
            pickedA={pickedA}
            animate={justVoted}
            onOpen={() => onOpen(heroA, heroB)}
          />
        )}
      </View>
    </View>
  );
}

// ── Fighter card ──────────────────────────────────────────────────────────────
const fc = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0d1a22',
    cursor: 'pointer',
    boxShadow: '0 22px 50px rgba(0,0,0,0.5)',
    transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease',
    justifyContent: 'flex-end',
  } as object,
  tiltL: { transform: [{ rotate: '-3deg' }] } as object,
  tiltR: { transform: [{ rotate: '3deg' }] } as object,
  cardHover: {
    transform: [{ rotate: '0deg' }, { translateY: -8 }],
    boxShadow: '0 30px 64px rgba(0,0,0,0.6)',
    zIndex: 3,
  } as object,
  cardDim: { opacity: 0.45, filter: 'grayscale(0.6)' } as object,
  mirror: { transform: [{ scaleX: -1 }] } as object,
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundImage: 'linear-gradient(to top, rgba(8,14,19,0.96) 0%, transparent 100%)',
  } as object,
  frame: { borderWidth: 2, borderRadius: 18, opacity: 0.9 } as object,
  pickTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    zIndex: 3,
  } as object,
  pickTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as object,
  body: { padding: 16 },
  pub: {
    ...EYEBROW,
    color: 'rgba(245,235,220,0.6)',
    marginBottom: 4,
  } as object,
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    lineHeight: 30,
    color: COLORS.beige,
    textShadow: '0 2px 10px rgba(0,0,0,0.9)',
  } as object,
});

// ── Stage layout ────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },
  deck: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  // Centre column between the cards — VS diamond + shuffle chip.
  center: { alignItems: 'center', marginHorizontal: -20, zIndex: 4, gap: 12 },
  coin: {
    transform: [{ rotate: '45deg' }],
    backgroundColor: COLORS.deepNavy,
    borderWidth: 2,
    borderColor: COLORS.goldAccent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 0 6px rgba(11,24,32,0.6), 0 0 30px ${COLORS.goldAccent}55`,
  } as object,
  coinText: {
    fontFamily: 'Flame-Regular',
    color: COLORS.goldAccent,
    transform: [{ rotate: '-45deg' }],
  } as object,
  shuffle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.18)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  shuffleHover: { backgroundColor: 'rgba(255,255,255,0.12)' } as object,

  // Ringside panel — glass card housing the tape and the vote/verdict.
  panel: {
    width: 640,
    maxWidth: '100%',
    marginTop: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 24,
  } as object,
  panelKicker: {
    ...EYEBROW,
    fontSize: 10,
    color: 'rgba(206,155,51,0.9)',
    marginBottom: 12,
  } as object,
  panelRule: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: 'rgba(245,235,220,0.08)',
    marginTop: 16,
    marginBottom: 14,
  } as object,
  prompt: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: 'rgba(245,235,220,0.8)',
  } as object,

  reveal: { width: '100%' } as object,
  barTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.1)',
  } as object,
  barFillA: {
    backgroundColor: ACCENT_A,
    transition: 'flex-grow 650ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  } as object,
  barFillB: {
    backgroundColor: ACCENT_B,
    transition: 'flex-grow 650ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  } as object,
  barLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 7,
  } as object,
  barPct: { fontFamily: 'Flame-Regular', fontSize: 16, opacity: 0.5 } as object,
  barPctOn: { opacity: 1 } as object,
  caption: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.6)',
  } as object,
  linkRow: {
    alignSelf: 'center',
    marginTop: 14,
    backgroundColor: COLORS.goldAccent,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 22,
    cursor: 'pointer',
    transition: 'opacity 150ms ease, transform 150ms ease',
  } as object,
  linkHover: { opacity: 0.9, transform: [{ scale: 1.04 }] } as object,
  link: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.deepNavy,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as object,
});

const t = StyleSheet.create({
  tape: { alignSelf: 'stretch', gap: 8 } as object,
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  val: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    width: 34,
    textAlign: 'center',
    opacity: 0.55,
  } as object,
  valLead: { opacity: 1 } as object,
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(245,235,220,0.1)',
    overflow: 'hidden',
  } as object,
  trackL: { alignItems: 'flex-end' } as object,
  fill: { height: 5, borderRadius: 3 } as object,
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(245,235,220,0.6)',
    width: 36,
    textAlign: 'center',
  } as object,
});
