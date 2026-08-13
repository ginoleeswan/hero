import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { COLORS, INK_TEXT, PAPER_TEXT } from '../../../constants/colors';
import { BrandLogoView } from '../../PublisherBadge';
import type { UniverseResult } from '../../../lib/db/universes';

// A brand chip for a universe search hit. Logo on a brand-tinted tile, name
// beside it; the whole row is a doorway into /universe/[slug]. Logos that read
// better on light get a light backing tile, mirroring the card-badge logic.
// Renders via the shared BrandLogoView so SVG-component and PNG logos (and
// single-colour tinted marks) all paint correctly.
// The tile is 38px; leave a little breathing room so marks never kiss the edge.
const TILE_CONTENT = 30;

/** Scale a box down to fit within a square `max`, preserving aspect ratio.
 *  Never scales up — small marks keep their tuned size. */
function fitWithin(box: { width: number; height: number }, max: number) {
  const scale = Math.min(max / box.width, max / box.height, 1);
  return { width: box.width * scale, height: box.height * scale };
}

export function UniverseChip({
  universe,
  onPress,
  variant = 'dark',
  active = false,
}: {
  universe: UniverseResult;
  onPress: () => void;
  /** 'dark' for the palette panel (beige text); 'light' for the beige results page (navy text). */
  variant?: 'dark' | 'light';
  /** Highlighted by the palette's keyboard cursor — renders like a hover. */
  active?: boolean;
}) {
  const { name, color, logo, badgeSize, logoOnLight, logoTint } = universe;
  const light = variant === 'light';
  // badgeSize is tuned for the small card-overlay badge and can be wider/taller
  // than this chip's 38px tile (e.g. Looney Tunes 100×48). Scale it down to fit
  // a fixed content box, preserving aspect ratio, so every mark sits inside.
  const fitted = badgeSize ? fitWithin(badgeSize, TILE_CONTENT) : undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`Browse the ${name} universe`}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.row,
          (hovered || active) && ((light ? styles.rowHoverLight : styles.rowHover) as object),
        ] as object
      }
    >
      <View
        style={[styles.tile, { backgroundColor: logoOnLight ? COLORS.beige : color }] as object}
      >
        {logo && fitted ? (
          <BrandLogoView logo={logo} width={fitted.width} height={fitted.height} tint={logoTint} />
        ) : (
          <Text style={styles.fallback as object} numberOfLines={1}>
            {name.slice(0, 2).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.text}>
        <Text
          style={[styles.name, light && (styles.nameLight as object)] as object}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={[styles.kicker, light && (styles.kickerLight as object)] as object}>
          Universe
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  rowHover: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  rowHoverLight: { backgroundColor: 'rgba(29,45,51,0.08)' } as object,
  tile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as object,
  text: { flexDirection: 'column' },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.beige } as object,
  nameLight: { color: COLORS.navy } as object,
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: INK_TEXT.faint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  } as object,
  kickerLight: { color: PAPER_TEXT.faint } as object,
  fallback: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy } as object,
});
