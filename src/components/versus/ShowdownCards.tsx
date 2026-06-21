// src/components/versus/ShowdownCards.tsx — native Battle-Deck showdown. Two
// tilted holographic fighter cards flank a gold VS coin; tapping a card casts
// your vote and reveals the crowd split in place. "See full breakdown →" opens
// the arena. Mirrors the web ShowdownStage (src/components/web/versus) so the two
// platforms read as one design; both share useMatchupVote.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { useMatchupVote } from '../../hooks/useMatchupVote';
import { statSplit, statLead } from '../../lib/home/matchupVote';
import type { TodaysMatchup, MatchupHero } from '../../lib/matchup';
import type { FighterArt } from '../../lib/compareHandoff';

const ACCENT_A = COLORS.orange;
const ACCENT_B = COLORS.blue;
const CARD_W = 150;
const CARD_H = 200;
const COIN = 56;

function HoloCard({
  hero,
  side,
  picked,
  dimmed,
  onPress,
}: {
  hero: MatchupHero;
  side: 'a' | 'b';
  picked: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const accent = side === 'a' ? ACCENT_A : ACCENT_B;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Vote for ${hero.name}`}
      style={({ pressed }) => [
        styles.card,
        side === 'a' ? styles.tiltL : styles.tiltR,
        { borderColor: picked ? accent : 'rgba(245,235,220,0.14)' },
        pressed && styles.cardPressed,
        dimmed && styles.cardDim,
      ]}
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        contentPosition="top"
        style={[StyleSheet.absoluteFill, side === 'b' && styles.mirror]}
      />
      {/* holographic sheen — the native stand-in for the web's blend-mode foil */}
      <LinearGradient
        colors={['rgba(255,255,255,0.14)', 'transparent', 'rgba(206,155,51,0.16)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(8,12,24,0.92)']}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {picked ? (
        <View style={[styles.pickTag, { backgroundColor: accent }]}>
          <Text style={styles.pickTagText}>Your pick</Text>
        </View>
      ) : null}
      <Text style={styles.name} numberOfLines={1}>
        {hero.name}
      </Text>
    </Pressable>
  );
}

export function ShowdownCards({
  matchup,
  onOpen,
}: {
  matchup: TodaysMatchup;
  onOpen: (a: FighterArt, b: FighterArt) => void;
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

  return (
    <View style={styles.wrap}>
      <View style={styles.arena}>
        <HoloCard
          hero={heroA}
          side="a"
          picked={pickedA}
          dimmed={revealed && !pickedA}
          onPress={() => castVote('a')}
        />
        <View style={styles.coin}>
          <Text style={styles.coinText}>VS</Text>
        </View>
        <HoloCard
          hero={heroB}
          side="b"
          picked={pickedId === heroB.id}
          dimmed={revealed && pickedId !== heroB.id}
          onPress={() => castVote('b')}
        />
      </View>

      {!revealed ? (
        <Text style={styles.prompt}>Who would win? Tap a card.</Text>
      ) : (
        <View style={styles.reveal}>
          <View style={styles.barTrack}>
            <View style={[styles.barFillA, { flex: Math.max(pctA, 1) }]} />
            <View style={[styles.barFillB, { flex: Math.max(pctB, 1) }]} />
          </View>
          <View style={styles.barLabels}>
            <Text style={[styles.barPct, { color: ACCENT_A }, pickedA && styles.barPctOn]}>
              {pctA}%
            </Text>
            <Text style={styles.caption}>{caption}</Text>
            <Text style={[styles.barPct, { color: ACCENT_B }, !pickedA && styles.barPctOn]}>
              {pctB}%
            </Text>
          </View>
          <Pressable
            onPress={() => onOpen(heroA, heroB)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.linkRow, pressed && styles.linkPressed]}
          >
            <Text style={styles.link}>See full breakdown →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  arena: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
    borderWidth: 1.5,
    zIndex: 2,
    boxShadow: '0 14px 32px rgba(0,0,0,0.5)',
  },
  tiltL: { transform: [{ rotate: '-4deg' }] },
  tiltR: { transform: [{ rotate: '4deg' }] },
  // Mirror the right fighter so the two portraits face inward, toward each other.
  mirror: { transform: [{ scaleX: -1 }] },
  cardPressed: { opacity: 0.92 },
  cardDim: { opacity: 0.45 },
  name: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    textAlign: 'center',
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
  },
  pickTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 3,
    alignItems: 'center',
    zIndex: 3,
  },
  pickTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  coin: {
    width: COIN,
    height: COIN,
    borderRadius: COIN / 2,
    marginHorizontal: -16,
    zIndex: 6,
    backgroundColor: COLORS.deepNavy,
    borderWidth: 2.5,
    borderColor: COLORS.goldAccent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 6px rgba(11,24,32,0.6)',
  },
  coinText: {
    fontFamily: 'Flame-Regular',
    fontSize: COIN * 0.34,
    color: COLORS.goldAccent,
  },
  prompt: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: 'rgba(245,235,220,0.75)',
    marginTop: 20,
  },
  reveal: { width: 320, maxWidth: '100%', marginTop: 20 },
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
  barPctOn: { opacity: 1 },
  caption: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.5)',
  },
  linkRow: { alignSelf: 'center', marginTop: 8 },
  linkPressed: { opacity: 0.7 },
  link: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.goldAccent,
    letterSpacing: 0.3,
  },
});
