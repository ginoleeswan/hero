import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import type { TeamSide, TeamBattleResult } from '../../lib/teamBattle';
import { HeroBattleCard } from './HeroBattleCard';
import { HeroStatPanel } from './HeroStatPanel';
import { ClashMeter } from './ClashMeter';

const TINT_A = COLORS.red;
const TINT_B = COLORS.blue;
const GOLD = COLORS.goldAccent;
const STOPWORDS = new Set(['of', 'the', 'and', 'a', '&']);

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

export function ClashArena({
  sideA,
  sideB,
  result,
  tally,
  onVote,
  topInset = 24,
  bottomInset = 24,
}: Props) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const animate = !reduced;
  const isWide = width >= 860;

  const nameA = sideA.team?.name ?? 'Team A';
  const nameB = sideB.team?.name ?? 'Team B';
  const cardSize = isWide ? 86 : Math.floor((Math.min(width, 480) - 32 - 24) / 3);

  const headline = <ClashHeadline sideA={sideA} sideB={sideB} result={result} animate={animate} />;
  const verdict = (
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
  );

  return (
    <View style={[styles.stage, { paddingTop: topInset + 18, paddingBottom: bottomInset + 28 }]}>
      <Atmosphere />
      <Flash animate={animate} />

      <View style={styles.container}>
        {isWide ? (
          <>
            <View style={styles.wideRow}>
              <FactionZone
                side={sideA}
                tint={TINT_A}
                cardSize={cardSize}
                align="A"
                animate={animate}
              />
              <View style={styles.centerWide}>
                {headline}
                {verdict}
              </View>
              <FactionZone
                side={sideB}
                tint={TINT_B}
                cardSize={cardSize}
                align="B"
                animate={animate}
              />
            </View>
            <StatBreakdown result={result} animate={animate} />
          </>
        ) : (
          <>
            <FactionBar nameA={nameA} nameB={nameB} animate={animate} />
            {headline}
            <View style={styles.mobileRosters}>
              <MobileRoster side={sideA} tint={TINT_A} cardSize={cardSize} animate={animate} />
              <MobileRoster side={sideB} tint={TINT_B} cardSize={cardSize} animate={animate} />
            </View>
            {verdict}
            <StatBreakdown result={result} animate={animate} />
          </>
        )}
      </View>
    </View>
  );
}

/* ── Layered arena light: team glow from each flank, gold spot, vignette ──── */
function Atmosphere() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['rgba(181,48,43,0.32)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.flankA}
      />
      <LinearGradient
        colors={['transparent', 'rgba(21,161,171,0.32)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.flankB}
      />
      <LinearGradient colors={['rgba(206,155,51,0.12)', 'transparent']} style={styles.spot} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.vignette} />
    </View>
  );
}

function Flash({ animate }: { animate: boolean }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (animate) {
      v.value = withDelay(
        T_CLASH - 40,
        withSequence(withTiming(0.5, { duration: 110 }), withTiming(0, { duration: 440 })),
      );
    }
  }, [animate, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View pointerEvents="none" style={[styles.flash, style]} />;
}

