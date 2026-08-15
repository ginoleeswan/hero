// src/components/home/SpotlightDeck.tsx — the billboard above 720pt.
//
// The phone billboard crops a 2:3 portrait into a box whose aspect comes from
// the window, which is fine at 0.81 and ruinous at 2.55: a landscape iPad kept
// the top 26% of the artwork. Here the card's aspect is the invariant and the
// stage height follows it, so rotating changes how many cards you see and never
// what shape they are. `spotlightLayout` owns that arithmetic for both
// platforms; this component owns only what is shown at each of its states.
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '../ui/Text';
import { SpotlightDeckCard } from './SpotlightDeckCard';
import { SpotlightGlow } from './SpotlightGlow';
import { SpotlightProgress } from './SpotlightProgress';
import { deckCards, resolveActiveIndex } from './deckSelection';
import { spotlightLayout, summaryLineBudget } from '../../constants/spotlightLayout';
import { COLORS, EYEBROW, INK_TEXT } from '../../constants/colors';
import { brandForPublisher } from '../../constants/publishers';
import { ALIGNMENT_LABELS } from '../../lib/characterTaxonomy';
import type { Hero } from '../../lib/db/heroes';

// One clock for the deck and its progress fill, matching the phone carousel.
const AUTOPLAY_MS = 6000;
const CARD_GAP = 12;
/** Past this a horizontal drag is a deck flip rather than a stray touch. */
const SWIPE_THRESHOLD = 44;

// iPadOS floats the tab bar at the TOP, not the bottom. Measured on an iPad
// Pro 13" simulator in both orientations: the pill (Explore / Arena / Profile
// / search) spans roughly 19–71pt, sitting directly on the deck's top card. A
// ~24pt safe-area inset plus this clears it in both orientations.
export const TABLET_TAB_CLEARANCE = 48;

// Web's spotlight wrap carries `marginBottom: 24` so the billboard doesn't sit
// flush against the section below it. `spotlightHeight()` (SpotlightCarousel)
// and the skeleton that mirrors it both need to agree with this number, so it
// lives here rather than being restated at each call site.
export const SPOTLIGHT_DECK_BOTTOM_GAP = 24;

/**
 * Brand hex → rgba at the ambient-glow alpha — the same conversion web's
 * local `glowColor` does for its stage orb (`app/(tabs)/explore.web.tsx`).
 * `brandForPublisher` is platform-neutral and lives in `constants/publishers`,
 * but this alpha blend is presentation, not data, so it stays local here too.
 */
