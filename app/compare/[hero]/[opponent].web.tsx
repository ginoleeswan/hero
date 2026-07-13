import { useState } from 'react';
import { flushSync } from 'react-dom';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { heroImageSource } from '../../../src/constants/heroImages';
import { useCompareMatchup } from '../../../src/hooks/useCompareMatchup';
import { COLORS, SURFACE } from '../../../src/constants/colors';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { ClashPortraits } from '../../../src/components/compare/ClashPortraits';
import { HeroMonogram } from '../../../src/components/HeroImage';
import { VerdictReveal } from '../../../src/components/compare/VerdictReveal';
import { CommunityVotes } from '../../../src/components/compare/CommunityVotes';
import { StatBattleRow } from '../../../src/components/compare/StatBattleRow';
import { VsBadge } from '../../../src/components/compare/VsBadge';
import { MatchupBadge } from '../../../src/components/compare/MatchupBadge';
import { useRelationship } from '../../../src/lib/query/heroQueries';
import { SeoHead } from '../../../src/components/web/SeoHead';
import { SITE_URL } from '../../../src/constants/site';
import { vsShareLine } from '../../../src/lib/share';
import { relationshipBadge } from '../../../src/lib/db/heroes';
import { getFighterArt, stashFighters } from '../../../src/lib/compareHandoff';
import { withViewTransition } from '../../../src/lib/viewTransition';
import { useMatchupShareImage } from '../../../src/hooks/useMatchupShareImage';
import { useMatchupVote } from '../../../src/hooks/useMatchupVote';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { TakesSection } from '../../../src/components/takes/TakesSection';

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

/** Winner caption matching native: gold "Winner"/"Draw" eyebrow, name, gold rule.
 *  The name is a link to the hero's profile (chevron affordance, hover underline). */
function PortraitLabel({
  name,
  state,
  align,
  onViewProfile,
}: {
  name: string;
  state: PortraitState;
  align: 'left' | 'right';
  onViewProfile: () => void;
}) {
  const right = align === 'right';
  return (
    <View
      pointerEvents="box-none"
      style={[styles.portraitLabel, right && (styles.alignEnd as object)] as object}
    >
      {state === 'win' && (
        <View style={[styles.winBadge, right && (styles.winBadgeRight as object)] as object}>
          <Ionicons name="trophy" size={13} color={COLORS.goldAccent} />
          <Text style={styles.eyebrowWin}>Winner</Text>
        </View>
      )}
      {state === 'tie' && (
        <Text style={[styles.eyebrowTie, right && (styles.textRight as object)] as object}>
          Draw
        </Text>
      )}
      <Pressable
        onPress={onViewProfile}
        accessibilityRole="link"
        accessibilityLabel={`View ${name}'s profile`}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [
            styles.nameLink,
            right && (styles.nameLinkRight as object),
            hovered && (styles.nameLinkHover as object),
          ] as object
        }
      >
        {right && <Ionicons name="chevron-back" size={17} color="rgba(245,235,220,0.7)" />}
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
        {!right && <Ionicons name="chevron-forward" size={17} color="rgba(245,235,220,0.7)" />}
      </Pressable>
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
  onViewProfile,
  vtName,
}: {
  image: { uri: string } | null;
  name: string;
  side: 'left' | 'right';
  state: PortraitState;
  onSwap: () => void;
  onViewProfile: () => void;
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
      {image?.uri ? (
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
      ) : (
        <HeroMonogram
          seed={name}
          name={name}
          style={[styles.arenaImage, state === 'loss' && (styles.imageLoss as object)] as object}
        />
      )}
      <View style={styles.portraitGradient as object} />
      {state === 'loss' && <View style={styles.lostOverlay as object} />}
      {/* Swap covers the whole portrait; the name link sits on top of it so a
          tap on the name opens the profile and a tap elsewhere swaps. */}
      <SwapOverlay side={side} name={name} onPress={onSwap} />
      {name ? (
        <PortraitLabel name={name} state={state} align={side} onViewProfile={onViewProfile} />
      ) : null}
    </View>
  );
}

