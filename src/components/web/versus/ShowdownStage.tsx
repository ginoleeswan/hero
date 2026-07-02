// src/components/web/versus/ShowdownStage.tsx — the Main Event of the web
// Arena: a full-bleed fight-night stage. The two fighters own half the arena
// each, split by the gold slash and VS coin; the entire half is the vote
// button. A tale of the tape (INT/STR/SPD as opposing bars) sits under the
// fighters; voting springs the crowd bar from an even split to the real tally,
// lights your corner and drains the loser's colour. "See full breakdown →"
// opens the full fight.
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

// ── One half of the arena — the fighter's corner, and the vote button ────────
// The corner owns the colour panel, glow, name block and vote press; the
// portrait itself lives in a sibling layer above (see PortraitLayer) so its
// inner edge can be clipped collinear with the diagonal slash.
function Corner({
  hero,
  side,
  picked,
  dimmed,
  revealed,
  isDesktop,
  onPress,
  onHover,
}: {
  hero: MatchupHero;
  side: 'a' | 'b';
  picked: boolean;
  dimmed: boolean;
  revealed: boolean;
  isDesktop: boolean;
  onPress: () => void;
  onHover: (side: 'a' | 'b' | null) => void;
}) {
  const accent = side === 'a' ? ACCENT_A : ACCENT_B;
  return (
    <Pressable
      onPress={onPress}
      disabled={revealed}
      onHoverIn={() => onHover(side)}
      onHoverOut={() => onHover(null)}
      accessibilityRole="button"
      accessibilityLabel={`Vote for ${hero.name}`}
      style={[c.corner, dimmed && (c.cornerDim as object)] as object}
    >
      {/* Corner-colour atmosphere behind the fighter. */}
      <View
        style={
          [
            c.glow,
            { backgroundColor: `${accent}2E` },
            side === 'a' ? { right: '4%' } : { left: '4%' },
          ] as object
        }
        pointerEvents="none"
      />
      <View style={c.bottomScrim as object} pointerEvents="none" />
      {picked && (
        <View style={[c.pickTag, { backgroundColor: accent }, side === 'b' && (c.pickTagB as object)] as object}>
          <Text style={c.pickTagText as object}>Your pick</Text>
        </View>
      )}
      <View style={[c.nameBlock, side === 'b' && (c.nameBlockB as object)] as object}>
        {!!hero.publisher && (
          <Text
            style={[c.pub, side === 'b' && (c.textRight as object)] as object}
            numberOfLines={1}
          >
            {hero.publisher}
          </Text>
        )}
        <Text
          style={
            [
              c.name,
              !isDesktop && (c.nameMobile as object),
              side === 'b' && (c.textRight as object),
            ] as object
          }
          numberOfLines={2}
        >
          {hero.name}
        </Text>
      </View>
    </Pressable>
  );
}

// ── The fighters — a decorative layer above the corners so each portrait can
// cross the centreline and be clipped at exactly the slash's angle. The two
// inner edges are collinear with the gold band: the art dies into the slash.
function FighterPortrait({
  hero,
  side,
  portraitW,
  arenaH,
  hovered,
  dimmed,
}: {
  hero: MatchupHero;
  side: 'a' | 'b';
  portraitW: number;
  arenaH: number;
  hovered: boolean;
  dimmed: boolean;
}) {
  // The slash is skewX(-7°): its top leans right of centre, its bottom left.
  const dxHalf = Math.round((Math.tan((7 * Math.PI) / 180) * arenaH) / 2);
  const over = dxHalf + 10; // how far the box crosses the centreline
  const clip =
    side === 'a'
      ? `polygon(0 0, calc(100% - ${over - dxHalf}px) 0, calc(100% - ${over + dxHalf}px) 100%, 0 100%)`
      : `polygon(${over + dxHalf}px 0, 100% 0, 100% 100%, ${over - dxHalf}px 100%)`;
  const anchor =
    side === 'a'
      ? { right: '50%', marginRight: -over }
      : { left: '50%', marginLeft: -over };
  return (
    <View
      style={
        [
          c.portraitBox,
          anchor,
          { width: portraitW + over, clipPath: clip },
          hovered && (c.portraitHover as object),
          dimmed && (c.cornerDim as object),
        ] as object
      }
      pointerEvents="none"
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        contentPosition={{ top: '8%', left: '50%' }}
        style={[StyleSheet.absoluteFill, side === 'b' && (c.mirror as object)] as object}
      />
      {/* Outer edge dissolves into the panel. */}
      <View
        style={
          [
            StyleSheet.absoluteFill,
            {
              backgroundImage: `linear-gradient(to ${side === 'a' ? 'left' : 'right'}, transparent 62%, #0c161d 100%)`,
            },
          ] as object
        }
      />
      {/* Feet fade into the arena floor so the name stays legible. */}
      <View style={c.bottomScrim as object} />
    </View>
  );
}

