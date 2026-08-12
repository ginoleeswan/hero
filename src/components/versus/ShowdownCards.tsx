// src/components/versus/ShowdownCards.tsx — native Battle-Deck showdown. Two
// tilted holographic fighter cards flank a gold VS coin; tapping a card casts
// your vote and reveals the split in place, followed by the ONE way into the
// arena. That link used to be duplicated — this block had "See full breakdown"
// and the screen had a takes link directly beneath it, stacked, both gold, both
// chevroned — and then it was permanent, inviting you to add the first take on
// a fight you had not called. It now appears with the reveal, because voting is
// the price of admission to the debate. Mirrors the web ShowdownStage
// (src/components/web/versus) so the two platforms read as one design; both
// share useMatchupVote.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { RADIUS } from '../../design';
import { HeroImage } from '../HeroImage';
import { useMatchupVote } from '../../hooks/useMatchupVote';
import { crowdSplit } from '../../lib/home/matchupVote';
import type { TodaysMatchup, MatchupHero } from '../../lib/matchup';

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
  takesCount,
  onOpenArena,
}: {
  matchup: TodaysMatchup;
  takesCount: number;
  onOpenArena: () => void;
}) {
  const { heroA, heroB, winsA, winsB } = matchup;
  const { revealed, pickedId, tally, castVote } = useMatchupVote(heroA.id, heroB.id);

  // Today's crowd only speaks once there IS a crowd. Below the floor a "split"
  // is one or two people — most often just you — and drawing your own vote back
  // as a full-width 100% bar reads as a verdict the app has no business
  // claiming. Under the floor the bar shows the pair's all-time record (real
  // data, plainly labelled) and the caption says how many have called it today.
  // The floor lives in crowdSplit: four surfaces drew this bar with their own
  // copy of the rule, so fixing one of them fixed exactly one of them.
  const { pctA, pctB, usingVotes, votes } = crowdSplit(tally, winsA, winsB);
  const caption = usingVotes ? `${votes} fans voted today` : 'All-time record';
  const todayNote = usingVotes
    ? null
    : votes <= 1
      ? 'You called it first today'
      : `${votes} calls today so far`;
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
          {todayNote ? <Text style={styles.todayNote}>{todayNote}</Text> : null}

          {/* AFTER the vote, not before. This was a permanent line of centred
              text under the cards inviting you to "add the first take" on a
              fight you had not called yet — the wrong order, and one of three
              stacked sentences competing for the same axis. Voting is the
              price of admission to the debate, so the way in appears once you
              have paid it. (The ledger's Debate tile still reaches it.) */}
          <Pressable
            onPress={onOpenArena}
            accessibilityRole="button"
            accessibilityLabel="Open the arena"
            style={({ pressed }) => [styles.arenaChip, pressed && styles.chipPressed]}
          >
            <Text style={styles.arenaChipText}>
              {takesCount > 0
                ? `${takesCount} ${takesCount === 1 ? 'take' : 'takes'} — see the debate`
                : 'See the debate'}
            </Text>
            <Ionicons name="chevron-forward" size={12} color={COLORS.goldAccent} />
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
    lineHeight: 22,
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
    color: INK_TEXT.faint,
  },
  arenaChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(206,155,51,0.45)',
    backgroundColor: 'rgba(206,155,51,0.1)',
  },
  chipPressed: { opacity: 0.65 },
  arenaChipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: COLORS.goldAccent,
  },
  todayNote: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: INK_TEXT.faint,
  },
});