export default function WebCompareScreen() {
  const { hero, opponent } = useLocalSearchParams<{ hero: string; opponent: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Document scroll so the mobile arena bleeds edge-to-edge under the iOS Safari
  // toolbar. Mobile ends on the beige sheet; desktop is a fixed navy arena.
  useScreenChrome({ top: SURFACE.ink, canvas: isDesktop ? SURFACE.band : SURFACE.ink });

  const { statsA, statsB, result, overallWinner, verdict, error } = useCompareMatchup(
    hero,
    opponent,
  );
  const { data: relationship } = useRelationship(hero, opponent);
  const badge = relationshipBadge(relationship);

  const [shareMsg, setShareMsg] = useState('');
  // When swapping back to the picker, the *kept* fighter morphs into the pick
  // page's locked portrait — so it must carry VT_HERO and the discarded side
  // must drop its name (two elements can't share one view-transition-name).
  const [backMorph, setBackMorph] = useState<'A' | 'B' | null>(null);
  const vtNameA = backMorph === 'A' ? VT_HERO : backMorph === 'B' ? undefined : VT_HERO;
  const vtNameB = backMorph === 'B' ? VT_HERO : backMorph === 'A' ? undefined : VT_PICK;

  const ready = !!(statsA && statsB && result && overallWinner);

  // Paint portraits instantly from the picker handoff (or an id fallback) so the
  // shared-element morph has a target before stats finish loading. Once stats
  // arrive, the winner glow / loser desaturation reveal over the morphed image.
  //
  // Guard: only call heroImageSource when we actually have a URL. Without this,
  // heroImageSource falls back to bundled local images (HERO_IMAGES map) or CDN
  // URLs that differ from the Supabase portrait, causing a visible flash on hard
  // refresh before the real portrait arrives.
  const artA = getFighterArt(hero);
  const artB = getFighterArt(opponent);
  const rawUrlA = statsA?.image.url ?? artA?.image_url;
  const portraitUrlA = statsA?.image.portraitUrl ?? artA?.portrait_url;
  const rawUrlB = statsB?.image.url ?? artB?.image_url;
  const portraitUrlB = statsB?.image.portraitUrl ?? artB?.portrait_url;
  const imageA = rawUrlA || portraitUrlA ? heroImageSource(hero, rawUrlA, portraitUrlA) : null;
  const imageB = rawUrlB || portraitUrlB ? heroImageSource(opponent, rawUrlB, portraitUrlB) : null;
  const nameA = statsA?.name ?? artA?.name ?? '';
  const nameB = statsB?.name ?? artB?.name ?? '';

  // The arena is the RESULT page — read-only. Voting happens earlier, as an
  // in-place poll on the matchup cards; here we only display who wins (stats +
  // verdict) and the fan-vote tally. We read the tally (+ the viewer's own pick
  // to highlight it) but never cast a vote from this screen.
  const { tally, pickedId } = useMatchupVote(hero, opponent);
  const stateA: PortraitState = ready ? portraitState(overallWinner!, 'A') : 'neutral';
  const stateB: PortraitState = ready ? portraitState(overallWinner!, 'B') : 'neutral';

  // Highest-res portrait URLs for the shareable poster (prefer the portrait crop).
  const shareImgA = portraitUrlA || rawUrlA ? { uri: (portraitUrlA ?? rawUrlA) as string } : null;
  const shareImgB = portraitUrlB || rawUrlB ? { uri: (portraitUrlB ?? rawUrlB) as string } : null;
  const { hiddenCard, share: shareImage } = useMatchupShareImage({
    nameA,
    nameB,
    imageA: shareImgA,
    imageB: shareImgB,
    winner: overallWinner ?? 'tie',
    verdict,
    winsA: result?.winsA ?? 0,
    winsB: result?.winsB ?? 0,
  });

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

  // Tap A → keep B (opponent becomes the fixed hero); tap B → keep A. The kept
  // fighter morphs into the picker's locked seat: stash its art so the picker
  // paints it instantly, tag it VT_HERO, then navigate inside a view transition.
  const swapA = () => {
    stashFighters({ id: opponent, name: nameB, image_url: rawUrlB, portrait_url: portraitUrlB });
    flushSync(() => setBackMorph('B'));
    withViewTransition(() =>
      router.push(`/compare/${opponent}/pick?name=${encodeURIComponent(nameB)}`),
    );
  };
  const swapB = () => {
    stashFighters({ id: hero, name: nameA, image_url: rawUrlA, portrait_url: portraitUrlA });
    flushSync(() => setBackMorph('A'));
    withViewTransition(() =>
      router.push(`/compare/${hero}/pick?name=${encodeURIComponent(nameA)}`),
    );
  };

  const flash = (msg: string) => {
    setShareMsg(msg);
    setTimeout(() => setShareMsg(''), 2200);
  };

  const handleShare = async () => {
    // Lead with the generated VS poster (the thing worth posting). Fall back to
    // sharing/copying the link when image share isn't available (e.g. desktop
    // browsers with no Web Share file support, or a tainted-canvas failure).
    const outcome = await shareImage();
    if (outcome === 'shared') return;
    if (outcome === 'downloaded') {
      flash('Image saved!');
      return;
    }
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const line = vsShareLine(nameA, nameB, tally?.votesA ?? 0, tally?.votesB ?? 0);
    try {
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ url })) {
        await navigator.share({ title: `${nameA} vs ${nameB}`, text: line, url });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${line} ${url}`);
        flash('Link copied!');
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

  // Per-matchup SEO/social head (JS-rendering crawlers; link-preview bots get
  // the same tags server-side from api/share-meta via the vercel.json rewrite).
  const seo =
    nameA && nameB ? (
      <SeoHead
        title={`${nameA} vs ${nameB} — Mythique`}
        description={vsShareLine(nameA, nameB, tally?.votesA ?? 0, tally?.votesB ?? 0)}
        path={`/compare/${hero}/${opponent}`}
        image={`${SITE_URL}/api/og?a=${encodeURIComponent(hero)}&b=${encodeURIComponent(opponent)}`}
      />
    ) : null;

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
        <Text style={styles.controlText}>{shareMsg || 'Share'}</Text>
      </Pressable>
    </>
  );

  if (isDesktop) {
    /* Desktop — a two-beat page. Beat one: the navy arena poster (portraits
       flank a centered scorecard, "Head to Head"), sized just under the
       viewport so the whole verdict is visible without scrolling. Beat two:
       the beige debate hands off at an ink→paper seam and peeks above the
       fold, so the take count + first take invite a motivated scroll rather
       than a jarring spill. Floating Back/Share over the navy. */
    return (
      <View style={styles.desktopRoot}>
        {seo}
        {hiddenCard}
        <View style={[styles.controls, styles.controlsDesktop] as object}>{controlButtons}</View>
        <View style={styles.arena}>
          <View style={styles.arenaInner as object}>
            <ArenaPortrait
              image={imageA}
              name={nameA}
              side="left"
              state={stateA}
              onSwap={swapA}
              onViewProfile={() => router.push(`/character/${hero}`)}
              vtName={vtNameA}
            />

            <View style={styles.scorecard}>
              <View style={styles.scorecardVs as object}>
                <VsBadge size={52} variant="solid" />
              </View>
              <MatchupBadge badge={badge} style={{ marginBottom: 14 }} />
              {ready && result ? (
                <>
                  <VerdictReveal verdict={verdict} tone="dark" />
                  <View style={styles.scorecardCommunity}>
                    <CommunityVotes tally={tally} pickedId={pickedId} heroAId={hero} tone="light" />
                  </View>
                  <View style={styles.scorecardStats}>
                    {result.stats.map((stat, i) => (
                      <StatBattleRow key={stat.key} stat={stat} animateIn animationDelay={i * 55} />
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
              onViewProfile={() => router.push(`/character/${opponent}`)}
              vtName={vtNameB}
            />
          </View>
        </View>

        {ready && (
          <View style={styles.desktopTakesOuter}>
            <View style={styles.desktopTakesInner}>
              <TakesSection
                heroA={{ id: hero, name: nameA }}
                heroB={{ id: opponent, name: nameB }}
              />
            </View>
          </View>
        )}
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

  /* Mobile web — native stack: fused clash card + verdict over a beige sheet.
     Back is omitted (TopBar + browser chrome handle navigation). Share sits in
     the verdict block — the emotional punchline is the moment users want to
     forward the result, so the action should be right there, not buried below
     a full stat list. */
  return (
    <View style={[styles.scroll, styles.contentOuter] as object}>
      {seo}
      {hiddenCard}
      <View style={styles.mobileNavyTop as object}>
        <View style={[styles.mobileCard, { width: mobileCardW }]}>
          <ClashPortraits
            imageA={imageA ?? { uri: '' }}
            imageB={imageB ?? { uri: '' }}
            nameA={statsA.name}
            nameB={statsB.name}
            winner={overallWinner}
            width={mobileCardW}
            height={286}
            onSwapA={swapA}
            onSwapB={swapB}
            onViewProfileA={() => router.push(`/character/${hero}`)}
            onViewProfileB={() => router.push(`/character/${opponent}`)}
          />
        </View>
        <MatchupBadge badge={badge} style={{ marginTop: 14, marginBottom: 2 }} />
        <View style={styles.verdictBlock}>
          <VerdictReveal verdict={verdict} />
          <View style={styles.mobileCommunity}>
            <CommunityVotes tally={tally} pickedId={pickedId} heroAId={hero} tone="dark" />
          </View>
          <Pressable
            onPress={handleShare}
            accessibilityLabel="Share matchup"
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [styles.shareRow, hovered && (styles.shareRowHover as object)] as object
            }
          >
            <Ionicons name="share-outline" size={14} color="rgba(245,235,220,0.7)" />
            <Text style={styles.shareRowText}>{shareMsg || 'Share result'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.mobileSheet}>
        <View style={styles.mobileStats}>
          {result.stats.map((stat) => (
            <StatBattleRow key={stat.key} stat={stat} />
          ))}
        </View>
        <View style={styles.mobileTakes}>
          <TakesSection heroA={{ id: hero, name: nameA }} heroB={{ id: opponent, name: nameB }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { minHeight: '100dvh', backgroundColor: COLORS.beige } as object,
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
    paddingTop: TOPBAR_HEIGHT + 6,
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

  // ── Desktop arena — fills the viewport with no internal scroll; The
  // Debate sits on the beige canvas below it, and the document scrolls to it.
  desktopRoot: { backgroundColor: COLORS.navy },
  arena: {
    // Just under a full viewport: the poster fills the first screen (verdict
    // fully visible, no scroll to see it) but deliberately leaves ~18vh so the
    // debate below peeks in and invites the scroll.
    minHeight: '82vh' as unknown as number,
    backgroundColor: COLORS.navy,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopTakesOuter: {
    backgroundColor: COLORS.beige,
    paddingHorizontal: 24,
    paddingVertical: 40,
  } as object,
  desktopTakesInner: {
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
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
      '0 0 0 3px rgba(206,155,51,0.95), 0 0 80px rgba(206,155,51,0.42), 0 18px 52px rgba(0,0,0,0.5)',
  } as object,
  arenaImage: { width: '100%', height: '100%' } as object,
  imageLoss: { filter: 'grayscale(0.5) brightness(0.76)' } as object,
  portraitGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
    backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 100%)',
  } as object,
  lostOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12,17,20,0.32)',
  } as object,
  portraitLabel: {
    position: 'absolute',
    bottom: 28,
    left: 24,
    right: 24,
  },

  scorecard: {
    width: 380,
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
  scorecardCommunity: {
    marginTop: 18,
    marginBottom: 4,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(41,60,67,0.14)',
  },
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
  winBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(14,20,24,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(206,155,51,0.55)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
  } as object,
  winBadgeRight: { flexDirection: 'row-reverse', alignSelf: 'flex-end' } as object,
  eyebrowWin: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.goldAccent,
    textTransform: 'uppercase',
    letterSpacing: 2,
  } as object,
  eyebrowTie: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  nameLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  } as object,
  nameLinkRight: { alignSelf: 'flex-end' } as object,
  nameLinkHover: { opacity: 0.82 } as object,
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
    ...StyleSheet.absoluteFill,
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
    paddingTop: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 16px)`,
    paddingBottom: 30,
  } as object,
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
  mobileCommunity: {
    alignSelf: 'stretch',
    maxWidth: 380,
    marginTop: 16,
    marginBottom: 4,
  } as object,
  mobileSheet: {
    flexGrow: 1,
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -14,
    paddingTop: 24,
    paddingBottom: 'calc(40px + env(safe-area-inset-bottom))',
  } as object,
  mobileStats: {
    gap: 18,
    paddingHorizontal: 20,
  },
  mobileTakes: {
    marginTop: 28,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(41,60,67,0.1)',
    paddingTop: 24,
  },

  // Share pill — in the navy verdict block, inline with the result reveal
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(245,235,220,0.18)',
    cursor: 'pointer',
  } as object,
  shareRowHover: { backgroundColor: 'rgba(245,235,220,0.14)' } as object,
  shareRowText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.7)',
  },
});
