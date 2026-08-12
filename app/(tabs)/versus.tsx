// app/(tabs)/versus.tsx — the native Arena hub, in three acts.
//
// Three people open this tab: the one keeping a STREAK, the one who wants a
// SPECIFIC fight, and the one who wants to be HANDED one. The screen answers
// those three in that order and nothing appears twice.
//
//   1. Today   — the showdown (vote → reveal in place), then what is left of
//                today's three as state rather than as three more links.
//   2. Make a fight — everything that starts one, ordered by how much say you
//                want: build it, take one that is ready, or let the app choose.
//   3. Fight a villain — the most-opposed board.
//
// It used to be six blocks of near-equal weight in which the debate and the
// team battle each appeared TWICE — once as content and once as a chip that
// opened the same route. Grouping by intent removed both duplicates and two
// whole sections. Shares useVersusHub with the web hub (versus.web.tsx) so the
// data layer never drifts.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStableTopInset } from '../../src/hooks/useStableTopInset';
import * as Haptics from 'expo-haptics';
import { COLORS, STAGE_INK } from '../../src/constants/colors';
import { SUBHEAD } from '../../src/constants/arenaType';
import { useVersusHub } from '../../src/hooks/useVersusHub';
import { pickRandomPair, spreadRivalries } from '../../src/lib/versus';
import { stashFighters, type FighterArt } from '../../src/lib/compareHandoff';
import { ShowdownCards } from '../../src/components/versus/ShowdownCards';
import { HallOfInfamy } from '../../src/components/home/HallOfInfamy';
import { YesterdayStrip } from '../../src/components/versus/YesterdayStrip';
import { TodaysLedger } from '../../src/components/versus/TodaysLedger';
import { MakeAFight } from '../../src/components/versus/MakeAFight';
import { VersusSkeleton } from '../../src/components/skeletons/VersusSkeleton';
import { FadeOutSkeleton } from '../../src/components/ui/FadeOutSkeleton';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';

