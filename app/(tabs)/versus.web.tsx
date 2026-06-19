// app/(tabs)/versus.web.tsx — the web Arena hub ("Battle Deck"). A navy game-
// lobby stage holds today's showdown (two holo cards → vote → reveal) plus the
// build-your-own / surprise-me actions, over a darker deck section of the
// greatest rivalries. Native uses the sibling versus.tsx; both share useVersusHub
// so the data layer never drifts. Entered from the TopBar Arena tab.
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/colors';
import { useVersusHub } from '../../src/hooks/useVersusHub';
import { pickRandomPair } from '../../src/lib/versus';
import { stashFighters, type FighterArt } from '../../src/lib/compareHandoff';
import { withViewTransition } from '../../src/lib/viewTransition';
import { useWebCanvas } from '../../src/hooks/useWebCanvas';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { ShowdownStage } from '../../src/components/web/versus/ShowdownStage';
import { RivalryDeck } from '../../src/components/web/versus/RivalryDeck';

export default function VersusHubWeb() {
  // The page ends on the dark deck section — keep the canvas deep-navy so it
  // reads continuous to the bottom under the iOS Safari toolbar.
  useWebCanvas(COLORS.deepNavy);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const contentPad = width < 640 ? 16 : 32;
  const { matchup, rivalries, iconicPool, loading } = useVersusHub();

  const openArena = (a: FighterArt, b: FighterArt) => {
    stashFighters(a, b);
    withViewTransition(() =>
      router.push(`/compare/${a.id}/${b.id}` as Parameters<typeof router.push>[0]),
    );
  };

  const surprise = () => {
    const pair = pickRandomPair(iconicPool);
    if (pair) openArena(pair[0], pair[1]);
  };
  const canSurprise = iconicPool.length >= 2;

  return (
    <View style={s.root}>
      {/* ── Navy game-lobby stage ── */}
      <View style={[s.stage, { paddingHorizontal: contentPad }] as object}>
        <View style={s.stageInner}>
          <Text style={s.eyebrow}>{"★ Today's Showdown ★"}</Text>
          {matchup ? (
            <Text style={s.title} numberOfLines={1}>
              {matchup.heroA.name} vs {matchup.heroB.name}
            </Text>
          ) : (
            <Text style={s.title}>The Arena</Text>
          )}

          {loading && !matchup ? (
            <View style={s.skeleton}>
              <View style={[s.skelCard, s.tiltL] as object} />
              <View style={s.skelCoin} />
              <View style={[s.skelCard, s.tiltR] as object} />
            </View>
          ) : matchup ? (
            <ShowdownStage
              matchup={matchup}
              iconicPool={iconicPool}
              isDesktop={isDesktop}
              onOpen={openArena}
            />
          ) : null}

          {/* ── Secondary actions ── */}
          <View style={s.actions}>
            <Pressable
              onPress={() => router.push('/compare/pick')}
              accessibilityRole="button"
              accessibilityLabel="Build your own matchup"
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [s.act, s.build, hovered && (s.actHover as object)] as object
              }
            >
              <View style={[s.actIcon, s.buildIcon] as object}>
                <MaterialCommunityIcons name="sword-cross" size={20} color={COLORS.orange} />
              </View>
              <View style={s.actText}>
                <Text style={s.actTitle}>Build your own</Text>
                <Text style={s.actSub}>Pick any two fighters</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={surprise}
              disabled={!canSurprise}
              accessibilityRole="button"
              accessibilityLabel="Surprise me with a random matchup"
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [
                  s.act,
                  s.surp,
                  hovered && (s.actHover as object),
                  !canSurprise && s.actDisabled,
                ] as object
              }
            >
              <View style={[s.actIcon, s.surpIcon] as object}>
                <Ionicons name="shuffle" size={20} color={COLORS.goldAccent} />
              </View>
              <View style={s.actText}>
                <Text style={s.actTitle}>Surprise me</Text>
                <Text style={s.actSub}>Random iconic clash</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Deck section: greatest rivalries ── */}
      <View style={[s.deckSec, { paddingHorizontal: contentPad }] as object}>
        <View style={s.deckInner}>
          <RivalryDeck rivalries={rivalries} isDesktop={isDesktop} onOpen={openArena} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },

  stage: {
    backgroundImage: 'radial-gradient(130% 100% at 50% -5%, #1c2f5a 0%, #13203a 48%, #0c1526 100%)',
    paddingTop: TOPBAR_HEIGHT + 26,
    paddingBottom: 34,
  } as object,
  stageInner: { width: '100%', maxWidth: 880, alignSelf: 'center', alignItems: 'center' },
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
    color: COLORS.beige,
    marginBottom: 22,
    textAlign: 'center',
  },

  // skeleton while the matchup query resolves
  skeleton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 250 },
  skelCard: {
    width: 190,
    height: 250,
    borderRadius: 18,
    backgroundColor: 'rgba(245,235,220,0.06)',
  } as object,
  skelCoin: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginHorizontal: -18,
    zIndex: 2,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 2.5,
    borderColor: 'rgba(206,155,51,0.4)',
  } as object,
  tiltL: { transform: [{ rotate: '-4deg' }] } as object,
  tiltR: { transform: [{ rotate: '4deg' }] } as object,

  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 26,
    width: '100%',
    maxWidth: 560,
    justifyContent: 'center',
  },
  act: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    cursor: 'pointer',
    transition: 'transform 150ms ease, background-color 150ms ease',
  } as object,
  actHover: { transform: [{ translateY: -2 }] } as object,
  actDisabled: { opacity: 0.4 } as object,
  build: {
    backgroundColor: 'rgba(231,115,51,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.4)',
  },
  surp: {
    backgroundColor: 'rgba(245,235,220,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
  },
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
  actTitle: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige },
  actSub: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: 'rgba(245,235,220,0.55)' },

  deckSec: { flexGrow: 1, backgroundColor: COLORS.deepNavy, paddingTop: 28, paddingBottom: 80 },
  deckInner: { width: '100%', maxWidth: 1180, alignSelf: 'center' },
});
