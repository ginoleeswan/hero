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
import { Text } from '../ui/Text';
import { SpotlightDeckCard } from './SpotlightDeckCard';
import { SpotlightProgress } from './SpotlightProgress';
import { deckCards, resolveActiveIndex } from './deckSelection';
import { spotlightLayout } from '../../constants/spotlightLayout';
import { COLORS } from '../../constants/colors';
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
  const align = hero.alignment ? ALIGNMENT_LABELS[hero.alignment.toLowerCase().trim()] : undefined;
  const kicker = [hero.publisher, align].filter(Boolean).join('   ·   ');
  // caption sheds the blurb; duo clamps it; gallery lets it run.
  const blurbLines = detail === 'full' ? 4 : 3;

  const topClearance = insetTop + TABLET_TAB_CLEARANCE;

  return (
    <View
      style={[
        styles.stage,
        {
          height: stageHeight + topClearance,
          paddingHorizontal: gutter,
          paddingTop: topClearance,
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
          {!!kicker && (
            <Text style={styles.kicker} numberOfLines={1}>
              {kicker}
            </Text>
          )}
          {/* The name is the link. A "View profile" button beside a tappable
              portrait is the same instruction printed twice — the argument the
              web plate already settled — so the chevron says it once. */}
          <Pressable
            onPress={() => onHeroPress(hero)}
            accessibilityRole="link"
            accessibilityLabel={`View ${hero.name}`}
          >
            <Text style={styles.name} numberOfLines={2}>
              {hero.name}
            </Text>
          </Pressable>
          {detail !== 'lean' && !!hero.summary && (
            <Text style={styles.blurb} numberOfLines={blurbLines}>
              {hero.summary}
            </Text>
          )}
          {heroes.length > 1 && (
            <View style={styles.progress}>
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
  );
}

const styles = StyleSheet.create({
  stage: { backgroundColor: COLORS.deepNavy, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: CARD_GAP },
  panel: { flex: 1, minWidth: 0, gap: 12 },
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
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    letterSpacing: 0.4,
    color: COLORS.orange,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 46,
    // 1.24× — clamped Flame clips below 1.22×.
    lineHeight: 58,
    color: COLORS.beige,
  },
  blurb: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(245,235,220,0.66)',
  },
  progress: { marginTop: 4, alignItems: 'flex-start' },
});
