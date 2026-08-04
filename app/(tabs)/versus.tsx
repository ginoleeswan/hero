// app/(tabs)/versus.tsx — the native Arena hub ("Battle Deck"). A navy game-
// lobby stage holds today's showdown (two holo cards → vote → reveal) plus the
// build-your-own / surprise-me actions, over a deck section of the greatest
// rivalries. Shares useVersusHub with the web hub (versus.web.tsx) so the data
// layer never drifts.
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';
import { useVersusHub } from '../../src/hooks/useVersusHub';
import { pickRandomPair } from '../../src/lib/versus';
import { stashFighters, type FighterArt } from '../../src/lib/compareHandoff';
import { ShowdownCards } from '../../src/components/versus/ShowdownCards';
import { RivalriesRail } from '../../src/components/versus/RivalriesRail';
import { HallOfInfamy } from '../../src/components/home/HallOfInfamy';
import { YesterdayStrip } from '../../src/components/versus/YesterdayStrip';
import { TodaysDailies } from '../../src/components/game/TodaysDailies';

export default function VersusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const openArena = (a: FighterArt, b: FighterArt) => {
    stashFighters(a, b);
    router.push(`/compare/${a.id}/${b.id}`);
  };

  const surprise = () => {
    const pair = pickRandomPair(iconicPool);
    if (!pair) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openArena(pair[0], pair[1]);
  };
  const canSurprise = iconicPool.length >= 2;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Navy game-lobby stage ── */}
        <LinearGradient
          colors={['#1c2f5a', '#13203a', '#0c1526']}
          locations={[0, 0.5, 1]}
          style={[styles.stage, { paddingTop: insets.top + 24 }]}
        >
          <Text style={styles.eyebrow}>{"★ Today's Debate ★"}</Text>
          {matchup ? (
            <Text style={[styles.title, hookText && styles.titleWithHook]} numberOfLines={1}>
              {matchup.heroA.name} vs {matchup.heroB.name}
            </Text>
          ) : (
            <Text style={styles.title}>The Arena</Text>
          )}
          {matchup && hookText ? <Text style={styles.hook}>{hookText}</Text> : null}

          {loading && !matchup ? (
            <View style={styles.loading}>
              <ActivityIndicator color={COLORS.orange} />
            </View>
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
                  {takesCount} {takesCount === 1 ? 'take' : 'takes'} — join the debate
                </Text>
                <Ionicons name="chevron-forward" size={13} color={COLORS.goldAccent} />
              </Pressable>
            </>
          ) : null}

          {yesterday ? <YesterdayStrip yesterday={yesterday} /> : null}

          {/* ── Secondary actions ── */}
          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push('/compare/pick')}
              accessibilityRole="button"
              accessibilityLabel="Build your own matchup"
              style={({ pressed }) => [styles.act, styles.build, pressed && styles.actPressed]}
            >
              <View style={[styles.actIcon, styles.buildIcon]}>
                <MaterialCommunityIcons name="sword-cross" size={20} color={COLORS.orange} />
              </View>
              <View style={styles.actText}>
                <Text style={styles.actTitle}>Build your own</Text>
                <Text style={styles.actSub}>Pick any two fighters</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={surprise}
              disabled={!canSurprise}
              accessibilityRole="button"
              accessibilityLabel="Surprise me with a random matchup"
              style={({ pressed }) => [
                styles.act,
                styles.surp,
                pressed && styles.actPressed,
                !canSurprise && styles.actDisabled,
              ]}
            >
              <View style={[styles.actIcon, styles.surpIcon]}>
                <Ionicons name="shuffle" size={20} color={COLORS.goldAccent} />
              </View>
              <View style={styles.actText}>
                <Text style={styles.actTitle}>Surprise me</Text>
                <Text style={styles.actSub}>Random iconic clash</Text>
              </View>
            </Pressable>
          </View>

          {/* ── Today's Dailies — streak + the three daily surfaces ── */}
          <View style={styles.dailiesWrap}>
            <TodaysDailies
              onPuzzle={() => router.push('/play')}
              onDebate={() => (matchup ? openArena(matchup.heroA, matchup.heroB) : undefined)}
              onTeamBattle={
                teamBattle
                  ? () =>
                      router.push(
                        `/versus/team/${teamBattle.teamA.id}-vs-${teamBattle.teamB.id}` as Parameters<
                          typeof router.push
                        >[0],
                      )
                  : undefined
              }
            />
          </View>
        </LinearGradient>

        {/* ── Featured team battle ── */}
        {teamBattle && (
          <Pressable
            style={styles.teamCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/versus/team/${teamBattle.teamA.id}-vs-${teamBattle.teamB.id}`);
            }}
          >
            <Text style={styles.teamEyebrow}>★ Team Battle ★</Text>
            <Text style={styles.teamTitle} numberOfLines={1}>
              {teamBattle.teamA.name} vs {teamBattle.teamB.name}
            </Text>
            <Text style={styles.teamCta}>Tap to see the clash →</Text>
          </Pressable>
        )}

        {/* ── Deck section: greatest rivalries ── */}
        <View style={styles.deckSec}>
          <RivalriesRail rivalries={rivalries} onOpen={openArena} />
        </View>

        {/* ── Public Enemies: villains the most heroes line up against ── */}
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
    fontSize: 11.5,
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
  hook: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    lineHeight: 18,
    color: 'rgba(245,235,220,0.65)',
    textAlign: 'center',
    marginBottom: 18,
    maxWidth: 320,
  },
  loading: { paddingVertical: 70, alignItems: 'center' },
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

  actions: { flexDirection: 'row', gap: 12, marginTop: 26, alignSelf: 'stretch' },
  dailiesWrap: { alignSelf: 'stretch', marginTop: 14 },
  act: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
  },
  actPressed: { opacity: 0.85 },
  actDisabled: { opacity: 0.4 },
  build: { backgroundColor: 'rgba(231,115,51,0.14)', borderColor: 'rgba(231,115,51,0.4)' },
  surp: { backgroundColor: 'rgba(245,235,220,0.05)', borderColor: 'rgba(245,235,220,0.14)' },
  actIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildIcon: { backgroundColor: 'rgba(231,115,51,0.22)' },
  surpIcon: { backgroundColor: 'rgba(206,155,51,0.16)' },
  actText: { flex: 1 },
  actTitle: { fontFamily: 'Flame-Regular', fontSize: 14, color: COLORS.beige },
  actSub: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: 'rgba(245,235,220,0.55)' },

  teamCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(206,155,51,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(206,155,51,0.4)',
  },
  teamEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.goldAccent,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  teamTitle: { fontFamily: 'Flame-Regular', fontSize: 20, lineHeight: 25, color: COLORS.beige },
  teamCta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.8)',
    marginTop: 6,
  },

  deckSec: { backgroundColor: COLORS.deepNavy, paddingTop: 28 },
});
