// src/components/versus/TodaysMatchupCard.tsx — the versus-hub daily matchup as
// an in-place POLL. Tapping a fighter casts your vote and reveals the crowd split
// right here (no navigation) — the proven poll pattern. "See full breakdown →"
// then takes you to the arena (the read-only result/deep-dive). The arena itself
// never asks you to vote; the vote lives here, on the card.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { HeroImage } from '../HeroImage';
import { VsBadge } from '../compare/VsBadge';
import { useMatchupVote } from '../../hooks/useMatchupVote';
import { statSplit, statLead } from '../../lib/home/matchupVote';
import type { TodaysMatchup } from '../../lib/matchup';
import type { FighterArt } from '../../lib/compareHandoff';

function Fighter({
  hero,
  side,
  picked,
  dimmed,
  onPress,
}: {
  hero: TodaysMatchup['heroA'];
  side: 'left' | 'right';
  picked: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Vote for ${hero.name}`}
      style={[styles.portraitWrap, picked && styles.portraitPicked, dimmed && styles.portraitDimmed]}
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        contentPosition="top"
        style={[StyleSheet.absoluteFill, styles.portrait]}
      />
      <View style={styles.scrim} />
      {picked ? (
        <View style={styles.pickTag}>
          <Text style={styles.pickTagText}>Your pick</Text>
        </View>
      ) : null}
      <Text style={[styles.name, side === 'right' && styles.nameRight]} numberOfLines={1}>
        {hero.name}
      </Text>
    </Pressable>
  );
}

export function TodaysMatchupCard({
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
    <View style={styles.card}>
      <View style={styles.portraits}>
        <Fighter
          hero={heroA}
          side="left"
          picked={pickedId === heroA.id}
          dimmed={revealed && pickedId !== heroA.id}
          onPress={() => castVote('a')}
        />
        <View style={styles.badge}>
          <VsBadge size={48} variant="solid" />
        </View>
        <Fighter
          hero={heroB}
          side="right"
          picked={pickedId === heroB.id}
          dimmed={revealed && pickedId !== heroB.id}
          onPress={() => castVote('b')}
        />
      </View>

      {!revealed ? (
        <Text style={styles.prompt}>Who would win? Tap your pick.</Text>
      ) : (
        <View style={styles.result}>
          <View style={styles.barTrack}>
            <View style={[styles.barFillA, { flex: Math.max(pctA, 1) }]} />
            <View style={[styles.barFillB, { flex: Math.max(pctB, 1) }]} />
          </View>
          <View style={styles.barLabels}>
            <Text style={[styles.barPct, { color: COLORS.orange }, pickedA && styles.barPctOn]}>
              {pctA}%
            </Text>
            <Text style={styles.caption}>{caption}</Text>
            <Text style={[styles.barPct, { color: COLORS.blue }, !pickedA && styles.barPctOn]}>
              {pctB}%
            </Text>
          </View>
          <Pressable
            onPress={() => onOpen(heroA, heroB)}
            accessibilityRole="button"
            style={styles.linkRow}
          >
            <Text style={styles.link}>See full breakdown →</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.12)',
  },
  portraits: { flexDirection: 'row', height: 200 },
  portraitWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.navy },
  portraitPicked: { borderColor: COLORS.orange, borderWidth: 2 },
  portraitDimmed: { opacity: 0.45 },
  portrait: {},
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: 'rgba(12,17,20,0.55)',
  },
  pickTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.orange,
    paddingVertical: 3,
    alignItems: 'center',
  },
  pickTagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    padding: 12,
  },
  nameRight: { textAlign: 'right' },
  badge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  prompt: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.7)',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  result: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, gap: 8 },
  barTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.1)',
  },
  barFillA: { backgroundColor: COLORS.orange },
  barFillB: { backgroundColor: COLORS.blue },
  barLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
  linkRow: { alignSelf: 'center', marginTop: 2 },
  link: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
    letterSpacing: 0.3,
  },
});
