import { memo, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';

const IS_WEB = Platform.OS === 'web';

interface OpponentLike {
  id: string;
  name: string;
  image_url?: string | null;
  portrait_url?: string | null;
}

interface OpponentCardProps {
  item: OpponentLike;
  onPress: () => void;
  /** Fixed width — used by native grid cells and horizontal rails. */
  width?: number;
  /** Fixed height — paired with `width`. */
  height?: number;
  /** Stretch to fill a CSS-grid cell (web roster grid). */
  fill?: boolean;
  /** Smaller name type for the compact suggestion rails. */
  compact?: boolean;
  /** Gold ring — marks marquee picks (Classic Rivals). */
  accent?: boolean;
  /** Already on a side — shows a gold ring + check and reads as "picked" (tap
   *  again to remove). Keeps the card in the pool so the grid never reflows. */
  added?: boolean;
  /** Web hover in/out — lets the picker preview this hero in the VS slot. */
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  /** Web only: view-transition-name to morph this card into the arena portrait. */
  vtName?: string;
  /** Long-press (touch) → open the hero peek without committing to a fight. */
  onLongPress?: () => void;
  /** Open the hero peek from the hover-revealed info chip (desktop web). */
  onInfo?: () => void;
}

/**
 * Shared roster tile for the opponent picker. Portrait fills the card with a
 * bottom scrim and the hero name; press (native) and hover (web) both lift it
 * via the same Pressable state, so the two platforms stay pixel-identical.
 */
function OpponentCardBase({
  item,
  onPress,
  width,
  height,
  fill,
  compact,
  accent,
  added,
  onHoverIn,
  onHoverOut,
  vtName,
  onLongPress,
  onInfo,
}: OpponentCardProps) {
  const sizeStyle = fill ? (styles.fill as object) : { width, height };

  // The info chip is a desktop-web affordance giving mouse users a discoverable
  // route to the peek (touch uses long-press). It reveals on card hover only
  // (one at a time, never plastered on every card) — kept mounted with an
  // opacity fade so it can't flicker out before a click.
  const showInfo = IS_WEB && !!onInfo;

  // Gentle skeleton pulse that sits BEHIND the image. expo-image fades in on
  // top of it and covers it once loaded, so the skeleton never lingers even if
  // an onLoad event is missed; onLoad just stops the animation to save cycles.
  // Reset the loaded flag when the card shows a different opponent. Adjusting
  // state during render (React's documented pattern) instead of an effect avoids
  // a frame where the new portrait shows without its skeleton.
  const [loaded, setLoaded] = useState(false);
  const [loadedFor, setLoadedFor] = useState(item.id);
  if (loadedFor !== item.id) {
    setLoadedFor(item.id);
    setLoaded(false);
  }

  const pulse = useSharedValue(0.65);
  useEffect(() => {
    if (loaded) {
      cancelAnimation(pulse);
      return;
    }
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 750 }), withTiming(0.65, { duration: 750 })),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [loaded, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.card,
          sizeStyle,
          accent && (styles.accent as object),
          hovered && (styles.hovered as object),
          pressed && styles.pressed,
          vtName ? ({ viewTransitionName: vtName } as object) : null,
        ] as object
      }
    >
      {({ hovered }: { pressed: boolean; hovered?: boolean }) => (
        <>
          {!loaded && (
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.skeleton as object, pulseStyle]}
            />
          )}
          <HeroImage
            id={item.id}
            name={item.name}
            imageUrl={item.image_url}
            portraitUrl={item.portrait_url}
            contentFit="cover"
            contentPosition="top"
            style={StyleSheet.absoluteFill}
            transition={250}
            onLoad={() => setLoaded(true)}
          />
          <View style={styles.scrim as object} />
          {added ? (
            <>
              {/* Gold ring + check so a picked hero stays visible in the pool and
                  reads as "on your team" — tapping again removes it. No reflow. */}
              <View style={styles.addedRing as object} pointerEvents="none" />
              <View style={styles.addedBadge} pointerEvents="none">
                <Ionicons name="checkmark" size={14} color="#1a130a" />
              </View>
            </>
          ) : null}
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
            {item.name}
          </Text>
          {showInfo && (
            <Pressable
              onPress={onInfo}
              accessibilityLabel={`About ${item.name}`}
              pointerEvents={hovered ? 'auto' : 'none'}
              style={({ hovered: chipHovered }: { pressed: boolean; hovered?: boolean }) =>
                [
                  styles.infoChip,
                  { opacity: hovered ? 1 : 0 },
                  chipHovered && (styles.infoChipHover as object),
                ] as object
              }
            >
              <Ionicons name="information" size={15} color={COLORS.beige} />
            </Pressable>
          )}
        </>
      )}
    </Pressable>
  );
}

/**
 * Memoised so the picker's hover-preview state can change without re-rendering
 * (and re-fetching the image of) every card — that re-render was the "flash".
 * The handler props only close over stable values, so they're safe to ignore.
 */
export const OpponentCard = memo(
  OpponentCardBase,
  (a, b) =>
    a.item.id === b.item.id &&
    a.width === b.width &&
    a.height === b.height &&
    a.fill === b.fill &&
    a.compact === b.compact &&
    a.accent === b.accent &&
    a.added === b.added &&
    a.vtName === b.vtName,
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
      } as object,
      default: {},
    }),
  },
  fill: { width: '100%', height: '100%' },
  skeleton: {
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(150deg, #20323a 0%, #2a3f48 50%, #20323a 100%)',
      } as object,
      default: { backgroundColor: '#26393f' },
    }),
  } as object,
  accent: { boxShadow: '0 0 0 2px rgba(206,155,51,0.7)' } as object,
  addedRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: COLORS.goldAccent,
  } as object,
  addedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.goldAccent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(0,0,0,0.4)' } as object,
      default: {},
    }),
  } as object,
  hovered: {
    transform: [{ translateY: -4 }],
    boxShadow: '0 18px 40px rgba(29,45,51,0.32)',
    zIndex: 2,
  } as object,
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.92 },
  scrim: {
    ...StyleSheet.absoluteFill,
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(to top, rgba(20,30,34,0.92) 0%, rgba(20,30,34,0.12) 52%, transparent 100%)',
      } as object,
      default: { backgroundColor: 'rgba(20,30,34,0.34)' },
    }),
  },
  name: {
    position: 'absolute',
    bottom: 11,
    left: 11,
    right: 11,
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.beige,
    lineHeight: 18,
    ...Platform.select({
      web: { textShadow: '0 1px 8px rgba(0,0,0,0.9)' } as object,
      default: {},
    }),
  },
  nameCompact: { fontSize: 13, lineHeight: 16, bottom: 9, left: 9, right: 9 },
  infoChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,14,10,0.55)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(245,235,220,0.4)',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'opacity 150ms ease, background-color 150ms ease',
      } as object,
      default: {},
    }),
  } as object,
  infoChipHover: { backgroundColor: 'rgba(18,14,10,0.8)' } as object,
});