// ── Tale of the tape — one stat, two bars meeting in the middle ──────────────
function TapeRow({ label, a, b }: { label: string; a: number; b: number }) {
  return (
    <View style={t.row}>
      <Text style={[t.val, { color: ACCENT_A }, a >= b && (t.valLead as object)] as object}>
        {a}
      </Text>
      <View style={[t.track, t.trackL] as object}>
        <View style={[t.fill, { width: `${Math.min(100, a)}%`, backgroundColor: ACCENT_A }] as object} />
      </View>
      <Text style={t.label as object}>{label}</Text>
      <View style={t.track as object}>
        <View style={[t.fill, { width: `${Math.min(100, b)}%`, backgroundColor: ACCENT_B }] as object} />
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
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [c.linkRow, hovered && (c.linkHover as object)] as object
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
  /** Deal a fresh random matchup — the corner shuffle chip. */
  onShuffle: () => void;
}) {
  const { heroA, heroB, winsA, winsB } = matchup;
  const { revealed, pickedId, tally, castVote } = useMatchupVote(heroA.id, heroB.id);

  // Fresh vote this session → the crowd bar springs; a returning voter gets
  // the settled tally.
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

  // Tale of the tape — rows render only when both fighters have the stat.
  const tape = (
    [
      ['INT', heroA.intelligence, heroB.intelligence],
      ['STR', heroA.strength, heroB.strength],
      ['SPD', heroA.speed, heroB.speed],
    ] as const
  ).filter(([, a, b]) => a != null && b != null) as [string, number, number][];

  const arenaH = isDesktop ? 430 : 280;
  // Portrait art is ~3:4 — derive the column width from the arena height so
  // the crop stays composed at every viewport.
  const portraitW = Math.round(arenaH * 0.82);
  const [hoverSide, setHoverSide] = useState<'a' | 'b' | null>(null);

  return (
    <View style={c.wrap}>
      <View style={[c.arena, { height: arenaH }] as object}>
        <Corner
          hero={heroA}
          side="a"
          picked={pickedA}
          dimmed={revealed && !pickedA}
          revealed={revealed}
          isDesktop={isDesktop}
          onPress={() => vote('a')}
          onHover={setHoverSide}
        />
        <Corner
          hero={heroB}
          side="b"
          picked={pickedId === heroB.id}
          dimmed={revealed && pickedId !== heroB.id}
          revealed={revealed}
          isDesktop={isDesktop}
          onPress={() => vote('b')}
          onHover={setHoverSide}
        />

        {/* Fighters — above the corner panels, clipped to the slash's angle. */}
        <FighterPortrait
          hero={heroA}
          side="a"
          portraitW={portraitW}
          arenaH={arenaH}
          hovered={hoverSide === 'a' && !revealed}
          dimmed={revealed && !pickedA}
        />
        <FighterPortrait
          hero={heroB}
          side="b"
          portraitW={portraitW}
          arenaH={arenaH}
          hovered={hoverSide === 'b' && !revealed}
          dimmed={revealed && pickedId !== heroB.id}
        />

        {/* The slash — a glowing gold band riding the split, carrying a
            diamond VS badge. */}
        <View style={c.seam as object} pointerEvents="none" />
        <View style={c.slash as object} pointerEvents="none" />
        <View
          style={[c.badge, !isDesktop && (c.badgeMobile as object)] as object}
          pointerEvents="none"
        >
          <Text style={[c.badgeText, !isDesktop && (c.badgeTextMobile as object)] as object}>
            VS
          </Text>
        </View>

        {/* Shuffle chip — deal a fresh random bout. */}
        <Pressable
          onPress={onShuffle}
          accessibilityRole="button"
          accessibilityLabel="Shuffle to a random matchup"
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [c.shuffle, hovered && (c.shuffleHover as object)] as object
          }
        >
          <Ionicons name="shuffle" size={16} color={COLORS.beige} />
        </Pressable>
      </View>

      {/* Tale of the tape */}
      {tape.length > 0 && (
        <View style={t.tape as object}>
          {tape.map(([label, a, b]) => (
            <TapeRow key={label} label={label} a={a} b={b} />
          ))}
        </View>
      )}

      {!revealed ? (
        <Text style={c.prompt as object}>Who takes it? Pick a side.</Text>
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
  );
}

const c = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },

  // The arena floor — full-width rounded block housing the two corners.
  arena: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0d1a22',
    borderWidth: 1,
    borderColor: 'rgba(206,155,51,0.18)',
    boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
    position: 'relative',
  } as object,

  corner: {
    width: '50%',
    height: '100%',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'opacity 300ms ease, filter 300ms ease',
    position: 'relative',
    backgroundColor: '#0c161d',
  } as object,
  cornerDim: { opacity: 0.45, filter: 'grayscale(0.6)' } as object,
  // Corner-colour bloom behind the fighter.
  glow: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    top: '18%',
    filter: 'blur(80px)',
  } as object,
  // The fixed-aspect portrait column, clipped collinear with the slash.
  portraitBox: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    maxWidth: '92%',
    transition: 'opacity 300ms ease, filter 300ms ease',
  } as object,
  portraitHover: { filter: 'brightness(1.12)' } as object,
  mirror: { transform: [{ scaleX: -1 }] } as object,
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
    backgroundImage: 'linear-gradient(to top, rgba(8,14,19,0.95) 0%, transparent 100%)',
  } as object,

  // Fighter identity anchored to the corner's outer edge.
  nameBlock: { position: 'absolute', bottom: 18, left: 22, right: 84 },
  nameBlockB: { left: 84, right: 22 } as object,
  textRight: { textAlign: 'right' } as object,
  pub: {
    ...EYEBROW,
    color: 'rgba(245,235,220,0.65)',
    marginBottom: 4,
  } as object,
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 42,
    lineHeight: 52,
    color: COLORS.beige,
    textShadow: '0 2px 12px rgba(0,0,0,0.9)',
  } as object,
  nameMobile: { fontSize: 22, lineHeight: 28 } as object,

  pickTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    zIndex: 3,
  } as object,
  pickTagB: { left: undefined, right: 14 } as object,
  pickTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  } as object,

  // Slash: soft dark separation, then a bold gold band with a real glow —
  // broadcast-graphics energy, not a hairline.
  seam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 130,
    marginLeft: -65,
    transform: [{ skewX: '-7deg' }],
    backgroundImage:
      'linear-gradient(to right, transparent 0%, rgba(8,14,19,0.85) 50%, transparent 100%)',
  } as object,
  slash: {
    position: 'absolute',
    top: -16,
    bottom: -16,
    left: '50%',
    width: 9,
    marginLeft: -4,
    transform: [{ skewX: '-7deg' }],
    backgroundImage: `linear-gradient(to bottom, transparent 0%, ${COLORS.goldAccent} 18%, #F3D27A 50%, ${COLORS.goldAccent} 82%, transparent 100%)`,
    boxShadow: `0 0 28px ${COLORS.goldAccent}66`,
  } as object,
  // Diamond VS badge riding the band.
  badge: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 66,
    height: 66,
    marginLeft: -33,
    marginTop: -33,
    borderRadius: 14,
    transform: [{ rotate: '45deg' }],
    backgroundColor: COLORS.deepNavy,
    borderWidth: 2,
    borderColor: COLORS.goldAccent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 0 6px rgba(11,24,32,0.6), 0 0 30px ${COLORS.goldAccent}55`,
    zIndex: 4,
  } as object,
  badgeMobile: {
    width: 50,
    height: 50,
    marginLeft: -25,
    marginTop: -25,
    borderRadius: 11,
  } as object,
  badgeText: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.goldAccent,
    transform: [{ rotate: '-45deg' }],
  } as object,
  badgeTextMobile: { fontSize: 16 } as object,

  shuffle: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,24,32,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.2)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    zIndex: 5,
  } as object,
  shuffleHover: { backgroundColor: 'rgba(11,24,32,0.9)' } as object,

  prompt: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: 'rgba(245,235,220,0.75)',
    marginTop: 18,
  } as object,

  reveal: { width: 380, maxWidth: '100%', marginTop: 18 } as object,
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
  linkRow: { alignSelf: 'center', marginTop: 8, cursor: 'pointer' } as object,
  linkHover: { opacity: 0.8 } as object,
  link: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.goldAccent,
    letterSpacing: 0.3,
  } as object,
});

const t = StyleSheet.create({
  tape: {
    width: 560,
    maxWidth: '100%',
    marginTop: 18,
    gap: 8,
  } as object,
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
  // Left track fills toward the centre (right-anchored).
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