/* ── Mobile faceoff bar: two crested coins meeting at a gold "vs" ──────────── */
function FactionBar({ nameA, nameB, animate }: { nameA: string; nameB: string; animate: boolean }) {
  return (
    <Animated.View entering={animate ? FadeIn.duration(360) : undefined} style={styles.faceoff}>
      <LinearGradient colors={[TINT_A, '#1a1426']} style={styles.coinSm}>
        <Text style={styles.coinSmTxt}>{crestInitials(nameA)}</Text>
      </LinearGradient>
      <Text style={[styles.faceName, { color: TINT_A }]} numberOfLines={1}>
        {nameA}
      </Text>
      <Text style={styles.faceVs}>vs</Text>
      <Text style={[styles.faceName, styles.right, { color: TINT_B }]} numberOfLines={1}>
        {nameB}
      </Text>
      <LinearGradient colors={[TINT_B, '#1a1426']} style={styles.coinSm}>
        <Text style={styles.coinSmTxt}>{crestInitials(nameB)}</Text>
      </LinearGradient>
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
      entering={animate ? FadeIn.delay(120).duration(360) : undefined}
      style={[styles.crest, reverse ? styles.crestReverse : null]}
    >
      <LinearGradient colors={[tint, '#1a1426']} style={styles.coin}>
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

/* ── Desktop faction column: crest above a centered card block ────────────── */
function FactionZone({
  side,
  tint,
  cardSize,
  align,
  animate,
}: {
  side: TeamSide;
  tint: string;
  cardSize: number;
  align: 'A' | 'B';
  animate: boolean;
}) {
  return (
    <View style={[styles.zone, { alignItems: align === 'A' ? 'flex-end' : 'flex-start' }]}>
      <FactionCrest
        name={side.team?.name ?? ''}
        tint={tint}
        count={side.roster.length}
        align={align}
        animate={animate}
      />
      <View style={[styles.cardWrap, align === 'B' ? styles.cardWrapR : null]}>
        {side.roster.map((h, i) => (
          <HeroBattleCard
            key={h.id}
            hero={h}
            tint={tint}
            index={i}
            size={cardSize}
            animate={animate}
          />
        ))}
      </View>
    </View>
  );
}

/* ── Mobile roster: a 3-up card grid; tap a hero to reveal their stats ────── */
function MobileRoster({
  side,
  tint,
  cardSize,
  animate,
}: {
  side: TeamSide;
  tint: string;
  cardSize: number;
  animate: boolean;
}) {
  const [sel, setSel] = useState(0);
  const selected = side.roster[sel] ?? side.roster[0];
  return (
    <View style={styles.mRoster}>
      <View style={styles.mLabel}>
        <View style={[styles.mDot, { backgroundColor: tint }]} />
        <Text style={[styles.mLabelTxt, { color: tint }]} numberOfLines={1}>
          {side.team?.name}
        </Text>
        <Text style={styles.mHint}>TAP TO COMPARE</Text>
      </View>
      <View style={styles.mGrid}>
        {side.roster.map((h, i) => (
          <HeroBattleCard
            key={h.id}
            hero={h}
            tint={tint}
            index={i}
            size={cardSize}
            animate={animate}
            selected={i === sel}
            onPress={() => setSel(i)}
          />
        ))}
      </View>
      {selected ? <HeroStatPanel key={selected.id} hero={selected} tint={tint} animate={animate} /> : null}
    </View>
  );
}

/* ── The result: CLASH wordmark, score numerals, front-line meter, synergy ── */
function ClashHeadline({
  sideA,
  sideB,
  result,
  animate,
}: {
  sideA: TeamSide;
  sideB: TeamSide;
  result: TeamBattleResult;
  animate: boolean;
}) {
  const synA = Math.round(sideA.synergy.total_pct * 100);
  const synB = Math.round(sideB.synergy.total_pct * 100);
  return (
    <View style={styles.headline}>
      <Animated.Text
        entering={animate ? ZoomIn.delay(T_CLASH).duration(300) : undefined}
        style={styles.clash}
      >
        CLASH
      </Animated.Text>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color: TINT_A }]}>{result.splitA}</Text>
        <Text style={styles.scoreVs}>vs</Text>
        <Text style={[styles.score, { color: TINT_B }]}>{result.splitB}</Text>
      </View>
      <ClashMeter
        splitA={result.splitA}
        tintA={TINT_A}
        tintB={TINT_B}
        animate={animate}
        delay={T_METER}
      />
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
      <Animated.View
        entering={animate ? FadeIn.delay(T_VERDICT) : undefined}
        style={styles.verdictBlock}
      >
        <Text style={styles.verdictEyebrow}>THE VERDICT</Text>
        <Text style={styles.verdict}>{result.verdict}</Text>
      </Animated.View>
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

/* ── Tale of the tape: mirrored composite stat bars with values ───────────── */
function StatBreakdown({ result, animate }: { result: TeamBattleResult; animate: boolean }) {
  return (
    <Animated.View
      entering={animate ? FadeIn.delay(T_VERDICT + 160) : undefined}
      style={styles.breakdown}
    >
      <Text style={styles.breakdownTitle}>Tale of the Tape</Text>
      {result.stats.map((s) => {
        const total = s.avgA + s.avgB || 1;
        return (
          <View key={s.key} style={styles.statRow}>
            <Text
              style={[styles.statVal, styles.right, s.winner === 'A' ? { color: TINT_A } : null]}
            >
              {s.avgA}
            </Text>
            <View style={styles.statBarWrap}>
              <View
                style={[
                  styles.statBar,
                  styles.statBarA,
                  { width: `${(s.avgA / total) * 100}%`, opacity: s.winner === 'B' ? 0.4 : 1 },
                ]}
              />
            </View>
            <Text style={styles.statLabel} numberOfLines={1}>
              {s.label}
            </Text>
            <View style={styles.statBarWrap}>
              <View
                style={[
                  styles.statBar,
                  styles.statBarB,
                  { width: `${(s.avgB / total) * 100}%`, opacity: s.winner === 'A' ? 0.4 : 1 },
                ]}
              />
            </View>
            <Text style={[styles.statVal, s.winner === 'B' ? { color: TINT_B } : null]}>
              {s.avgB}
            </Text>
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#100b1a',
    paddingHorizontal: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  flankA: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '58%' },
  flankB: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '58%' },
  spot: { position: 'absolute', left: 0, right: 0, top: 0, height: '55%' },
  vignette: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: GOLD,
    zIndex: 5,
  },

  container: { width: '100%', maxWidth: 1120, alignSelf: 'center', zIndex: 1 },
  wideRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  centerWide: { width: 320 },

  /* mobile faceoff bar */
  faceoff: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  coinSm: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(206,155,51,0.85)',
  },
  coinSmTxt: { fontFamily: 'Flame-Regular', fontSize: 12, color: COLORS.beige },
  faceName: { flex: 1, fontFamily: 'Flame-Regular', fontSize: 15 },
  faceVs: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  /* desktop crest */
  crest: { flexDirection: 'row', alignItems: 'center', gap: 11 },
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

  /* desktop faction zone */
  zone: { flex: 1, gap: 16 },
  cardWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    maxWidth: 288,
    justifyContent: 'flex-end',
  },
  cardWrapR: { justifyContent: 'flex-start' },

  /* mobile rosters */
  mobileRosters: { marginTop: 26, gap: 18 },
  mRoster: { gap: 11 },
  mLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mDot: { width: 9, height: 9, borderRadius: 5 },
  mLabelTxt: { flex: 1, fontFamily: 'Flame-Regular', fontSize: 16, letterSpacing: 0.3 },
  mHint: { fontFamily: 'Nunito_700Bold', fontSize: 9, letterSpacing: 1, color: 'rgba(245,235,220,0.4)' },
  mGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

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
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
    marginBottom: 14,
  },
  score: { fontFamily: 'Flame-Regular', fontSize: 48, lineHeight: 52 },
  scoreVs: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.45)',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  synRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 360,
    marginTop: 12,
  },
  synPip: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 0.4 },

  /* verdict + votes */
  verdictWrap: { width: '100%', maxWidth: 380, alignSelf: 'center', marginTop: 26 },
  verdictBlock: { alignItems: 'center' },
  verdictEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2.4,
    color: 'rgba(206,155,51,0.7)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  verdict: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.beige,
    textAlign: 'center',
    lineHeight: 20,
  },
  votes: { flexDirection: 'row', gap: 12, marginTop: 18 },
  voteBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
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
    marginTop: 14,
    textAlign: 'center',
  },

  /* breakdown */
  breakdown: {
    width: '100%',
    maxWidth: 580,
    alignSelf: 'center',
    marginTop: 40,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingVertical: 22,
    paddingHorizontal: 22,
  },
  breakdownTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.beige,
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  statVal: {
    width: 26,
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.55)',
  },
  statBarWrap: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  statBar: { position: 'absolute', top: 0, bottom: 0 },
  statBarA: {
    right: 0,
    backgroundColor: TINT_A,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  statBarB: { left: 0, backgroundColor: TINT_B, borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  statLabel: {
    width: 92,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.78)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