function glowColor(hex: string | undefined, alpha: number): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return `rgba(231,115,51,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// A single power-stat chip: icon + value, a magnitude bar (stats run 0–100),
// then the key label — mirrors web's StatChip at panel widths of the same
// order (its 400–460pt targets are close kin to the native 415–475pt range).
function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statPill}>
      <View style={styles.statTop}>
        <MaterialCommunityIcons name={icon} size={18} color={COLORS.orange} />
        <Text style={styles.statPillVal}>{value}</Text>
      </View>
      <View style={styles.statBarTrack}>
        <View style={[styles.statBarFill, { width: `${Math.min(100, value)}%` }]} />
      </View>
      <Text style={styles.statPillKey}>{label}</Text>
    </View>
  );
}

export function SpotlightDeck({
  heroes,
  insetTop,
  onHeroPress,
}: {
  heroes: Hero[];
  insetTop: number;
  onHeroPress: (hero: Hero) => void;
}) {
  const { width } = useWindowDimensions();
  const layout = spotlightLayout(width);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  // A ref, not component state: it must survive a re-render between the
  // responder grant and release (autoplay ticks every 6s, and setActive
  // re-renders), or the gesture's start point is silently lost.
  const touchStart = useRef<number | null>(null);
  // Web pauses autoplay while the pointer rests on the stage — touch has no
  // hover, so a tap here instead restarts the dwell from zero. Bumping this
  // counter tears the interval effect down and recreates it, which buys a
  // full AUTOPLAY_MS from the moment of the touch rather than handing the
  // rest of whatever dwell was already in flight.
  const [interactionTick, setInteractionTick] = useState(0);
  // The name is the only variable-height element above the summary, and the
  // summary's line budget is what is left after it — see summaryLineBudget.
  // Measured rather than guessed: onTextLayout reports the laid-out lines.
  const [nameLines, setNameLines] = useState(1);
  const bumpInteraction = useCallback(() => setInteractionTick((t) => t + 1), []);

  const step = useCallback(
    (dir: number) => setActive((i) => (i + dir + heroes.length) % heroes.length),
    [heroes.length],
  );

  // Autoplay only re-renders the deck, not the feed around it. Off entirely
  // under Reduce Motion, where an unattended advance is the thing being asked
  // for less of.
  useEffect(() => {
    if (heroes.length <= 1 || reduced) return;
    const timer = setInterval(() => step(1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [heroes.length, reduced, step, interactionTick]);

  if (heroes.length === 0) return null;

  const { stageHeight, cardWidth, tail, detail, showGhostName, gutter } = layout;
  // A refetch can shrink `heroes` out from under `active` between renders;
  // resolve once so the panel and the deck's front card never disagree.
  const safeActive = resolveActiveIndex(active, heroes.length);
  const hero = heroes[safeActive];
  const cards = deckCards(heroes, { cardWidth, tail }, safeActive);
  // ALIGNMENT_LABELS is a plain Record — an alignment string outside its
  // handful of known keys indexes to `undefined`, which the chip below guards.
  const align = hero.alignment ? ALIGNMENT_LABELS[hero.alignment.toLowerCase().trim()] : undefined;
  const hasRealName = detail !== 'lean' && !!hero.full_name && hero.full_name !== hero.name;
  const hasSummary = detail !== 'lean' && !!hero.summary;
  const hasStats = !!(hero.intelligence || hero.strength || hero.speed);
  const hasFirstAppearance = detail === 'full' && !!hero.first_appearance;

  // Publisher-tinted ambience: the orb warms toward the featured hero's brand
  // colour (Marvel red, DC blue…), easing over 800ms per advance — see
  // SpotlightGlow. Fixed size, matching web's `pss.orbA` exactly
  // (`app/(tabs)/explore.web.tsx`) — it isn't scaled off the stage there
  // either, so scaling it here just pushed it off-screen on wide stages.
  const brand = brandForPublisher(hero.publisher);
  const brandGlow = glowColor(brand?.color, 0.16);
  const glowSize = 320;
  // Matches web's `backdropSize` exactly (`app/(tabs)/explore.web.tsx`) — a
  // fraction of the viewport, clamped so it never shrinks to illegible or
  // grows past the stage on very wide screens.
  const ghostSize = Math.min(260, Math.max(140, Math.round(width * 0.15)));

  const topClearance = insetTop + TABLET_TAB_CLEARANCE;

  return (
    <View
      style={[
        styles.stage,
        {
          // The extra `SPOTLIGHT_DECK_BOTTOM_GAP` lands as bottom padding, not
          // extra centred space — `justifyContent: 'center'` centres within
          // the content box (padding already excluded), so the deck's own
          // cards/panel keep their original `stageHeight` and the gap shows
          // up only below them, matching web's `marginBottom: 24`.
          height: stageHeight + topClearance + SPOTLIGHT_DECK_BOTTOM_GAP,
          paddingHorizontal: gutter,
          paddingTop: topClearance,
          paddingBottom: SPOTLIGHT_DECK_BOTTOM_GAP,
        },
      ]}
    >
      {showGhostName && (
        <View style={[StyleSheet.absoluteFill, styles.ghostWrap]} pointerEvents="none">
          <Text
            style={[
              styles.ghost,
              { fontSize: ghostSize, lineHeight: Math.round(ghostSize * 1.05) },
            ]}
            numberOfLines={1}
            accessible={false}
          >
            {hero.name.toUpperCase()}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.glowLayer,
          {
            width: glowSize,
            height: glowSize,
            // Matches web's `pss.orbA` (`top: -60, left: 140` within its
            // gutter-inset content band): native's glow layer sits inside the
            // stage View, whose absolute children ignore the stage's
            // `paddingHorizontal` and whose content starts `topClearance`
            // down — so the gutter and topClearance offsets stand in for
            // web's wrap-relative origin.
            top: topClearance - 60,
            left: gutter + 140,
          },
        ]}
        pointerEvents="none"
      >
        <SpotlightGlow color={brandGlow} size={glowSize} />
      </View>

      <View
        style={styles.row}
        // `onStartShouldSetResponder` is a bubbling handler, and RN's responder
        // negotiation grants the responder to the deepest node that returns
        // true — every card is a Pressable and so is the panel name, so they
        // all claimed the responder on touch start and this row's grant/release
        // pair almost never fired. Capture-phase handlers run top-down instead:
        // recording the start point here (without claiming the responder, so
        // taps still reach the cards) and only claiming it, via
        // `onMoveShouldSetResponderCapture`, once the drag has actually
        // crossed the swipe threshold. A plain tap never claims the row's
        // responder at all — it falls through to the card/panel Pressable
        // underneath, which is what makes tapping still work.
        onStartShouldSetResponderCapture={(e) => {
          touchStart.current = e.nativeEvent.pageX;
          return false;
        }}
        onMoveShouldSetResponderCapture={(e) => {
          const from = touchStart.current;
          if (from == null) return false;
          return Math.abs(e.nativeEvent.pageX - from) > SWIPE_THRESHOLD;
        }}
        onResponderGrant={() => {
          // Only reached once the move-capture above has claimed the
          // responder for a genuine swipe — restart the dwell here too, so a
          // drag across the stage counts as interaction just like a tap does.
          bumpInteraction();
        }}
        onResponderRelease={(e) => {
          const from = touchStart.current;
          touchStart.current = null;
          if (from == null) return;
          const dx = e.nativeEvent.pageX - from;
          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            step(dx < 0 ? 1 : -1);
            if (!reduced) Haptics.selectionAsync();
          }
        }}
      >
        <View style={styles.strip}>
          {cards.map((card) => (
            <SpotlightDeckCard
              // Stable per-hero key — not the index or taper position, both of
              // which change on every advance. The card has to hold its slot
              // across renders for the width/opacity animation to have
              // anything to animate between; a key that moves defeats it by
              // making React remount into a new position instead.
              key={card.hero.id}
              hero={card.hero}
              width={card.width}
              height={stageHeight}
              opacity={card.opacity}
              active={card.active}
              next={card.next}
              onPress={() => {
                // The row's own responder never grants on a plain tap (see the
                // capture-phase handlers above), so a card tap has to restart
                // the dwell itself — otherwise a tap that merely promotes a
                // sliver leaves `SpotlightProgress` timed against whatever
                // dwell was already in flight.
                bumpInteraction();
                if (card.active) onHeroPress(card.hero);
                else setActive(card.index);
              }}
            />
          ))}
        </View>

        <View style={styles.panel}>
          {/* No backdrop-filter on native — a BlurView sits behind the content,
              clipped to the container's own radius, with the fill and border
              carried by the container itself (see web's `glassPanel`). Web's
              panel is `rgba(255,255,255,0.04)` + `blur(18px)` — barely there,
              so the ghost name in `ghostWrap` shows *through* it. A high
              BlurView `intensity` is opaque enough to erase that; kept low so
              the panel reads the same as web's glass, not a frosted card. */}
          <View style={styles.glassPanel}>
            <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.eyebrow}>Featured Character</Text>
            {/* The name is the link. A "View profile" button beside a tappable
                portrait is the same instruction printed twice — the argument
                the web plate already settled — so the chevron says it once. */}
            <Pressable
              onPress={() => {
                bumpInteraction();
                onHeroPress(hero);
              }}
              accessibilityRole="link"
              accessibilityLabel={`View ${hero.name}`}
            >
              <Text
                style={styles.name}
                numberOfLines={2}
                onTextLayout={(e) => setNameLines(e.nativeEvent.lines.length)}
              >
                {hero.name}
              </Text>
            </Pressable>
            {hasRealName && (
              <Text style={styles.realName} numberOfLines={1}>
                {hero.full_name}
              </Text>
            )}
            <View style={styles.metaRow}>
              {!!hero.publisher && (
                <Text style={styles.publisher} numberOfLines={1}>
                  {hero.publisher}
                </Text>
              )}
              {!!align && (
                <View style={styles.alignChip}>
                  <Text style={styles.alignChipText}>{align}</Text>
                </View>
              )}
            </View>
            {hasSummary && (
              <Text
                style={styles.summary}
                numberOfLines={detail === 'full' ? summaryLineBudget(stageHeight, nameLines) : 3}
              >
                {hero.summary}
              </Text>
            )}
            {hasStats && (
              <View style={styles.statPills}>
                {!!hero.intelligence && (
                  <StatChip icon="brain" label="INT" value={hero.intelligence} />
                )}
                {!!hero.strength && <StatChip icon="arm-flex" label="STR" value={hero.strength} />}
                {!!hero.speed && <StatChip icon="run-fast" label="SPD" value={hero.speed} />}
              </View>
            )}
            {hasFirstAppearance && (
              <Text style={styles.firstAppearance} numberOfLines={1}>
                First appearance · {hero.first_appearance}
              </Text>
            )}
            {heroes.length > 1 && (
              <View style={styles.footer}>
                {/* Web's plate number (`03 / 08`) beside its dwell rail — the
                    rail says how long this one has left, the number says
                    where in the deck you are. */}
                <Text style={styles.plateNo}>
                  {String(safeActive + 1).padStart(2, '0')}
                  <Text
                    style={styles.plateNoTotal}
                  >{` / ${String(heroes.length).padStart(2, '0')}`}</Text>
                </Text>
                <SpotlightProgress
                  count={heroes.length}
                  active={safeActive}
                  intervalMs={AUTOPLAY_MS}
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: COLORS.deepNavy, justifyContent: 'center' },
  // `stretch` (not `center`) so the glass panel below runs the full stage
  // height, matching web's `pss.wrap` — see `glassPanel`'s `flex: 1`. The
  // strip's own cards are already given an explicit `height={stageHeight}`
  // by the caller, so stretching this row's cross-axis doesn't change their
  // size, only the panel's, which had none.
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: CARD_GAP },
  panel: { flex: 1, minWidth: 0 },
  // Ink on ink, behind the deck. Set large enough to read as scenery rather
  // than as a heading someone forgot to style. Clips to the stage bounds —
  // matches web's `ambientClip` — so the name's bottom-left overhang (see
  // `ghost` below) doesn't bleed past the stage edge.
  ghostWrap: {
    overflow: 'hidden',
  },
  ghost: {
    // Anchored bottom-left of the (clipped) stage, hanging slightly off both
    // edges — matches web's `pss.backdropName` (`bottom: -14, left: -6`)
    // exactly. Previously this was centred, which is why native's ghost sat
    // mid-stage instead of low-left like web's.
    position: 'absolute',
    bottom: -14,
    left: -6,
    fontFamily: 'Flame-Regular',
    // fontSize/lineHeight are supplied inline from `ghostSize` (viewport-
    // derived, matching web's `backdropSize`) rather than fixed here.
    color: COLORS.beige,
    // Matches web's `pss.backdropName` (`rgba(245,235,220,0.07)`) — legible
    // only once the panel's BlurView is thinned to let it show through.
    opacity: 0.07,
    letterSpacing: 2,
    // Uppercase-only text (see `.toUpperCase()` at the call site) has no
    // descenders, so this is exempt from the repo's ≥1.22× clamped-Flame
    // line-height rule (CLAUDE.md) — that rule exists to stop `g`/`y`/`p`
    // descenders from being clipped by `numberOfLines` + tight line-height,
    // and there are none here. Matching web's 1.05 keeps the glyphs from
    // spacing out vertically for no reason; do not "fix" this back to 1.22.
  },
  // Positioned behind the strip (see the inline top/left/width/height in the
  // render — they depend on stageHeight/gutter/glowSize) and never intercepts
  // touch, so it sits between the ghost name and the row in paint order only.
  glowLayer: { position: 'absolute' },
  // Glass info panel — web's `glassPanel` uses `backdrop-filter: blur(18px)`,
  // which doesn't exist on native. The BlurView above fills this container
  // (absoluteFill, first child) and is clipped to the same radius by
  // `overflow: hidden`; the translucent fill and border live on the
  // container itself so they composite over the blur rather than under it.
  glassPanel: {
    // Fills `panel`'s now-stretched height (see `row`) and top-aligns its
    // content by default (column flex, no `justifyContent` override) —
    // matching web's `flex: 1` + `justifyContent: 'flex-start'`.
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingVertical: 32,
    paddingHorizontal: 30,
  },
  eyebrow: {
    ...EYEBROW,
    marginBottom: 10,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 38,
    // ~1.24× — clamped Flame clips below 1.22×.
    lineHeight: 47,
    color: COLORS.beige,
    paddingBottom: 2,
    marginBottom: 4,
  },
  realName: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 17,
    color: INK_TEXT.faint,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  publisher: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: INK_TEXT.faint,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  alignChip: {
    backgroundColor: 'rgba(231,115,51,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(231,115,51,0.4)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  alignChipText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summary: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14.5,
    lineHeight: 22,
    color: INK_TEXT.muted,
    marginBottom: 20,
  },
  statPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statPill: {
    flexGrow: 1,
    flexBasis: 90,
    maxWidth: 120,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 9,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statPillKey: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: INK_TEXT.faint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statPillVal: {
    fontFamily: 'Flame-Regular',
    fontSize: 23,
    color: COLORS.beige,
    lineHeight: 23,
  },
  statBarTrack: {
    height: 4,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  statBarFill: {
    height: 4,
    backgroundColor: COLORS.orange,
    borderRadius: 4,
  },
  firstAppearance: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: INK_TEXT.faint,
  },
  // `marginTop: 'auto'` now has something to push against: `glassPanel` is
  // `flex: 1` inside a stretched-height `panel`, so the footer (rail + plate
  // number) sits pinned to the stage floor exactly as it does on web,
  // instead of trailing directly under whatever content happens to precede
  // it.
  footer: {
    marginTop: 'auto',
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Matches web's `pss.plateNo` / `plateNoTotal` — Flame for a tracked,
  // tabular-feeling digit pair rather than the panel's usual Nunito prose.
  plateNo: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    lineHeight: 19,
    color: COLORS.beige,
    letterSpacing: 1,
  },
  plateNoTotal: { color: INK_TEXT.faint },
});
