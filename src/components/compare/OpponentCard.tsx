import { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { heroImageSource } from '../../constants/heroImages';
import { COLORS } from '../../constants/colors';

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
  /** Web hover in/out — lets the picker preview this hero in the VS slot. */
  onHoverIn?: () => void;
  onHoverOut?: () => void;
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
  onHoverIn,
  onHoverOut,
}: OpponentCardProps) {
  const source = heroImageSource(item.id, item.image_url, item.portrait_url);
  const sizeStyle = fill ? (styles.fill as object) : { width, height };

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.card,
          sizeStyle,
          accent && (styles.accent as object),
          hovered && (styles.hovered as object),
          pressed && styles.pressed,
        ] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top center"
        style={StyleSheet.absoluteFill}
        placeholder={COLORS.navy}
        transition={150}
      />
      <View style={styles.scrim as object} />
      <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={2}>
        {item.name}
      </Text>
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
    a.accent === b.accent,
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
  accent: { boxShadow: '0 0 0 2px rgba(206,155,51,0.7)' } as object,
  hovered: {
    transform: [{ translateY: -4 }],
    boxShadow: '0 18px 40px rgba(29,45,51,0.32)',
    zIndex: 2,
  } as object,
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.92 },
  scrim: {
    ...StyleSheet.absoluteFillObject,
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
});
