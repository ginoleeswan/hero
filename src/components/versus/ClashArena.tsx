import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { COLORS, SURFACE_GRADIENT } from '../../constants/colors';
import type { TeamSide, TeamBattleResult, RosterHero } from '../../lib/teamBattle';
import { HeroBattleCard } from './HeroBattleCard';
import { MobileDuel } from './MobileDuel';
import { ClashMeter } from './ClashMeter';
import { HeroVsHero, statWins } from './duelStats';
import { FACTION_A as TINT_A, FACTION_B as TINT_B } from './factionColors';

const GOLD = COLORS.goldAccent;
const STOPWORDS = new Set(['of', 'the', 'and', 'a', '&']);

// Desktop stage geometry.
const CONTAINER_W = 1280;

// Fast, subtle entrance (ms): everything is on screen within ~450ms so the
// vote CTA is never hidden behind a cinematic beat timeline.
const T_SYNERGY = 100;
const T_METER = 0;
const T_VERDICT = 120;

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
  votable?: boolean;
}

export function ClashArena({
  sideA,
  sideB,
  result,
  tally,
  onVote,
  topInset = 24,
  bottomInset = 24,
  votable = true,
}: Props) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const animate = !reduced;
  const isWide = width >= 900;

  const nameA = sideA.team?.name ?? 'Team A';
  const nameB = sideB.team?.name ?? 'Team B';

  return (
    <View style={[styles.stage, { paddingTop: topInset + 14, paddingBottom: bottomInset + 16 }]}>
      <Atmosphere />

      <View style={styles.container}>
        <ClashHeadline
          sideA={sideA}
          sideB={sideB}
          result={result}
          nameA={nameA}
          nameB={nameB}
          wide={isWide}
          animate={animate}
        />
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
            votable={votable}
          />
        ) : (
          <MobileDuel
            sideA={sideA}
            sideB={sideB}
            animate={animate}
            footer={
              <VerdictVotes
                result={result}
                sideA={sideA}
                sideB={sideB}
                nameA={nameA}
                nameB={nameB}
                tally={tally}
                onVote={onVote}
                animate={animate}
                votable={votable}
              />
            }
          />
        )}
      </View>
    </View>
  );
}

/* ── Arena light: the hub's game-lobby stage, verbatim — the stageImmersive
 *    radial spotlight over deep ink, plus the two blurred corner blooms that
 *    take sides (orange A / blue B). Native falls back to gradient washes. ─ */
