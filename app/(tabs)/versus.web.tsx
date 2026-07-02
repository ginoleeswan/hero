// app/(tabs)/versus.web.tsx — the web Arena hub ("Battle Deck"). A navy game-
// lobby stage holds today's showdown (two holo cards → vote → reveal) plus the
// build-your-own / surprise-me actions, over a darker deck section of the
// greatest rivalries. Native uses the sibling versus.tsx; both share useVersusHub
// so the data layer never drifts. Entered from the TopBar Arena tab.
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SURFACE, SURFACE_GRADIENT } from '../../src/constants/colors';
import { useVersusHub } from '../../src/hooks/useVersusHub';
import { pickRandomPair } from '../../src/lib/versus';
import { stashFighters, type FighterArt } from '../../src/lib/compareHandoff';
import { withViewTransition } from '../../src/lib/viewTransition';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { TOPBAR_HEIGHT } from '../../src/components/web/TopBar';
import { ShowdownStage } from '../../src/components/web/versus/ShowdownStage';
import { MatchupRow } from '../../src/components/web/versus/MatchupRow';
import { MatchupCard } from '../../src/components/web/versus/MatchupCard';
import { useDiscoveryRows } from '../../src/hooks/useDiscoveryRows';
import { HallOfInfamy } from '../../src/components/web/home/HallOfInfamy';
import { Reveal } from '../../src/components/web/Reveal';

export default function VersusHubWeb() {
  // The page ends on the dark deck section — keep the canvas deep-navy so it
  // reads continuous to the bottom under the iOS Safari toolbar.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const contentPad = width < 640 ? 16 : 32;
  const { matchup, iconicPool, loading, mostFeared } = useVersusHub();

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

  const rows = useDiscoveryRows();
  const openTeam = (aId: string, bId: string) =>
    withViewTransition(() =>
      router.push(`/versus/team/${aId}-vs-${bId}` as Parameters<typeof router.push>[0]),
    );
  const heroSide = (h: {
    name: string;
    image_url?: string | null;
    portrait_url?: string | null;
  }) => ({
    name: h.name,
    art: h.portrait_url ?? h.image_url,
  });

  return (
    <View style={s.root}>
      {/* ── Navy game-lobby stage ── */}
      <View style={[s.stage, { paddingHorizontal: contentPad }] as object}>
        {/* Type-as-scenery: a colossal ink-on-ink VS behind the duel, flanked
            by the two corner-colour blooms (orange vs blue) — the stage takes
            sides before the cards even load. */}
        <Text
          style={[s.backdropVs, { fontSize: Math.min(440, Math.round(width * 0.34)) }] as object}
          numberOfLines={1}
          aria-hidden
        >
          VS
        </Text>
        <View style={s.glowA as object} />
        <View style={s.glowB as object} />
        <View style={s.stageInner}>
          <Text style={s.eyebrow}>{"★ Today's Showdown ★"}</Text>
          {matchup ? (
            <Text style={[s.title, !isDesktop && (s.titleMobile as object)] as object} numberOfLines={1}>
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
              onShuffle={surprise}
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

      {/* ── Battle Discovery feed ── */}
      <View style={[s.feed, { paddingHorizontal: contentPad }] as object}>
        <View style={s.feedInner}>
          {rows.rivalries.length > 0 && (
            <Reveal>
              <MatchupRow
                icon="sword-cross"
                kicker="Grudge Matches"
                title="Greatest Rivalries"
                blurb="The debates that never settle — fans keep score."
                wrap={isDesktop}
              >
                {rows.rivalries.map((m) => (
                  <MatchupCard
                    key={`${m.a.id}-${m.b.id}`}
                    a={heroSide(m.a)}
                    b={heroSide(m.b)}
                    large={isDesktop}
                    onOpen={() => openArena(m.a, m.b)}
                  />
                ))}
              </MatchupRow>
            </Reveal>
          )}

          {rows.dream.length > 0 && (
            <Reveal>
              <MatchupRow
                icon="star-four-points"
                kicker="Cross-Universe"
                title="Dream Matches"
                blurb="Marvel meets DC — clashes the comics can't print."
                wrap={isDesktop}
              >
                {rows.dream.map((m) => (
                  <MatchupCard
                    key={`${m.a.id}-${m.b.id}`}
                    a={heroSide(m.a)}
                    b={heroSide(m.b)}
                    large={isDesktop}
                    onOpen={() => openArena(m.a, m.b)}
                  />
                ))}
              </MatchupRow>
            </Reveal>
          )}

          {rows.goliath.length > 0 && (
            <Reveal>
              <MatchupRow
                icon="scale-unbalanced"
                kicker="The Upsets"
                title="David vs Goliath"
                blurb="Underdogs against the heavyweights."
                wrap={isDesktop}
              >
                {rows.goliath.map((m) => (
                  <MatchupCard
                    key={`${m.a.id}-${m.b.id}`}
                    a={heroSide(m.a)}
                    b={heroSide(m.b)}
                    large={isDesktop}
                    onOpen={() => openArena(m.a, m.b)}
                  />
                ))}
              </MatchupRow>
            </Reveal>
          )}

          {rows.teams.length > 0 && (
            <Reveal>
              <MatchupRow
                icon="account-group"
                kicker="Squads"
                title="Team Battles"
                blurb="Iconic squads clash — roster against roster."
                wrap={isDesktop}
              >
                {rows.teams.map((m) => (
                  <MatchupCard
                    key={`${m.a.id}-${m.b.id}`}
                    a={{ name: m.a.name, art: m.a.logo_url }}
                    b={{ name: m.b.name, art: m.b.logo_url }}
                    fit="contain"
                    large={isDesktop}
                    onOpen={() => openTeam(m.a.id, m.b.id)}
                  />
                ))}
              </MatchupRow>
            </Reveal>
          )}

          {/* Public Enemies — flush so it aligns with the matchup rows above. */}
          <Reveal>
            <HallOfInfamy villains={mostFeared} flush />
          </Reveal>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },

  stage: {
    backgroundColor: COLORS.deepNavy,
    backgroundImage: SURFACE_GRADIENT.stageImmersive,
    paddingTop: TOPBAR_HEIGHT + 26,
    paddingBottom: 34,
    position: 'relative',
    overflow: 'hidden',
  } as object,
  // Colossal VS, ink-on-ink, centred behind the duel.
  backdropVs: {
    position: 'absolute',
    alignSelf: 'center',
    top: 10,
    fontFamily: 'Flame-Regular',
    color: 'rgba(245,235,220,0.045)',
    letterSpacing: 12,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  } as object,
  // The two corners' colour blooms — orange (A) vs blue (B).
  glowA: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    top: 60,
    left: '8%',
    backgroundColor: 'rgba(231,115,51,0.10)',
    filter: 'blur(90px)',
    pointerEvents: 'none',
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
    pointerEvents: 'none',
  } as object,
  stageInner: { width: '100%', maxWidth: 880, alignSelf: 'center', alignItems: 'center' },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11.5,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: COLORS.goldAccent,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 34,
    lineHeight: 42,
    color: COLORS.beige,
    marginBottom: 24,
    textAlign: 'center',
  },
  titleMobile: { fontSize: 24, lineHeight: 30 } as object,

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

  feed: { flexGrow: 1, backgroundColor: COLORS.deepNavy, paddingTop: 30, paddingBottom: 80 },
  feedInner: { width: '100%', maxWidth: 1180, alignSelf: 'center', gap: 40 },
});
