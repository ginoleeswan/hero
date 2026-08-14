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
import { SpotlightProgress } from './SpotlightProgress';
import { deckCards, resolveActiveIndex } from './deckSelection';
import { spotlightLayout } from '../../constants/spotlightLayout';
import { COLORS, EYEBROW, INK_TEXT } from '../../constants/colors';
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
  }, [heroes.length, reduced, step]);

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
          <Text style={styles.ghost} numberOfLines={1} accessible={false}>
            {hero.name}
          </Text>
        </View>
      )}

      <View
        style={styles.row}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          touchStart.current = e.nativeEvent.pageX;
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
              key={`${card.hero.id}-${card.index}`}
              hero={card.hero}
              width={card.width}
              height={stageHeight}
              opacity={card.opacity}
              active={card.active}
              onPress={() => (card.active ? onHeroPress(card.hero) : setActive(card.index))}
            />
          ))}
        </View>

        <View style={styles.panel}>
          {/* No backdrop-filter on native — a BlurView sits behind the content,
              clipped to the container's own radius, with the fill and border
              carried by the container itself (see web's `glassPanel`). */}
          <View style={styles.glassPanel}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.eyebrow}>Featured Character</Text>
            {/* The name is the link. A "View profile" button beside a tappable
                portrait is the same instruction printed twice — the argument
                the web plate already settled — so the chevron says it once. */}
            <Pressable
              onPress={() => onHeroPress(hero)}
              accessibilityRole="link"
              accessibilityLabel={`View ${hero.name}`}
            >
              <Text style={styles.name} numberOfLines={2}>
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
              <Text style={styles.summary} numberOfLines={detail === 'full' ? 4 : 3}>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: CARD_GAP },
  panel: { flex: 1, minWidth: 0 },
  // Ink on ink, behind the deck. Set large enough to read as scenery rather
  // than as a heading someone forgot to style.
  ghostWrap: {
    justifyContent: 'center',
    paddingLeft: 24,
  },
  ghost: {
    fontFamily: 'Flame-Regular',
    fontSize: 200,
    // Flame needs ≥1.22× or a clamped line loses its descenders.
    lineHeight: 244,
    color: COLORS.beige,
    opacity: 0.055,
  },
  // Glass info panel — web's `glassPanel` uses `backdrop-filter: blur(18px)`,
  // which doesn't exist on native. The BlurView above fills this container
  // (absoluteFill, first child) and is clipped to the same radius by
  // `overflow: hidden`; the translucent fill and border live on the
  // container itself so they composite over the blur rather than under it.
  glassPanel: {
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
  // Unlike web's `marginTop: 'auto'`, this panel isn't stretched to the
  // deck's full height (`row` centres its cross-axis, so the glass container
  // is sized by its own content) — a fixed gap reads the same without an
  // unfilled flex parent for `auto` to push against.
  footer: { marginTop: 12, alignItems: 'flex-start' },
});
