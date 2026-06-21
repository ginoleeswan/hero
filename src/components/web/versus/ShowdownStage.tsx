// src/components/web/versus/ShowdownStage.tsx — the Battle-Deck hero of the web
// Arena hub. Two holographic fighter cards flank a gold VS coin; tapping a card
// casts your vote and reveals the crowd split in place (the same poll pattern as
// the native versus hub). "See full breakdown →" then opens the arena. On desktop
// two dimmed cards peek behind for depth; they're decorative only.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import { useMatchupVote } from '../../../hooks/useMatchupVote';
import { statSplit, statLead } from '../../../lib/home/matchupVote';
import type { TodaysMatchup, MatchupHero } from '../../../lib/matchup';
import type { Hero } from '../../../lib/db/heroes';
import type { FighterArt } from '../../../lib/compareHandoff';

const ACCENT_A = COLORS.orange;
const ACCENT_B = COLORS.blue;
const holoGradient =
  'linear-gradient(135deg, rgba(255,255,255,0.10), transparent 45%, rgba(206,155,51,0.12) 80%)';

function HoloCard({
  hero,
  side,
  picked,
  dimmed,
  onPress,
  w,
  h,
}: {
  hero: MatchupHero;
  side: 'a' | 'b';
  picked: boolean;
  dimmed: boolean;
  onPress: () => void;
  w: number;
  h: number;
}) {
  const accent = side === 'a' ? ACCENT_A : ACCENT_B;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Vote for ${hero.name}`}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          c.card,
          side === 'a' ? c.tiltL : c.tiltR,
          { width: w, height: h },
          hovered && (c.cardHover as object),
          dimmed && (c.cardDim as object),
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
        style={[StyleSheet.absoluteFill, side === 'b' && c.mirror] as object}
      />
      <View style={[StyleSheet.absoluteFill, c.holo] as object} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, c.grad] as object} pointerEvents="none" />
      {picked ? (
        <View style={[c.pickTag, { backgroundColor: accent }] as object}>
          <Text style={c.pickTagText}>Your pick</Text>
        </View>
      ) : null}
      <Text style={c.name} numberOfLines={1}>
        {hero.name}
      </Text>
      <View
        style={[StyleSheet.absoluteFill, c.frame, { borderColor: accent }] as object}
        pointerEvents="none"
      />
    </Pressable>
  );
}

// A dimmed card peeking behind the main pair. It's the deck's "shuffle" control:
// tapping it deals a fresh random matchup (same as Surprise me). The shuffle
// glyph + hover lift signal it's interactive, not a third fighter.
function GhostCard({
  hero,
  side,
  w,
  h,
  onPress,
}: {
  hero: Hero;
  side: 'l' | 'r';
  w: number;
  h: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Shuffle to a random matchup"
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          c.ghost,
          side === 'l' ? c.ghostL : c.ghostR,
          { width: w, height: h },
          hovered && (c.ghostHover as object),
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
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, c.ghostVeil] as object} pointerEvents="none" />
      <View style={c.ghostHint as object} pointerEvents="none">
        <Ionicons name="shuffle" size={16} color={COLORS.beige} />
      </View>
    </Pressable>
  );
}

export function ShowdownStage({
  matchup,
  iconicPool,
  isDesktop,
  onOpen,
  onShuffle,
}: {
  matchup: TodaysMatchup;
  iconicPool: Hero[];
  isDesktop: boolean;
  onOpen: (a: FighterArt, b: FighterArt) => void;
  /** Deal a fresh random matchup — wired to the peeking "deck" cards. */
  onShuffle: () => void;
}) {
  const { heroA, heroB, winsA, winsB } = matchup;
  const { revealed, pickedId, tally, castVote } = useMatchupVote(heroA.id, heroB.id);

  const usingVotes = !!tally && tally.total > 0;
  const { pctA, pctB } = usingVotes
    ? statSplit(tally!.votesA, tally!.votesB)
    : statSplit(winsA, winsB);
  const caption = usingVotes
    ? `${tally!.total} ${tally!.total === 1 ? 'fan' : 'fans'} voted`
    : statLead(winsA, winsB, heroA.name, heroB.name);
  const pickedA = pickedId === heroA.id;

  const cardW = isDesktop ? 190 : 140;
  const cardH = isDesktop ? 250 : 186;
  const coin = isDesktop ? 70 : 52;

  // Two decorative cards peeking behind the pair — first iconic heroes that
  // aren't already in today's matchup. Desktop only.
  const ghosts = isDesktop
    ? iconicPool.filter((h) => h.id !== heroA.id && h.id !== heroB.id).slice(0, 2)
    : [];

  return (
    <View style={c.wrap}>
      <View style={c.arena}>
        {ghosts[0] ? (
          <GhostCard
            hero={ghosts[0]}
            side="l"
            w={cardW * 0.58}
            h={cardH * 0.76}
            onPress={onShuffle}
          />
        ) : null}
        <HoloCard
          hero={heroA}
          side="a"
          picked={pickedA}
          dimmed={revealed && !pickedA}
          onPress={() => castVote('a')}
          w={cardW}
          h={cardH}
        />
        <View style={[c.coin, { width: coin, height: coin, borderRadius: coin / 2 }] as object}>
          <Text style={[c.coinText, { fontSize: coin * 0.34 }]}>VS</Text>
        </View>
        <HoloCard
          hero={heroB}
          side="b"
          picked={pickedId === heroB.id}
          dimmed={revealed && pickedId !== heroB.id}
          onPress={() => castVote('b')}
          w={cardW}
          h={cardH}
        />
        {ghosts[1] ? (
          <GhostCard
            hero={ghosts[1]}
            side="r"
            w={cardW * 0.58}
            h={cardH * 0.76}
            onPress={onShuffle}
          />
        ) : null}
      </View>

      {!revealed ? (
        <Text style={c.prompt}>Who would win? Tap a card.</Text>
      ) : (
        <View style={c.reveal}>
          <View style={c.barTrack}>
            <View style={[c.barFillA, { flex: Math.max(pctA, 1) }] as object} />
            <View style={[c.barFillB, { flex: Math.max(pctB, 1) }] as object} />
          </View>
          <View style={c.barLabels}>
            <Text style={[c.barPct, { color: ACCENT_A }, pickedA && c.barPctOn] as object}>
              {pctA}%
            </Text>
            <Text style={c.caption}>{caption}</Text>
            <Text style={[c.barPct, { color: ACCENT_B }, !pickedA && c.barPctOn] as object}>
              {pctB}%
            </Text>
          </View>
          <Pressable
            onPress={() => onOpen(heroA, heroB)}
            accessibilityRole="button"
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [c.linkRow, hovered && (c.linkHover as object)] as object
            }
          >
            <Text style={c.link}>See full breakdown →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const c = StyleSheet.create({
  wrap: { alignItems: 'center' },
  arena: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
    zIndex: 2,
    boxShadow: '0 18px 44px rgba(0,0,0,0.55)',
    cursor: 'pointer',
    transition: 'transform 160ms ease, opacity 160ms ease',
  } as object,
  tiltL: { transform: [{ rotate: '-4deg' }] } as object,
  tiltR: { transform: [{ rotate: '4deg' }] } as object,
  cardHover: { transform: [{ translateY: -6 }, { rotate: '0deg' }] } as object,
  cardDim: { opacity: 0.45 } as object,
  holo: { backgroundImage: holoGradient, mixBlendMode: 'screen' } as object,
  grad: {
    backgroundImage: 'linear-gradient(180deg, transparent 55%, rgba(8,12,24,0.92))',
  } as object,
  frame: { borderWidth: 1.5, borderRadius: 18 } as object,
  // Mirror the right fighter so the two portraits face inward, toward each other.
  mirror: { transform: [{ scaleX: -1 }] } as object,
  name: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    textAlign: 'center',
    fontFamily: 'Flame-Regular',
    fontSize: 19,
    color: COLORS.beige,
  } as object,
  pickTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 3,
    alignItems: 'center',
    zIndex: 3,
  } as object,
  pickTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  ghost: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
    opacity: 0.32,
    cursor: 'pointer',
    transition: 'opacity 160ms ease, transform 160ms ease',
  } as object,
  ghostL: { transform: [{ translateX: 26 }, { rotate: '-6deg' }] } as object,
  ghostR: { transform: [{ translateX: -26 }, { rotate: '6deg' }] } as object,
  ghostHover: { opacity: 0.7 } as object,
  ghostVeil: { backgroundColor: 'rgba(8,12,24,0.5)' } as object,
  ghostHint: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  } as object,

  coin: {
    marginHorizontal: -18,
    zIndex: 6,
    backgroundColor: COLORS.deepNavy,
    borderWidth: 2.5,
    borderColor: COLORS.goldAccent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 6px rgba(11,24,32,0.6)',
  } as object,
  coinText: { fontFamily: 'Flame-Regular', color: COLORS.goldAccent },

  prompt: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: 'rgba(245,235,220,0.75)',
    marginTop: 20,
  },

  reveal: { width: 340, maxWidth: '100%', marginTop: 20 } as object,
  barTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.1)',
  },
  barFillA: { backgroundColor: ACCENT_A },
  barFillB: { backgroundColor: ACCENT_B },
  barLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 7,
  },
  barPct: { fontFamily: 'Flame-Regular', fontSize: 16, opacity: 0.5 },
  barPctOn: { opacity: 1 } as object,
  caption: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.5)',
  },
  linkRow: { alignSelf: 'center', marginTop: 8, cursor: 'pointer' } as object,
  linkHover: { opacity: 0.8 } as object,
  link: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.goldAccent,
    letterSpacing: 0.3,
  },
});
