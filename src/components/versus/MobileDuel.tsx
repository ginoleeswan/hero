import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';
import type { TeamSide, RosterHero } from '../../lib/teamBattle';
import { HeroBattleCard } from './HeroBattleCard';

const TINT_A = COLORS.red;
const TINT_B = COLORS.blue;
const GOLD = COLORS.goldAccent;

const STATS: [string, keyof RosterHero][] = [
  ['INT', 'intelligence'],
  ['STR', 'strength'],
  ['SPD', 'speed'],
  ['DUR', 'durability'],
  ['PWR', 'power'],
  ['CMB', 'combat'],
];

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** How many of the six stats `x` wins outright against `y`. */
function statWins(x: RosterHero, y: RosterHero): number {
  return STATS.reduce((n, [, k]) => n + ((Number(x[k]) || 0) > (Number(y[k]) || 0) ? 1 : 0), 0);
}

/** A small tappable squad member; the active one wears a gold ring. */
function BenchChip({
  hero,
  tint,
  active,
  size,
  onPress,
}: {
  hero: RosterHero;
  tint: string;
  active: boolean;
  size: number;
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
        { width: size, height: size, borderColor: active ? GOLD : 'rgba(255,255,255,0.18)' },
        active ? styles.chipActive : styles.chipIdle,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[styles.chipFallback, { backgroundColor: tint }]}>
          <Text style={styles.chipInitials}>{initials}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** One mirrored stat: A's value grows left, B's grows right; loser side dims. */
function CompareRow({
  label,
  a,
  b,
  p,
}: {
  label: string;
  a: number;
  b: number;
  p: SharedValue<number>;
}) {
  const total = a + b || 1;
  const aWin = a > b;
  const bWin = b > a;
  const aStyle = useAnimatedStyle(() => ({ width: `${(a / total) * 100 * p.value}%` }));
  const bStyle = useAnimatedStyle(() => ({ width: `${(b / total) * 100 * p.value}%` }));
  return (
    <View style={styles.cRow}>
      <Text style={[styles.cVal, styles.right, aWin ? { color: TINT_A } : null]}>{a}</Text>
      <View style={styles.cTrack}>
        <Animated.View
          style={[
            styles.cFill,
            styles.cFillA,
            { backgroundColor: TINT_A, opacity: bWin ? 0.4 : 1 },
            aStyle,
          ]}
        />
      </View>
      <Text style={styles.cLabel}>{label}</Text>
      <View style={styles.cTrack}>
        <Animated.View
          style={[
            styles.cFill,
            styles.cFillB,
            { backgroundColor: TINT_B, opacity: aWin ? 0.4 : 1 },
            bStyle,
          ]}
        />
      </View>
      <Text style={[styles.cVal, bWin ? { color: TINT_B } : null]}>{b}</Text>
    </View>
  );
}

/** Head-to-head stat sheet for the two spotlighted heroes; re-animates on swap. */
function HeroVsHero({
  a,
  b,
  aWins,
  bWins,
  animate,
}: {
  a: RosterHero;
  b: RosterHero;
  aWins: number;
  bWins: number;
  animate: boolean;
}) {
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) {
      p.value = 0;
      p.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
    } else {
      p.value = 1;
    }
  }, [a.id, b.id, animate, p]);

  return (
    <View style={styles.compare}>
      <View style={styles.compareHead}>
        <Text style={[styles.cName, { color: TINT_A }]} numberOfLines={1}>
          {a.name}
        </Text>
        <View style={styles.tally}>
          <Text style={[styles.tallyN, aWins >= bWins ? { color: TINT_A } : null]}>{aWins}</Text>
          <Text style={styles.tallyDash}>–</Text>
          <Text style={[styles.tallyN, bWins >= aWins ? { color: TINT_B } : null]}>{bWins}</Text>
        </View>
        <Text style={[styles.cName, styles.right, { color: TINT_B }]} numberOfLines={1}>
          {b.name}
        </Text>
      </View>
      {STATS.map(([label, key]) => (
        <CompareRow
          key={label}
          label={label}
          a={Number(a[key]) || 0}
          b={Number(b[key]) || 0}
          p={p}
        />
      ))}
    </View>
  );
}

/** Mobile clash body: two spotlight cards facing off, a tappable bench under
 *  each, and a head-to-head comparison of whoever is spotlighted. */
export function MobileDuel({
  sideA,
  sideB,
  animate,
}: {
  sideA: TeamSide;
  sideB: TeamSide;
  animate: boolean;
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
          animate={animate}
        />
      </View>
      {a && b ? <HeroVsHero a={a} b={b} aWins={aWins} bWins={bWins} animate={animate} /> : null}
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
  animate,
}: {
  side: TeamSide;
  tint: string;
  sel: number;
  setSel: (i: number) => void;
  cardW: number;
  chip: number;
  leads: boolean;
  animate: boolean;
}) {
  const hero = side.roster[sel] ?? side.roster[0];
  return (
    <View style={{ width: cardW }}>
      <Animated.View key={hero?.id} entering={animate ? FadeIn.duration(220) : undefined}>
        {hero ? (
          <HeroBattleCard hero={hero} tint={tint} index={sel} size={cardW} animate={false} />
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

  bench: { flexDirection: 'row', gap: 6, marginTop: 10, justifyContent: 'center' },
  chip: { borderRadius: 9, overflow: 'hidden', borderWidth: 1.5, backgroundColor: '#1b2a30' },
  chipIdle: { opacity: 0.7 },
  chipActive: { opacity: 1, borderWidth: 2 },
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

  compare: { marginTop: 22, width: '100%', maxWidth: 460, alignSelf: 'center' },
  compareHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  cName: { flex: 1, fontFamily: 'Flame-Regular', fontSize: 15 },
  tally: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tallyN: { fontFamily: 'Flame-Regular', fontSize: 18, color: 'rgba(245,235,220,0.5)' },
  tallyDash: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.35)' },
  right: { textAlign: 'right' },
  cRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cVal: { width: 24, fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.55)' },
  cTrack: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  cFill: { position: 'absolute', top: 0, bottom: 0 },
  cFillA: { right: 0, borderTopRightRadius: 5, borderBottomRightRadius: 5 },
  cFillB: { left: 0, borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  cLabel: {
    width: 40,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.78)',
    letterSpacing: 0.4,
  },
});
