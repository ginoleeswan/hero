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
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStableTopInset } from '../../src/hooks/useStableTopInset';
import * as Haptics from 'expo-haptics';
import { COLORS, STAGE_INK } from '../../src/constants/colors';
import { useVersusHub } from '../../src/hooks/useVersusHub';
import { pickRandomPair } from '../../src/lib/versus';
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

  const surprise = () => {
    const pair = pickRandomPair(iconicPool);
    if (!pair) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openArena(pair[0], pair[1]);
  };
  const canSurprise = iconicPool.length >= 2;

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
                <ShowdownCards matchup={matchup} onOpen={openArena} />
                <Pressable
                  onPress={() => openArena(matchup.heroA, matchup.heroB)}
                  accessibilityRole="button"
                  accessibilityLabel="Join the debate"
                  style={styles.takesLink}
                >
                  <Text style={styles.takesLinkText}>
                    {/* Never open by advertising that nobody bothered. */}
                    {takesCount > 0
                      ? `${takesCount} ${takesCount === 1 ? 'take' : 'takes'} — see the debate`
                      : 'Be first to call it'}
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
          onBuild={() => router.push('/compare/pick')}
          // Both modes open the same builder — /versus/team/draft is the RESULT
          // screen for a drafted clash and needs two rosters in its query string,
          // so pushing it bare landed on "We couldn't build that battle". The
          // builder itself routes: one-a-side goes to /compare/[a]/[b], anything
          // larger to the team draft, via resolveBattleRoute.
          onDraft={() => router.push('/compare/pick?mode=team')}
          onSurprise={surprise}
          canSurprise={canSurprise}
          rivalries={rivalries}
          onOpenRivalry={openArena}
        />

        {/* ── Act 3 — the most-opposed board ── */}
        <HallOfInfamy villains={mostFeared} onPress={(id) => router.push(`/character/${id}`)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  scroll: { flex: 1, backgroundColor: COLORS.deepNavy },

  stage: { paddingHorizontal: 16, paddingBottom: 30, alignItems: 'center' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 6,
  },
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

  ledgerWrap: { alignSelf: 'stretch', marginTop: 14 },
});
