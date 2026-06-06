import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { heroImageSource } from '../../../src/constants/heroImages';
import { useCompareMatchup } from '../../../src/hooks/useCompareMatchup';
import { COLORS } from '../../../src/constants/colors';
import { ClashPortraits } from '../../../src/components/compare/ClashPortraits';
import { VerdictReveal } from '../../../src/components/compare/VerdictReveal';
import { StatBattleRow } from '../../../src/components/compare/StatBattleRow';
import { VsBadge } from '../../../src/components/compare/VsBadge';
import { getFighterArt } from '../../../src/lib/compareHandoff';

// Must match the picker — the locked hero (A) and chosen card (B) morph in.
const VT_HERO = 'vt-fighter-a';
const VT_PICK = 'vt-fighter-b';

type PortraitState = 'win' | 'loss' | 'tie' | 'neutral';

function portraitState(overall: 'A' | 'B' | 'tie', thisSide: 'A' | 'B'): PortraitState {
  if (overall === 'tie') return 'tie';
  return overall === thisSide ? 'win' : 'loss';
}

/** Tap target + "Swap" affordance laid over a portrait — replaces that combatant. */
function SwapOverlay({
  onPress,
  side,
  name,
}: {
  onPress: () => void;
  side: 'left' | 'right';
  name: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Replace ${name}`}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [styles.swapHit, hovered && (styles.swapHitHover as object)] as object
      }
    >
      <View
        style={
          [styles.swapChip, side === 'left' ? styles.swapChipLeft : styles.swapChipRight] as object
        }
      >
        <Ionicons name="swap-horizontal" size={13} color={COLORS.beige} />
        <Text style={styles.swapChipText}>Swap</Text>
      </View>
    </Pressable>
  );
}

/** Winner caption matching native: gold "Winner"/"Draw" eyebrow, name, gold rule. */
function PortraitLabel({
  name,
  state,
  align,
}: {
  name: string;
  state: PortraitState;
  align: 'left' | 'right';
}) {
  const right = align === 'right';
  return (
    <View style={[styles.portraitLabel, right && (styles.alignEnd as object)] as object}>
      {state === 'win' && (
        <Text style={[styles.eyebrowWin, right && (styles.textRight as object)] as object}>
          Winner
        </Text>
      )}
      {state === 'tie' && (
        <Text style={[styles.eyebrowTie, right && (styles.textRight as object)] as object}>
          Draw
        </Text>
      )}
      <Text
        style={
          [
            styles.heroNameLarge,
            right && (styles.textRight as object),
            state === 'loss' && (styles.heroNameDim as object),
          ] as object
        }
      >
        {name}
      </Text>
      {state === 'win' && (
        <View style={[styles.winRule, right && (styles.winRuleRight as object)] as object} />
      )}
    </View>
  );
}

/** A single tall arena portrait (desktop) — faces inward toward the scorecard. */
function ArenaPortrait({
  image,
  name,
  side,
  state,
  onSwap,
  vtName,
}: {
  image: number | { uri: string };
  name: string;
  side: 'left' | 'right';
  state: PortraitState;
  onSwap: () => void;
  vtName?: string;
}) {
  const right = side === 'right';
  return (
    <View
      style={[
        styles.arenaPortrait,
        state === 'win' && (styles.arenaPortraitWin as object),
        vtName ? ({ viewTransitionName: vtName } as object) : null,
      ]}
    >
      <Image
        source={image}
        contentFit="cover"
        contentPosition="top"
        style={
          [
            styles.arenaImage,
            state === 'loss' && (styles.imageLoss as object),
            right && { transform: [{ scaleX: -1 }] },
          ] as object
        }
      />
      <View style={styles.portraitGradient as object} />
      {state === 'loss' && <View style={styles.lostOverlay as object} />}
      {name ? <PortraitLabel name={name} state={state} align={side} /> : null}
      <SwapOverlay side={side} name={name} onPress={onSwap} />
    </View>
  );
}

export default function WebCompareScreen() {
  const { hero, opponent } = useLocalSearchParams<{ hero: string; opponent: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const { statsA, statsB, result, overallWinner, verdict, error } = useCompareMatchup(
    hero,
    opponent,
  );

  const [copied, setCopied] = useState(false);

  const ready = !!(statsA && statsB && result && overallWinner);

  // Paint portraits instantly from the picker handoff (or an id fallback) so the
  // shared-element morph has a target before stats finish loading. Once stats
  // arrive, the winner glow / loser desaturation reveal over the morphed image.
  const artA = getFighterArt(hero);
  const artB = getFighterArt(opponent);
  const imageA = heroImageSource(
    hero,
    statsA?.image.url ?? artA?.image_url,
    statsA?.image.portraitUrl ?? artA?.portrait_url,
  );
  const imageB = heroImageSource(
    opponent,
    statsB?.image.url ?? artB?.image_url,
    statsB?.image.portraitUrl ?? artB?.portrait_url,
  );
  const nameA = statsA?.name ?? artA?.name ?? '';
  const nameB = statsB?.name ?? artB?.name ?? '';
  const stateA: PortraitState = ready ? portraitState(overallWinner!, 'A') : 'neutral';
  const stateB: PortraitState = ready ? portraitState(overallWinner!, 'B') : 'neutral';

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(`/character/${hero}`)
          }
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // Tap A → keep B (opponent becomes the fixed hero); tap B → keep A.
  const swapA = () => router.push(`/compare/${opponent}/pick?name=${encodeURIComponent(nameB)}`);
  const swapB = () => router.push(`/compare/${hero}/pick?name=${encodeURIComponent(nameA)}`);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = { title: `${nameA} vs ${nameB}`, url };
    try {
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user cancelled or API unavailable — silent
    }
  };

  const mobileCardW = Math.min(width, 480) - 24;

  // router.back() throws "GO_BACK not handled" when there's no history (landed
  // here via the picker's replace, or opened the URL directly) — fall back to
  // the hero's page.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/character/${hero}`);
  };

  const controlButtons = (
    <>
      <Pressable
        onPress={goBack}
        accessibilityLabel="Go back"
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [styles.controlBtn, hovered && (styles.controlBtnHover as object)] as object
        }
      >
        <Ionicons name="arrow-back" size={15} color="rgba(245,235,220,0.75)" />
        <Text style={styles.controlText}>Back</Text>
      </Pressable>

      <Pressable
        onPress={handleShare}
        accessibilityLabel="Share matchup"
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [styles.controlBtn, hovered && (styles.controlBtnHover as object)] as object
        }
      >
        <Ionicons name="share-outline" size={15} color="rgba(245,235,220,0.75)" />
        <Text style={styles.controlText}>{copied ? 'Copied!' : 'Share'}</Text>
      </Pressable>
    </>
  );

  if (isDesktop) {
    /* Desktop — chromeless full-bleed arena, no page scroll. Floating Back/Share
       over the navy; portraits flank a centered scorecard ("Tale of the Tape"). */
    return (
      <View style={styles.desktopRoot}>
        <View style={[styles.controls, styles.controlsDesktop] as object}>{controlButtons}</View>
        <View style={styles.arena}>
          <View style={styles.arenaInner as object}>
            <ArenaPortrait
              image={imageA}
              name={nameA}
              side="left"
              state={stateA}
              onSwap={swapA}
              vtName={VT_HERO}
            />

            <View style={styles.scorecard}>
              <View style={styles.scorecardVs as object}>
                <VsBadge size={52} variant="solid" />
              </View>
              {ready && result ? (
                <>
                  <VerdictReveal verdict={verdict} tone="dark" />
                  <View style={styles.scorecardStats}>
                    {result.stats.map((stat) => (
                      <StatBattleRow key={stat.key} stat={stat} />
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.scorecardLoading}>
                  <ActivityIndicator color={COLORS.orange} />
                </View>
              )}
            </View>

            <ArenaPortrait
              image={imageB}
              name={nameB}
              side="right"
              state={stateB}
              onSwap={swapB}
              vtName={VT_PICK}
            />
          </View>
        </View>
      </View>
    );
  }

  if (!statsA || !statsB || !result || !overallWinner) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
  }

  /* Mobile web — native stack: fused clash card + verdict over a beige sheet. */
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.contentOuter}>
      <View style={styles.mobileNavyTop}>
        <View style={styles.controls}>{controlButtons}</View>
        <View style={[styles.mobileCard, { width: mobileCardW }]}>
          <ClashPortraits
            imageA={imageA}
            imageB={imageB}
            nameA={statsA.name}
            nameB={statsB.name}
            winner={overallWinner}
            width={mobileCardW}
            height={286}
            onSwapA={swapA}
            onSwapB={swapB}
          />
        </View>
        <View style={styles.verdictBlock}>
          <VerdictReveal verdict={verdict} />
        </View>
      </View>

      <View style={styles.mobileSheet}>
        <View style={styles.mobileStats}>
          {result.stats.map((stat) => (
            <StatBattleRow key={stat.key} stat={stat} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  contentOuter: { flexGrow: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: COLORS.navy,
  },
  errorText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.beige },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },

  // Floating controls (no bar) — quiet pills over the immersive navy
  controls: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexShrink: 0,
  },
  controlsDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 6,
  } as object,
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.06)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(245,235,220,0.14)',
    cursor: 'pointer',
  } as object,
  controlBtnHover: { backgroundColor: 'rgba(245,235,220,0.13)' } as object,
  controlText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: 'rgba(245,235,220,0.75)' },

  // ── Desktop arena (fixed-height, no page scroll) ───────────────
  desktopRoot: { flex: 1, backgroundColor: COLORS.navy },
  arena: {
    flex: 1,
    backgroundColor: COLORS.navy,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arenaInner: {
    maxWidth: 1200,
    width: '100%',
    height: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 24,
  } as object,
  arenaPortrait: {
    flex: 1,
    minWidth: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
    position: 'relative',
  },
  arenaPortraitWin: {
    boxShadow:
      '0 0 0 2px rgba(206,155,51,0.8), 0 0 64px rgba(206,155,51,0.28), 0 18px 50px rgba(0,0,0,0.45)',
  } as object,
  arenaImage: { width: '100%', height: '100%' } as object,
  imageLoss: { filter: 'grayscale(0.4) brightness(0.78)' } as object,
  portraitGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
    backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 100%)',
  } as object,
  lostOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,24,28,0.3)',
  } as object,
  portraitLabel: {
    position: 'absolute',
    bottom: 28,
    left: 24,
    right: 24,
  },

  scorecard: {
    width: 468,
    flexShrink: 0,
    alignSelf: 'center',
    maxHeight: '100%',
    backgroundColor: COLORS.beige,
    borderRadius: 18,
    paddingTop: 40,
    paddingBottom: 26,
    paddingHorizontal: 30,
    position: 'relative',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.55), 0 2px 6px rgba(0,0,0,0.18), 0 26px 64px rgba(0,0,0,0.42)',
  } as object,
  scorecardVs: {
    position: 'absolute',
    top: -26,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  } as object,
  scorecardStats: {
    gap: 16,
    marginTop: 18,
  },
  scorecardLoading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Shared winner treatment ────────────────────────────────────
  eyebrowWin: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.goldAccent,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  eyebrowTie: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  heroNameLarge: {
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    color: COLORS.beige,
    lineHeight: 34,
    textShadow: '0 2px 12px rgba(0,0,0,0.7)',
  } as object,
  heroNameDim: { color: 'rgba(245,235,220,0.55)' },
  winRule: {
    height: 2,
    width: 34,
    borderRadius: 2,
    backgroundColor: COLORS.goldAccent,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  winRuleRight: { alignSelf: 'flex-end' },
  alignEnd: { alignItems: 'flex-end' },
  textRight: { textAlign: 'right' },

  // ── Swap affordance ────────────────────────────────────────────
  swapHit: {
    ...StyleSheet.absoluteFillObject,
    cursor: 'pointer',
  } as object,
  swapHitHover: { backgroundColor: 'rgba(0,0,0,0.12)' } as object,
  swapChip: {
    position: 'absolute',
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 13,
    backgroundColor: 'rgba(18,14,10,0.5)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(245,235,220,0.4)',
  },
  swapChipLeft: { left: 14 },
  swapChipRight: { right: 14 },
  swapChipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    color: COLORS.beige,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // ── Mobile web (native stack) ──────────────────────────────────
  mobileNavyTop: {
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 30,
  },
  mobileCard: {
    height: 286,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
    boxShadow: '0 10px 26px rgba(0,0,0,0.4)',
  } as object,
  verdictBlock: {
    minHeight: 76,
    paddingTop: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileSheet: {
    flexGrow: 1,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -14,
    paddingTop: 24,
    paddingBottom: 40,
  },
  mobileStats: {
    gap: 18,
    paddingHorizontal: 20,
  },
});
