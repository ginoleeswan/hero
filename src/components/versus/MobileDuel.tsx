import { useMemo, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';
import type { TeamSide, RosterHero } from '../../lib/teamBattle';
import { HeroBattleCard } from './HeroBattleCard';
import { FACTION_A as TINT_A, FACTION_B as TINT_B } from './factionColors';
import { HeroVsHero, statWins } from './duelStats';

const GOLD = COLORS.goldAccent;

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** A small tappable squad member; the active one wears a gold ring. */
function BenchChip({
  hero,
  tint,
  active,
  size,
  flip,
  onPress,
}: {
  hero: RosterHero;
  tint: string;
  active: boolean;
  size: number;
  flip: boolean;
  onPress: () => void;
}) {
  const uri = hero.portrait_url ?? hero.image_url ?? undefined;
  const initials = useMemo(() => initialsOf(hero.name), [hero.name]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.chip,
        { width: size, height: size, borderColor: active ? GOLD : 'transparent' },
        active ? styles.chipActive : styles.chipIdle,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, flip ? styles.flip : null]}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.chipFallback, { backgroundColor: tint }]}>
          <Text style={styles.chipInitials}>{initials}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Mobile clash body: two spotlight cards facing off, a tappable bench under
 *  each, and a head-to-head comparison of whoever is spotlighted. */
export function MobileDuel({
  sideA,
  sideB,
  animate,
  footer,
}: {
  sideA: TeamSide;
  sideB: TeamSide;
  animate: boolean;
  /** Verdict + vote CTA, rendered inside the head-to-head panel. */
  footer?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const [selA, setSelA] = useState(0);
  const [selB, setSelB] = useState(0);

  const gap = 14;
  const cardW = Math.min(200, Math.floor((Math.min(width, 540) - 32 - gap) / 2));
  const chip = Math.floor((cardW - 4 * 6) / 5);

  const a = sideA.roster[selA] ?? sideA.roster[0];
  const b = sideB.roster[selB] ?? sideB.roster[0];
  const aWins = a && b ? statWins(a, b) : 0;
  const bWins = a && b ? statWins(b, a) : 0;

  return (
    <View style={styles.duel}>
      <View style={[styles.row, { gap }]}>
        <Spotlight
          side={sideA}
          tint={TINT_A}
          sel={selA}
          setSel={setSelA}
          cardW={cardW}
          chip={chip}
          leads={aWins > bWins}
          animate={animate}
        />
        <Spotlight
          side={sideB}
          tint={TINT_B}
          sel={selB}
          setSel={setSelB}
          cardW={cardW}
          chip={chip}
          leads={bWins > aWins}
          flip
          animate={animate}
        />
      </View>
      {a && b ? (
        <View style={styles.compareWrap}>
          <HeroVsHero a={a} b={b} aWins={aWins} bWins={bWins} animate={animate} footer={footer} />
        </View>
      ) : null}
    </View>
  );
}

function Spotlight({
  side,
  tint,
  sel,
  setSel,
  cardW,
  chip,
  leads,
  flip = false,
  animate,
}: {
  side: TeamSide;
  tint: string;
  sel: number;
  setSel: (i: number) => void;
  cardW: number;
  chip: number;
  leads: boolean;
  flip?: boolean;
  animate: boolean;
}) {
  const hero = side.roster[sel] ?? side.roster[0];
  return (
    <View style={{ width: cardW }}>
      <Animated.View key={hero?.id} entering={animate ? FadeIn.duration(220) : undefined}>
        {hero ? (
          <HeroBattleCard
            hero={hero}
            tint={tint}
            index={sel}
            size={cardW}
            animate={false}
            flip={flip}
          />
        ) : null}
        {leads ? (
          <View style={styles.crown}>
            <Ionicons name="trophy" size={11} color={COLORS.deepNavy} />
          </View>
        ) : null}
      </Animated.View>
      <View style={styles.bench}>
        {side.roster.map((h, i) => (
          <BenchChip
            key={h.id}
            hero={h}
            tint={tint}
            active={i === sel}
            size={chip}
            flip={flip}
            onPress={() => setSel(i)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  duel: { width: '100%', marginTop: 26 },
  row: { flexDirection: 'row', justifyContent: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
  compareWrap: { marginTop: 22 },

  bench: { flexDirection: 'row', gap: 6, marginTop: 10, justifyContent: 'center' },
  chip: { borderRadius: 9, overflow: 'hidden', borderWidth: 2, backgroundColor: '#1b2a30' },
  chipIdle: { opacity: 0.5 },
  chipActive: {
    opacity: 1,
    shadowColor: GOLD,
    shadowOpacity: 0.7,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  chipFallback: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInitials: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.beige },

  crown: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