function Atmosphere() {
  if (Platform.OS === 'web') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View
          style={
            [
              StyleSheet.absoluteFill,
              { backgroundColor: COLORS.deepNavy, backgroundImage: SURFACE_GRADIENT.stageImmersive },
            ] as object
          }
        />
        <View style={styles.glowA as object} />
        <View style={styles.glowB as object} />
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[COLORS.navy, COLORS.deepNavy]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={styles.vignette} />
    </View>
  );
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
  votable,
}: {
  sideA: TeamSide;
  sideB: TeamSide;
  result: TeamBattleResult;
  tally: { votesA: number; votesB: number; total: number } | null;
  onVote: (teamId: string) => void;
  nameA: string;
  nameB: string;
  animate: boolean;
  votable: boolean;
}) {
  const [selA, setSelA] = useState(0);
  const [selB, setSelB] = useState(0);
  const a = sideA.roster[selA] ?? sideA.roster[0];
  const b = sideB.roster[selB] ?? sideB.roster[0];
  const aWins = a && b ? statWins(a, b) : 0;
  const bWins = a && b ? statWins(b, a) : 0;

  return (
    <>
      <View style={styles.ddRow}>
        <View style={styles.ddRowSide}>
          <FactionCrest
            name={nameA}
            tint={TINT_A}
            count={sideA.roster.length}
            align="A"
            animate={animate}
          />
          <RosterColumn
            side={sideA}
            tint={TINT_A}
            sel={selA}
            setSel={setSelA}
            size={96}
            animate={animate}
          />
        </View>

        <View style={styles.ddCenter}>
          <View style={styles.ddSpots}>
            <DuelSpot
              hero={a}
              tint={TINT_A}
              slot={selA}
              size={150}
              leads={aWins > bWins}
              animate={animate}
            />
            <DuelSpot
              hero={b}
              tint={TINT_B}
              slot={selB}
              size={150}
              leads={bWins > aWins}
              flip
              animate={animate}
            />
          </View>
          {a && b ? (
            <View style={styles.ddCompare}>
              <HeroVsHero
                a={a}
                b={b}
                aWins={aWins}
                bWins={bWins}
                animate={animate}
                footer={
                  <VerdictVotes
                    result={result}
                    sideA={sideA}
                    sideB={sideB}
                    nameA={nameA}
                    nameB={nameB}
                    tally={tally}
                    onVote={onVote}
                    animate={animate}
                    votable={votable}
                  />
                }
              />
            </View>
          ) : null}
        </View>

        <View style={styles.ddRowSide}>
          <FactionCrest
            name={nameB}
            tint={TINT_B}
            count={sideB.roster.length}
            align="B"
            animate={animate}
          />
          <RosterColumn
            side={sideB}
            tint={TINT_B}
            sel={selB}
            setSel={setSelB}
            size={96}
            flip
            animate={animate}
          />
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
  // A fanned, overlapping deck: cards stack with vertical overlap and a per-card
  // tilt that arcs toward the centre duel; the spotlit card pops out and forward.
  // `dir` mirrors the whole fan for the right squad.
  const n = side.roster.length;
  const mid = (n - 1) / 2;
  const dir = flip ? -1 : 1;
  const cardH = Math.round((size * 9) / 7);
  // Tighter overlap for bigger squads so the fan never outgrows the centre stack.
  const overlap = Math.round(cardH * (n >= 5 ? 0.3 : 0.2));
  return (
    <View style={styles.ddCol}>
      {side.roster.map((h, i) => {
        const d = i - mid;
        const reach = mid > 0 ? (1 - Math.abs(d) / mid) * 20 : 0; // arc bows toward the centre
        const isSel = i === sel;
        // A spread fan: tilt grows toward the ends; the spotlit card lifts out.
        const transform = [
          { translateX: dir * (reach + (isSel ? 28 : 0)) },
          { rotate: `${dir * d * 5}deg` },
          { scale: isSel ? 1.08 : 1 },
        ];
        return (
          <View
            key={h.id}
            // Upper cards stack over lower ones so every name plate stays legible.
            style={{ marginTop: i === 0 ? 0 : -overlap, zIndex: isSel ? 50 : n - i, transform }}
          >
            <HeroBattleCard
              hero={h}
              tint={tint}
              index={i}
              size={size}
              animate={animate}
              flip={flip}
              selected={isSel}
              onPress={() => setSel(i)}
            />
          </View>
        );
      })}
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
    <Animated.View
      key={hero?.id}
      entering={animate ? FadeIn.duration(220) : undefined}
      style={{ width: size }}
    >
      {hero ? (
        <HeroBattleCard
          hero={hero}
          tint={tint}
          index={slot}
          size={size}
          animate={false}
          flip={flip}
        />
      ) : null}
      {leads ? (
        <View style={styles.crown}>
          <Ionicons name="trophy" size={12} color={COLORS.deepNavy} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/* ── Desktop faction crest (coin + name + member count) ───────────────────── */
function FactionCrest({
  name,
  tint,
  count,
  align,
  animate,
}: {
  name: string;
  tint: string;
  count: number;
  align: 'A' | 'B';
  animate: boolean;
}) {
  const initials = useMemo(() => crestInitials(name), [name]);
  const reverse = align === 'B';
  return (
    <Animated.View
      entering={animate ? FadeIn.delay(60).duration(240) : undefined}
      style={[styles.crest, reverse ? styles.crestReverse : null]}
    >
      <LinearGradient colors={[tint, COLORS.deepNavy]} style={styles.coin}>
        <Text style={styles.coinTxt}>{initials}</Text>
      </LinearGradient>
      <View style={reverse ? styles.crestTextR : styles.crestText}>
        <Text
          style={[styles.crestName, { color: tint }, reverse ? styles.right : null]}
          numberOfLines={2}
        >
          {name}
        </Text>
        <Text style={[styles.crestMeta, reverse ? styles.right : null]}>
          {count} {count === 1 ? 'member' : 'members'}
        </Text>
      </View>
    </Animated.View>
  );
}

/* ── The header: house eyebrow + Flame title (same voice as the Arena hub),
 *    then the score numerals, the front-line meter and the synergy pips. ── */
function ClashHeadline({
  sideA,
  sideB,
  result,
  nameA,
  nameB,
  wide,
  animate,
}: {
  sideA: TeamSide;
  sideB: TeamSide;
  result: TeamBattleResult;
  nameA: string;
  nameB: string;
  wide: boolean;
  animate: boolean;
}) {
  const synA = Math.round(sideA.synergy.total_pct * 100);
  const synB = Math.round(sideB.synergy.total_pct * 100);
  return (
    <View style={styles.headline}>
      <Animated.Text entering={animate ? FadeIn.duration(200) : undefined} style={styles.eyebrow}>
        {'★ Team Battle ★'}
      </Animated.Text>
      <Animated.Text
        entering={animate ? FadeIn.duration(240) : undefined}
        style={[styles.title, !wide ? styles.titleMobile : null]}
      >
        {nameA} vs {nameB}
      </Animated.Text>
      <View style={styles.meterRow}>
        <Text style={[styles.score, { color: TINT_A }]}>{result.splitA}</Text>
        <View style={styles.meterFlex}>
          <ClashMeter
            splitA={result.splitA}
            tintA={TINT_A}
            tintB={TINT_B}
            animate={animate}
            delay={T_METER}
          />
        </View>
        <Text style={[styles.score, styles.right, { color: TINT_B }]}>{result.splitB}</Text>
      </View>
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
  votable = true,
}: {
  result: TeamBattleResult;
  sideA: TeamSide;
  sideB: TeamSide;
  nameA: string;
  nameB: string;
  tally: { votesA: number; votesB: number; total: number } | null;
  onVote: (teamId: string) => void;
  animate: boolean;
  votable?: boolean;
}) {
  return (
    <View style={styles.verdictWrap}>
      <Animated.View
        entering={animate ? FadeIn.delay(T_VERDICT) : undefined}
        style={styles.verdictBlock}
      >
        <Text style={styles.verdictEyebrow}>THE VERDICT</Text>
        <Text style={styles.verdict}>{result.verdict}</Text>
      </Animated.View>
      {votable ? (
        <>
          <Animated.View
            entering={animate ? FadeIn.delay(T_VERDICT + 90) : undefined}
            style={styles.votes}
          >
            <VoteButton
              tint={TINT_A}
              name={nameA}
              onPress={() => sideA.team && onVote(sideA.team.id)}
            />
            <VoteButton
              tint={TINT_B}
              name={nameB}
              onPress={() => sideB.team && onVote(sideB.team.id)}
            />
          </Animated.View>
          {tally && tally.total > 0 ? (
            <Text style={styles.tally}>
              {tally.votesA} – {tally.votesB} · {tally.total} {tally.total === 1 ? 'vote' : 'votes'}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function VoteButton({ tint, name, onPress }: { tint: string; name: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.voteBtn,
        { backgroundColor: tint },
        pressed ? styles.votePressed : null,
      ]}
      onPress={onPress}
    >
      <Text style={styles.voteTop}>VOTE</Text>
      <Text style={styles.voteName} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: COLORS.deepNavy,
    paddingHorizontal: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  // The hub's corner colour blooms — orange (A) vs blue (B). Web-only (blur).
  glowA: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    top: 60,
    left: '8%',
    backgroundColor: 'rgba(231,115,51,0.10)',
    filter: 'blur(90px)',
  } as object,
  glowB: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    top: 60,
    right: '8%',
    backgroundColor: 'rgba(21,161,171,0.10)',
    filter: 'blur(90px)',
  } as object,
  vignette: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  container: { width: '100%', maxWidth: CONTAINER_W, alignSelf: 'center', zIndex: 1 },

  /* ── desktop grand duel ── symmetric flex-1 / fixed-centre / flex-1 so the
   * centre column is page-centred regardless of crest or roster widths. Each
   * side is a self-contained squad: crest on top, fanned roster below. */
  ddRow: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', marginTop: 20 },
  ddRowSide: { flex: 1, alignItems: 'center', gap: 14 },
  ddCol: { alignItems: 'center' },
  ddCenter: { width: 520, alignItems: 'center' },
  ddSpots: { flexDirection: 'row', gap: 16, marginBottom: 14, justifyContent: 'center' },
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

  /* desktop crest */
  crest: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 },
  crestReverse: { flexDirection: 'row-reverse' },
  coin: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(206,155,51,0.85)',
  },
  coinTxt: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige, letterSpacing: 0.5 },
  crestText: { flexShrink: 1 },
  crestTextR: { flexShrink: 1, alignItems: 'flex-end' },
  crestName: { fontFamily: 'Flame-Regular', fontSize: 18, letterSpacing: 0.3 },
  crestMeta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  right: { textAlign: 'right' },

  /* clash headline */
  headline: { alignItems: 'center', width: '100%' },
  // The house eyebrow + Flame title — same voice as the hub's header.
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: GOLD,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 34,
    lineHeight: 42,
    color: COLORS.beige,
    textAlign: 'center',
  },
  titleMobile: { fontSize: 24, lineHeight: 30 },
  // Scores flank the meter — one compact row instead of a tall numeral block.
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 460,
    marginTop: 12,
  },
  meterFlex: { flex: 1 },
  score: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 36, minWidth: 44 },
  synRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 400,
    marginTop: 10,
  },
  synPip: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 0.4 },

  /* verdict + votes — rendered inside the ringside panel's footer slot */
  verdictWrap: { width: '100%', marginTop: 6 },
  verdictBlock: { alignItems: 'center' },
  verdictEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2.4,
    color: 'rgba(206,155,51,0.7)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  verdict: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.beige,
    textAlign: 'center',
    lineHeight: 18,
  },
  votes: { flexDirection: 'row', gap: 12, marginTop: 12 },
  voteBtn: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  votePressed: { opacity: 0.82 },
  voteTop: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff', letterSpacing: 1.5 },
  voteName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 1,
  },
  tally: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 10,
    textAlign: 'center',
  },
});
