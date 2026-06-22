import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';
import type { TeamSide, TeamBattleResult, RosterHero } from '../../lib/teamBattle';
import { HeroBattleCard } from './HeroBattleCard';
import { MobileDuel } from './MobileDuel';
import { ClashMeter } from './ClashMeter';
import { HeroVsHero, statWins } from './duelStats';
import { FACTION_A as TINT_A, FACTION_B as TINT_B } from './factionColors';

const GOLD = COLORS.goldAccent;
const STOPWORDS = new Set(['of', 'the', 'and', 'a', '&']);

// Desktop stage geometry.
const CONTAINER_W = 1460;
const CENTER_W = 360; // the headline column

// Beat timeline (ms): cards deal → synergy ignites → CLASH lands → meter charges.
const T_SYNERGY = 760;
const T_CLASH = 960;
const T_METER = 1140;
const T_VERDICT = 1700;

function crestInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()))
    .map((w) => w[0]);
  return (letters.join('') || name.slice(0, 2)).slice(0, 3).toUpperCase();
}

interface Props {
  sideA: TeamSide;
  sideB: TeamSide;
  result: TeamBattleResult;
  tally: { votesA: number; votesB: number; total: number } | null;
  onVote: (teamId: string) => void;
  topInset?: number;
  bottomInset?: number;
}

export function ClashArena({ sideA, sideB, result, tally, onVote, topInset = 24, bottomInset = 24 }: Props) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const animate = !reduced;
  const isWide = width >= 900;

  const nameA = sideA.team?.name ?? 'Team A';
  const nameB = sideB.team?.name ?? 'Team B';

  return (
    <View style={[styles.stage, { paddingTop: topInset + 18, paddingBottom: bottomInset + 28 }]}>
      <Atmosphere />
      <Flash animate={animate} />

      <View style={styles.container}>
        {isWide ? (
          <DesktopDuel
            sideA={sideA}
            sideB={sideB}
            result={result}
            tally={tally}
            onVote={onVote}
            nameA={nameA}
            nameB={nameB}
            animate={animate}
          />
        ) : (
          <>
            <FactionBar nameA={nameA} nameB={nameB} animate={animate} />
            <ClashHeadline sideA={sideA} sideB={sideB} result={result} animate={animate} />
            <MobileDuel sideA={sideA} sideB={sideB} animate={animate} />
            <VerdictVotes
              result={result}
              sideA={sideA}
              sideB={sideB}
              nameA={nameA}
              nameB={nameB}
              tally={tally}
              onVote={onVote}
              animate={animate}
            />
          </>
        )}
      </View>
    </View>
  );
}

/* ── Arena light: a navy stage that lifts toward the top (theatrical, neutral)
 *    with a faint gold crown and a deepening floor. No team-coloured washes. ─ */
function Atmosphere() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[COLORS.navy, COLORS.deepNavy]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.85 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(206,155,51,0.10)', 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.spot} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={styles.vignette} />
    </View>
  );
}

