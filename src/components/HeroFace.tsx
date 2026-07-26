import { View, StyleSheet, type ViewStyle } from 'react-native';
import { HeroAvatar } from './HeroAvatar';
import { HeroImage } from './HeroImage';

/**
 * A hero as a round face — the flat head icon where one exists, a cropped
 * portrait where it doesn't.
 *
 * The app is full of small circular hero slots: search suggestions, top-result
 * rows, the Hall of Fame list, trending leaderboards, campaign chip stacks.
 * Every one of them was cropping a rectangular portrait into a circle, which is
 * an approximation of a head — and at 34–56px an approximation is all it can
 * be, because the crop has to guess where the face is.
 *
 * The avatars ARE heads, drawn to be read at exactly this size. Where a
 * character has one this shows it; where they don't (only the famous tier is
 * covered) it falls back to the crop that was there before, so no slot ever
 * regresses to initials.
 *
 * The plate is ONLY for the fallback. A cropped rectangle has to be clipped to
 * a circle to read as a face at all; a cut-out head already is one, and putting
 * a disc behind it just adds a container the art doesn't need.
 */
export function HeroFace({
  id,
  name,
  avatarUrl,
  portraitUrl,
  imageUrl,
  imageMdUrl,
  blurhash,
  size,
  style,
}: {
  id: string;
  name: string;
  avatarUrl?: string | null;
  portraitUrl?: string | null;
  imageUrl?: string | null;
  imageMdUrl?: string | null;
  blurhash?: string | null;
  size: number;
  /** Extra styling for the plate — a ring, a border, a shadow. */
  style?: ViewStyle;
}) {
  const plate: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
  };

  if (avatarUrl) {
    return (
      <View style={[{ width: size, height: size }, styles.bare, style] as object}>
        <HeroAvatar id={id} name={name} avatarUrl={avatarUrl} size={size} bare />
      </View>
    );
  }

  return (
    <View style={[plate, styles.plate, style] as object}>
      <HeroImage
        id={id}
        name={name}
        imageUrl={imageUrl ?? null}
        portraitUrl={portraitUrl ?? null}
        imageMdUrl={imageMdUrl ?? null}
        blurhash={blurhash ?? null}
        grid
        contentFit="cover"
        // Faces sit high in a portrait, so a centred crop lands on the chest.
        contentPosition={{ top: '22%', left: '50%' }}
        style={StyleSheet.absoluteFill}
        recyclingKey={id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bare: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  plate: {
    backgroundColor: 'rgba(245,235,220,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