export default function VersusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = useStableTopInset();
  const {
    matchup,
    hookText,
    takesCount,
    yesterday,
    rivalries,
    iconicPool,
    loading,
    teamBattle,
    mostFeared,
  } = useVersusHub();

  // Showdown block only — the stage's eyebrow and title are already real. pre →
  // nothing, so a cached matchup never blinks a skeleton.
  const showdownLoading = loading && !matchup;
  const showdownPhase = useSkeletonTransition(showdownLoading);

  const openArena = (a: FighterArt, b: FighterArt) => {
    stashFighters(a, b);
    router.push(`/compare/${a.id}/${b.id}`);
  };

  const openTeamBattle = () => {
    if (!teamBattle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/versus/team/${teamBattle.teamA.id}-vs-${teamBattle.teamB.id}`);
  };

  // The clash currently dealt into "Make a fight". Held here rather than in the
  // component so it survives the one-v-one / team toggle, and so the screen can
  // deal the first one the moment the iconic pool lands.
  const [dealt, setDealt] = useState<[FighterArt, FighterArt] | null>(null);
  useEffect(() => {
    if (dealt || iconicPool.length < 2) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDealt(pickRandomPair(iconicPool));
  }, [iconicPool, dealt]);

  const shuffle = useCallback(() => {
    const next = pickRandomPair(iconicPool);
    if (!next) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDealt(next);
  }, [iconicPool]);

  // Swapping one side keeps the other: the opponent picker takes a fixed
  // fighter and returns a full matchup, which is exactly "change this one".
  const chooseSide = (side: 'a' | 'b') => {
    const keep = dealt?.[side === 'a' ? 1 : 0];
    if (!keep) {
      router.push('/compare/pick');
      return;
    }
    router.push(`/compare/${keep.id}/pick?name=${encodeURIComponent(keep.name ?? '')}`);
  };

  // One fighter per card until the list is exhausted — see spreadRivalries.
  const spreadRail = useMemo(() => spreadRivalries(rivalries), [rivalries]);

  return (
    // NO collapsable={false} here, deliberately. Adding it let iOS pair this
    // screen's scroll view with the tab bar, and pairing hands content insets
    // to RNScreens — which insets the list below the status bar and exposes a
    // band of the root's colour above this full-bleed billboard. The tab bar
    // no longer needs the pairing: both its appearances are pinned explicitly
    // in _layout.tsx (disableTransparentOnScrollEdge + blurEffect).
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Navy game-lobby stage ── */}
        <LinearGradient
          colors={[...STAGE_INK]}
          locations={[0, 0.5, 1]}
          style={[styles.stage, { paddingTop: topInset + 24 }]}
        >
          <Text style={styles.eyebrow}>{"Today's Debate"}</Text>
          {matchup ? (
            <Text style={[styles.title, hookText && styles.titleWithHook]} numberOfLines={1}>
              {matchup.heroA.name} vs {matchup.heroB.name}
            </Text>
          ) : (
            <Text style={styles.title}>The Arena</Text>
          )}
          {matchup && hookText ? <Text style={styles.hook}>{hookText}</Text> : null}

          {/* Wrapper so the dissolving skeleton overlays the showdown block only. */}
          <View style={styles.showdown}>
            {showdownLoading ? (
              showdownPhase === 'skeleton' ? (
                <VersusSkeleton />
              ) : null
            ) : matchup ? (
              <>
                <ShowdownCards matchup={matchup} />
                {/* THE link into the arena, and the only one. The showdown
                    block used to carry "See full breakdown →" and this sat
                    directly beneath it — two gold chevroned links, stacked,
                    going to the same screen. Never open by advertising that
                    nobody bothered, so with no takes it names the act. */}
                <Pressable
                  onPress={() => openArena(matchup.heroA, matchup.heroB)}
                  accessibilityRole="button"
                  accessibilityLabel="Open the arena"
                  style={styles.takesLink}
                >
                  <Text style={styles.takesLinkText}>
                    {takesCount > 0
                      ? `${takesCount} ${takesCount === 1 ? 'take' : 'takes'} — see the debate`
                      : 'Open the arena — add the first take'}
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color={COLORS.goldAccent} />
                </Pressable>
              </>
            ) : null}
            {showdownPhase === 'crossfade' ? (
              <FadeOutSkeleton>
                <VersusSkeleton />
              </FadeOutSkeleton>
            ) : null}
          </View>

          {yesterday ? <YesterdayStrip yesterday={yesterday} /> : null}

          {/* ── What's left today — state, not a third way to reach the same
                 three screens. The debate line records what YOU did; repeating
                 the pairing already shown above it would be an echo. ── */}
          <View style={styles.ledgerWrap}>
            <TodaysLedger
              onPuzzle={() => router.push('/play')}
              onDebate={() => (matchup ? openArena(matchup.heroA, matchup.heroB) : undefined)}
              onTeamBattle={teamBattle ? openTeamBattle : undefined}
              debateNote={matchup ? 'Tap a card above to call it' : 'Loading'}
              teamNote={
                teamBattle ? `${teamBattle.teamA.name} vs ${teamBattle.teamB.name}` : 'Eight a side'
              }
            />
          </View>
        </LinearGradient>

        {/* ── Act 2 — everything that starts a fight, in one place ── */}
        <MakeAFight
          pair={dealt}
          onFight={() => dealt && openArena(dealt[0], dealt[1])}
          onShuffle={shuffle}
          onChoose={chooseSide}
          // Team battle opens the same builder — /versus/team/draft is the
          // RESULT screen for a drafted clash and needs two rosters in its
          // query string. The builder routes: one-a-side goes to
          // /compare/[a]/[b], anything larger to the team draft.
          onDraft={() => router.push('/compare/pick?mode=team')}
          rivalries={spreadRail}
          onOpenRivalry={openArena}
        />

        {/* ── Act 3 — the most-opposed board ── */}
        {/* ── Act 3 — a third way to start a fight, not a browse rail ──
              These cards opened the character page, which is what the same
              component does on Explore and exactly wrong here: a tab that
              spends two acts starting fights ended on a row that quietly
              stopped. Tapping a villain now opens the opponent picker with
              them held on one side — "who fights Darkseid?" — which is the
              question the board was already asking. */}
        <HallOfInfamy
          villains={mostFeared}
          onPress={(id, name) =>
            router.push(`/compare/${id}/pick?name=${encodeURIComponent(name)}`)
          }
          tone="ink"
          eyebrow="Fight a villain"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  scroll: { flex: 1, backgroundColor: COLORS.deepNavy },

  stage: { paddingHorizontal: 16, paddingBottom: 18, alignItems: 'center' },
  // Gold, because it names the live thing; the type is the shared SUBHEAD.
  eyebrow: { ...SUBHEAD, color: COLORS.goldAccent, marginBottom: 6 },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    lineHeight: 32,
    color: COLORS.beige,
    marginBottom: 22,
    textAlign: 'center',
  },
  titleWithHook: { marginBottom: 8 },
  showdown: { alignSelf: 'stretch', alignItems: 'center' },
  hook: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    lineHeight: 18,
    color: 'rgba(245,235,220,0.65)',
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 320,
  },
  takesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
  },
  takesLinkText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: COLORS.goldAccent,
  },

  ledgerWrap: { alignSelf: 'stretch', marginTop: 6 },
});