function Flash({ animate }: { animate: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (animate) {
      v.value = withDelay(T_CLASH - 40, withSequence(withTiming(0.5, { duration: 110 }), withTiming(0, { duration: 440 })));
    }
  }, [animate, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View pointerEvents="none" style={[styles.flash, style]} />;
}

/* ── Desktop Grand Duel: crested header, two clickable roster columns flanking
 *    a centre stage of two big spotlight cards + the head-to-head + verdict. ─ */
function DesktopDuel({
  sideA,
  sideB,
  result,
  tally,
  onVote,
  nameA,
  nameB,
  animate,
}: {
  sideA: TeamSide;
  sideB: TeamSide;
  result: TeamBattleResult;
  tally: { votesA: number; votesB: number; total: number } | null;
  onVote: (teamId: string) => void;
  nameA: string;
  nameB: string;
  animate: boolean;
}) {
  const [selA, setSelA] = useState(0);
  const [selB, setSelB] = useState(0);
  const a = sideA.roster[selA] ?? sideA.roster[0];
  const b = sideB.roster[selB] ?? sideB.roster[0];
  const aWins = a && b ? statWins(a, b) : 0;
  const bWins = a && b ? statWins(b, a) : 0;

  return (
    <>
      <View style={styles.ddHeader}>
        <View style={styles.ddHeadSideL}>
          <FactionCrest name={nameA} tint={TINT_A} count={sideA.roster.length} align="A" animate={animate} />
        </View>
        <View style={styles.ddHeadCenter}>
          <ClashHeadline sideA={sideA} sideB={sideB} result={result} animate={animate} />
        </View>
        <View style={styles.ddHeadSideR}>
          <FactionCrest name={nameB} tint={TINT_B} count={sideB.roster.length} align="B" animate={animate} />
        </View>
      </View>

      <View style={styles.ddRow}>
        <View style={styles.ddRowSideL}>
          <RosterColumn side={sideA} tint={TINT_A} sel={selA} setSel={setSelA} size={112} animate={animate} />
        </View>

        <View style={styles.ddCenter}>
          <View style={styles.ddSpots}>
            <DuelSpot hero={a} tint={TINT_A} slot={selA} size={190} leads={aWins > bWins} animate={animate} />
            <DuelSpot hero={b} tint={TINT_B} slot={selB} size={190} leads={bWins > aWins} flip animate={animate} />
          </View>
          {a && b ? (
            <View style={styles.ddCompare}>
              <HeroVsHero a={a} b={b} aWins={aWins} bWins={bWins} animate={animate} />
            </View>
          ) : null}
          <VerdictVotes result={result} sideA={sideA} sideB={sideB} nameA={nameA} nameB={nameB} tally={tally} onVote={onVote} animate={animate} />
        </View>

        <View style={styles.ddRowSideR}>
          <RosterColumn side={sideB} tint={TINT_B} sel={selB} setSel={setSelB} size={112} flip animate={animate} />
        </View>
      </View>
    </>
  );
}

function RosterColumn({
  side,
  tint,
  sel,
  setSel,
  size,
  flip = false,
  animate,
}: {
  side: TeamSide;
  tint: string;
  sel: number;
  setSel: (i: number) => void;
  size: number;
  flip?: boolean;
  animate: boolean;
}) {
  return (
    <View style={styles.ddCol}>
      {side.roster.map((h, i) => (
        <HeroBattleCard
          key={h.id}
          hero={h}
          tint={tint}
          index={i}
          size={size}
          animate={animate}
          flip={flip}
          selected={i === sel}
          onPress={() => setSel(i)}
        />
      ))}
    </View>
  );
}

function DuelSpot({
  hero,
  tint,
  slot,
  size,
  leads,
  flip = false,
  animate,
}: {
  hero: RosterHero | undefined;
  tint: string;
  slot: number;
  size: number;
  leads: boolean;
  flip?: boolean;
  animate: boolean;
}) {
  return (
    <Animated.View key={hero?.id} entering={animate ? FadeIn.duration(220) : undefined} style={{ width: size }}>
      {hero ? <HeroBattleCard hero={hero} tint={tint} index={slot} size={size} animate={false} flip={flip} /> : null}
      {leads ? (
        <View style={styles.crown}>
          <Ionicons name="trophy" size={12} color={COLORS.deepNavy} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/* ── Mobile faceoff bar: two crested coins meeting at a gold "vs" ──────────── */
function FactionBar({ nameA, nameB, animate }: { nameA: string; nameB: string; animate: boolean }) {
  return (
    <Animated.View entering={animate ? FadeIn.duration(360) : undefined} style={styles.faceoff}>
      <LinearGradient colors={[TINT_A, COLORS.deepNavy]} style={styles.coinSm}>
        <Text style={styles.coinSmTxt}>{crestInitials(nameA)}</Text>
      </LinearGradient>
      <Text style={[styles.faceName, { color: TINT_A }]} numberOfLines={1}>
        {nameA}
      </Text>
      <Text style={styles.faceVs}>vs</Text>
      <Text style={[styles.faceName, styles.right, { color: TINT_B }]} numberOfLines={1}>
        {nameB}
      </Text>
      <LinearGradient colors={[TINT_B, COLORS.deepNavy]} style={styles.coinSm}>
        <Text style={styles.coinSmTxt}>{crestInitials(nameB)}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

/* ── Desktop faction crest (coin + name + member count) ───────────────────── */
function FactionCrest({ name, tint, count, align, animate }: { name: string; tint: string; count: number; align: 'A' | 'B'; animate: boolean }) {
  const initials = useMemo(() => crestInitials(name), [name]);
  const reverse = align === 'B';
  return (
    <Animated.View entering={animate ? FadeIn.delay(120).duration(360) : undefined} style={[styles.crest, reverse ? styles.crestReverse : null]}>
      <LinearGradient colors={[tint, COLORS.deepNavy]} style={styles.coin}>
        <Text style={styles.coinTxt}>{initials}</Text>
      </LinearGradient>
      <View style={reverse ? styles.crestTextR : styles.crestText}>
        <Text style={[styles.crestName, { color: tint }, reverse ? styles.right : null]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.crestMeta, reverse ? styles.right : null]}>
          {count} {count === 1 ? 'member' : 'members'}
        </Text>
      </View>
    </Animated.View>
  );
}

/* ── The result: CLASH wordmark, score numerals, front-line meter, synergy ── */
function ClashHeadline({ sideA, sideB, result, animate }: { sideA: TeamSide; sideB: TeamSide; result: TeamBattleResult; animate: boolean }) {
  const synA = Math.round(sideA.synergy.total_pct * 100);
  const synB = Math.round(sideB.synergy.total_pct * 100);
  return (
    <View style={styles.headline}>
      <Animated.Text entering={animate ? ZoomIn.delay(T_CLASH).duration(300) : undefined} style={styles.clash}>
        CLASH
      </Animated.Text>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color: TINT_A }]}>{result.splitA}</Text>
        <Text style={styles.scoreVs}>vs</Text>
        <Text style={[styles.score, { color: TINT_B }]}>{result.splitB}</Text>
      </View>
      <ClashMeter splitA={result.splitA} tintA={TINT_A} tintB={TINT_B} animate={animate} delay={T_METER} />
      <Animated.View entering={animate ? FadeIn.delay(T_SYNERGY) : undefined} style={styles.synRow}>
        <Text style={[styles.synPip, { color: TINT_A }]}>SYNERGY +{synA}%</Text>
        <Text style={[styles.synPip, { color: TINT_B }]}>+{synB}% SYNERGY</Text>
      </Animated.View>
    </View>
  );
}

function VerdictVotes({
  result,
  sideA,
  sideB,
  nameA,
  nameB,
  tally,
  onVote,
  animate,
}: {
  result: TeamBattleResult;
  sideA: TeamSide;
  sideB: TeamSide;
  nameA: string;
  nameB: string;
  tally: { votesA: number; votesB: number; total: number } | null;
  onVote: (teamId: string) => void;
  animate: boolean;
}) {
  return (
    <View style={styles.verdictWrap}>
      <Animated.View entering={animate ? FadeIn.delay(T_VERDICT) : undefined} style={styles.verdictBlock}>
        <Text style={styles.verdictEyebrow}>THE VERDICT</Text>
        <Text style={styles.verdict}>{result.verdict}</Text>
      </Animated.View>
      <Animated.View entering={animate ? FadeIn.delay(T_VERDICT + 90) : undefined} style={styles.votes}>
        <VoteButton tint={TINT_A} name={nameA} onPress={() => sideA.team && onVote(sideA.team.id)} />
        <VoteButton tint={TINT_B} name={nameB} onPress={() => sideB.team && onVote(sideB.team.id)} />
      </Animated.View>
      {tally && tally.total > 0 ? (
        <Text style={styles.tally}>
          {tally.votesA} – {tally.votesB} · {tally.total} {tally.total === 1 ? 'vote' : 'votes'}
        </Text>
      ) : null}
    </View>
  );
}

function VoteButton({ tint, name, onPress }: { tint: string; name: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.voteBtn, { backgroundColor: tint }, pressed ? styles.votePressed : null]} onPress={onPress}>
      <Text style={styles.voteTop}>VOTE</Text>
      <Text style={styles.voteName} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: COLORS.deepNavy, paddingHorizontal: 16, alignItems: 'center', overflow: 'hidden' },
  spot: { position: 'absolute', left: 0, right: 0, top: 0, height: '55%' },
  vignette: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: GOLD, zIndex: 5 },
  container: { width: '100%', maxWidth: CONTAINER_W, alignSelf: 'center', zIndex: 1 },

  /* ── desktop grand duel ── symmetric flex-1 / fixed-centre / flex-1 so the
   * centre column is page-centred regardless of crest or roster widths. */
  ddHeader: { flexDirection: 'row', alignItems: 'flex-start', width: '100%' },
  ddHeadSideL: { flex: 1, alignItems: 'flex-start' },
  ddHeadSideR: { flex: 1, alignItems: 'flex-end' },
  ddHeadCenter: { width: CENTER_W },
  ddRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginTop: 18 },
  // Rosters sit at the outer edges, directly under their crests, so the two
  // squads bookend the stage and the duel commands the centre.
  ddRowSideL: { flex: 1, alignItems: 'flex-start' },
  ddRowSideR: { flex: 1, alignItems: 'flex-end' },
  ddCol: { gap: 12 },
  ddCenter: { width: 540, alignItems: 'center' },
  ddSpots: { flexDirection: 'row', gap: 16, marginBottom: 22, justifyContent: 'center' },
  ddCompare: { width: '100%', marginBottom: 4 },
  crown: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  /* mobile faceoff bar */
  faceoff: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  coinSm: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(206,155,51,0.85)' },
  coinSmTxt: { fontFamily: 'Flame-Regular', fontSize: 12, color: COLORS.beige },
  faceName: { flex: 1, fontFamily: 'Flame-Regular', fontSize: 15 },
  faceVs: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.45)', textTransform: 'uppercase', letterSpacing: 1 },

  /* desktop crest */
  crest: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 },
  crestReverse: { flexDirection: 'row-reverse' },
  coin: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(206,155,51,0.85)' },
  coinTxt: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige, letterSpacing: 0.5 },
  crestText: { flexShrink: 1 },
  crestTextR: { flexShrink: 1, alignItems: 'flex-end' },
  crestName: { fontFamily: 'Flame-Regular', fontSize: 18, letterSpacing: 0.3 },
  crestMeta: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: 'rgba(245,235,220,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  right: { textAlign: 'right' },

  /* clash headline */
  headline: { alignItems: 'center', width: '100%' },
  clash: {
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    color: GOLD,
    letterSpacing: 2,
    textShadowColor: 'rgba(206,155,51,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 16, marginTop: 4, marginBottom: 14 },
  score: { fontFamily: 'Flame-Regular', fontSize: 48, lineHeight: 52 },
  scoreVs: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.45)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  synRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', maxWidth: 360, marginTop: 12 },
  synPip: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 0.4 },

  /* verdict + votes */
  verdictWrap: { width: '100%', maxWidth: 380, alignSelf: 'center', marginTop: 24 },
  verdictBlock: { alignItems: 'center' },
  verdictEyebrow: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 2.4, color: 'rgba(206,155,51,0.7)', textTransform: 'uppercase', marginBottom: 6 },
  verdict: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.beige, textAlign: 'center', lineHeight: 20 },
  votes: { flexDirection: 'row', gap: 12, marginTop: 18 },
  voteBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  votePressed: { opacity: 0.82 },
  voteTop: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff', letterSpacing: 1.5 },
  voteName: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.82)', marginTop: 1 },
  tally: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: 'rgba(245,235,220,0.6)', marginTop: 14, textAlign: 'center' },
});
